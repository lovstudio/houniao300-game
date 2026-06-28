// 生图落盘统一管线：优先转存七牛 CDN（imageUrl），失败回退 Convex storage（imageStorageId），绝不漏图。
// photoMemories 与 experience 两条生图链路共用此函数，带统一 timing log（requestId 串起 director→生图→落盘）。
import { ActionCtx } from '../_generated/server';
import { uploadToQiniu } from './qiniu';

// 一次生图请求的追踪 id，串起 director LLM → 生图 → 落盘三步的结构化日志。
export function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function storeGeneratedImage(
  ctx: ActionCtx,
  blob: Blob,
  namespace: string,
  requestId: string,
): Promise<{ imageUrl?: string; imageStorageId?: string; storeMs: number }> {
  const t = Date.now();
  const key = `${namespace}/${requestId}`;
  const outKB = Math.round(blob.size / 1024);
  try {
    const url = await uploadToQiniu(blob, key);
    const storeMs = Date.now() - t;
    console.log(`[gen] requestId=${requestId} stage=store sink=qiniu ms=${storeMs} outKB=${outKB}`);
    return { imageUrl: url, storeMs };
  } catch (e) {
    const id = await ctx.storage.store(blob);
    const storeMs = Date.now() - t;
    console.error(`[gen] requestId=${requestId} stage=store sink=convex ms=${storeMs} outKB=${outKB} 七牛失败回退`, e);
    return { imageStorageId: id, storeMs };
  }
}
