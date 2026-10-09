'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data', 'events.json');
const POSTERS = path.join(ROOT, 'site', 'assets', 'posters');
const MODE = process.argv.includes('--discover') ? 'discover' : 'watch';
const UA = 'FutureZaowuBot/2.0 (+https://chen002129.github.io/future-zaowu-arena/)';
const HACKERTRIP = 'https://hackertrip.space/api/hackathons';

const PRIMARY_HOSTS = [
  'tianchi.aliyun.com',
  'tch.cloud.tencent.com',
  'aipay.alipay.com',
  'pages.tmall.com',
  'aiia.douyin.com',
  'ideas.qq.com',
  'app.tapnow.ai',
  'create.gosim.org',
  'mathathonchallenge.com',
  'micos.genomics.cn',
  'appmiaoda.com',
  'luma.com',
  'lu.ma'
];

const BLOCKED_DISCOVERY_HOSTS = [
  'mp.weixin.qq.com',
  'xiaohongshu.com',
  'www.xiaohongshu.com',
  'feishu.cn',
  'www.feishu.cn',
  'doc.weixin.qq.com'
];

const AI_RE = /(\bAI\b|AIGC|Agent|智能体|人工智能|大模型|LLM|多模态|具身|机器人|VLA|机器学习|深度学习|算法|AI\s*Coding|智能硬件|AI\s*for\s*Science)/i;
const SIGNAL_RE = /(报名|截止|奖|主办|承办|赛道|资格|参赛|时间|地点|决赛|初赛|作品|提交|registration|deadline|prize|organizer|track|eligibility|venue)/i;

function sha(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}
function md5(s) {
  return crypto.createHash('md5').update(String(s || ''), 'utf8').digest('hex');
}
function normUrl(u) {
  try {
    const x = new URL(u);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','spm','from','source'].forEach(k => x.searchParams.delete(k));
    x.hash = '';
    return x.toString().replace(/\?$/, '');
  } catch { return String(u || '').trim(); }
}
function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}
function isPrimaryUrl(u) {
  const h = hostOf(u);
  return PRIMARY_HOSTS.some(x => h === x || h.endsWith('.' + x));
}
function isBlockedDiscoveryUrl(u) {
  const h = hostOf(u);
  return BLOCKED_DISCOVERY_HOSTS.some(x => h === x || h.endsWith('.' + x));
}
function futureDeadline(s) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(s || ''))) return false;
  const t = Date.parse(String(s).slice(0,10) + 'T23:59:59+08:00');
  return Number.isFinite(t) && t >= Date.now() - 6 * 3600 * 1000;
}
function deadlineFromRaw(raw) {
  return raw?.registrationDeadline ? String(raw.registrationDeadline).slice(0,10) : '';
}
function aiRelated(raw) {
  const hay = [
    raw?.name, raw?.theme, raw?.summary, raw?.description,
    ...(Array.isArray(raw?.tags) ? raw.tags : []),
    ...(Array.isArray(raw?.tracks) ? raw.tracks.map(t => typeof t === 'string' ? t : t?.title) : [])
  ].filter(Boolean).join(' ');
  return AI_RE.test(hay);
}
function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'");
}
function htmlToText(html) {
  return decodeHtml(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<[^>]+>/g,' ')
  ).replace(/\s+/g,' ').trim();
}
function signalFingerprint(text) {
  const chunks = String(text || '').split(/[。！？!?；;|]/)
    .map(s => s.trim())
    .filter(s => s.length >= 5 && (SIGNAL_RE.test(s) || /20\d{2}[年\/.\-]\d{1,2}/.test(s)))
    .slice(0,180);
  return sha(chunks.join('\n').slice(0,25000));
}
function deadlineVariants(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return [];
  const y = Number(m[1]), mo = Number(m[2]), day = Number(m[3]);
  return [
    `${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    `${y}/${String(mo).padStart(2,'0')}/${String(day).padStart(2,'0')}`,
    `${y}年${mo}月${day}日`,
    `${mo}月${day}日`,
    `${String(mo).padStart(2,'0')}.${String(day).padStart(2,'0')}`,
    `${mo}/${day}`
  ];
}
function titleTokens(title) {
  return String(title || '')
    .replace(/[（(].*?[）)]/g,' ')
    .replace(/20\d{2}/g,' ')
    .split(/[·｜|\s—–\-_，,：:]/)
    .map(s => s.replace(/[^\u4e00-\u9fffa-zA-Z0-9]/g,''))
    .filter(s => s.length >= 3)
    .sort((a,b)=>b.length-a.length)
    .slice(0,4);
}
async function fetchPage(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5'
    },
    signal: AbortSignal.timeout(16000)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const ct = r.headers.get('content-type') || '';
  const raw = await r.text();
  const text = /json/i.test(ct) ? raw : htmlToText(raw);
  return {
    text: text.slice(0,300000),
    etag: r.headers.get('etag') || '',
    lastModified: r.headers.get('last-modified') || '',
    url: r.url || url
  };
}
function officialConfirms(pageText, title, deadline) {
  const low = String(pageText || '').toLowerCase();
  const hasDate = deadlineVariants(deadline).some(v => low.includes(v.toLowerCase()));
  const tokens = titleTokens(title);
  const hasTitle = tokens.length ? tokens.some(t => low.includes(t.toLowerCase())) : true;
  return hasDate && hasTitle;
}
function cleanSummary(s) {
  return String(s || '')
    .replace(/^#+\s*/gm,'')
    .replace(/\r/g,'')
    .replace(/\n+/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
}
function modeZh(s) {
  const x = String(s || '').toLowerCase();
  if (x.includes('online')) return '线上';
  if (x.includes('hybrid')) return '混合';
  if (x.includes('person') || x.includes('offline')) return '线下';
  return s || '混合';
}
function inferGroup(raw) {
  const s = [raw?.name, raw?.summary, raw?.teams, raw?.eligibility, ...(raw?.tags || [])].filter(Boolean).join(' ');
  if (/青少年|少年|中学生|小学生|18岁以下|K12/i.test(s)) return '青少年';
  if (/高校|大学|学生|campus|college|university/i.test(s)) return '高校';
  return '开发者';
}
function mapRaw(raw, nowISO) {
  const deadline = deadlineFromRaw(raw);
  return {
    id: raw.slug || raw.name || raw.id,
    title: raw.name || '',
    shortName: raw.shortName || '',
    src: raw.hostOrganizer || 'HackerTrip',
    tier: 'aggregator',
    sourceTier: 'aggregator',
    discoveredVia: 'HackerTrip',
    verifyState: 'pending',
    mode: modeZh(raw.mode),
    city: raw.city || (raw.mode === 'online' ? '线上' : '待公布'),
    country: raw.country || '中国',
    venue: raw.venue || '',
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0,6) : ['人工智能'],
    deadline,
    startDate: raw.startDate ? String(raw.startDate).slice(0,10) : '',
    endDate: raw.endDate ? String(raw.endDate).slice(0,10) : '',
    prize: raw.prizePool || '奖励见官方页面',
    prizePool: raw.prizePool || '',
    featured: !!raw.isFeatured,
    theme: raw.theme || '',
    tracks: (raw.tracks || []).map(t => typeof t === 'string' ? t : t?.title).filter(Boolean),
    tech: [],
    summary: cleanSummary(raw.summary || raw.description || ''),
    website: raw.registration?.url || raw.website || '',
    sourceUrl: raw.website || raw.registration?.url || '',
    authoritativeUrl: '',
    poster: '',
    posterRemote: raw.coverImage || '',
    qrRemote: raw.registration?.qrImage || '',
    qr: '',
    updatedAt: nowISO,
    infoUpdatedAt: nowISO,
    ended: false,
    dateRange: raw.dateRange || '',
    teamSize: raw.teams || '',
    organizer: raw.hostOrganizer || '',
    agenda: (raw.agenda || []).map(a => ({ d: a.time || '', t: a.title || '' })),
    audience: inferGroup(raw),
    audienceGroup: inferGroup(raw),
    level: /具身|算法|VLA|科研|Web3/i.test([raw.name,raw.theme,raw.summary].join(' ')) ? '高阶' : '进阶',
    parentNote: '',
  };
}
async function downloadPoster(event, raw) {
  if (!raw?.coverImage) return;
  fs.mkdirSync(POSTERS, { recursive: true });
  const name = 'p' + md5(event.id).slice(0,10) + '.jpg';
  const dest = path.join(POSTERS, name);
  if (fs.existsSync(dest)) {
    event.poster = 'assets/posters/' + name;
    return;
  }
  try {
    const r = await fetch(raw.coverImage, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(16000) });
    if (!r.ok) return;
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1024 || buf.length > 4 * 1024 * 1024) return;
    fs.writeFileSync(dest, buf);
    event.poster = 'assets/posters/' + name;
  } catch {}
}
function addFlash(db, txt, src, nowISO, hot=false) {
  db.flashes = Array.isArray(db.flashes) ? db.flashes : [];
  if (db.flashes.some(f => f.txt === txt && Date.now() - Date.parse(f.at || 0) < 36*3600*1000)) return false;
  db.flashes.unshift({ auto:true, hot, txt, src, at:nowISO });
  if (db.flashes.length > 40) db.flashes.length = 40;
  return true;
}
function radarUpsert(db, item, reason, nowISO) {
  db.radar = Array.isArray(db.radar) ? db.radar : [];
  const id = item.id || item.title;
  const i = db.radar.findIndex(x => x.id === id || normUrl(x.website || x.sourceUrl) === normUrl(item.website || item.sourceUrl));
  const row = {
    id,
    title: item.title,
    deadline: item.deadline,
    city: item.city,
    organizer: item.organizer,
    website: item.website,
    sourceUrl: item.sourceUrl,
    reason,
    verifyState: 'pending',
    discoveredAt: i >= 0 ? (db.radar[i].discoveredAt || nowISO) : nowISO,
    updatedAt: nowISO
  };
  if (i >= 0) db.radar[i] = { ...db.radar[i], ...row };
  else db.radar.unshift(row);
}

async function watch(db, nowISO) {
  db._watch = db._watch && typeof db._watch === 'object' ? db._watch : {};
  let changed = false;

  for (const e of db.events || []) {
    const wasEnded = !!e.ended;
    const ended = e.deadline ? Date.parse(String(e.deadline).slice(0,10) + 'T23:59:59+08:00') < Date.now() : wasEnded;
    if (ended !== wasEnded) {
      e.ended = ended;
      e.updatedAt = nowISO;
      changed = true;
      addFlash(db, ended ? e.title + ' 报名时间已过，状态更新为已截止' : e.title + ' 重新进入可报名状态', '自动状态监测', nowISO, false);
    }

    const url = e.authoritativeUrl || e.website;
    if (!url || !isPrimaryUrl(url)) continue;
    try {
      const page = await fetchPage(url);
      const fp = signalFingerprint(page.text);
      const key = e.id;
      const prev = db._watch[key];
      if (!prev) {
        db._watch[key] = { fingerprint:fp, checkedAt:nowISO, url:page.url, etag:page.etag, lastModified:page.lastModified };
        changed = true;
      } else if (prev.fingerprint !== fp) {
        db._watch[key] = { fingerprint:fp, checkedAt:nowISO, url:page.url, etag:page.etag, lastModified:page.lastModified };
        e.sourceChangedAt = nowISO;
        changed = true;
        addFlash(db, e.title + ' 官方页面刚刚发生更新，关键信息正在复核', (e.organizer || '主办方') + ' · 官方页面监测', nowISO, true);
      } else if (Date.now() - Date.parse(prev.checkedAt || 0) > 12*3600*1000) {
        db._watch[key].checkedAt = nowISO;
        changed = true;
      }
    } catch (err) {
      const key = e.id;
      const prev = db._watch[key] || {};
      if (Date.now() - Date.parse(prev.errorAt || 0) > 24*3600*1000) {
        db._watch[key] = { ...prev, errorAt:nowISO, error:String(err.message || err).slice(0,120) };
        changed = true;
      }
    }
  }
  return changed;
}

async function discover(db, nowISO) {
  const r = await fetch(HACKERTRIP, { headers:{'User-Agent':UA,'Accept':'application/json'}, signal:AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HackerTrip HTTP ' + r.status);
  const raws = await r.json();
  const knownById = new Map((db.events || []).map(e => [String(e.id), e]));
  const knownByUrl = new Map((db.events || []).map(e => [normUrl(e.website || e.sourceUrl), e]).filter(([u])=>u));
  let changed = false;

  for (const raw of raws) {
    if (raw.country && raw.country !== '中国') continue;
    if (!aiRelated(raw)) continue;
    const deadline = deadlineFromRaw(raw);
    if (!futureDeadline(deadline)) continue;

    const item = mapRaw(raw, nowISO);
    const url = item.website || item.sourceUrl;
    const existing = knownById.get(String(item.id)) || knownByUrl.get(normUrl(url));

    if (existing) {
      if (existing.deadline && existing.deadline !== deadline) {
        let confirmed = false, officialUrl = existing.authoritativeUrl || (isPrimaryUrl(url) ? url : '');
        if (officialUrl) {
          try {
            const page = await fetchPage(officialUrl);
            confirmed = officialConfirms(page.text, existing.title, deadline);
          } catch {}
        }
        if (confirmed) {
          existing.deadlineHistory = Array.isArray(existing.deadlineHistory) ? existing.deadlineHistory : [];
          existing.deadlineHistory.push({
            from: existing.deadline,
            to: deadline,
            changedAt: nowISO,
            source: officialUrl
          });
          db.chg = db.chg && typeof db.chg === 'object' ? db.chg : {};
          db.chg[existing.id] = existing.deadline;
          const old = existing.deadline;
          existing.deadline = deadline;
          existing.updatedAt = nowISO;
          existing.infoUpdatedAt = nowISO;
          existing.verifyState = 'verified';
          existing.lastVerifiedAt = nowISO;
          existing.verifiedAgainst = officialUrl;
          changed = true;
          addFlash(db, existing.title + ' 截止时间更新：' + old.replace(/-/g,'.') + ' → ' + deadline.replace(/-/g,'.'), (existing.organizer || '主办方') + ' · 官方核验', nowISO, true);
        } else {
          radarUpsert(db, item, '发现截止时间变化：' + existing.deadline + ' → ' + deadline + '，等待官方核验', nowISO);
          changed = true;
        }
      }
      continue;
    }

    let verified = false;
    if (url && isPrimaryUrl(url) && !isBlockedDiscoveryUrl(url)) {
      try {
        const page = await fetchPage(url);
        verified = officialConfirms(page.text, item.title, deadline);
        if (verified) {
          item.verifyState = 'verified';
          item.sourceTier = 'primary';
          item.tier = 'primary';
          item.authoritativeUrl = page.url || url;
          item.verifiedAgainst = page.url || url;
          item.lastVerifiedAt = nowISO;
          item.src = item.organizer || hostOf(url);
        }
      } catch {}
    }

    if (verified) {
      await downloadPoster(item, raw);
      db.events.push(item);
      knownById.set(String(item.id), item);
      knownByUrl.set(normUrl(url), item);
      changed = true;
      addFlash(db, '新赛事上线：' + item.title + '，' + deadline.replace(/-/g,'.') + ' 截止', (item.organizer || '主办方') + ' · 自动核验', nowISO, true);
    } else {
      radarUpsert(db, item, '自动发现新赛事，等待主办方官方页面核验', nowISO);
      changed = true;
      addFlash(db, '新发现：' + item.title + '（待核验）', '赛事雷达 · 自动发现', nowISO, false);
    }
  }
  return changed;
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DATA,'utf8'));
  db.events = Array.isArray(db.events) ? db.events : [];
  db.flashes = Array.isArray(db.flashes) ? db.flashes : [];
  const nowISO = new Date().toISOString();

  let changed = false;
  if (MODE === 'discover') changed = await discover(db, nowISO);
  changed = (await watch(db, nowISO)) || changed;

  if (!changed) {
    console.log('NO_CHANGES');
    return;
  }

  db.updatedAt = nowISO;
  fs.writeFileSync(DATA, JSON.stringify(db,null,2) + '\n','utf8');
  console.log('UPDATED', MODE, db.events.length, 'events', (db.radar||[]).length, 'radar');
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
