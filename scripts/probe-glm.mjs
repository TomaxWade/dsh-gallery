// dsh-gallery 开发探测脚本：验证 GLM 视觉 API 合同（不打印 key）
// 用法: node scripts/probe-glm.mjs [model-id] [本地图片路径]
// 读取 .env.local（git 已忽略）。输出只含状态、模型 id 与回答文本。
// 实测坑：供应商侧拉取海外图源会超时（1210），故视觉调用固定走
// 本地取图 → base64 直传（与插件运行时管线一致）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const BASE = process.env.DSH_GALLERY_VISION_BASE_URL ?? env.DSH_GALLERY_VISION_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4';
const KEY = process.env.DSH_GALLERY_VISION_KEY ?? env.DSH_GALLERY_VISION_KEY;
const MODEL = process.argv[2] ?? env.DSH_GALLERY_VISION_MODEL ?? 'glm-4.6v-flash';

if (!KEY) {
  console.error('missing DSH_GALLERY_VISION_KEY in .env.local');
  process.exit(2);
}

async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }
  return { status: res.status, data };
}

// 1) 模型列表：找视觉相关模型 id
const list = await call('/models');
console.log('== GET /models status', list.status);
if (list.data?.data) {
  const ids = list.data.data.map((m) => m.id);
  console.log('total models:', ids.length);
  console.log('vision-ish ids:', ids.filter((i) => /vision|4\.6v|flash/i.test(i)).slice(0, 40).join(', '));
} else {
  console.log('list body:', JSON.stringify(list.data).slice(0, 300));
}

// 2) 最小真实视觉调用（本地图 base64 直传）
const imagePath = process.argv[3] ?? fileURLToPath(new URL('../output/browser-test/evidence.png', import.meta.url))
let dataUrl
try {
  const bytes = readFileSync(imagePath)
  dataUrl = `data:image/png;base64,${bytes.toString('base64')}`
} catch {
  console.error(`本地图片不可读: ${imagePath}（请给第二个参数指定存在的 PNG）`)
  process.exit(2)
}
const payload = {
  model: MODEL,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '这张图的主体是什么？用一句话回答。' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ],
  max_tokens: 300
};
const t0 = Date.now();
const r = await call('/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
console.log('== vision call model=', MODEL, 'status', r.status, 'elapsed', Date.now() - t0, 'ms');
if (r.data?.error) {
  console.log('error:', JSON.stringify(r.data.error).slice(0, 400));
} else {
  console.log('answer:', r.data?.choices?.[0]?.message?.content?.slice(0, 300));
  console.log('model used:', r.data?.model);
  console.log('usage:', JSON.stringify(r.data?.usage));
}
