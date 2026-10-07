# AGENTS.md · 未来造物赛场（AI 赛事聚合）

> 给任何接手本项目的 AI / agent：读完这一页就能干活，不需要追问历史。
> 人类看的背景文档在 `docs/`；本文只讲「怎么维护」。

## 一句话

「未来造物赛场」聚合国内 AI 黑客松与数据竞赛，展示真实海报、报名截止倒计时与关键时间线。网页已上线：https://future-zaowu-arena.app.workbuddy.host/

## 目录速览

```
site/index.html            网页（单文件应用，UI/渲染逻辑都在这，数据不在）
site/data/events.json      ★ 唯一数据源（赛事 + 快讯 + 专栏）
site/assets/posters/       海报与报名二维码（本地文件，不热链外站）
miniprogram/               微信小程序端（页面 + 数据包）
tools/                     维护脚本（见下）
docs/                      背景文档（抓取源清单、部署方案、字段清单等）
.workbuddy/_backup/        历史归档（登录功能、旧版页面、一次性脚本）
```

## 核心机制：数据与代码分离

网页每次打开时 `fetch('data/events.json')` 渲染。**改数据 = 改 JSON，不用动 HTML，不用重新发布**（发布一次的站点会持续读到最新 JSON；若平台缓存 JSON，可用强刷或改文件名破缓存）。

`events.json` 结构：

```json
{
  "updatedAt": "ISO 时间戳",
  "chg": { "赛事id": "旧截止日期" },
  "events": [ …赛事… ],
  "flashes": [ { "txt","src","auto","at"(ISO 时间戳) } ],
  "news": [ { "tag","t","s" } ]
}
```

赛事条目字段：`id / title / src / tier / verifyState / mode(线上|线下|混合) / city / tags / deadline(YYYY-MM-DD) / prize / theme / tracks / tech / summary / website(报名链接) / poster(相对 site/ 的路径) / qr / updatedAt(ISO) / ended / dateRange / teamSize / organizer / agenda[{d,t}]`。

`updatedAt / at` 用真实时间戳，页面自动换算「N 分钟前」「今日更新」「NEW」角标。**新加内容就是填当前时间，旧内容别动。**

## 日常操作（任何 AI 照此执行）

### 加一场赛事 / 改信息
1. 编辑 `site/data/events.json`
2. `node tools/verify.js` 校验（必须通过）
3. `node tools/build-mp-data.js` 生成小程序份数据
4. 若改动涉及页面本身才需要重新发布；纯数据变更免发布

### 每日采集（半自动流程）
1. `node tools/collect.js`
2. 用户确认
3. `node tools/apply-inbox.js`
4. `node tools/verify.js` → `node tools/build-mp-data.js`

### 发布
- 网页：WorkBuddy 的 `workbuddy_sites_deploy`，`directory: site`，`domainPrefix: future-zaowu-arena`，`applicationId: wbapp_p5IqiBBFBjDwpJuLsE7tgl`（覆盖发布，链接不变）
- 发布后必须 curl 验证
- 小程序：数据包变了要重新上传版本

## 铁律

1. 截止日期绝不能删。
2. 每场比赛必须有真实海报。
3. 不收录国外赛事。
4. 聚合源关键字段须回溯主办方官网核验。
5. 不显示数据来源链路。
6. 两端同源。
7. 改完 site/ 立即发布并 curl 验证。
8. 不做账号/登录体系。
9. ended 字段不可信，以 deadline 为准。
10. .workbuddy/ 永远不要删除。
11. 截图提问不是删除指令。

## 当前状态（2026-10-07）

- 网页已上线 9 场活跃赛事
- 小程序工程已同步数据
- 每日采集定时任务由 WorkBuddy automation 承担
