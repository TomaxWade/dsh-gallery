# dsh-gallery Skill：对话中展示图片卡片

当用户要**参考图、素材、概念配图、图片对比**等"答案是一张图"的需求时，使用本 Skill 的工作流。

## 工作流

1. **搜索**：调用 `image_search` 工具取候选图（默认 Wikimedia 优先、Openverse 次之、国内必应图搜兜底；必应已启用严格安全搜索）。
2. **筛选**：若 `image_search` 返回 `filteredByVision: true`，调用 `vision_curate` 对候选筛选：
   - 只保留 `relevant=true` 且 `safety=true` 的图；
   - 使用返回的 `caption` 作为卡片里的一句话说明。
3. **展示**：在回复中输出一个 `dsh-gallery` 围栏：

````text
```dsh-gallery
{"title":"标题","filtered":true,"images":[{"url":"https://...","alt":"...","caption":"一句话说明","source":"Wikimedia Commons","sourceUrl":"https://..."}]}
```
````

## 围栏契约（必须遵守）

- `url` 只能是 `https:`；**禁止** data: URL 与本地路径；每张卡最多 8 张图。
- 只使用 `image_search` 返回的候选 `url`（已是展示优化图）与 `sourceUrl`，**禁止编造**图片链接。
- 经过 `vision_curate` 且全部通过的图：`filtered: true`。
- 视觉模型未配置或筛选失败：仍可展示搜索结果，但 `filtered: false`，正文明示"未经视觉模型复核"；此时**优先展示国内必应图搜的结果**（严格安全搜索 + 相关度排序，零配置安全兜底）。
- JSON 严格合法；非法 JSON 会退化成普通代码块。
- 正文简短引导即可，不要堆 URL 列表；搜索无结果时如实说明并建议换词。

## 隐私与安全

- 图片经用户配置的视觉模型识别时会发送到对应厂商；这是筛选能力的代价，正文不夸大"本地处理"。
- 不展示用户未要求的内容；`safety=false` 的图绝不放入围栏。
