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
  "chg": { "赛事id": "旧截止日期" },     // 截止时间变更留痕，禁止静默改数字
  "events": [ …赛事… ],
  "flashes": [ { "txt","src","auto","at"(ISO 时间戳) } ],
  "news": [ { "tag","t","s" } ]
}
```

赛事条目字段：`id / title / src / tier / verifyState / mode(线上|线下|混合) / city / tags / deadline(YYYY-MM-DD) / prize / theme / tracks / tech / summary / website(报名链接) / poster(相对 site/ 的路径) / qr / updatedAt(ISO) / ended / dateRange / teamSize / organizer / agenda[{d,t}]`。

`updatedAt / at` 用真实时间戳，页面自动换算「N 分钟前」「今日更新」「NEW」角标。**新加内容就是填当前时间，旧内容别动。**

## 日常操作（任何 AI 照此执行）

### 加一场赛事 / 改信息
1. 编辑 `site/data/events.json`（新增往 `events` 数组追加；海报放进 `site/assets/posters/`，命名 `p<md5(id)前10>.jpg`）
2. `node tools/verify.js` 校验（必须通过）
3. `node tools/build-mp-data.js` 生成小程序份数据
4. 若改动涉及页面本身才需要重新发布；纯数据变更免发布

### 每日采集（半自动流程）
1. `node tools/collect.js` → 抓 HackerTrip 公开接口，产出 `tools/inbox/*-*.json/.md` 待确认清单（`approve` 全为 null）
2. 把清单整理给用户确认；**确认后**把对应条目 `approve` 改为 `true`
3. `node tools/apply-inbox.js` 合入正式数据（自动追加快讯、截止变更自动留痕到 `chg`）
4. `node tools/verify.js` → `node tools/build-mp-data.js` → 如需发布见下节

### 发布
- 网页：WorkBuddy 的 `workbuddy_sites_deploy`，`directory: site`，`domainPrefix: future-zaowu-arena`，`applicationId: wbapp_p5IqiBBFBjDwpJuLsE7tgl`（覆盖发布，链接不变）
- **发布后必须 curl 验证**：`curl -s -o /dev/null -w "%{http_code}" https://future-zaowu-arena.app.workbuddy.host/data/events.json`
- 小程序：数据包变了要重新上传版本（微信离线包机制，无法实时）；账号注册/绑定流程见 `docs/部署方案.md`

## 铁律（违反过的教训，必须遵守）

1. **赛事信息的截止日期绝不能删**。卡片角标、详情页倒计时、时间线都依赖它。用户没让删就别动。
2. **每场比赛必须有真实海报**。从主办方官网/官方渠道抓 `og:image` 等真实图，本地化存储；抓不到用深色渐变兜底（代码内置），**禁止用橙色系占位图**。
3. **不收录国外赛事**。`country !== '中国'` 一律不放。
4. **聚合源（HackerTrip 等）给的信息只是线索**。报名状态/截止/奖金/场地/参赛资格/主办方身份六项，发布前须回溯主办方官网核验；核验不了就 `verifyState: "pending"`，**界面上不显示「待核验」字样**（用户明确要求过），但不许把它伪装成已核验。
5. **不显示数据来源链路**（如「来自 XX 聚合站」），界面上不出现采集痕迹。
6. **两端同源**：网页和小程序的数据都出自 `site/data/events.json`，改数据后跑 `build-mp-data.js`，不要手改 `miniprogram/data/*.js`。
7. **改完 site/ 立即发布并 curl 验证**，不要只改本地。
8. **不做账号/登录体系**（用户 2026-10-07 明确决定），收藏只存本机 + 设备同步码，别加回任何鉴权。
9. **`ended` 字段不可信**，判断是否截止以 `deadline` 日期计算为准；已截止赛事应及时下架。
10. **`.workbuddy/` 是项目数据目录，永远不要删除**。
11. 用户截图问「这是怎么回事」是在提问，**不是删除指令**——先回答，别动手改。

## 环境说明

- Node 用托管版：`C:/Users/20173/.workbuddy/binaries/node/versions/22.22.2-6/node.exe`
- 采集接口：`https://hackertrip.space/api/hackathons`（公开、免认证、含海报），方法与合规细节见 `docs/抓取源清单.md`
- 更多赛事线索来源（公众号/小红书/飞书表单不可抓，需人工粘链接解析）见同一文档

## 当前状态（2026-10-07）

- 网页已上线 9 场活跃赛事，全真实海报，无登录、无来源链路
- 小程序工程已同步数据，待用户注册微信小程序账号后发体验版
- 公众号 / 视频号「未来造物科创」二维码已上线（`site/assets/qr-gzh.jpg`、`qr-sph.jpg`）
- 每日采集定时任务：由 WorkBuddy automation 承担（账号级配置，非代码）
