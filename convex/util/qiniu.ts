// 七牛云（Qiniu）对象存储上传：把生成的连环画 PNG 转存到 CDN，Convex 仅存 https URL。
// 运行在 Convex action 默认 runtime（有 crypto.subtle / fetch / FormData / Blob）。
// 配置全部走 Convex env vars（npx convex env set ...），不在源码硬编码密钥：
//   QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET / QINIU_DOMAIN / QINIU_PREFIX
// region z0 → 上传 host https://up-z0.qiniup.com 。

const UP_HOST = 'https://up-z0.qiniup.com';

function qiniuConfig() {
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET;
  const domain = process.env.QINIU_DOMAIN;
  const prefix = process.env.QINIU_PREFIX ?? '';
  if (!accessKey || !secretKey || !bucket || !domain) {
    throw new Error('七牛云未配置：需 QINIU_ACCESS_KEY/SECRET_KEY/BUCKET/DOMAIN');
  }
  return { accessKey, secretKey, bucket, domain: domain.replace(/\/$/, ''), prefix };
}

// 七牛 url-safe base64：标准 base64 后 '+'->'-'、'/'->'_'，保留 '=' 补位。
function urlSafeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

async function buildUploadToken(accessKey: string, secretKey: string, bucket: string): Promise<string> {
  const putPolicy = { scope: bucket, deadline: Math.floor(Date.now() / 1000) + 3600 };
  const encoder = new TextEncoder();
  const encodedPolicy = urlSafeBase64(encoder.encode(JSON.stringify(putPolicy)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPolicy));
  const encodedSign = urlSafeBase64(new Uint8Array(sig));
  return `${accessKey}:${encodedSign}:${encodedPolicy}`;
}

// 上传一张 PNG blob 到七牛，返回公开 https CDN URL（失败抛错，由调用方决定回退）。
// unique 用于拼出稳定且唯一的 key，例如 `${experienceId}-${panelIndex}-${Date.now()}`。
export async function uploadToQiniu(blob: Blob, unique: string): Promise<string> {
  const { accessKey, secretKey, bucket, domain, prefix } = qiniuConfig();
  const token = await buildUploadToken(accessKey, secretKey, bucket);
  const key = `${prefix}${unique}.png`;
  const form = new FormData();
  form.append('token', token);
  form.append('key', key);
  form.append('file', blob, key.split('/').pop());
  const res = await fetch(UP_HOST + '/', { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`七牛上传失败 ${res.status}: ${await res.text()}`);
  }
  return `${domain}/${key}`;
}
