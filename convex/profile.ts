import { v } from 'convex/values';
import { query, mutation, action } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { generateImage } from './util/image';

const genderValidator = v.union(v.literal('male'), v.literal('female'), v.literal('other'));

async function resolveAvatarUrl(ctx: { storage: { getUrl: (id: string) => Promise<string | null> } }, p: Doc<'profiles'>) {
  return {
    ...p,
    avatarUrl: p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : null,
  };
}

export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const p = await ctx.db
      .query('profiles')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first();
    return p ? await resolveAvatarUrl(ctx, p) : null;
  },
});

export const saveProfile = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    gender: genderValidator,
    avatarPreset: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('profiles')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .first();
    const patch = {
      name: args.name,
      gender: args.gender,
      avatarPreset: args.avatarPreset,
      avatarStorageId: args.avatarStorageId,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert('profiles', { userId: args.userId, ...patch });
  },
});

// 自定义头像：根据描述 + 名字/性别用文生图生成一张沙雕风头像，存储后返回预览。
export const generateAvatar = action({
  args: {
    description: v.string(),
    name: v.string(),
    gender: genderValidator,
  },
  handler: async (ctx, { description, name, gender }): Promise<{ storageId: string; url: string | null }> => {
    const genderWord = gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'androgynous';
    const prompt = `circular profile avatar portrait of a ${genderWord} character named "${name}", ${description}, cinematic sand-sculpture style, fine sand grain texture, warm golden-hour light, simple soft background, head and shoulders, centered`;
    const blob = await generateImage(prompt);
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    return { storageId, url };
  },
});
