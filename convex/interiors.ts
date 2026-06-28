import { v } from 'convex/values';
import { internal } from './_generated/api';
import { MutationCtx, mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { createEngine } from './aiTown/main';
import { insertInput } from './aiTown/insertInput';
import { ENGINE_ACTION_DURATION } from './constants';
import { Descriptions } from '../data/characters';
import { resolveInterior } from '../data/birdRestaurantInterior';
import { interiorToWorldMap } from '../data/interiorWorldMap';

// 每个内场世界里安置几名 AI 居民（复用主世界的人物设定）；可后续按场馆定制。
const INTERIOR_AGENT_COUNT = 2;

async function lookupInteriorWorld(ctx: MutationCtx, interiorId: string) {
  const row = await ctx.db
    .query('interiorWorlds')
    .withIndex('interiorId', (q) => q.eq('interiorId', interiorId))
    .unique();
  if (!row) return null;
  const status = await ctx.db
    .query('worldStatus')
    .withIndex('worldId', (q) => q.eq('worldId', row.worldId))
    .unique();
  if (!status) return null;
  return { worldId: status.worldId, engineId: status.engineId };
}

// 只读：内场世界是否已存在（客户端可据此决定先建后切）。
export const getInteriorWorld = query({
  args: { interiorId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('interiorWorlds')
      .withIndex('interiorId', (q) => q.eq('interiorId', args.interiorId))
      .unique();
    if (!row) return null;
    const status = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', row.worldId))
      .unique();
    if (!status) return null;
    return {
      worldId: status.worldId,
      engineId: status.engineId,
      status: status.status,
    };
  },
});

// 取/建内场世界：首次进入时新建一个独立 world（自己的地图 + 引擎 + AI 居民），
// 之后复用。世界闲置会被 cron 休眠，再次进入时 heartbeat 自动唤醒（见 world.heartbeatWorld）。
export const getOrCreateInteriorWorld = mutation({
  args: { interiorId: v.string() },
  handler: async (ctx, args): Promise<{ worldId: Id<'worlds'>; engineId: Id<'engines'> }> => {
    const existing = await lookupInteriorWorld(ctx, args.interiorId);
    if (existing) return existing;

    const interior = resolveInterior(args.interiorId);
    if (!interior) {
      throw new Error(`Unknown interior: ${args.interiorId}`);
    }

    const engineId = await createEngine(ctx);
    const engine = (await ctx.db.get(engineId))!;
    const worldId = await ctx.db.insert('worlds', {
      nextId: 0,
      agents: [],
      conversations: [],
      players: [],
    });
    await ctx.db.insert('worldStatus', {
      engineId,
      isDefault: false,
      lastViewed: Date.now(),
      status: 'running',
      worldId,
    });
    await ctx.db.insert('maps', { worldId, ...interiorToWorldMap(interior) });
    await ctx.db.insert('interiorWorlds', { interiorId: args.interiorId, worldId });
    await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
      worldId,
      generationNumber: engine.generationNumber,
      maxDuration: ENGINE_ACTION_DURATION,
    });

    for (let i = 0; i < INTERIOR_AGENT_COUNT; i++) {
      await insertInput(ctx, worldId, 'createAgent', {
        descriptionIndex: i % Descriptions.length,
      });
    }

    return { worldId, engineId };
  },
});
