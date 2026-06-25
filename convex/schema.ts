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
  })
    .index('eventId', ['eventId'])
    .index('userId', ['userId']),

  // 连环画里的一格：图片 + 旁白 +（可选）问题/选项 + 用户回答。
  panels: defineTable({
    experienceId: v.id('experiences'),
    index: v.number(),
    imagePrompt: v.string(),
    imageStorageId: v.optional(v.string()), // 图片异步生成后回填
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
    awardedAt: v.number(),
  })
    .index('eventId', ['eventId'])
    .index('userId', ['userId']),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
