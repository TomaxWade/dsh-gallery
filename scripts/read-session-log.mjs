// 会话日志诊断工具：解压并检索 DSH 会话 JSONL（zstd，用 node 内置 zlib）。
// 用法: node scripts/read-session-log.mjs <会话目录> [grep正则] [尾部行数]
// 只打印脱敏摘要：命中行截断到 400 字符，不整行输出（工具结果可能含正文）。
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const [dir, pattern, tailArg] = process.argv.slice(2)
if (!dir) {
  console.error('usage: node scripts/read-session-log.mjs <session-dir> [regex] [tail-lines]')
  process.exit(2)
}
const file = `${dir.replace(/\\+$/, '')}/session.jsonl.zstd`
const raw = readFileSync(file)
// 会话日志是逐次追加的独立 zstd 帧拼接（非单一流，流式 API 只解首帧）：
// 按魔数 28 B5 2F FD 切帧、逐帧同步解压后拼接。
const frames = []
for (let i = 0; i < raw.length - 3; i++) {
  if (raw[i] === 0x28 && raw[i + 1] === 0xb5 && raw[i + 2] === 0x2f && raw[i + 3] === 0xfd) frames.push(i)
}
const parts = []
for (let j = 0; j < frames.length; j++) {
  const start = frames[j]
  const end = j + 1 < frames.length ? frames[j + 1] : raw.length
  try {
    parts.push(zstdDecompressSync(raw.subarray(start, end)).toString('utf8'))
  } catch {
    // 跳过无法解压的帧（如末尾半帧）
  }
}
const text = parts.join('')
const lines = text.split(/\r?\n/).filter((line) => line.length > 0)
console.log(`总行数: ${lines.length}`)

if (pattern === 'system') {
  // 特殊模式：检查最新 request/header 的 system 是否包含插件注入
  let lastHeader = null
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('"type":"request/header"')) {
      lastHeader = lines[i]
      break
    }
  }
  if (lastHeader === null) {
    console.log('未找到 request/header 行')
  } else {
    let system = null
    try {
      const parsed = JSON.parse(lastHeader)
      system = parsed?.data?.header?.system ?? null
    } catch {
      system = null
    }
    if (typeof system !== 'string') {
      console.log('system 字段提取失败')
    } else {
      console.log('system 长度:', system.length)
      console.log('包含 dsh-gallery 围栏教学:', system.includes('dsh-gallery'))
      console.log('包含 image_search 工具说明:', system.includes('image_search'))
      const index = system.indexOf('dsh-gallery')
      if (index >= 0) console.log('围栏教学片段:', system.slice(Math.max(0, index - 80), index + 200))
    }
  }
} else if (pattern) {
  const re = new RegExp(pattern, 'i')
  const hits = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => re.test(entry.line))
  console.log(`匹配 "${pattern}" 的行数: ${hits.length}`)
  for (const hit of hits.slice(-60)) {
    console.log(`--- L${hit.index + 1} ---`)
    console.log(hit.line.slice(0, 400))
  }
} else {
  const tail = Number(tailArg) || 12
  console.log(`尾部 ${tail} 行：`)
  for (const line of lines.slice(-tail)) {
    console.log(line.slice(0, 300))
  }
}
