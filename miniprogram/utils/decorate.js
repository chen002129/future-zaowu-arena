/* 赛事视图模型：把数据层字段加工成界面直接可用的形态
 * 发现页与收藏页共用，避免两处逻辑分叉。
 */
const EV = require('../data/events.js');
const F = require('./format.js');

/* 一手源（L1）：字段即结论；其余为聚合源（L2）：只给线索，须回溯主办方核验 */
const TIER1 = ['LUMA', '阿里云天池', '腾讯云官网', 'GOSIM 官网', 'lablab.ai', 'ETHGlobal'];

/* 24 小时内新收录 */
const FRESH_WINDOW = 1440;

/* 截止时间变更留痕：正式环境由后端 refreshStatus 写入 deadlineHistory */
const CHG = { 'caltech-mathathon': '2026-09-28' };

function decorate(e) {
  const d = F.daysLeft(e.deadline);
  const ended = !!e.ended || (!!e.deadline && d < 0);
  const tier = e.tier || (TIER1.indexOf(e.src) >= 0 ? 'primary' : 'aggregator');
  const chg = CHG[e.id] || null;

  let badge = '报名中';
  let badgeCls = '';
  if (ended) { badge = '已结束'; badgeCls = 'ended'; }
  else if (e.deadline && d <= 7) { badge = '剩 ' + d + ' 天'; badgeCls = 'soon'; }

  return {
    id: e.id,
    title: e.title,
    src: e.src,
    tier: tier,
    tierLabel: F.tierLabel(tier),
    theme: e.theme || (e.tags || []).join(' · ') || '',
    mode: e.mode,
    city: e.city,
    tags: (e.tags || []).slice(0, 2),
    featured: !!e.featured,
    poster: e.poster || '',
    posterOk: !!e.poster,
    deadlineText: F.fmtDate(e.deadline),
    metaPre: (e.prize || '奖金待公布') + ' · ' + (e.city || '线上') + ' · ',
    metaDate: F.fmtDate(e.deadline) + ' 截止',
    dateRed: !!chg || (!ended && !!e.deadline && d <= 7),
    badge: badge,
    badgeCls: badgeCls,
    fresh: (e.up || 0) <= FRESH_WINDOW,
    chg: !!chg,
    up: e.up || 0,
    dl: d,
    ended: ended
  };
}

function decorateById(id) {
  const raw = EV.filter(function (x) { return x.id === id; })[0];
  return raw ? decorate(raw) : null;
}

/* 筛选项从真实数据里统计：线上/线下固定，其余取出现频次最高的标签 */
function buildChips() {
  const c = {};
  EV.forEach(function (e) {
    (e.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; });
  });
  const top = Object.keys(c)
    .sort(function (a, b) { return c[b] - c[a]; })
    .filter(function (t) { return !/^\d+$/.test(t); })
    .slice(0, 7);
  return ['全部', '线上', '线下'].concat(top);
}

module.exports = {
  EV: EV,
  TIER1: TIER1,
  FRESH_WINDOW: FRESH_WINDOW,
  CHG: CHG,
  decorate: decorate,
  decorateById: decorateById,
  buildChips: buildChips
};
