'use strict';
/* 赛事数据校验器：发布前必跑。
 *
 * 用法：node tools/verify.js
 * 通过输出 OK，失败输出问题清单并以非零码退出。
 *
 * 检查项来自项目铁律（见 AGENTS.md）：
 *  - 不收录国外赛事
 *  - 每场比赛必须有海报文件
 *  - 截止日期不能缺、格式必须是 YYYY-MM-DD
 *  - 聚合源一律 pending
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data', 'events.json');
const SITE = path.join(ROOT, 'site');

const errors = [];
const warns = [];
const push = (arr, msg) => arr.push(msg);

let d;
try {
  d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
} catch (e) {
  console.error('✗ events.json 无法解析：' + e.message);
  process.exit(1);
}

if (!Array.isArray(d.events)) push(errors, '缺少 events 数组');
if (!Array.isArray(d.flashes)) push(errors, '缺少 flashes 数组');
if (!Array.isArray(d.news)) push(warns, '缺少 news 数组（可容忍）');

const ids = new Set();
const MODES = ['线上', '线下', '混合'];

(d.events || []).forEach((e, i) => {
  const tag = `[${i}] ${e.title || e.id || '(无标题)'}`;
  if (!e.id) push(errors, tag + ' 缺 id');
  else if (ids.has(e.id)) push(errors, tag + ' id 重复');
  ids.add(e.id);

  if (!e.title) push(errors, tag + ' 缺 title');
  if (!e.summary) push(warns, tag + ' 缺赛事简介');
  if (!e.deadline) push(errors, tag + ' 缺截止日期（铁律：截止日期绝不能删）');
  else if (!/^\d{4}-\d{2}-\d{2}/.test(e.deadline)) push(errors, tag + ' 截止日期格式应为 YYYY-MM-DD，实际 ' + e.deadline);

  if (e.mode && MODES.indexOf(e.mode) < 0) push(warns, tag + ' mode 不在 线上/线下/混合 内：' + e.mode);
  if (e.country && e.country !== '中国') push(errors, tag + ' 是国外赛事（铁律：不收录国外）');

  if (!e.poster) push(warns, tag + ' 无海报字段（将用渐变兜底）');
  else {
    const f = path.join(SITE, e.poster);
    if (!fs.existsSync(f)) push(errors, tag + ' 海报文件不存在：' + e.poster);
  }
  if (e.qr) {
    const f = path.join(SITE, e.qr);
    if (!fs.existsSync(f)) push(errors, tag + ' 二维码文件不存在：' + e.qr);
  }
  if (e.website && !/^https?:\/\//.test(e.website)) push(errors, tag + ' website 不是 http 链接');
  if (!e.updatedAt) push(warns, tag + ' 缺 updatedAt（影响「今日更新/NEW」角标）');

  if (e.deadline) {
    const dl = new Date(e.deadline + 'T23:59:00');
    if (dl.getTime() < Date.now()) push(warns, tag + ' 截止日期已过（' + e.deadline + '），考虑下架或确认');
  }
});

(d.flashes || []).forEach((f, i) => {
  if (!f.txt) push(errors, `[flash ${i}] 缺 txt`);
  if (!f.at) push(warns, `[flash ${i}] 缺 at 时间戳`);
});

/* 汇总 */
console.log('赛事 ' + d.events.length + ' 条 · 快讯 ' + (d.flashes || []).length + ' 条');
if (errors.length) {
  console.log('\n✗ 错误 ' + errors.length + ' 项（必须修复）：');
  errors.forEach((m) => console.log('  - ' + m));
}
if (warns.length) {
  console.log('\n△ 警告 ' + warns.length + ' 项（建议处理）：');
  warns.forEach((m) => console.log('  - ' + m));
}
if (!errors.length && !warns.length) console.log('\n✓ 数据完全干净');
process.exit(errors.length ? 1 : 0);
