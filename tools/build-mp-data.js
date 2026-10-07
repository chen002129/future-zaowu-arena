'use strict';
/* 由 site/data/events.json（唯一数据源）生成小程序端数据文件。
 *
 * 用法：node tools/build-mp-data.js
 * 产出：
 *   miniprogram/data/events.js   赛事（updatedAt 换算回 up 分钟数）
 *   miniprogram/data/flashes.js  快讯（at 换算回 m 分钟数）
 *
 * 为什么换算：小程序端视图层（utils/decorate.js / 页面）读的是 up / m 分钟数，
 * 本脚本保证小程序端零改动即可拿到最新数据。
 *
 * 之后：小程序数据变了需要重新上传版本才生效（微信离线包机制）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'site', 'data', 'events.json');
const MP = path.join(ROOT, 'miniprogram', 'data');

const db = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const now = Date.now();
const minsOf = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return isNaN(t) ? 0 : Math.max(0, Math.round((now - t) / 60000));
};

/* ---------- events.js ---------- */
const events = db.events.map((e) => {
  const { updatedAt, ...rest } = e;
  return { up: minsOf(updatedAt), ...rest };
});
const evHead = '/* 自动生成，勿手改。源：site/data/events.json（node tools/build-mp-data.js） */\nmodule.exports = [\n';
const evBody = events.map((e) => '  ' + JSON.stringify(e) + ',\n').join('');
const evTail = '];\n';
fs.writeFileSync(path.join(MP, 'events.js'), evHead + evBody + evTail, 'utf8');

/* ---------- flashes.js ---------- */
const flashes = db.flashes.map((f) => {
  const { at, ...rest } = f;
  return { m: minsOf(at), ...rest };
});
const flHead = '/* 实时快讯：auto = 系统自动监测生成 / 人工 = 公众号或后台发布。自动生成，勿手改。源：site/data/events.json */\nmodule.exports = [\n';
const flBody = flashes.map((f) => '  ' + JSON.stringify(f) + ',\n').join('');
const flTail = '];\n';
fs.writeFileSync(path.join(MP, 'flashes.js'), flHead + flBody + flTail, 'utf8');

console.log('已生成 miniprogram/data/events.js（' + events.length + ' 条）与 flashes.js（' + flashes.length + ' 条）');
console.log('提醒：小程序是离线包，需要重新上传版本后用户才能看到。');
