// 把候鸟300知识库（Fumadocs mdx）抽取、清洗、分块，内置进游戏仓库供 RAG 检索。
// 用法：node scripts/build-houniao-kb.mjs [docsRepoPath]
// 默认源：/Users/mark/yoda/repositories/houniao300-docs/content/docs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = process.argv[2] || '/Users/mark/yoda/repositories/houniao300-docs/content/docs';
const OUT = new URL('../convex/data/houniao300Kb.ts', import.meta.url);
const MAX = 760; // 每块目标字符数
const MIN = 80; // 太短的块丢弃

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.mdx') || name.endsWith('.md')) out.push(p);
  }
  return out;
}

function clean(body) {
  return body
    // <Card title="X" description="Y" /> → X：Y（保留导航卡片里的信息）
    .replace(/<Card\b[^>]*?title="([^"]*)"[^>]*?description="([^"]*)"[^>]*?\/?>/g, '\n$1：$2\n')
    .replace(/<Card\b[^>]*?title="([^"]*)"[^>]*?\/?>/g, '\n$1\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/<[^>]+>/g, '') // 其余 JSX 标签
    .replace(/^import .*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 链接 → 文本
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunk(text, title, source) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const chunks = [];
  let heading = '';
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t.length >= MIN) chunks.push({ heading, text: t });
    buf = '';
  };
  for (const b of blocks) {
    const h = b.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      flush();
      heading = h[1].trim();
      continue;
    }
    if ((buf + '\n\n' + b).length > MAX) flush();
    buf = buf ? buf + '\n\n' + b : b;
  }
  flush();
  return chunks.map((c, i) => ({
    chunkId: `${source}#${i}`,
    source,
    title: c.heading ? `${title} · ${c.heading}` : title,
    text: c.text,
  }));
}

const files = walk(SRC).sort();
const all = [];
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  let title = '';
  let body = raw;
  if (fm) {
    const m = fm[1].match(/title:\s*"?([^"\n]+)"?/);
    title = m ? m[1].trim() : '';
    body = raw.slice(fm[0].length);
  }
  const rel = relative(SRC, f).replace(/\.(mdx?|md)$/, '');
  if (!title) title = rel;
  all.push(...chunk(clean(body), title, rel));
}

const header = `// 候鸟300 二零二六 知识库（自动生成，勿手改）。
// 源：houniao300-docs/content/docs，经 scripts/build-houniao-kb.mjs 抽取分块。
// 重新生成：node scripts/build-houniao-kb.mjs
export type KbChunk = { chunkId: string; source: string; title: string; text: string };

export const HOUNIAO_KB: KbChunk[] = ${JSON.stringify(all, null, 2)};
`;
writeFileSync(OUT, header, 'utf8');
console.log(`✓ ${files.length} 篇 → ${all.length} 块 → ${OUT.pathname}`);
