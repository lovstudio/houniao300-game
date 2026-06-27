import { v } from 'convex/values';
import {
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { generateImageTraced } from './util/image';
import { uploadToQiniu } from './util/qiniu';

const contextValidator = v.optional(
  v.object({
    activityKey: v.optional(v.string()),
    activityTitle: v.optional(v.string()),
    venue: v.optional(v.string()),
    contextLabel: v.optional(v.string()),
  }),
);

function compact(value: string | undefined, max = 48): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function normalizeTitle(title: string, fallback: string | undefined): string {
  return compact(title, 32) ?? compact(fallback, 32) ?? '沙城照片';
}

function buildPrompt(args: {
  title: string;
  activityTitle?: string;
  venue?: string;
  contextLabel?: string;
  userPrompt?: string; // 累积的文字上下文（追问时把历轮拼接进来）
  useSystemStyle?: boolean; // 默认 true：套用沙之书母题；false：仅保人物身份，场景/风格交给 userPrompt
}) {
  const context = [
    args.activityTitle ? `festival activity: ${args.activityTitle}` : null,
    args.venue ? `venue: ${args.venue}` : null,
    args.contextLabel ? `current place: ${args.contextLabel}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // 关闭系统风格：只保住"这是这个人的照片"的身份底线，其余场景/风格完全交给用户提示词。
  if (args.useSystemStyle === false) {
    return [
      `Reimagine the uploaded real-world photo into a new artwork titled "${args.title}".`,
      'Keep the main people, their identity and faces clearly recognizable from the original photo.',
      args.userPrompt
        ? `Follow the visitor's creative direction for scene and style: ${args.userPrompt}.`
        : 'The visitor gave no direction; produce a tasteful, imaginative reinterpretation.',
      'No readable text, watermark, logo, UI, or caption.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `Transform the uploaded real-world photo into a "Book of Sand" memory image titled "${args.title}".`,
    'Preserve the main people, poses, facial direction, camera angle, and recognizable composition of the original photo.',
    'Rebuild the scene as a cinematic sand-sculpture diorama from the 沙之书 world: carved sand figures, granular texture, warm coastal dusk, sea wind, tent lights, miniature festival architecture, subtle magical realism.',
    context ? `Anchor the image to this context: ${context}.` : 'Anchor the image to 候鸟沙城, a temporary coastal festival city made of sand.',
    // 访客的可选创作指令：在沙之书母题内做调整，但不得违背"保留真人主体/构图"与"无文字"等硬约束。
    args.userPrompt
      ? `Honor this creative direction from the visitor while keeping the sand-sculpture style and the people recognizable: ${args.userPrompt}.`
      : null,
    'Use a refined storybook frame, tactile sand material, golden shadows, and no readable text, watermark, logo, UI, or caption.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function resolveImageUrl(
  ctx: QueryCtx,
  item: { imageUrl?: string; imageStorageId?: string },
): Promise<string | null> {
  if (item.imageUrl) return item.imageUrl;
  if (item.imageStorageId) return await ctx.storage.getUrl(item.imageStorageId);
  return null;
}

async function resolvePhotoMemory(ctx: QueryCtx, item: Doc<'photoMemories'>) {
  return {
    ...item,
    imageUrl: await resolveImageUrl(ctx, item),
    originalUrl: await ctx.storage.getUrl(item.originalStorageId),
  };
}

// 把生成图优先转存七牛 CDN（imageUrl），失败回退 Convex storage（imageStorageId），绝不漏图。
async function storeGenerated(
  ctx: ActionCtx,
  blob: Blob,
): Promise<{ imageUrl?: string; imageStorageId?: string }> {
  const t = Date.now();
  try {
    const unique = `photo-memories/${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const url = await uploadToQiniu(blob, unique);
    console.log(`[DEBUG][photo] storeGenerated 七牛上传成功: ms=${Date.now() - t} outKB=${Math.round(blob.size / 1024)}`);
    return { imageUrl: url };
  } catch (e) {
    console.error(`[DEBUG][photo] 七牛上传失败回退 Convex storage: ms=${Date.now() - t}`, e);
    const id = await ctx.storage.store(blob);
    console.log(`[DEBUG][photo] storeGenerated Convex storage 兜底: 总ms=${Date.now() - t}`);
    return { imageStorageId: id };
  }
}

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// 插入记忆 + 首轮 turn，调度后台生成。前端拿到 memoryId 后订阅 getPhotoConversation 看进度，
// 不再 await 长 action（图像生成 20-60s，over-WS 等待易因重连丢失 → "action in flight 连接丢失"）。
export const createPhotoMemory = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    originalStorageId: v.string(),
    sharePublic: v.boolean(),
    context: contextValidator,
    userPrompt: v.optional(v.string()),
    useSystemStyle: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ memoryId: Id<'photoMemories'> }> => {
    const now = Date.now();
    const title = normalizeTitle(args.title, args.context?.activityTitle ?? args.context?.venue);
    const useSystemStyle = args.useSystemStyle ?? true;
    const memoryId = await ctx.db.insert('photoMemories', {
      userId: args.userId,
      userName: compact(args.userName, 24) ?? '候鸟',
      title,
      sourceType: 'photo',
      originalStorageId: args.originalStorageId,
      activityKey: args.context?.activityKey,
      activityTitle: compact(args.context?.activityTitle, 120),
      venue: compact(args.context?.venue, 48),
      contextLabel: compact(args.context?.contextLabel, 80),
      userPrompt: compact(args.userPrompt, 280),
      useSystemStyle,
      status: 'pending',
      shared: args.sharePublic,
      sharedAt: args.sharePublic ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    const turnId = await ctx.db.insert('photoMemoryTurns', {
      memoryId,
      index: 0,
      userPrompt: compact(args.userPrompt, 280),
      useSystemStyle,
      status: 'pending',
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.photoMemories.runGeneration, { turnId });
    return { memoryId };
  },
});

// 追问：在同一条记忆上追加一轮 turn（不覆盖历史），始终以原图为参考、累积文字上下文。
export const askPhotoMemory = mutation({
  args: {
    memoryId: v.id('photoMemories'),
    userId: v.string(),
    userPrompt: v.string(),
    useSystemStyle: v.optional(v.boolean()),
  },
  handler: async (ctx, { memoryId, userId, userPrompt, useSystemStyle }): Promise<{ turnId: Id<'photoMemoryTurns'> }> => {
    const memory = await ctx.db.get(memoryId);
    if (!memory || memory.userId !== userId) throw new Error('照片记忆不存在或无权调整');
    const turns = await ctx.db
      .query('photoMemoryTurns')
      .withIndex('memoryId', (q) => q.eq('memoryId', memoryId))
      .collect();
    const nextIndex = turns.reduce((m, t) => Math.max(m, t.index), -1) + 1;
    const turnId = await ctx.db.insert('photoMemoryTurns', {
      memoryId,
      index: nextIndex,
      userPrompt: compact(userPrompt, 280),
      useSystemStyle: useSystemStyle ?? memory.useSystemStyle ?? true,
      status: 'pending',
      createdAt: Date.now(),
    });
    await ctx.db.patch(memoryId, { status: 'pending', updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.photoMemories.runGeneration, { turnId });
    return { turnId };
  },
});

// 后台生成单个 turn 的输入：该 turn + 记忆 + 截至该 turn 的累积提示词上下文。
export const turnInput = internalQuery({
  args: { turnId: v.id('photoMemoryTurns') },
  handler: async (ctx, { turnId }) => {
    const turn = await ctx.db.get(turnId);
    if (!turn) return null;
    const memory = await ctx.db.get(turn.memoryId);
    if (!memory) return null;
    const turns = await ctx.db
      .query('photoMemoryTurns')
      .withIndex('memoryId', (q) => q.eq('memoryId', turn.memoryId))
      .collect();
    // 累积上下文：截至本轮（含）所有非空提示词，按 index 顺序拼接。
    const accumulatedPrompt = turns
      .filter((t) => t.index <= turn.index)
      .sort((a, b) => a.index - b.index)
      .map((t) => t.userPrompt?.trim())
      .filter(Boolean)
      .join('; ');
    return { turn, memory, accumulatedPrompt };
  },
});

export const setTurnResult = internalMutation({
  args: {
    turnId: v.id('photoMemoryTurns'),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    trace: v.optional(v.string()),
  },
  handler: async (ctx, { turnId, imageUrl, imageStorageId, trace }) => {
    await ctx.db.patch(turnId, { status: 'ready', imageUrl, imageStorageId, trace });
  },
});

export const setTurnFailed = internalMutation({
  args: { turnId: v.id('photoMemoryTurns'), trace: v.optional(v.string()) },
  handler: async (ctx, { turnId, trace }) => {
    await ctx.db.patch(turnId, { status: 'failed', trace });
  },
});

// 让记忆行的代表图/状态跟随"最新一张就绪的 turn"（相册卡片、体验主角参考都读这里）。
export const syncMemoryFromTurns = internalMutation({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }) => {
    const turns = await ctx.db
      .query('photoMemoryTurns')
      .withIndex('memoryId', (q) => q.eq('memoryId', memoryId))
      .collect();
    if (turns.length === 0) return;
    turns.sort((a, b) => a.index - b.index);
    const latest = turns[turns.length - 1];
    const lastReady = [...turns].reverse().find((t) => t.status === 'ready');
    const patch: Partial<Doc<'photoMemories'>> = { updatedAt: Date.now() };
    if (latest.status === 'pending') {
      patch.status = 'pending'; // 保留现有代表图
    } else if (lastReady) {
      patch.status = 'ready';
      patch.imageUrl = lastReady.imageUrl;
      patch.imageStorageId = lastReady.imageStorageId;
    } else {
      patch.status = 'failed';
    }
    await ctx.db.patch(memoryId, patch);
  },
});

// 后台生成一个 turn：读原图 + 累积提示词 → 文生图 → 转存 → 回填该 turn + 同步记忆代表图。
export const runGeneration = internalAction({
  args: { turnId: v.id('photoMemoryTurns') },
  handler: async (ctx, { turnId }) => {
    const tAll = Date.now();
    const input = await ctx.runQuery(internal.photoMemories.turnInput, { turnId });
    if (!input) return;
    const { turn, memory, accumulatedPrompt } = input;
    let trace: string | undefined;
    try {
      const tSrc = Date.now();
      const source = await ctx.storage.get(memory.originalStorageId);
      if (!source) throw new Error('原图不可用');
      console.log(
        `[DEBUG][photo] runGeneration turn#${turn.index} 取原图: getMs=${Date.now() - tSrc} sourceKB=${Math.round(source.size / 1024)} useSystemStyle=${turn.useSystemStyle} memoryId=${memory._id}`,
      );
      const prompt = buildPrompt({
        title: memory.title,
        activityTitle: compact(memory.activityTitle, 80),
        venue: compact(memory.venue, 48),
        contextLabel: compact(memory.contextLabel, 80),
        userPrompt: accumulatedPrompt || undefined,
        useSystemStyle: turn.useSystemStyle,
      });
      const { blob, trace: imgTrace } = await generateImageTraced(prompt, source);
      const tStore = Date.now();
      const { imageUrl, imageStorageId } = await storeGenerated(ctx, blob);
      const storeMs = Date.now() - tStore;
      trace = JSON.stringify({
        ...imgTrace,
        sourceKB: Math.round(source.size / 1024),
        storeMs,
        totalMs: Date.now() - tAll,
        useSystemStyle: turn.useSystemStyle,
      });
      await ctx.runMutation(internal.photoMemories.setTurnResult, {
        turnId,
        imageUrl,
        imageStorageId,
        trace,
      });
      console.log(
        `[DEBUG][photo] runGeneration turn#${turn.index} 完成: 总ms=${Date.now() - tAll} 文生图ms=${imgTrace.apiMs} retries=${imgTrace.retries} 转存ms=${storeMs}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      trace = JSON.stringify({ error: msg, totalMs: Date.now() - tAll });
      console.error(`[DEBUG][photo] runGeneration turn#${turn.index} 失败: 总ms=${Date.now() - tAll}`, e);
      await ctx.runMutation(internal.photoMemories.setTurnFailed, { turnId, trace });
    }
    await ctx.runMutation(internal.photoMemories.syncMemoryFromTurns, { memoryId: memory._id });
  },
});

// 前端订阅一条记忆的完整"追问对话"：记忆基本信息 + 按序的每轮（提示词/图/状态/trace）。
export const getPhotoConversation = query({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }) => {
    const m = await ctx.db.get(memoryId);
    if (!m) return null;
    const turnsRaw = await ctx.db
      .query('photoMemoryTurns')
      .withIndex('memoryId', (q) => q.eq('memoryId', memoryId))
      .collect();
    turnsRaw.sort((a, b) => a.index - b.index);
    const turns = await Promise.all(
      turnsRaw.map(async (t) => ({
        _id: t._id,
        index: t.index,
        userPrompt: t.userPrompt ?? null,
        useSystemStyle: t.useSystemStyle,
        status: t.status,
        imageUrl: await resolveImageUrl(ctx, t),
        trace: t.trace ?? null,
        createdAt: t.createdAt,
      })),
    );
    return {
      _id: m._id,
      title: m.title,
      shared: m.shared,
      useSystemStyle: m.useSystemStyle ?? true,
      status: m.status ?? (m.imageUrl || m.imageStorageId ? 'ready' : 'pending'),
      turns,
    };
  },
});

export const listMyPhotoMemories = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(80);
    return await Promise.all(items.map((item) => resolvePhotoMemory(ctx, item)));
  },
});

export const listSharedPhotoMemories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('shared', (q) => q.eq('shared', true))
      .order('desc')
      .take(80);
    return await Promise.all(items.map((item) => resolvePhotoMemory(ctx, item)));
  },
});

export const recentSharedPhotoMemories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('shared', (q) => q.eq('shared', true))
      .order('desc')
      .take(8);
    return items.map((item) => ({
      _id: item._id,
      userId: item.userId,
      userName: item.userName,
      title: item.title,
      createdAt: item.createdAt,
      activityTitle: item.activityTitle,
      venue: item.venue,
    }));
  },
});

// 内部：取某用户在某作品/活动下最新一张照片记忆的生成图定位，喂给该活动专属体验当主角参考。
export const latestMemoryForActivity = internalQuery({
  args: { activityKey: v.string(), userId: v.string() },
  handler: async (
    ctx,
    { activityKey, userId },
  ): Promise<{ imageStorageId: string | null; imageUrl: string | null } | null> => {
    // 取最新一张"已出图"的记忆（跳过 pending/failed），作为主角参考。
    const recent = await ctx.db
      .query('photoMemories')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .order('desc')
      .filter((q) => q.eq(q.field('activityKey'), activityKey))
      .take(10);
    const item = recent.find((m) => m.imageUrl || m.imageStorageId);
    if (!item) return null;
    return { imageStorageId: item.imageStorageId ?? null, imageUrl: item.imageUrl ?? null };
  },
});

export const setPhotoMemoryShared = mutation({
  args: {
    memoryId: v.id('photoMemories'),
    userId: v.string(),
    shared: v.boolean(),
  },
  handler: async (ctx, { memoryId, userId, shared }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) throw new Error('照片记忆不存在');
    if (memory.userId !== userId) throw new Error('只能修改自己的照片记忆');
    await ctx.db.patch(memoryId, {
      shared,
      sharedAt: shared ? (memory.sharedAt ?? Date.now()) : undefined,
      updatedAt: Date.now(),
    });
  },
});
