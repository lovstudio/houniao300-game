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
    // 注册时选择的身份角色：访客（仅观看互动）/ 艺术家（可申领、创建作品）。
    role: v.optional(v.union(v.literal('visitor'), v.literal('artist'))),
    // 艺术家自述（对应 AI Town 角色的「出厂设置」identity）。
    artistStatement: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('userId', ['userId']),

  // ---- 艺术家作品（沙之书核心实体）----
  // 真相源：既有作品由 data/installations.ts 迁移为种子（origin='seed'），
  // 用户自助新建的作品 origin='user'。坐标沿用 1703x1279 源图坐标系。
  artworks: defineTable({
    worldId: v.id('worlds'),
    slug: v.string(), // 'A1'..（种子）或生成的 'u_xxxx'（用户新建），世界内唯一
    title: v.string(),
    artistName: v.string(),
    zone: v.string(),
    note: v.optional(v.string()),
    x: v.number(), // 源图坐标 X
    y: v.number(), // 源图坐标 Y
    // 'view' = 仅供观看；'space' = 可进入的空间/建筑。
    kind: v.union(v.literal('view'), v.literal('space')),
    ownerUserId: v.optional(v.string()), // 归属艺术家 userId；undefined = 未申领
    imageStorageId: v.optional(v.string()), // 实拍效果图（Convex storage）
    origin: v.union(v.literal('seed'), v.literal('user')),
    createdAt: v.number(),
  })
    .index('worldId', ['worldId'])
    .index('slug', ['worldId', 'slug'])
    .index('owner', ['ownerUserId']),

  // ---- 通知：作品被申领/被观看/被进入时，提醒归属艺术家 ----
  notifications: defineTable({
    userId: v.string(), // 收件人 = 作品归属艺术家 / 传话者本人
    worldId: v.id('worlds'),
    kind: v.string(), // 'artwork_viewed' | 'artwork_entered' | 'artwork_claimed' | 'user_said'
    artworkId: v.optional(v.id('artworks')),
    artworkTitle: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    targetName: v.optional(v.string()), // user_said：@ 的角色名
    text: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index('userId', ['userId', 'read'])
    .index('recent', ['userId', 'createdAt']),

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
    // 生图可观测：状态 + 追踪 JSON（ImageTrace + 落盘耗时）+ 失败阶段/原因。
    // 旧行无 imageStatus：前端按"有图即 ready，否则 pending"兜底。
    imageStatus: v.optional(v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'))),
    imageTrace: v.optional(v.string()), // JSON.stringify(ImageTrace + storeMs/totalMs)
    imageError: v.optional(v.string()), // 失败阶段 + 错误信息
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
    userPrompt: v.optional(v.string()), // 访客的可选风格化提示词（首轮）
    useSystemStyle: v.optional(v.boolean()), // 是否套用"沙之书"系统风格（默认 true）；艺术家可关
    // 生成异步化：客户端订阅本行而非等待长 action，避免"action in flight 连接丢失"。
    // 旧行无此字段时按 ready 处理（有图即成功）。imageUrl/imageStorageId 镜像"最新一张就绪的追问图"。
    status: v.optional(v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'))),
    shared: v.boolean(),
    sharedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('userId', ['userId', 'createdAt'])
    .index('shared', ['shared', 'createdAt'])
    .index('activityKey', ['activityKey', 'createdAt']),

  // 照片记忆的"追问"对话：每条 = 一次提示词 + 一张生成图，按 index 串成聊天线。
  // 始终以 photoMemories.originalStorageId（真人原图）为参考，accumulate 文字上下文，避免人脸漂移。
  photoMemoryTurns: defineTable({
    memoryId: v.id('photoMemories'),
    index: v.number(),
    userPrompt: v.optional(v.string()),
    useSystemStyle: v.boolean(),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed')),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    trace: v.optional(v.string()), // 生成追踪 JSON（模型/尺寸/耗时/重试…），前端 console 打印
    createdAt: v.number(),
  }).index('memoryId', ['memoryId', 'index']),

  // ---- 物料管理（场所内场地图 / 作品点位的"照片→生成"溯源）----
  // 每条 = 一个可生成单元的物料记录，key 唯一（'venue:<interiorId>' 或 'work:<installationId>'）。
  // 源图走 Convex 文件存储（浏览器直传），生成结果（几何 JSON / 图注）落 generated 字段。
  materials: defineTable({
    key: v.string(),
    kind: v.union(v.literal('venue'), v.literal('work')),
    refId: v.string(), // interior id 或 installation id
    title: v.string(), // 冗余存一份，方便后台检索/展示
    sourceStorageId: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    capturedAt: v.optional(v.string()),
    status: v.union(
      v.literal('idle'),
      v.literal('generating'),
      v.literal('ready'),
      v.literal('error'),
    ),
    generated: v.optional(v.string()), // 生成结果 JSON 字符串
    error: v.optional(v.string()), // 失败短消息（截断），明细看日志
    errorCode: v.optional(v.string()), // 失败归类（llm_http/bad_json/empty/unknown）
    trace: v.optional(v.string()), // 生成追踪 JSON（model/durationMs/retries/requestId）
    updatedAt: v.number(),
  })
    .index('key', ['key'])
    .index('kind', ['kind']),

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
