import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { INSTALLATIONS } from '../data/installations';

const kindValidator = v.union(v.literal('view'), v.literal('space'));

async function withImageUrl(
  ctx: { storage: { getUrl: (id: string) => Promise<string | null> } },
  a: Doc<'artworks'>,
) {
  return {
    ...a,
    imageUrl: a.imageStorageId ? await ctx.storage.getUrl(a.imageStorageId) : null,
  };
}

// 列出某个世界的全部作品（前端地图标记 + 侧栏列表的唯一数据源）。
export const list = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const rows = await ctx.db
      .query('artworks')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    return Promise.all(rows.map((a) => withImageUrl(ctx, a)));
  },
});

export const get = query({
  args: { artworkId: v.id('artworks') },
  handler: async (ctx, { artworkId }) => {
    const a = await ctx.db.get(artworkId);
    return a ? await withImageUrl(ctx, a) : null;
  },
});

// 把 data/installations.ts 的 91 件既有作品迁移为种子。幂等：按 (worldId, slug) upsert。
export const seedArtworks = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, { worldId }) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    for (const inst of INSTALLATIONS) {
      const existing = await ctx.db
        .query('artworks')
        .withIndex('slug', (q) => q.eq('worldId', worldId).eq('slug', inst.id))
        .first();
      const base = {
        worldId,
        slug: inst.id,
        title: inst.title,
        artistName: inst.artist,
        zone: inst.zone,
        note: inst.note,
        x: inst.x,
        y: inst.y,
      };
      if (existing) {
        // 只回填静态字段，绝不覆盖运行时产生的归属/类型/实拍图。
        await ctx.db.patch(existing._id, base);
        updated++;
      } else {
        await ctx.db.insert('artworks', {
          ...base,
          kind: 'view' as const,
          origin: 'seed' as const,
          createdAt: now,
        });
        inserted++;
      }
    }
    return { inserted, updated, total: INSTALLATIONS.length };
  },
});

// 艺术家申领既有作品：把作品与其 userId 关联。仅未被申领（或已属于本人）时允许。
export const claimArtwork = mutation({
  args: { artworkId: v.id('artworks'), userId: v.string() },
  handler: async (ctx, { artworkId, userId }) => {
    const profile = await requireArtist(ctx, userId);
    const artwork = await ctx.db.get(artworkId);
    if (!artwork) throw new ConvexError('作品不存在');
    if (artwork.ownerUserId && artwork.ownerUserId !== userId) {
      throw new ConvexError('该作品已被其他艺术家申领');
    }
    await ctx.db.patch(artworkId, { ownerUserId: userId, artistName: profile.name });
    return artworkId;
  },
});

// 艺术家自助新建作品并摆放。坐标为源图坐标系（与既有作品一致）。
export const createArtwork = mutation({
  args: {
    worldId: v.id('worlds'),
    userId: v.string(),
    title: v.string(),
    zone: v.string(),
    x: v.number(),
    y: v.number(),
    kind: kindValidator,
    note: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireArtist(ctx, args.userId);
    const slug = 'u_' + Math.random().toString(36).slice(2, 10);
    return await ctx.db.insert('artworks', {
      worldId: args.worldId,
      slug,
      title: args.title,
      artistName: profile.name,
      zone: args.zone,
      note: args.note,
      x: args.x,
      y: args.y,
      kind: args.kind,
      ownerUserId: args.userId,
      imageStorageId: args.imageStorageId,
      origin: 'user' as const,
      createdAt: Date.now(),
    });
  },
});

// 上传实拍效果图：返回一次性上传 URL，前端 PUT 文件后拿 storageId 传给 createArtwork。
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

// 记录一次作品互动（观看 / 进入），若作品已被申领且触发者非本人，则通知归属艺术家。
// 去重：同一 (作品, 触发者, 类型) 30 分钟内只通知一次，避免刷屏。
export const recordInteraction = mutation({
  args: {
    worldId: v.id('worlds'),
    artworkId: v.id('artworks'),
    kind: v.union(v.literal('artwork_viewed'), v.literal('artwork_entered')),
    actorUserId: v.string(),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const artwork = await ctx.db.get(args.artworkId);
    if (!artwork || !artwork.ownerUserId) return null;
    if (artwork.ownerUserId === args.actorUserId) return null;

    const cutoff = Date.now() - 30 * 60 * 1000;
    const recent = await ctx.db
      .query('notifications')
      .withIndex('recent', (q) => q.eq('userId', artwork.ownerUserId!).gt('createdAt', cutoff))
      .collect();
    const dup = recent.find(
      (n) =>
        n.artworkId === args.artworkId &&
        n.actorUserId === args.actorUserId &&
        n.kind === args.kind,
    );
    if (dup) return null;

    const verb = args.kind === 'artwork_entered' ? '进入了' : '看了';
    const who = args.actorName ?? '有人';
    return await ctx.db.insert('notifications', {
      userId: artwork.ownerUserId,
      worldId: args.worldId,
      kind: args.kind,
      artworkId: args.artworkId,
      artworkTitle: artwork.title,
      actorUserId: args.actorUserId,
      actorName: args.actorName,
      text: `${who}${verb}你的作品《${artwork.title}》`,
      read: false,
      createdAt: Date.now(),
    });
  },
});

// 公共校验：调用者必须是已注册的艺术家。
async function requireArtist(
  ctx: { db: { query: any } },
  userId: string,
): Promise<Doc<'profiles'>> {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('userId', (q: any) => q.eq('userId', userId))
    .first();
  if (!profile) throw new ConvexError('请先完成登记');
  if (profile.role !== 'artist') throw new ConvexError('仅艺术家身份可执行此操作');
  return profile as Doc<'profiles'>;
}
