# 动态后端

当前网站已经改成 **Cloudflare Worker + D1 + R2 + 静态前端资源** 架构。

## 运行逻辑

- `site/`：保留原前端视觉与交互。
- `/api/content`：前端优先从这里读取动态数据。
- D1：保存赛事、快讯、精选专栏。
- R2：保存赛事海报、报名二维码等媒体。
- 若 D1 暂未初始化或暂时不可用，Worker 会回退读取 `site/data/events.json`，所以迁移期间不会白屏。
- `/media/:key`：从 R2 返回图片。

## 数据表

见 `worker/migrations/0001_init.sql`。

## 管理接口

以下接口要求 `Authorization: Bearer <ADMIN_TOKEN>`：

- `POST /api/admin/competition`
- `POST /api/admin/article`
- `POST /api/admin/flash`
- `PUT /api/admin/media/:key`

`ADMIN_TOKEN` 只作为 Worker secret 配置，不写入 GitHub。

## Cloudflare 绑定

`wrangler.jsonc` 已声明：

- D1 binding: `DB`
- R2 binding: `MEDIA`
- Assets binding: `ASSETS`

首次部署时可由 Cloudflare 自动创建 D1 / R2 资源，或之后改成明确的 database_id / bucket_name。

## 发布原则

- 内容更新：写 D1/R2，不需要重新部署 UI。
- UI/Worker 代码更新：走 GitHub 版本管理，确认后再部署。
