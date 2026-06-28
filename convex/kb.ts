import { v } from 'convex/values';
import { internal } from './_generated/api';
import { ActionCtx, action, internalMutation, internalQuery } from './_generated/server';
import { fetchEmbedding, fetchEmbeddingBatch } from './util/llm';
import { HOUNIAO_KB } from './data/houniao300Kb';

// 候鸟300 知识库 RAG：把内置分块嵌入并存入向量表（ingest），@AI 时按问题检索 top-k（retrieve）。

export const countChunks = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query('kbChunks').collect()).length,
});

export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db.query('kbChunks').collect()) await ctx.db.delete(row._id);
  },
});

export const insertBatch = internalMutation({
  args: {
    items: v.array(
      v.object({
        chunkId: v.string(),
        source: v.string(),
        title: v.string(),
        text: v.string(),
        embedding: v.array(v.float64()),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    for (const it of items) await ctx.db.insert('kbChunks', it);
  },
});

export const fetchChunks = internalQuery({
  args: { ids: v.array(v.id('kbChunks')) },
  handler: async (ctx, { ids }) => {
    const out = [];
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row) out.push({ title: row.title, source: row.source, text: row.text });
    }
    return out;
  },
});

// 一次性导入（幂等）：清空后重新嵌入全部分块。手动触发：npx convex run kb:ingest
export const ingest = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { force },
  ): Promise<{ skipped: true; existing: number } | { ingested: number }> => {
    const existing: number = await ctx.runQuery(internal.kb.countChunks, {});
    if (existing > 0 && !force) {
      return { skipped: true, existing };
    }
    await ctx.runMutation(internal.kb.clearAll, {});
    const BATCH = 64;
    let done = 0;
    for (let i = 0; i < HOUNIAO_KB.length; i += BATCH) {
      const slice = HOUNIAO_KB.slice(i, i + BATCH);
      const { embeddings } = await fetchEmbeddingBatch(slice.map((c) => c.text));
      await ctx.runMutation(internal.kb.insertBatch, {
        items: slice.map((c, j) => ({ ...c, embedding: embeddings[j] })),
      });
      done += slice.length;
    }
    return { ingested: done };
  },
});

// RAG 检索：嵌入问题 → 向量搜索 top-k → 返回带出处的文本块。供 aiReply 使用。
export async function retrieveKb(
  ctx: ActionCtx,
  query: string,
  k = 4,
): Promise<{ title: string; source: string; text: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const { embedding } = await fetchEmbedding(trimmed);
    const hits = await ctx.vectorSearch('kbChunks', 'embedding', { vector: embedding, limit: k });
    if (!hits.length) return [];
    return await ctx.runQuery(internal.kb.fetchChunks, { ids: hits.map((h) => h._id) });
  } catch (e) {
    console.error('[kb] retrieve failed', e);
    return [];
  }
}
