import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { chatCompletion, LLMMessage } from './util/llm';
import { retrieveKb } from './kb';

// 被 @ 的角色「基于上下文」回应：玩家传话 → 角色读取自身设定 + 近况 + 与该玩家的来往 → 第一人称简短回复。
// 回复作为「未读」通知落回时间流，红点提醒玩家。

type ReplyContext = {
  name: string;
  identity: string;
  plan: string;
  ambient: string[]; // 全城最近的公开发言
  dialogue: { role: 'user' | 'assistant'; text: string }[]; // 玩家与该角色的来往
};

// 收集回复所需的全部上下文；若 targetName 不是世界里的 AI 角色则返回 null。
export const gatherContext = internalQuery({
  args: { worldId: v.id('worlds'), userId: v.string(), targetName: v.string() },
  handler: async (ctx, { worldId, userId, targetName }): Promise<ReplyContext | null> => {
    const world = await ctx.db.get(worldId);
    if (!world) return null;

    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const desc = descriptions.find((d) => d.name === targetName);
    if (!desc) return null;

    const player = world.players.find((p) => p.id === desc.playerId);
    if (!player || player.human) return null; // 只有 AI 角色才回应
    const agent = world.agents.find((a) => a.playerId === desc.playerId);
    if (!agent) return null;
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agent.id))
      .first();
    if (!agentDescription) return null;

    // 全城最近公开发言（环境氛围）。
    const allMsgs = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', worldId))
      .collect();
    allMsgs.sort((a, b) => a._creationTime - b._creationTime);
    const ambient = allMsgs.slice(-6).map((m) => m.text);

    // 该玩家与此角色的来往（传话 + 角色回复），按时间正序拼成对话历史。
    const notes = await ctx.db
      .query('notifications')
      .withIndex('recent', (q) => q.eq('userId', userId))
      .order('desc')
      .take(40);
    const dialogue = notes
      .filter(
        (n) =>
          (n.kind === 'user_said' && n.targetName === targetName) ||
          (n.kind === 'ai_reply' && n.actorName === targetName),
      )
      .reverse()
      .slice(-8)
      .map((n) => ({ role: n.kind === 'user_said' ? ('user' as const) : ('assistant' as const), text: n.text }));

    return {
      name: desc.name,
      identity: agentDescription.identity,
      plan: agentDescription.plan,
      ambient,
      dialogue,
    };
  },
});

export const insertReply = internalMutation({
  args: { worldId: v.id('worlds'), userId: v.string(), actorName: v.string(), text: v.string() },
  handler: async (ctx, { worldId, userId, actorName, text }) => {
    await ctx.db.insert('notifications', {
      userId,
      worldId,
      kind: 'ai_reply',
      actorName,
      text,
      read: false, // 角色的回应需要提醒玩家
      createdAt: Date.now(),
    });
  },
});

export const replyAsCharacter = internalAction({
  args: { worldId: v.id('worlds'), userId: v.string(), targetName: v.string() },
  handler: async (ctx, { worldId, userId, targetName }) => {
    const c = await ctx.runQuery(internal.aiReply.gatherContext, { worldId, userId, targetName });
    if (!c) return; // 目标不是 AI 角色，静默忽略

    // RAG：以玩家最新一句为查询，检索候鸟300知识库。
    const lastUser = [...c.dialogue].reverse().find((t) => t.role === 'user')?.text ?? '';
    const kb = await retrieveKb(ctx, lastUser, 4);
    const kbBlock = kb.length
      ? `\n关于候鸟300大会，以下是可参考的资料（请据此作答，不要编造；若资料未涵盖就坦诚说不确定）：\n` +
        kb.map((c, i) => `[${i + 1}] (${c.title}) ${c.text}`).join('\n') +
        `\n`
      : '';

    const system =
      `你是「${c.name}」，沙城（候鸟300艺术节）里的居民。\n` +
      `你的身份：${c.identity}\n` +
      `你当下的计划：${c.plan}\n` +
      (c.ambient.length ? `此刻城里的人们在说：${c.ambient.join('；')}\n` : '') +
      kbBlock +
      `有人正隔空向你传话。请以「${c.name}」的第一人称、自然口语地回应，1-3 句，` +
      `贴合你的身份与语气，结合上面候鸟300的资料作答，不要复述对方的话，不要加引号或旁白。`;

    const messages: LLMMessage[] = [{ role: 'system', content: system }];
    for (const turn of c.dialogue) messages.push({ role: turn.role, content: turn.text });

    let reply = '';
    try {
      const { content } = await chatCompletion({ messages, max_tokens: 220, temperature: 0.9 });
      reply = (content as string).trim();
    } catch (e) {
      console.error('[aiReply] chatCompletion failed', e);
      return;
    }
    if (!reply) return;

    await ctx.runMutation(internal.aiReply.insertReply, {
      worldId,
      userId,
      actorName: c.name,
      text: reply.slice(0, 500),
    });
  },
});
