import { v } from 'convex/values';
import { query, mutation, action, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { chatCompletion } from './util/llm';
import { generateImage } from './util/image';

// ============================================================
// 导演（LLM）：基于活动背景 + 历史问答，决定下一格连环画。
// 单次 LLM 调用，输出 JSON。不依赖 response_format 以兼容各网关。
// ============================================================
type DirectorStep = {
  imagePrompt: string;
  narration: string;
  question?: string;
  options?: string[];
  allowCustom?: boolean;
  final?: boolean;
  badgeTitle?: string;
  badgeSummary?: string;
};

function parseJson(content: string): DirectorStep {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned);
}

async function director(
  event: Doc<'events'>,
  history: { narration: string; question?: string; answer?: string }[],
  opts: { stepIndex: number; minPanels: number; maxPanels: number; forceFinal: boolean },
): Promise<DirectorStep> {
  const system = [
    '你是一个沉浸式 AIGC 互动连环画的"导演"。你为用户即时编织一条独一无二的视觉叙事线。',
    '每一步你产出：一张图片的提示词、一段中文旁白、以及（除非收尾）一个面向用户的问题和若干选项。',
    '严格只输出一个 JSON 对象，不要 markdown、不要多余文字。字段：',
    '  imagePrompt: string  // 英文，详尽的文生图提示词，必须融入活动风格并与前几格保持视觉连贯',
    `  narration: string    // 1-3 句中文旁白，推进剧情`,
    '  question: string     // 中文，引导用户做出影响后续走向的选择（收尾格省略）',
    '  options: string[]    // 3-4 个中文选项（收尾格省略）',
    '  allowCustom: boolean // 是否允许用户自定义输入（收尾格省略）',
    '  final: boolean       // 是否为收尾格',
    '  badgeTitle: string   // 仅收尾格：为这段独特经历命名一枚勋章（4-8 字）',
    '  badgeSummary: string // 仅收尾格：一句话总结用户这趟体验',
    `视觉风格固定为：${event.style}`,
    '关键：每一格都必须实质推进剧情——出现新的场景、转折或人物，绝不能重复上一格的旁白或画面。imagePrompt 也要随之变化。',
    `当一段完整、有起承转合的体验已经达成（且至少进行了 ${opts.minPanels} 格）时，可主动收尾（final=true）。`,
  ].join('\n');

  const user = JSON.stringify({
    活动: { 标题: event.title, 主题: event.theme, 背景: event.background },
    历史: history,
    当前第几格: opts.stepIndex,
    最多格数: opts.maxPanels,
    必须收尾: opts.forceFinal,
  });

  const { content } = await chatCompletion({
    // 叙事质量是体验的核心，默认用高质量模型（可用 DIRECTOR_MODEL 覆盖）。
    model: process.env.DIRECTOR_MODEL ?? 'anthropic/claude-sonnet-4.6',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.9,
    max_tokens: 800,
  });
  return parseJson(content as string);
}

// ============================================================
// 内部 mutation / query
// ============================================================
export const getEvent = internalQuery({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => await ctx.db.get(eventId),
});

export const createExperience = internalMutation({
  args: { eventId: v.id('events'), userId: v.string(), userName: v.string() },
  handler: async (ctx, args) =>
    await ctx.db.insert('experiences', {
      eventId: args.eventId,
      userId: args.userId,
      userName: args.userName,
      status: 'active',
      startedAt: Date.now(),
    }),
});

export const insertPanel = internalMutation({
  args: {
    experienceId: v.id('experiences'),
    index: v.number(),
    imagePrompt: v.string(),
    narration: v.string(),
    question: v.optional(v.string()),
    options: v.array(v.string()),
    allowCustom: v.boolean(),
    isFinal: v.boolean(),
  },
  handler: async (ctx, args) => await ctx.db.insert('panels', args),
});

export const setPanelImage = internalMutation({
  args: { panelId: v.id('panels'), imageStorageId: v.string() },
  handler: async (ctx, { panelId, imageStorageId }) =>
    await ctx.db.patch(panelId, { imageStorageId }),
});

export const setAnswer = internalMutation({
  args: { panelId: v.id('panels'), answer: v.string() },
  handler: async (ctx, { panelId, answer }) => await ctx.db.patch(panelId, { answer }),
});

export const awardBadge = internalMutation({
  args: {
    experienceId: v.id('experiences'),
    title: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { experienceId, title, summary }) => {
    const exp = await ctx.db.get(experienceId);
    if (!exp) throw new Error('experience 不存在');
    await ctx.db.patch(experienceId, { status: 'completed', completedAt: Date.now() });
    await ctx.db.insert('badges', {
      eventId: exp.eventId,
      experienceId,
      userId: exp.userId,
      userName: exp.userName,
      title,
      summary,
      awardedAt: Date.now(),
    });
  },
});

export const experienceState = internalQuery({
  args: { experienceId: v.id('experiences') },
  handler: async (ctx, { experienceId }) => {
    const experience = await ctx.db.get(experienceId);
    if (!experience) throw new Error('experience 不存在');
    const event = await ctx.db.get(experience.eventId);
    if (!event) throw new Error('event 不存在');
    const panels = await ctx.db
      .query('panels')
      .withIndex('experienceId', (q) => q.eq('experienceId', experienceId))
      .collect();
    panels.sort((a, b) => a.index - b.index);
    return { experience, event, panels };
  },
});

// ============================================================
// 公开 query
// ============================================================
export const listEvents = query({
  handler: async (ctx) =>
    await ctx.db
      .query('events')
      .filter((q) => q.eq(q.field('active'), true))
      .collect(),
});

export const getExperience = query({
  args: { experienceId: v.id('experiences') },
  handler: async (ctx, { experienceId }) => {
    const experience = await ctx.db.get(experienceId);
    if (!experience) return null;
    const event = await ctx.db.get(experience.eventId);
    const panelsRaw = await ctx.db
      .query('panels')
      .withIndex('experienceId', (q) => q.eq('experienceId', experienceId))
      .collect();
    panelsRaw.sort((a, b) => a.index - b.index);
    const panels = await Promise.all(
      panelsRaw.map(async (p) => ({
        ...p,
        imageUrl: p.imageStorageId ? await ctx.storage.getUrl(p.imageStorageId) : null,
      })),
    );
    const badge = await ctx.db
      .query('badges')
      .withIndex('eventId', (q) => q.eq('eventId', experience.eventId))
      .filter((q) => q.eq(q.field('experienceId'), experienceId))
      .first();
    return { experience, event, panels, badge };
  },
});

export const listBadges = query({
  handler: async (ctx) => {
    const badges = await ctx.db.query('badges').order('desc').take(100);
    return await Promise.all(
      badges.map(async (b) => {
        const event = await ctx.db.get(b.eventId);
        return { ...b, eventTitle: event?.title ?? '' };
      }),
    );
  },
});

// ============================================================
// 公开 mutation：开发期种子数据
// ============================================================
export const seedDemoEvent = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query('events').first();
    if (existing) return existing._id;
    return await ctx.db.insert('events', {
      title: '候鸟沙城·迁徙之约',
      theme: '一只候鸟跨越山海、寻找栖息地的旅程',
      style:
        'cinematic sand-sculpture diorama, warm golden hour light, fine sand grain texture, soft depth of field, dreamy storybook mood',
      background:
        '候鸟沙城是一座由风与沙塑成的临时之城，每年迁徙季短暂浮现。旅人将化身一只候鸟，在沙之城邦中做出选择，遇见同行者，最终找到属于自己的栖息之地。',
      hostName: '候鸟工作室',
      minPanels: 5,
      maxPanels: 8,
      active: true,
    });
  },
});

// ============================================================
// 公开 action：核心交互闭环
// ============================================================
export const startExperience = action({
  args: { eventId: v.id('events'), userId: v.string(), userName: v.string() },
  handler: async (ctx, { eventId, userId, userName }): Promise<Id<'experiences'>> => {
    const event = await ctx.runQuery(internal.experience.getEvent, { eventId });
    if (!event) throw new Error('event 不存在');

    const experienceId = await ctx.runMutation(internal.experience.createExperience, {
      eventId,
      userId,
      userName,
    });

    const step = await director(event, [], {
      stepIndex: 0,
      minPanels: event.minPanels,
      maxPanels: event.maxPanels,
      forceFinal: false,
    });
    const panelId = await ctx.runMutation(internal.experience.insertPanel, {
      experienceId,
      index: 0,
      imagePrompt: step.imagePrompt,
      narration: step.narration,
      question: step.question,
      options: step.options ?? [],
      allowCustom: step.allowCustom ?? true,
      isFinal: false,
    });
    const blob = await generateImage(step.imagePrompt);
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.experience.setPanelImage, { panelId, imageStorageId: storageId });
    return experienceId;
  },
});

export const answerPanel = action({
  args: { experienceId: v.id('experiences'), answer: v.string() },
  handler: async (ctx, { experienceId, answer }): Promise<void> => {
    const state = await ctx.runQuery(internal.experience.experienceState, { experienceId });
    if (state.experience.status === 'completed') return;
    const { event, panels } = state;
    const last = panels[panels.length - 1];
    if (!last || last.isFinal) return;

    await ctx.runMutation(internal.experience.setAnswer, { panelId: last._id, answer });

    const history = panels.map((p) => ({
      narration: p.narration,
      question: p.question,
      answer: p._id === last._id ? answer : p.answer,
    }));
    const nextIndex = panels.length;
    const forceFinal = nextIndex >= event.maxPanels - 1;

    const step = await director(event, history, {
      stepIndex: nextIndex,
      minPanels: event.minPanels,
      maxPanels: event.maxPanels,
      forceFinal,
    });
    const isFinal = forceFinal || (!!step.final && nextIndex >= event.minPanels - 1);

    const panelId = await ctx.runMutation(internal.experience.insertPanel, {
      experienceId,
      index: nextIndex,
      imagePrompt: step.imagePrompt,
      narration: step.narration,
      question: isFinal ? undefined : step.question,
      options: isFinal ? [] : step.options ?? [],
      allowCustom: isFinal ? false : step.allowCustom ?? true,
      isFinal,
    });
    const blob = await generateImage(step.imagePrompt);
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.experience.setPanelImage, { panelId, imageStorageId: storageId });

    if (isFinal) {
      await ctx.runMutation(internal.experience.awardBadge, {
        experienceId,
        title: step.badgeTitle ?? `${event.title}·体验者`,
        summary: step.badgeSummary ?? '完成了一段独一无二的旅程。',
      });
    }
  },
});
