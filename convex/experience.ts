import { v } from 'convex/values';
import { query, mutation, action, internalAction, internalMutation, internalQuery, ActionCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { chatCompletion } from './util/llm';
import { generateImageTraced, ImageTrace } from './util/image';
import { newRequestId, storeGeneratedImage } from './util/generation';

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
  protagonist?: string; // 仅首格：一句英文主角外形锚定（贯穿全程，锁定同一人）
};

function parseJson(content: string): DirectorStep {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const raw = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(raw);
  } catch {
    // 容忍模型偶发的尾逗号（temperature 较高 + CJK 内容时常见）。
    return JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1'));
  }
}

// 候鸟300 是真实发生在海边的艺术节现场——故事必须锚定到评委与观众脚下这片沙地。
const FESTIVAL_SITE =
  '候鸟300 是真实发生在海边沙滩上的艺术节现场：连绵的帐篷营区、一级与二级城墙、戏剧大本营、时间广场、被海风与潮声包围的沙地、夜里的篝火与灯串。';

// 命名结局原型：导演据用户累积选择倾向收束到其一，结局名写进勋章，给"我是 X 型"的身份感。
// 这样"再玩一次（全新结局）"才名副其实。
const ENDING_ARCHETYPES = [
  '沙城常住候鸟｜选择留下，把这片海当成家',
  '带着遗憾离开｜错过了什么，却在转身时释怀',
  '这场戏的主角｜从旁观者变成被众人看见的人',
  '偷沙的旅人｜只带走一粒沙，藏起一个私密的纪念',
  '把名字写进风里｜燃烧过、参与过，然后轻轻消失',
];

// badgeTitle 必须收敛到这 5 个命名原型之一（｜前那段），结局墙才能干净地按类型聚合。
// 单一真相源：从 ENDING_ARCHETYPES 派生，不另维护重复列表。
const ENDING_NAMES = ENDING_ARCHETYPES.map((e) => e.split('｜')[0].trim());

function validateStep(step: DirectorStep, willFinal: boolean): string | null {
  if (!step.imagePrompt?.trim() || !step.narration?.trim()) return '缺少 imagePrompt 或 narration';
  if (willFinal) {
    if (!step.badgeTitle?.trim() || !step.badgeSummary?.trim()) return '收尾格缺少 badgeTitle/badgeSummary';
    // 结局名强约束：必须逐字命中 5 个原型名之一，否则触发重试（题词 badgeSummary 不限内容）。
    if (!ENDING_NAMES.includes(step.badgeTitle.trim())) {
      return `badgeTitle「${step.badgeTitle.trim()}」不在命名原型内，必须逐字取自：${ENDING_NAMES.join('、')}`;
    }
  } else if (!step.question?.trim() || !step.options || step.options.length < 2) {
    return '非收尾格缺少 question 或 options';
  }
  return null;
}

async function director(
  event: Doc<'events'>,
  history: { narration: string; question?: string; answer?: string }[],
  opts: {
    stepIndex: number;
    minPanels: number;
    maxPanels: number;
    forceFinal: boolean;
    protagonistDesc?: string;
  },
): Promise<DirectorStep> {
  const isFirst = opts.stepIndex === 0;
  const venue = event.hostName || '候鸟沙城';
  const system = [
    '你是一个沉浸式 AIGC 互动连环画的"导演"。你为真实身处海边艺术节现场的用户即时编织一条独一无二的视觉叙事线。',
    '每一步你产出：一张图片的提示词、一段中文旁白、以及（除非收尾）一个面向用户的问题和若干选项。',
    '严格只输出一个 JSON 对象，不要 markdown、不要多余文字。字段：',
    '  imagePrompt: string  // 英文，详尽的文生图提示词，必须融入活动风格并与前几格保持视觉连贯',
    `  narration: string    // 1-3 句中文旁白，推进剧情`,
    '  question: string     // 中文，引导用户做出影响后续走向的选择（收尾格省略）',
    '  options: string[]    // 3-4 个中文选项（收尾格省略）',
    '  allowCustom: boolean // 是否允许用户自定义输入（收尾格省略）',
    '  final: boolean       // 是否为收尾格',
    '  badgeTitle: string   // 仅收尾格：必须逐字等于下方某个命名原型的"结局名"（｜前那段），原样复制，不得自创、不得加标点',
    '  badgeSummary: string // 仅收尾格：一句可当签名档的题词（≤20 字，诗性/反差/留白，禁止套话）',
    ...(isFirst
      ? [
          '  protagonist: string  // 英文，一句话锁定主角外形（性别气质/服饰/配色/材质特征），后续每格都将复用同一主角，请具体且稳定',
        ]
      : []),
    `视觉风格固定为：${event.style}`,
    // —— 锚定真实现场 ——
    FESTIVAL_SITE,
    `本次活动真实场地：「${venue}」。故事必须发生在这片真实沙地与该场地上，让线上叙事与用户脚下的现场同构。`,
    isFirst
      ? `开篇旁白必须点名真实场景（如「${venue}」、海边沙地、帐篷营区、城墙、篝火等），让用户一眼认出自己就在那里。`
      : '继续把场景锚定在该活动场地与海边艺术节现场，不要漂到架空世界。',
    // —— 题词金句化 ——
    '每一段 narration 里都要埋一句 ≤14 字、能独立成立的金句（诗性、反差或留白），让用户想截图引用。',
    '金句要自然融进旁白行文，不要用 markdown 加粗、星号、引号或任何符号包裹（前端按纯文本展示）。',
    '严禁任何套话与兜底废话（如"独一无二的旅程""完成了一段体验"）；宁可写得锋利具体，也不要平庸。',
    // —— 命名结局 ——
    '本故事将收束到以下命名结局原型之一（格式：结局名｜一句注解）：',
    ...ENDING_ARCHETYPES.map((e) => `  - ${e}`),
    '每个用户选项都隐含一种倾向；请根据"历史"里用户的累积选择，自然地把剧情导向最契合的那个结局。',
    '收尾时：badgeTitle 必须从上面 5 个原型里挑一个，逐字复制其"结局名"（｜前那部分），不得自创新名、不得改写、不得添加任何标点或修饰；badgeSummary 才是为这位用户量身的自由金句题词。',
    `badgeTitle 只能是以下之一：${ENDING_NAMES.join(' / ')}。`,
    // 跨格视觉一致性：每格都带上首格锁定的主角描述，且 imagePrompt 必须复刻同一主角与色板。
    ...(opts.protagonistDesc
      ? [
          `主角锁定（全程同一人，禁止换脸/换装/换配色）：${opts.protagonistDesc}`,
          '每一格的 imagePrompt 都必须显式包含上述主角特征，并保持 same protagonist、same color palette、same sand-sculpture material，只改变场景与动作。',
        ]
      : []),
    '关键：每一格都必须实质推进剧情——出现新的场景、转折或人物，绝不能重复上一格的旁白或画面。imagePrompt 也要随之变化。',
    `当一段完整、有起承转合的体验已经达成（且至少进行了 ${opts.minPanels} 格）时，可主动收尾（final=true）。`,
  ].join('\n');

  const user = JSON.stringify({
    活动: { 标题: event.title, 主题: event.theme, 场地: venue, 背景: event.background },
    历史: history,
    当前第几格: opts.stepIndex,
    最多格数: opts.maxPanels,
    必须收尾: opts.forceFinal,
  });

  // 叙事质量是体验的核心，默认用高质量模型（可用 DIRECTOR_MODEL 覆盖）。
  // 模型偶发输出非法 JSON、或缺字段/平庸收尾，都会重试（不输出兜底默认值）；
  // 重试时降温以换取更确定的结构。
  // 注意：minPanels 只是"最早可收尾"，不是"必须收尾"——是否收尾以 forceFinal 或模型
  // 自己给出的 final=true 为准，否则就是普通推进格（要 question/options，不要 badge）。
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { content } = await chatCompletion({
      model: process.env.DIRECTOR_MODEL ?? 'anthropic/claude-sonnet-4.6',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: attempt === 0 ? 0.9 : 0.4,
      max_tokens: 1000,
    });
    try {
      const step = parseJson(content as string);
      // willFinal 必须与下游 answerPanel 的 isFinal 判定完全一致：
      // 模型的 final=true 只有在已达 minPanels 时才算数，否则按普通推进格校验（要 question/options）。
      // 否则会出现"被当作收尾校验（只验 badge）、却被插成非收尾格（缺 question/options）"的死格。
      const willFinal = opts.forceFinal || (step.final === true && opts.stepIndex >= opts.minPanels - 1);
      const err = validateStep(step, willFinal);
      if (err) throw new Error(err);
      return step;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`导演输出不合格（已重试）：${lastErr}`);
}

// ============================================================
// 内部 mutation / query
// ============================================================
export const getEvent = internalQuery({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => await ctx.db.get(eventId),
});

// 按 activityKey 懒创建活动对应的 event（每个活动一个，独立）。
export const getOrCreateEvent = internalMutation({
  args: {
    activityKey: v.string(),
    title: v.string(),
    theme: v.string(),
    style: v.string(),
    background: v.string(),
    hostName: v.optional(v.string()),
    minPanels: v.number(),
    maxPanels: v.number(),
  },
  handler: async (ctx, args): Promise<Id<'events'>> => {
    const existing = await ctx.db
      .query('events')
      .withIndex('activityKey', (q) => q.eq('activityKey', args.activityKey))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('events', { ...args, active: true });
  },
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
  // 插入即标 pending：图还在生成中，前端据此显示"正在绘制画面"。
  handler: async (ctx, args) => await ctx.db.insert('panels', { ...args, imageStatus: 'pending' }),
});

export const setPanelImage = internalMutation({
  args: {
    panelId: v.id('panels'),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    imageTrace: v.optional(v.string()),
  },
  // 落盘成功：标 ready + 记 trace，前端解除"绘制中"并允许交互。
  handler: async (ctx, { panelId, imageUrl, imageStorageId, imageTrace }) => {
    const patch: Partial<Doc<'panels'>> = { imageStatus: 'ready' };
    if (imageUrl) patch.imageUrl = imageUrl;
    if (imageStorageId) patch.imageStorageId = imageStorageId;
    if (imageTrace) patch.imageTrace = imageTrace;
    await ctx.db.patch(panelId, patch);
  },
});

export const setPanelImageFailed = internalMutation({
  args: { panelId: v.id('panels'), imageError: v.string() },
  // 生图/落盘失败：标 failed + 记失败阶段+原因，前端显示失败态但允许继续答题。
  handler: async (ctx, { panelId, imageError }) => {
    await ctx.db.patch(panelId, { imageStatus: 'failed', imageError });
  },
});

// 首格生成后锁定主角描述 + 首格图（作为后续每格 image edit 的参考图）。
export const setExperienceLock = internalMutation({
  args: {
    experienceId: v.id('experiences'),
    protagonistDesc: v.optional(v.string()),
    firstPanelStorageId: v.optional(v.string()),
  },
  handler: async (ctx, { experienceId, protagonistDesc, firstPanelStorageId }) => {
    const patch: Partial<Doc<'experiences'>> = {};
    if (protagonistDesc) patch.protagonistDesc = protagonistDesc;
    if (firstPanelStorageId) patch.firstPanelStorageId = firstPanelStorageId;
    await ctx.db.patch(experienceId, patch);
  },
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

// 一次性清理：删除冒烟/E2E 测试遗留的 events 及其 experiences/panels/badges。
// 按 activityKey 前缀匹配（测试键都带这些前缀），真实节目单键形如 "20|11:00|场地|标题" 不会命中。
export const cleanupTestData = internalMutation({
  args: { prefixes: v.array(v.string()) },
  handler: async (ctx, { prefixes }) => {
    const events = await ctx.db.query('events').collect();
    const targets = events.filter((e) => {
      const key = e.activityKey;
      return typeof key === 'string' && prefixes.some((p) => key.startsWith(p));
    });
    let removed = { events: 0, experiences: 0, panels: 0, badges: 0 };
    for (const ev of targets) {
      const exps = await ctx.db
        .query('experiences')
        .withIndex('eventId', (q) => q.eq('eventId', ev._id))
        .collect();
      for (const exp of exps) {
        const panels = await ctx.db
          .query('panels')
          .withIndex('experienceId', (q) => q.eq('experienceId', exp._id))
          .collect();
        for (const p of panels) {
          await ctx.db.delete(p._id);
          removed.panels++;
        }
        await ctx.db.delete(exp._id);
        removed.experiences++;
      }
      const badges = await ctx.db
        .query('badges')
        .withIndex('eventId', (q) => q.eq('eventId', ev._id))
        .collect();
      for (const b of badges) {
        await ctx.db.delete(b._id);
        removed.badges++;
      }
      await ctx.db.delete(ev._id);
      removed.events++;
    }
    return { removedKeys: targets.map((t) => t.activityKey ?? ''), removed };
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
// 统一把一格图解析成可用 URL：新图存 imageUrl（七牛 CDN），旧图回退 Convex storage getUrl。
async function resolvePanelImageUrl(
  ctx: QueryCtx,
  panel: { imageUrl?: string; imageStorageId?: string } | null | undefined,
): Promise<string | null> {
  if (!panel) return null;
  if (panel.imageUrl) return panel.imageUrl;
  if (panel.imageStorageId) return await ctx.storage.getUrl(panel.imageStorageId);
  return null;
}

// 该体验里有图的收尾格（用于结局墙缩略图）：有 imageUrl 或 imageStorageId 都算。
function panelHasImage(p: { imageUrl?: string; imageStorageId?: string }): boolean {
  return !!(p.imageUrl || p.imageStorageId);
}

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
        imageUrl: await resolvePanelImageUrl(ctx, p),
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

// 某个活动的勋章墙（按 activityKey）。
export const activityBadges = query({
  args: { activityKey: v.string() },
  handler: async (ctx, { activityKey }) => {
    const event = await ctx.db
      .query('events')
      .withIndex('activityKey', (q) => q.eq('activityKey', activityKey))
      .first();
    if (!event) return [];
    const badges = await ctx.db
      .query('badges')
      .withIndex('eventId', (q) => q.eq('eventId', event._id))
      .order('desc')
      .take(100);
    return await Promise.all(
      badges.map(async (b) => {
        const profile = await ctx.db
          .query('profiles')
          .withIndex('userId', (q) => q.eq('userId', b.userId))
          .first();
        // 该体验的收尾格（别人的结局画面）
        const panels = await ctx.db
          .query('panels')
          .withIndex('experienceId', (q) => q.eq('experienceId', b.experienceId))
          .collect();
        const ending = panels.sort((a, c) => c.index - a.index).find((p) => p.isFinal) ?? panels[0];
        return {
          ...b,
          avatarPreset: profile?.avatarPreset,
          avatarUrl: profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
          endingImageUrl: await resolvePanelImageUrl(ctx, ending),
          endingNarration: ending?.narration ?? '',
        };
      }),
    );
  },
});

// 公测实时结局墙：最近完成的体验（跨所有活动），用于投屏大屏直播。
// 每条 = 结局名(title) + 题词(summary/reflection) + 收尾画面图 + 活动名 + 玩家 + 时间。
// 另带总场次与命名结局分布，制造现场社交张力。useQuery 订阅，新结局自动上墙。
export const wallFeed = query({
  handler: async (ctx) => {
    const badges = await ctx.db.query('badges').order('desc').take(60);
    const items = await Promise.all(
      badges.map(async (b) => {
        const event = await ctx.db.get(b.eventId);
        const profile = await ctx.db
          .query('profiles')
          .withIndex('userId', (q) => q.eq('userId', b.userId))
          .first();
        // 该体验的收尾格（结局画面）；没有则退回首格。
        const panels = await ctx.db
          .query('panels')
          .withIndex('experienceId', (q) => q.eq('experienceId', b.experienceId))
          .collect();
        panels.sort((a, c) => c.index - a.index);
        const ending = panels.find((p) => p.isFinal && panelHasImage(p)) ?? panels.find((p) => panelHasImage(p));
        return {
          _id: b._id,
          experienceId: b.experienceId,
          title: b.title,
          summary: b.summary,
          reflection: b.reflection ?? null,
          userName: b.userName,
          awardedAt: b.awardedAt,
          eventTitle: event?.title ?? '',
          activityKey: event?.activityKey ?? null,
          avatarPreset: profile?.avatarPreset ?? null,
          avatarUrl: profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
          imageUrl: await resolvePanelImageUrl(ctx, ending),
        };
      }),
    );

    // 全量完成场次 + 命名结局分布（按 badgeTitle 聚合）。
    const allBadges = await ctx.db.query('badges').collect();
    const distMap = new Map<string, number>();
    for (const b of allBadges) distMap.set(b.title, (distMap.get(b.title) ?? 0) + 1);
    const distribution = [...distMap.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);

    return { items, total: allBadges.length, distribution };
  },
});

// 结局墙点开某张卡片：只读取出该体验的完整连环画（所有格按序）+ 结局/题词/玩家/活动。
// 公开、只读，供大屏/手机端浏览。
export const experienceComic = query({
  args: { experienceId: v.id('experiences') },
  handler: async (ctx, { experienceId }) => {
    const experience = await ctx.db.get(experienceId);
    if (!experience) return null;
    const event = await ctx.db.get(experience.eventId);
    const profile = await ctx.db
      .query('profiles')
      .withIndex('userId', (q) => q.eq('userId', experience.userId))
      .first();
    const badge = await ctx.db
      .query('badges')
      .withIndex('experienceId', (q) => q.eq('experienceId', experienceId))
      .first();
    const panelsRaw = await ctx.db
      .query('panels')
      .withIndex('experienceId', (q) => q.eq('experienceId', experienceId))
      .collect();
    panelsRaw.sort((a, b) => a.index - b.index);
    const panels = await Promise.all(
      panelsRaw.map(async (p) => ({
        index: p.index,
        narration: p.narration,
        imageUrl: await resolvePanelImageUrl(ctx, p),
      })),
    );
    return {
      panels,
      userName: experience.userName,
      avatarPreset: profile?.avatarPreset ?? null,
      avatarUrl: profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
      eventTitle: event?.title ?? '',
      venue: event?.hostName ?? null,
      activityKey: event?.activityKey ?? null,
      badgeTitle: badge?.title ?? null,
      badgeSummary: badge?.summary ?? null,
      reflection: badge?.reflection ?? null,
    };
  },
});

// 末幕留下感言/题词，写到该体验的勋章上。
export const saveReflection = mutation({
  args: { experienceId: v.id('experiences'), text: v.string() },
  handler: async (ctx, { experienceId, text }) => {
    const badge = await ctx.db
      .query('badges')
      .withIndex('experienceId', (q) => q.eq('experienceId', experienceId))
      .first();
    if (badge) await ctx.db.patch(badge._id, { reflection: text });
  },
});

// ============================================================
// 公开 action：核心交互闭环
// ============================================================
// 生图结果：blob 供首格做后续 image edit 参考；imageUrl/imageStorageId 二选一供回填；trace/storeMs 供落库。
type GenImage = { blob: Blob; imageUrl?: string; imageStorageId?: string; trace: ImageTrace; storeMs: number };
// 失败时带"失败阶段+原因"，写进 panel.imageError，前端显示失败态但允许继续答题。
type GenOutcome = { image: GenImage } | { image: null; error: string };

// 生图容错：优先用首格图做 image edit；若失败（如偶发内容审核 400）退回纯 t2i；
// 再失败则该格无图——绝不让单格生图失败阻断整条剧情/收尾。
// 全程用 requestId 串结构化日志（gen/store 各阶段 ms）；落盘走统一管线（七牛优先，失败回退 Convex）。
async function genImageSafe(
  ctx: ActionCtx,
  prompt: string,
  namespace: string,
  requestId: string,
  reference?: Blob,
): Promise<GenOutcome> {
  const tGen = Date.now();
  let blob: Blob | null = null;
  let trace: ImageTrace | null = null;
  let genError = '';
  try {
    ({ blob, trace } = await generateImageTraced(prompt, reference));
  } catch (e1) {
    if (reference) {
      try {
        // 退回纯 t2i（prompt 已含主角描述，仍尽量一致）。
        ({ blob, trace } = await generateImageTraced(prompt));
      } catch (e2) {
        genError = `gen: edit+t2i 均失败 ${e2 instanceof Error ? e2.message : String(e2)}`;
        console.error(`[gen] requestId=${requestId} stage=gen ms=${Date.now() - tGen} ${genError}`, e2);
      }
    } else {
      genError = `gen: t2i 失败 ${e1 instanceof Error ? e1.message : String(e1)}`;
      console.error(`[gen] requestId=${requestId} stage=gen ms=${Date.now() - tGen} ${genError}`, e1);
    }
  }
  if (!blob || !trace) return { image: null, error: genError || 'gen: 文生图返回为空' };
  console.log(
    `[gen] requestId=${requestId} stage=gen ms=${Date.now() - tGen} mode=${trace.mode} apiMs=${trace.apiMs} retries=${trace.retries} outKB=${trace.outKB}`,
  );
  try {
    const { imageUrl, imageStorageId, storeMs } = await storeGeneratedImage(ctx, blob, namespace, requestId);
    return { image: { blob, imageUrl, imageStorageId, trace, storeMs } };
  } catch (e) {
    const error = `store: 七牛+Convex 落盘均失败 ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[gen] requestId=${requestId} stage=store ${error}`, e);
    return { image: null, error };
  }
}

// 取参考图 blob：优先 Convex storage（refStorageId），其次远程 URL（refUrl）；取不到返回 undefined。
async function resolveReference(
  ctx: ActionCtx,
  refStorageId?: string,
  refUrl?: string,
): Promise<Blob | undefined> {
  if (refStorageId) return (await ctx.storage.get(refStorageId)) ?? undefined;
  if (refUrl) {
    try {
      const res = await fetch(refUrl);
      if (res.ok) return await res.blob();
    } catch (e) {
      console.error('拉取参考图失败，跳过主角参考', e);
    }
  }
  return undefined;
}

// 后台异步生图：把 20-60s 的生图+落盘从前台交互链路里挪走。
// 前台已 insertPanel(pending) 并把 narration/question 立即返回给用户；本 action 由 scheduler 触发，
// 完成后 setPanelImage(ready+trace) 或 setPanelImageFailed，前端订阅 getExperience 自动刷新。
// 首格（isFirst）额外把生成图锁成 firstPanelStorageId + protagonistDesc，供后续每格 image edit 锁脸。
export const generatePanelImage = internalAction({
  args: {
    panelId: v.id('panels'),
    experienceId: v.id('experiences'),
    imagePrompt: v.string(),
    requestId: v.string(),
    startedAt: v.number(), // director 开始时间戳，用于算 totalMs（director→store 全链路）
    isFirst: v.boolean(),
    refStorageId: v.optional(v.string()), // 参考图定位：首格=照片记忆，非首格=firstPanelStorageId
    refUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 外层兜底：任何异常都不能让 panel 永久 pending；未标过状态就 setPanelImageFailed。
    let resolved = false;
    try {
      // 非首格的 reference 可能尚未就绪（首格还在后台生成）；resolveReference 取不到时返回 undefined，
      // genImageSafe 会自动走纯 t2i（不等待/不轮询）。
      const reference = await resolveReference(ctx, args.refStorageId, args.refUrl);
      const outcome = await genImageSafe(ctx, args.imagePrompt, 'experience-panels', args.requestId, reference);
      if (outcome.image) {
        // 首格：先把参考图（firstPanelStorageId）锁好，再标 ready——让 reference 在前端被允许进入
        // 下一格之前就绪，缩小非首格 image edit 拿不到 reference 的窗口。
        if (args.isFirst) {
          const firstPanelStorageId = outcome.image.imageStorageId ?? (await ctx.storage.store(outcome.image.blob));
          await ctx.runMutation(internal.experience.setExperienceLock, {
            experienceId: args.experienceId,
            firstPanelStorageId,
          });
        }
        // trace 里一并写 requestId + totalMs，方便从 DB trace 反查日志。
        const trace = JSON.stringify({
          ...outcome.image.trace,
          requestId: args.requestId,
          storeMs: outcome.image.storeMs,
          totalMs: Date.now() - args.startedAt,
        });
        await ctx.runMutation(internal.experience.setPanelImage, {
          panelId: args.panelId,
          imageUrl: outcome.image.imageUrl,
          imageStorageId: outcome.image.imageStorageId,
          imageTrace: trace,
        });
      } else {
        await ctx.runMutation(internal.experience.setPanelImageFailed, {
          panelId: args.panelId,
          imageError: outcome.error,
        });
      }
      resolved = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[gen] requestId=${args.requestId} stage=panel-image 后台异常 resolved=${resolved}`, e);
      if (!resolved) {
        try {
          await ctx.runMutation(internal.experience.setPanelImageFailed, {
            panelId: args.panelId,
            imageError: `panel-image: ${msg}`,
          });
        } catch (e2) {
          console.error(`[gen] requestId=${args.requestId} setPanelImageFailed 兜底也失败`, e2);
        }
      }
    }
  },
});

// 生成首格的前台部分：director（同步，用户即刻拿到旁白/题目）+ insertPanel(pending) + 调度后台生图。
// referenceLocator（用户上传过该作品的风格化照片记忆）传给后台，让首格主角就是用户本人的沙雕化形象。
async function generateFirstPanel(
  ctx: ActionCtx,
  experienceId: Id<'experiences'>,
  event: Doc<'events'>,
  refStorageId?: string,
  refUrl?: string,
) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const step = await director(event, [], {
    stepIndex: 0,
    minPanels: event.minPanels,
    maxPanels: event.maxPanels,
    forceFinal: false,
  });
  console.log(`[gen] requestId=${requestId} stage=director ms=${Date.now() - startedAt} panelIndex=0`);
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
  // protagonistDesc 是文字锁：后续每格 director 都要读它锁主角，必须前台同步落库（图还没生成时就有）。
  // firstPanelStorageId 是图片锁（仅 image edit 用），留给后台生图完成时再写。
  if (step.protagonist) {
    await ctx.runMutation(internal.experience.setExperienceLock, {
      experienceId,
      protagonistDesc: step.protagonist,
    });
  }
  await ctx.scheduler.runAfter(0, internal.experience.generatePanelImage, {
    panelId,
    experienceId,
    imagePrompt: step.imagePrompt,
    requestId,
    startedAt,
    isFirst: true,
    refStorageId,
    refUrl,
  });
}

// 从节目单的某个活动进入：按 activityKey 取/建 event，再开一段独立体验。
export const startActivityExperience = action({
  args: {
    activity: v.object({
      activityKey: v.string(),
      title: v.string(),
      theme: v.string(),
      style: v.string(),
      background: v.string(),
      hostName: v.optional(v.string()),
      category: v.optional(v.string()), // 前端用于推荐，后端不持久化
      minPanels: v.number(),
      maxPanels: v.number(),
    }),
    userId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, { activity, userId, userName }): Promise<Id<'experiences'>> => {
    const eventId = await ctx.runMutation(internal.experience.getOrCreateEvent, {
      activityKey: activity.activityKey,
      title: activity.title,
      theme: activity.theme,
      style: activity.style,
      background: activity.background,
      hostName: activity.hostName,
      minPanels: activity.minPanels,
      maxPanels: activity.maxPanels,
    });
    const event = await ctx.runQuery(internal.experience.getEvent, { eventId });
    if (!event) throw new Error('event 创建失败');
    const experienceId = await ctx.runMutation(internal.experience.createExperience, {
      eventId,
      userId,
      userName,
    });
    // 若用户在该作品/活动下上传过照片记忆，取最新一张生成图当首格主角参考（沙雕化的自己出演）。
    // 参考图的实际拉取挪到后台 generatePanelImage，这里只传定位（storageId/url），不阻塞前台。
    const memory = await ctx.runQuery(internal.photoMemories.latestMemoryForActivity, {
      activityKey: activity.activityKey,
      userId,
    });
    await generateFirstPanel(
      ctx,
      experienceId,
      event,
      memory?.imageStorageId ?? undefined,
      memory?.imageUrl ?? undefined,
    );
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

    const requestId = newRequestId();
    const startedAt = Date.now();
    const step = await director(event, history, {
      stepIndex: nextIndex,
      minPanels: event.minPanels,
      maxPanels: event.maxPanels,
      forceFinal,
      protagonistDesc: state.experience.protagonistDesc,
    });
    console.log(`[gen] requestId=${requestId} stage=director ms=${Date.now() - startedAt} panelIndex=${nextIndex}`);
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
    // 生图挪到后台：以首格图作参考做 image edit 锁主角/色板/沙雕材质（仅改场景/动作）。
    // firstPanelStorageId 此刻可能还没就绪（首格仍在后台生成）——后台取不到参考会自动降级纯 t2i。
    await ctx.scheduler.runAfter(0, internal.experience.generatePanelImage, {
      panelId,
      experienceId,
      imagePrompt: step.imagePrompt,
      requestId,
      startedAt,
      isFirst: false,
      refStorageId: state.experience.firstPanelStorageId ?? undefined,
    });

    if (isFinal) {
      // 命名结局 + 金句题词由 director 保证（validateStep 已强约束 + 重试）。
      // 最后兜底：万一模型重试后仍给出非原型名（极少数顽固情况），就贴到第一个原型，
      // 绝不让收尾抛错而中断整段游玩；这里只校正 title，绝不引入平庸填充词。
      const finalTitle = ENDING_NAMES.includes(step.badgeTitle?.trim() ?? '')
        ? step.badgeTitle!.trim()
        : ENDING_NAMES[0];
      await ctx.runMutation(internal.experience.awardBadge, {
        experienceId,
        title: finalTitle,
        summary: step.badgeSummary!,
      });
    }
  },
});
