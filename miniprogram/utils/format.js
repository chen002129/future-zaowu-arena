/* 通用格式化：必须与 design/mvp.html 保持同一套规则，H5 与小程序表现才一致 */

/** 2026-10-09 → 10.09；无日期 → 待定 */
function fmtDate(d) {
  if (!d) return '待定';
  const p = String(d).split('-');
  return p.length >= 3 ? p[1] + '.' + p[2] : String(d);
}

/** 2026-10-09 → 2026.10.09；无日期 → 待定 */
function fmtFull(d) {
  if (!d) return '待定';
  return String(d).replace(/-/g, '.');
}

/** 距报名截止剩余天数（以当天 23:59 计），无日期返回 9999 */
function daysLeft(d) {
  if (!d) return 9999;
  const t = new Date(String(d) + 'T23:59:00').getTime();
  if (isNaN(t)) return 9999;
  return Math.ceil((t - Date.now()) / 86400000);
}

/** 剩余天数 → 倒计时三段 */
function countdown(d) {
  if (!d) return { ended: false, text: '待公布', soon: false };
  const t = new Date(String(d) + 'T23:59:00').getTime();
  const diff = t - Date.now();
  if (isNaN(t) || diff <= 0) return { ended: true, text: '已截止', soon: false };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return {
    ended: false,
    soon: days <= 7,
    days: days,
    text: days + ' 天 ' + hours + ' 时 ' + mins + ' 分'
  };
}

/** 分钟数 → 相对时间 */
function ago(m) {
  if (m < 1) return '刚刚';
  if (m < 60) return Math.round(m) + ' 分钟前';
  const h = m / 60;
  if (h < 24) return Math.floor(h) + ' 小时前';
  const d = Math.floor(h / 24);
  return d === 1 ? '昨天' : d + ' 天前';
}

/** 来源层级 → 中文标签（L1 一手源 / L2 聚合源） */
function tierLabel(tier) {
  return tier === 'primary' ? '一手源' : '聚合源';
}

module.exports = {
  fmtDate,
  fmtFull,
  daysLeft,
  countdown,
  ago,
  tierLabel
};
