import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  // ---- AIGC 连环画体验模块（独立于 AI Town 引擎）----
  // 全局玩家身份（landing 强制录入一次）。鉴权接入后 userId 可换成真实 user。
  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    gender: v.union(v.literal('male'), v.literal('female'), v.literal('other')),
    avatarPreset: v.optional(v.string()), // 选预置头像时记预置 id
    avatarStorageId: v.optional(v.string()), // AI 生成头像时记 storage id
    updatedAt: v.number(),
  }).index('userId', ['userId']),

  // 一个活动 = 节目单里的一项，每个活动有自己独立的游戏。
  // activityKey 由节目单条目唯一标识（date+time+venue+title），首次进入时按 key 懒创建。
  events: defineTable({
    activityKey: v.optional(v.string()),
    title: v.string(),
    theme: v.string(),
    style: v.string(), // 视觉风格描述，注入文生图提示词
    background: v.string(), // 活动背景 / 知识库摘要
    hostName: v.optional(v.string()),
    minPanels: v.number(),
    maxPanels: v.number(),
    active: v.boolean(),
  }).index('activityKey', ['activityKey']),

  // 一次体验 = 一个用户走完一个活动的一条 AIGC 叙事线。
  experiences: defineTable({
    eventId: v.id('events'),
    userId: v.string(), // 匿名 id（前端 localStorage），鉴权接入后可替换
    userName: v.string(),
    status: v.union(v.literal('active'), v.literal('completed')),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // 跨格视觉一致性：首格锁定的主角外形描述 + 首格图（作为后续每格的参考图）。
    protagonistDesc: v.optional(v.string()),
    firstPanelStorageId: v.optional(v.string()),
  })
    .index('eventId', ['eventId'])
    .index('userId', ['userId']),

  // 连环画里的一格：图片 + 旁白 +（可选）问题/选项 + 用户回答。
  panels: defineTable({
    experienceId: v.id('experiences'),
    index: v.number(),
    imagePrompt: v.string(),
    imageUrl: v.optional(v.string()), // 七牛 CDN https URL（新图首选）
    imageStorageId: v.optional(v.string()), // Convex storage（旧图兼容 / 七牛失败回退）
    narration: v.string(),
    question: v.optional(v.string()),
    options: v.array(v.string()),
    allowCustom: v.boolean(),
    answer: v.optional(v.string()),
    isFinal: v.boolean(),
  }).index('experienceId', ['experienceId', 'index']),

  // 完成活动后获得的勋章，所有人可见（勋章墙）。
  badges: defineTable({
    eventId: v.id('events'),
    experienceId: v.id('experiences'),
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    summary: v.string(),
    reflection: v.optional(v.string()), // 用户末幕留下的感言/题词
    awardedAt: v.number(),
  })
    .index('eventId', ['eventId'])
    .index('userId', ['userId'])
    .index('experienceId', ['experienceId']),

  // 玩家上传真实照片后生成的「沙之书」风格记忆。
  // shared=true 时进入公共相册与实时通知流；原图与生成图都自动持久化。
  // activityKey 记录拍摄上下文（作品 / 节目），也用于把记忆喂给该作品/活动的专属体验当主角参考。
  photoMemories: defineTable({
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    sourceType: v.union(v.literal('photo'), v.literal('video')),
    originalStorageId: v.string(),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    activityKey: v.optional(v.string()),
    activityTitle: v.optional(v.string()),
    venue: v.optional(v.string()),
    contextLabel: v.optional(v.string()),
    userPrompt: v.optional(v.string()), // 访客的可选风格化提示词（生成/重绘共用）
    // 生成异步化：客户端订阅本行而非等待长 action，避免"action in flight 连接丢失"。
    // 旧行无此字段时按 ready 处理（有图即成功）。
    status: v.optional(v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'))),
    shared: v.boolean(),
    sharedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('userId', ['userId', 'createdAt'])
    .index('shared', ['shared', 'createdAt'])
    .index('activityKey', ['activityKey', 'createdAt']),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  // GPS→地图 标定锚点（全场单例，最新一条为准）。由现场操作员用标定工具采集后写入，
  // 所有玩家共享同一套坐标变换。
  gpsCalibration: defineTable({
    anchors: v.array(
      v.object({
        lat: v.number(),
        lng: v.number(),
        sourceX: v.number(),
        sourceY: v.number(),
        label: v.optional(v.string()),
      }),
    ),
    updatedAt: v.number(),
  }),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
