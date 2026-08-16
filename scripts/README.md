# scripts 工具说明

## probe-glm.mjs

开发期探测脚本：验证视觉模型 API 合同（模型 id、图片输入方式、返回形状）。**不打印 API Key**。

```powershell
node scripts/probe-glm.mjs [model-id]
```

- 读取 `.env.local`（git 已忽略）中的 `DSH_GALLERY_VISION_BASE_URL` / `DSH_GALLERY_VISION_KEY` / `DSH_GALLERY_VISION_MODEL`；进程环境变量优先。
- 输出只含：`GET /models` 状态与视觉相关模型 id、一次最小真实视觉调用（蒙娜丽莎缩略图）的状态/耗时/回答/用量。
- 用途：换厂商或换模型时先跑一次确认合同，再改插件默认值。
