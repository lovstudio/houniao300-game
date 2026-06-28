import { v } from 'convex/values';
import { query, mutation, action, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { Doc } from './_generated/dataModel';
import { chatCompletion } from './util/llm';
import { newRequestId } from './util/generation';

const kindValidator = v.union(v.literal('venue'), v.literal('work'));

// ---- 查询：列出所有物料记录（含源图可访问 URL）----
export const list = query({
  args: { kind: v.optional(kindValidator) },
  handler: async (ctx, { kind }) => {
    const docs = kind
      ? await ctx.db
          .query('materials')
          .withIndex('kind', (q) => q.eq('kind', kind))
          .collect()
      : await ctx.db.query('materials').collect();
    return await Promise.all(
      docs.map(async (d) => ({
        ...d,
        sourceUrl: d.sourceStorageId ? await ctx.storage.getUrl(d.sourceStorageId) : null,
      })),
    );
  },
});

// ---- 浏览器直传：拿一个一次性上传 URL ----
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

async function upsert(ctx: { db: any }, key: string, patch: Record<string, unknown>) {
  const existing = (await ctx.db
    .query('materials')
    .withIndex('key', (q: any) => q.eq('key', key))
    .first()) as Doc<'materials'> | null;
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
    return existing._id;
  }
  return await ctx.db.insert('materials', { key, ...patch, updatedAt: Date.now() });
}

// ---- 绑定/替换源图：浏览器上传完拿到 storageId 后调用 ----
export const attachSource = mutation({
  args: {
    key: v.string(),
    kind: kindValidator,
    refId: v.string(),
    title: v.string(),
    storageId: v.string(),
    sourceName: v.optional(v.string()),
    capturedAt: v.optional(v.string()),
  },
  handler: async (ctx, { key, kind, refId, title, storageId, sourceName, capturedAt }) => {
    return await upsert(ctx, key, {
      kind,
      refId,
      title,
      sourceStorageId: storageId,
      sourceName,
      capturedAt,
      // 换了源图 → 之前的生成结果作废，回到待生成状态
      status: 'idle',
      generated: undefined,
      error: undefined,
    });
  },
});

// ---- 内部 mutation：供 action 回写状态/结果 ----
export const setStatus = internalMutation({
  args: {
    key: v.string(),
    status: kindStatus(),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    trace: v.optional(v.string()),
  },
  handler: async (ctx, { key, status, error, errorCode, trace }) => {
    await upsert(ctx, key, { status, error: error ?? undefined, errorCode: errorCode ?? undefined, trace });
  },
});

export const setResult = internalMutation({
  args: { key: v.string(), generated: v.string(), trace: v.optional(v.string()) },
  handler: async (ctx, { key, generated, trace }) => {
    await upsert(ctx, key, { status: 'ready', generated, error: undefined, errorCode: undefined, trace });
  },
});

export const getByKey = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const d = await ctx.db
      .query('materials')
      .withIndex('key', (q) => q.eq('key', key))
      .first();
    if (!d) return null;
    return { ...d, sourceUrl: d.sourceStorageId ? await ctx.storage.getUrl(d.sourceStorageId) : null };
  },
});

function kindStatus() {
  return v.union(
    v.literal('idle'),
    v.literal('generating'),
    v.literal('ready'),
    v.literal('error'),
  );
}

// ---- 真实 AI 生成管线：源图 → 结构化几何/图注 JSON ----
// 走 ZenMux（OpenAI 兼容网关）的 vision 接口，默认 Claude Sonnet 4.6。
const VENUE_SYSTEM = `你是空间测绘助手。给你一张某活动场所的实景照片，请输出该场所"内场平面图"的结构化 JSON，供 2D 俯视渲染使用。
坐标系：以照片像素为准，左上角 (0,0)，x 向右、y 向下，范围即照片宽高。
只输出一个 JSON 对象，不要任何解释或 markdown 代码块，结构如下：
{
  "subtitle": "一句话场景概述",
  "labels": [{ "id": "label-xxx", "label": "区域名", "x": 数字, "y": 数字 }],
  "rects": [{ "id": "xxx", "label": "可选", "x": 数字, "y": 数字, "width": 数字, "height": 数字, "kind": "wall|sand|sea|mound|bridge|path|stall|counter|stage|speaker|table|seat|sofa|aisle|entry|light", "walkable": true|false }],
  "circles": [{ "id": "xxx", "x": 数字, "y": 数字, "radius": 数字, "kind": "table|seat|sofa|light", "walkable": true|false }]
}
要点：识别照片中的墙体/摊位/吧台/舞台/桌椅/通道/灯光等，给出合理的矩形与圆形布局；通道与灯光设 walkable:true。`;

const WORK_SYSTEM = `你是艺术展陈布展助手。给你一件公共艺术装置的实景照片，请输出结构化 JSON，供作品点位卡片展示。
只输出一个 JSON 对象，不要任何解释或 markdown 代码块，结构如下：
{ "caption": "80字以内的作品视觉描述", "materials": ["主要材质/媒介"], "palette": ["主色1", "主色2"], "scale": "体量感（如：人体尺度/巨型/小型）" }`;

type VisionTrace = { requestId: string; model: string; durationMs: number; retries: number };

// 复用 llm.ts 的 chatCompletion（含 retryWithBackoff + 结构化日志），不再自己 fetch / 无 retry。
async function visionJSON(
  systemPrompt: string,
  imageUrl: string,
  userHint: string,
  requestId: string,
): Promise<{ generated: string; trace: VisionTrace }> {
  const model = process.env.MATERIALS_VISION_MODEL ?? 'anthropic/claude-sonnet-4.6';
  const { content, retries, ms } = await chatCompletion({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userHint },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.2,
  });
  if (!content) throw new Error('vision 返回为空');
  // 容错：去掉可能的 ```json 包裹，并校验是 JSON（解析失败 → SyntaxError → 归类 bad_json）。
  const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
  JSON.parse(cleaned);
  return { generated: cleaned, trace: { requestId, model, durationMs: ms, retries } };
}

// 失败归类：errorCode + 截断短消息（明细看日志），避免把整串 error 塞进 DB。
function classifyError(e: unknown): { errorCode: string; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  let errorCode = 'unknown';
  if (e instanceof SyntaxError) errorCode = 'bad_json';
  else if (/code (4\d\d|5\d\d)/.test(msg)) errorCode = 'llm_http';
  else if (msg.includes('返回为空')) errorCode = 'empty';
  return { errorCode, message: msg.length > 200 ? msg.slice(0, 199) + '…' : msg };
}

export const regenerate = action({
  args: { key: v.string(), hint: v.optional(v.string()) },
  handler: async (ctx, { key, hint }): Promise<{ ok: boolean; error?: string }> => {
    const doc = await ctx.runQuery(internal.materials.getByKey, { key });
    if (!doc) return { ok: false, error: '物料记录不存在，请先上传源图' };
    if (!doc.sourceUrl) return { ok: false, error: '尚未上传源图' };
    await ctx.runMutation(internal.materials.setStatus, { key, status: 'generating' });
    const requestId = newRequestId();
    try {
      const systemPrompt = doc.kind === 'venue' ? VENUE_SYSTEM : WORK_SYSTEM;
      const userHint = `物料：${doc.title}${hint ? `。补充：${hint}` : ''}`;
      const { generated, trace } = await visionJSON(systemPrompt, doc.sourceUrl, userHint, requestId);
      await ctx.runMutation(internal.materials.setResult, { key, generated, trace: JSON.stringify(trace) });
      return { ok: true };
    } catch (e) {
      const { errorCode, message } = classifyError(e);
      console.error(`[materials] requestId=${requestId} key=${key} errorCode=${errorCode}`, e);
      await ctx.runMutation(internal.materials.setStatus, {
        key,
        status: 'error',
        error: message,
        errorCode,
        trace: JSON.stringify({ requestId }),
      });
      return { ok: false, error: message };
    }
  },
});
