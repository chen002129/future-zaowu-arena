'use strict';
/* 赛事采集器：从 HackerTrip 公开接口抓取线索，与现有数据比对，产出「待确认清单」。
 *
 * 用法：node tools/collect.js
 * 产出：tools/inbox/YYYY-MM-DD-HHMM.json（机器可读） + 同名 .md（人可读摘要）
 *
 * 流程（半自动模式）：采集 → 比对 → 落 inbox（approve 全为 null）→
 *   人工/AI 整理清单给用户确认 → 用户点头后把对应条目 approve 改为 true →
 *   node tools/apply-inbox.js 合入正式数据。
 *
 * 遵守《docs/抓取源清单.md》第六章铁律：
 *  - HackerTrip 只是发现层（L2），六项关键字段（报名状态/截止/奖金/场地/资格/主办方）
 *    必须回溯主办方官网核验后才算数，因此本脚本产出的条目一律 verifyState='pending'
 *  - 自定义 UA、低频访问、不镜像转发其数据
 *  - 不收录国外赛事（country !== '中国' 一律跳过）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data', 'events.json');
const POSTER_DIR = path.join(ROOT, 'site', 'assets', 'posters');
const INBOX_DIR = path.join(ROOT, 'tools', 'inbox');

const UPSTREAM = 'https://hackertrip.space/api/hackathons';
const UA = 'FutureZaowuBot/1.0 (+https://future-zaowu-arena.app.workbuddy.host/)';
const MODE_MAP = { hybrid: '混合', online: '线上', 'in-person': '线下', inperson: '线下', offline: '线下' };

const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-').slice(0, 13); // YYYY-MM-DD-HHMM
const pad = (n) => String(n).padStart(2, '0');

function fmtRange(startISO, endISO) {
  if (!startISO) return '';
  const s = new Date(startISO), e = endISO ? new Date(endISO) : null;
  if (isNaN(s.getTime())) return '';
  const f = (d) => pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  return e && !isNaN(e.getTime()) ? f(s) + ' – ' + f(e) : f(s);
}

function cleanSummary(s) {
  if (!s) return '';
  return String(s)
    .replace(/^#+\s*/gm, '')          // 去 markdown 标题符
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* HackerTrip raw → 本项目赛事字段 */
function mapItem(raw) {
  const slug = raw.slug || raw.name || raw.id;
  const hash = crypto.createHash('md5').update(slug, 'utf8').digest('hex').slice(0, 10);
  const id = slug;
  const reg = raw.registration || {};
  const regDeadline = raw.registrationDeadline ? String(raw.registrationDeadline).slice(0, 10) : '';
  const isPast = !!raw.isPast ||
    (regDeadline && new Date(regDeadline + 'T23:59:59') < new Date());

  return {
    _raw: raw,
    skip: null,
    item: {
      id,
      title: raw.name || '',
      src: raw.hostOrganizer || 'HackerTrip',
      tier: 'aggregator',
      verifyState: 'pending', // 铁律：聚合源一律待核验
      mode: MODE_MAP[(raw.mode || '').toLowerCase()] || raw.mode || '混合',
      city: raw.city || '待公布',
      tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 4) : [],
      deadline: regDeadline,
      prize: raw.prizePool || '奖金见官网',
      featured: !!raw.isFeatured,
      theme: raw.theme || '',
      tracks: (raw.tracks || []).map((t) => (typeof t === 'string' ? t : t.title)).filter(Boolean),
      tech: [],
      summary: cleanSummary(raw.summary || raw.description || ''),
      website: reg.url || raw.website || '',
      poster: '',
      qr: '',
      updatedAt: now.toISOString(),
      ended: !!isPast,
      dateRange: fmtRange(raw.startDate, raw.endDate),
      teamSize: raw.teams || '',
      organizer: raw.hostOrganizer || '',
      agenda: (raw.agenda || []).map((a) => ({ d: a.time || '', t: a.title || '' })),
    },
  };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const type = res.headers.get('content-type') || '';
  if (!/image\//.test(type)) throw new Error('非图片：' + type);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) throw new Error('图片过大 ' + Math.round(buf.length / 1024) + 'KB');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  console.log('拉取上游：' + UPSTREAM);
  const res = await fetch(UPSTREAM, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('上游返回 HTTP ' + res.status);
  const raws = await res.json();
  console.log('上游共 ' + raws.length + ' 条');

  const db = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const known = new Map(db.events.map((e) => [e.id, e]));
  const knownUrls = new Set(db.events.map((e) => (e.website || '').replace(/[?#].*$/, '')));

  const inbox = [];
  const skipLog = [];

  for (const raw of raws) {
    const { item, skip: _s } = mapItem(raw);
    const base = { id: item.id, title: item.title };

    if (raw.country && raw.country !== '中国') { skipLog.push({ ...base, reason: '国外赛事（' + raw.country + '）' }); continue; }
    if (item.ended) { skipLog.push({ ...base, reason: '报名已截止（' + (item.deadline || '无日期') + '）' }); continue; }
    if (!item.deadline) { skipLog.push({ ...base, reason: '缺报名截止日期，无法展示' }); continue; }

    const exist = known.get(item.id);
    if (exist) {
      if (exist.deadline !== item.deadline) {
        inbox.push({ action: 'update', approve: null, reason: '截止时间变更 ' + (exist.deadline || '无') + ' → ' + item.deadline, event: item });
      }
      continue; // 其余情况：已收录，跳过
    }
    if (item.website && knownUrls.has(item.website.replace(/[?#].*$/, ''))) {
      skipLog.push({ ...base, reason: '报名链接与已收录赛事相同（疑似同场）' });
      continue;
    }

    // 新增：先抓海报与二维码（抓不到不阻断，页面有渐变兜底）
    try {
      const hash = crypto.createHash('md5').update(item.id, 'utf8').digest('hex').slice(0, 10);
      if (raw.coverImage) {
        const p = 'p' + hash + '.jpg';
        const size = await download(raw.coverImage, path.join(POSTER_DIR, p));
        item.poster = 'assets/posters/' + p;
        console.log('  海报 ' + p + ' ' + Math.round(size / 1024) + 'KB');
      }
      if (raw.registration && raw.registration.qrImage) {
        const q = 'p' + hash + '-qr.jpg';
        await download(raw.registration.qrImage, path.join(POSTER_DIR, q));
        item.qr = 'assets/posters/' + q;
        console.log('  二维码 ' + q);
      }
    } catch (e) {
      console.log('  ⚠ 素材抓取失败：' + e.message + '（海报将用渐变兜底）');
    }

    inbox.push({ action: 'add', approve: null, reason: '新增赛事', event: item });
  }

  /* ---------- 写 inbox ---------- */
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const jsonPath = path.join(INBOX_DIR, stamp + '.json');
  const payload = {
    _readme: '待确认清单。把需要上线的条目 approve 改为 true，然后运行 node tools/apply-inbox.js 合入正式数据。',
    fetchedAt: now.toISOString(),
    upstream: UPSTREAM,
    items: inbox,
    skipped: skipLog,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  /* ---------- 人可读摘要 ---------- */
  const lines = [];
  lines.push('# 赛事采集清单 · ' + now.toISOString().slice(0, 10));
  lines.push('');
  lines.push('来源：HackerTrip 公开接口（发现层，均待核验） · 共 ' + raws.length + ' 条，待确认 ' + inbox.length + ' 条');
  lines.push('');
  if (inbox.length) {
    inbox.forEach((x, i) => {
      const e = x.event;
      lines.push('## ' + (i + 1) + '. ' + e.title + (x.action === 'update' ? '（截止时间变更）' : ''));
      lines.push('- 截止：' + (e.deadline || '无') + ' · ' + e.mode + ' · ' + e.city);
      lines.push('- 奖金：' + e.prize);
      lines.push('- 主办：' + (e.organizer || '待核验'));
      lines.push('- 报名：' + (e.website || '无'));
      lines.push('- 海报：' + (e.poster ? '已抓取 ' + e.poster : '无（渐变兜底）'));
      lines.push('- 核验要点：报名状态 / 截止 / 奖金 / 场地 / 资格 / 主办方，以主办方官网为准');
      lines.push('');
    });
  } else {
    lines.push('本轮无新增、无变更。');
  }
  if (skipLog.length) {
    lines.push('---');
    lines.push('已自动跳过 ' + skipLog.length + ' 条：');
    skipLog.forEach((s) => lines.push('- ' + s.title + ' — ' + s.reason));
  }
  const mdPath = jsonPath.replace(/\.json$/, '.md');
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  console.log('\n待确认 ' + inbox.length + ' 条，跳过 ' + skipLog.length + ' 条');
  console.log('清单：' + path.relative(ROOT, jsonPath));
  console.log('摘要：' + path.relative(ROOT, mdPath));
  console.log('\n确认方式：把需要上线的条目 approve 改为 true → node tools/apply-inbox.js');
}

main().catch((e) => { console.error('采集失败：' + e.message); process.exit(1); });
