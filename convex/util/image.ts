// 文生图：走 OpenAI 兼容的 /v1/images/generations。
// 默认复用聊天网关（ZenMux 等）的 URL/Key，也可单独用 IMAGE_* 覆盖，方便后端切换 MaaS。
//   IMAGE_API_URL  (默认 LLM_API_URL)   — 不带结尾斜杠
//   IMAGE_API_KEY  (默认 LLM_API_KEY)
//   IMAGE_MODEL    (默认 gpt-image-1)
//   IMAGE_SIZE     (默认 1024x1024)
import { retryWithBackoff } from './llm';

function imageConfig() {
  const url = process.env.IMAGE_API_URL ?? process.env.LLM_API_URL ?? process.env.OPENAI_API_BASE;
  if (!url) {
    throw new Error('未配置文生图网关：请 npx convex env set IMAGE_API_URL 或 LLM_API_URL');
  }
  return {
    url: url.replace(/\/$/, ''),
    apiKey: process.env.IMAGE_API_KEY ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY,
    model: process.env.IMAGE_MODEL ?? 'gpt-image-1',
    size: process.env.IMAGE_SIZE ?? '1024x1024',
  };
}

async function toBlob(result: { data?: { b64_json?: string; url?: string }[] }): Promise<Blob> {
  const item = result.data?.[0];
  if (item?.b64_json) {
    const binary = atob(item.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }
  if (item?.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error(`下载图片失败 ${img.status}`);
    return await img.blob();
  }
  throw new Error('文生图返回为空');
}

// 生成一张图片，返回 PNG Blob（调用方负责存入 Convex storage）。
// 传入 reference 时走 /v1/images/edits（image edit）——用首格图锁定主角 + 色板 + 沙雕材质，
// 保证连环画跨格视觉一致；不传则普通文生图。
export async function generateImage(prompt: string, reference?: Blob): Promise<Blob> {
  const config = imageConfig();
  const mode = reference ? 'edit(image+prompt)' : 't2i(prompt-only)';
  const refKB = reference ? Math.round(reference.size / 1024) : 0;
  console.log(
    `[DEBUG][image] generateImage 入口: mode=${mode} model=${config.model} size=${config.size} promptChars=${prompt.length} refKB=${refKB} host=${config.url}`,
  );
  const { result, ms, retries } = await retryWithBackoff(async () => {
    let resp: Response;
    if (reference) {
      const form = new FormData();
      form.append('model', config.model);
      form.append('prompt', prompt);
      form.append('size', config.size);
      form.append('n', '1');
      form.append('image', reference, 'reference.png');
      resp = await fetch(config.url + '/v1/images/edits', {
        method: 'POST',
        // 不要手动设 Content-Type，让 fetch 自动带上 multipart boundary。
        headers: config.apiKey ? { Authorization: 'Bearer ' + config.apiKey } : {},
        body: form,
      });
    } else {
      resp = await fetch(config.url + '/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: 'Bearer ' + config.apiKey } : {}),
        },
        body: JSON.stringify({ model: config.model, prompt, n: 1, size: config.size }),
      });
    }
    if (!resp.ok) {
      throw {
        retry: resp.status === 429 || resp.status >= 500,
        error: new Error(`文生图失败 ${resp.status}: ${await resp.text()}`),
      };
    }
    return (await resp.json()) as { data?: { b64_json?: string; url?: string }[] };
  });

  // ms = 实际成功那次请求的耗时；retries>0 说明命中了 429/5xx 退避（[1s,10s,20s]），是"很慢"的常见元凶。
  const t0 = Date.now();
  const blob = await toBlob(result);
  console.log(
    `[DEBUG][image] generateImage 完成: mode=${mode} apiMs=${ms} retries=${retries} toBlobMs=${Date.now() - t0} outKB=${Math.round(blob.size / 1024)} returnedAs=${result.data?.[0]?.b64_json ? 'b64' : result.data?.[0]?.url ? 'url(需再下载)' : 'empty'}`,
  );
  return blob;
}
