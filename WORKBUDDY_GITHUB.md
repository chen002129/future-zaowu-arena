# GitHub ↔ WorkBuddy 接管说明

## 固定身份

- 项目：未来造物赛场
- GitHub 目标仓库：`chen002129/future-zaowu-arena`
- WorkBuddy 已上线应用 locator：`wbapp_p5IqiBBFBjDwpJuLsE7tgl`
- 线上地址：`https://future-zaowu-arena.app.workbuddy.host/`
- GitHub 默认分支：`main`

## 唯一原则

GitHub `main` 作为代码唯一来源。不要在 WorkBuddy 里另起一套长期分叉。

WorkBuddy 已发布网页不会因为 GitHub 有新 commit 自动更新。每次代码变更后，WorkBuddy 必须针对**同一个 locator**执行“更新发布”，不要新建应用，否则会产生新链接和双版本。

## WorkBuddy 第一次接管时粘贴这段指令

请把 GitHub 仓库 `chen002129/future-zaowu-arena` 作为“未来造物赛场”的唯一代码源。
这是现有已上线应用，不要新建应用；必须继续使用 locator `wbapp_p5IqiBBFBjDwpJuLsE7tgl`。
以后开始修改前先同步 `main` 最新版本；修改后先按 `AGENTS.md` 执行校验，再提交并推送 GitHub。
需要上线时，针对这个现有应用执行“更新发布”，保持原线上链接 `https://future-zaowu-arena.app.workbuddy.host/` 不变。
如果 GitHub 与本地有冲突，以 GitHub `main` 为基准，先展示差异再合并，不要静默覆盖。

## 数据改动标准流程

1. 修改 `site/data/events.json`。
2. `node tools/verify.js`。
3. `node tools/build-mp-data.js`。
4. commit + push 到 GitHub `main`。
5. WorkBuddy 同步最新 `main`。
6. 对 locator `wbapp_p5IqiBBFBjDwpJuLsE7tgl` 执行“更新发布”。
7. 验证 `https://future-zaowu-arena.app.workbuddy.host/data/events.json` 返回 200。

## 页面代码改动流程

修改 `site/` 后同样先校验、commit、push，再由 WorkBuddy 对现有应用“更新发布”。

## 小程序

小程序是离线包。`build-mp-data.js` 只负责生成数据文件；微信小程序端仍需要重新上传版本才会对用户生效。
