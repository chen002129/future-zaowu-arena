# 未来造物赛场 · GitHub / CloudBase 发布说明

## 当前架构

- GitHub 仓库：`chen002129/future-zaowu-arena`
- 主分支：`main`
- CloudBase 环境：`ai-class-signup-d5fwtjd5b150455f`
- 前端目录：`site/`
- 赛事数据：`site/data/events.json`
- 赛事海报：`site/assets/posters/`

WorkBuddy 已退出正式发布链路。

## 两条更新链路

### 1. 动态内容更新

以下内容变化后，GitHub Actions 自动同步到 CloudBase：

- `site/data/**`
- `site/assets/posters/**`

对应工作流：

`.github/workflows/deploy-content-cloudbase.yml`

这条链路只更新赛事数据与赛事海报，不改 UI。

### 2. UI / 功能正式发布

修改 `site/index.html`、页面结构或功能时：

1. 先提交到 GitHub `main`
2. 不自动发布
3. 等用户明确说“上线 / 发布 / 确认更新”
4. 更新 `.deploy/release.json`
5. 触发 `.github/workflows/deploy-site-cloudbase.yml`
6. 全量部署 `site/` 到 CloudBase
7. 发布后检查线上页面

## 发布闸门

普通代码提交不得触发整站发布。

唯一允许触发正式整站部署的条件：

- 用户明确说“上线 / 发布 / 确认更新”
- 或在 GitHub 手工运行 `Release site to CloudBase`

## CloudBase 凭证

GitHub Actions 需要仓库 Secrets：

- `TCB_SECRET_ID`
- `TCB_SECRET_KEY`

环境 ID 不属于敏感信息，保存在：

`.deploy/cloudbase.json`

以后更换 CloudBase 环境，只需修改其中的 `envId`，无需重做项目。

## 数据规则

- 只收录中国区 AI 相关赛事
- 优先主办方/官方报名页
- 聚合站仅用于发现线索
- 截止时间、奖金、地点、参赛资格、主办方等关键信息尽量回官方核验
- 每场比赛尽量保存真实赛事海报
- 截止时间不得删除
- 网站与小程序继续保持同一数据源
