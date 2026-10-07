'use strict';
/* 把 tools/inbox/ 里 approve=true 的条目合入 site/data/events.json。
 *
 * 前置：collect.js 已跑过、海报已下载、用户已确认。
 * 用法：node tools/apply-inbox.js [inbox文件名，缺省取最新]
 *
 * 合入后必须：
 *   node tools/verify.js   校验
 *   node tools/build-mp-data.js   同步小程序数据
 *   重新发布 site/ 并 curl 验证
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data', 'events.json');
const INBOX_DIR = path.join(ROOT, 'tools', 'inbox');

/* ---------- 选 inbox 文件 ---------- */
let target = process.argv[2];
const files = fs.existsSync(INBOX_DIR)
  ? fs.readdirSync(INBOX_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];
if (!target) {
  if (!files.length) { console.log('inbox 目录为空，先跑 node tools/collect.js'); process.exit(0); }
  target = files[files.length - 1];
}
const inboxPath = path.join(INBOX_DIR, target);
if (!fs.existsSync(inboxPath)) { console.error('找不到 ' + inboxPath); process.exit(1); }

const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
const approved = (inbox.items || []).filter((x) => x.approve === true);
console.log('清单 ' + target + '：共 ' + (inbox.items || []).length + ' 条，已确认 ' + approved.length + ' 条');
if (!approved.length) {
  console.log('没有 approve=true 的条目，无事可做。');
  process.exit(0);
}

/* ---------- 合入 ---------- */
const db = JSON.parse(fs.readFileSync(DATA, 'utf8'));
if (typeof db.chg !== 'object' || db.chg === null || Array.isArray(db.chg)) db.chg = {};
let added = 0, updated = 0;
const nowISO = new Date().toISOString();

for (const x of approved) {
  const e = x.event;
  if (!e || !e.id) continue;
  const i = db.events.findIndex((t) => t.id === e.id);
  if (x.action === 'update' && i >= 0) {
    const old = db.events[i];
    if (old.deadline && old.deadline !== e.deadline) db.chg[e.id] = old.deadline; // 变更留痕
    db.events[i] = Object.assign({}, old, e, { updatedAt: nowISO, chgFrom: undefined });
    updated++;
  } else if (i < 0) {
    db.events.push(Object.assign({ featured: false, tech: [] }, e, { updatedAt: nowISO }));
    added++;
    // 新增赛事同步生成一条自动快讯
    db.flashes.unshift({
      auto: true, hot: false,
      txt: e.title + ' 开放报名，' + (e.deadline ? e.deadline.replace(/-/g, '.') + ' 截止' : '截止待定'),
      src: (e.organizer || '主办方') + ' · 自动监测',
      at: nowISO,
    });
    if (db.flashes.length > 30) db.flashes.length = 30;
  }
}

db.updatedAt = nowISO;
fs.writeFileSync(DATA, JSON.stringify(db, null, 2), 'utf8');
console.log('已合入：新增 ' + added + ' 条，更新 ' + updated + ' 条 → site/data/events.json');
console.log('\n下一步：');
console.log('  1. node tools/verify.js');
console.log('  2. node tools/build-mp-data.js   （同步小程序数据）');
console.log('  3. 重新发布 site/ 并 curl 验证线上');
