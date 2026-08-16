# dsh-gallery

> 🌏 English version: [README.md](README.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的**视觉输出通道插件**：让 Agent 在对话回复中插入一张**横向可滑动的多图卡片**，图片来自 CC 图库搜索，并经过一个可配置的视觉模型（默认智谱 GLM-4.6V-Flash）做相关性与安全筛选。

一句话：**给 DSH 的鲸鱼装上眼睛，再把看到的世界拿给你看。**

## 效果对比

| 豆包（官方聊天界面） | dsh-gallery（本插件） |
| --- | --- |
| <img src="assets/doubao.png" width="100%" alt="豆包展示效果"> | <img src="assets/dsh-gallery.png" width="100%" alt="dsh-gallery 展示效果"> |

## 能力

- 对话内多图卡片：横向滑动、点按放大、说明与来源标注、`未筛选` 徽标（未配置视觉模型时）
- 双工具：`image_search`（Wikimedia Commons / Openverse，CC 授权免 key）、`vision_curate`（相关/安全/一句话说明）
- 设置页「视觉模型」：API Key（本机凭据，write-only）+ 端点/模型/候选数/图源开关，保存即时生效
- 图源经代理可达：`DSH_GALLERY_HTTPS_PROXY`（或 HTTPS_PROXY/HTTP_PROXY）走 undici 标准 CONNECT 隧道

## 安装（本机开发，link 方式）

```powershell
cd <仓库目录>
pnpm install
pnpm run build          # 类型检查 + 产物 lib/index.js + lib/client.js
dsh plugin --profile web add link:<仓库目录绝对路径>
# 重启 DSH Web 生效
```

改客户端代码后热更新回路：`pnpm run build` → 页面 ≤1 秒自动热替换（DSH 内置 client HMR）；宿主改动需重启 DSH Web。

## 配置

| 途径 | 项 | 说明 |
| --- | --- | --- |
| 设置 → 视觉模型 | API Key / 端点 / 模型名 / 候选数 / 图源开关 | 推荐；Key 只存本机凭据，不回显 |
| 环境变量（启动 dsh web 前） | `DSH_GALLERY_VISION_KEY` / `DSH_GALLERY_VISION_BASE_URL` / `DSH_GALLERY_VISION_MODEL` / `DSH_GALLERY_HTTPS_PROXY` / `DSH_GALLERY_WIKIMEDIA_URL` / `DSH_GALLERY_OPENVERSE_URL` | env 优先于设置页 |
| 默认 | 端点 `https://open.bigmodel.cn/api/paas/v4`，模型 `glm-4.6v-flash`（免费） | 图源双开 |

## 验证命令

```powershell
pnpm test               # 单测+集成（本地假三端走真实 fetch），33 条
pnpm run test:browser   # 隔离 Chromium 浏览器验收，14 条（静态挂载/非法降级/动态注入/https白名单/lightbox/移动端横滑）
pnpm run build
node scripts\probe-glm.mjs glm-4.6v-flash   # 视觉 API 合同探测（不打印 key，读 .env.local）
```

## 真实验收（重启 DSH 后）

1. 新会话发："帮我找 5 张赛博朋克夜景参考图" → 预期：Agent 调 `image_search` → 回复中出现横向滑动图片卡片，点图放大、显示来源；未配置 Key 时卡片带「未筛选」。
2. "差速器内部结构长什么样，配图说明" → 同上（概念配图链路）。
3. 设置 → 视觉模型：填写 Key 后重试，卡片应去掉「未筛选」徽标（筛选生效）。

## 命名

`dsh-gallery`：gallery（画廊/图廊）准确描述"横向滑动的多图展示"，符合 DSH 生态 `dsh-*` 命名惯例。备选：`dsh-lookbook`（灵感册，更偏素材场景）。

## 许可证

[AGPL-3.0](LICENSE) —— 任何使用（含商用）免费，但衍生作品（尤其是闭源的网络部署）必须同样以 AGPL-3.0 开源。**闭源商用需另行取得商业授权（收费，联系作者）。**

Copyright (c) 2026 TomaxWade.

## 仓库边界

- 不提交任何 API Key、凭据、用户图片与运行时数据（`.env.local`、`output/`、`tmp/` 已忽略）。
- 内部设计文档（`docs/`）与项目规则（`AGENTS.md`）仅本地保留，不进公开仓库。
