'use strict';

/**
 * HackerTrip 公开 feed  →  未来造物 competitions 结构
 * =====================================================
 *
 * 定位：**L2 聚合兜底源**（只给线索，不作结论）
 *
 * 依据其 `llms.txt` 原文自述：
 *   「HackerTrip 是发现与比较层，不是第三方赛事变更的最终权威。
 *     涉及具体赛事的报名状态、截止时间、奖金、场地、参赛资格或主办方身份时，
 *     请以该赛事主办方的官方页面为准并优先引用官方来源。」
 *
 * 因此本映射器的输出**一律标记 `verifyState: 'pending'`**，
 * 必须经 `verifyAgainstSource` 回溯主办方官方页面、比对六项关键信息后，才可发布。
 *
 * 六项受管信息：报名状态 / 截止时间 / 奖金 / 场地 / 参赛资格 / 主办方身份
 *
 * 接口合规：`llms.txt` 主动声明 "Public Event Feed"，
 *           `.well-known/agent.json` 标注 `/api/hackathons` 为 `auth: none`。
 *           仍须标注身份、控制频率（上游 Cache-Control: max-age=300）。
 */

const UPSTREAM = Object.freeze({
  id: 'hackertrip',
  name: 'HackerTrip',
  tier: 'aggregator',
  endpoint: 'https://hackertrip.space/api/hackathons',
  doc: 'https://hackertrip.space/llms.txt',
  userAgent: 'FutureZaowuBot/1.0 (+https://futurezaowu.example; 赛事信息聚合)',
  maxAgeSeconds: 300,
});

/**
 * 托管平台：出现在这些域名下的 URL 是「报名入口 / 活动页」，
 * **不能作为权威源**——六项关键信息仍需回溯主办方自有域名。
 */
const HOSTED_HOSTS = [
  'feishu.cn',
  'doc.weixin.qq.com',
  'mp.weixin.qq.com',
  'luma.com',
  'lu.ma',
  'wjx.cn',
  'jinshuju.net',
  'eventbrite.com',
  'devpost.com',
  'hack2skill.com',
  'taplink.cc',
  'henryht.sh',
  'mxgent.cn',
  'ton-ton.fun',
];

/** 域名 → 展示用来源名 */
const DOMAIN_LABEL = {
  'mp.weixin.qq.com': '微信公众号',
  'doc.weixin.qq.com': '腾讯文档',
  'feishu.cn': '飞书表单',
  'luma.com': 'LUMA',
  'lu.ma': 'LUMA',
  'tianchi.aliyun.com': '阿里云天池',
  'tch.cloud.tencent.com': '腾讯云官网',
  'gosim.org': 'GOSIM 官网',
  'scrm.nvidia.cn': 'NVIDIA',
  'pages.tmall.com': '天猫',
  'aiia.douyin.com': '抖音',
  'aipay.alipay.com': '支付宝',
  'ideas.qq.com': '腾讯',
  'join.tencentmusic.com': '腾讯音乐',
  'career.anker.com.cn': 'Anker',
  'www.insta360.com': '影石 Insta360',
  'mathathonchallenge.com': 'Caltech 官网',
  'www.g-ican.com': 'iCAN 官网',
  'app.tapnow.ai': 'TapNow',
  'www.token2049.com': 'Token2049 官网',
  'www.rebuild-z.com': 'Rebuild-Z',
  'competehub.dev': 'CompeteHub',
  'micos.genomics.cn': '华大基因',
  'weavefox.cn': 'WeaveFox',
  'appmiaoda.com': '百度秒哒',
  'github.com': 'GitHub',
  'hack2skill.com': 'Hack2Skill',
  'henryht.sh': 'Hack123',
};

const MODE_MAP = { hybrid: '混合', online: '线上', offline: '线下' };

/** 从 URL 取主机名 */
function hostOf(url) {
  if (!url) return '';
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/** 是否托管平台（报名表单 / 活动页），命中则不可作权威源 */
function isHosted(host) {
  if (!host) return false;
  return HOSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

/** 主机名 → 中文展示名（支持子域后缀匹配） */
function labelOf(host) {
  if (!host) return '';
  if (DOMAIN_LABEL[host]) return DOMAIN_LABEL[host];
  for (const key of Object.keys(DOMAIN_LABEL)) {
    if (host === key || host.endsWith('.' + key)) return DOMAIN_LABEL[key];
  }
  return host;
}

/** 剔除追踪参数后的 URL 指纹，作为**跨源去重主键** */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'share_link_type', 'ccm_open_type', 'src', 'timestamp', 'ver', 'signature',
  'from', 'share_source', 'spm', 'scene',
];
function dedupeKey(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    TRACKING_PARAMS.forEach((k) => u.searchParams.delete(k));
    const path = (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, '');
    const q = u.searchParams.toString();
    return q ? `${path}?${q}` : path;
  } catch {
    return String(url).trim().toLowerCase();
  }
}

/** ISO 时间串 → YYYY-MM-DD（上游均为 T00:00:00.000Z，取日期部分即为当地日期） */
function toDate(v) {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** 仅用于生成展示用短版本，不改变原值 */
function clip(s, n) {
  const t = s || '';
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** 去掉 Markdown 记号；`max` 省略时**不做截断**（数据层保持无损） */
function stripMd(s, max) {
  if (!s) return '';
  let t = String(s)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*(.+?)\s*$/gm, '$1。')
    .replace(/\*\*|__|`|~~|>\s?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/。{2,}/g, '。')
    .replace(/([。，、；])\s*([。，、；])/g, '$1')
    .trim();
  if (max && t.length > max) t = t.slice(0, max - 1) + '…';
  return t;
}

/**
 * 合并被上游拆散的 track 碎片。
 *
 * 上游数据质量问题：`在线科普作品（论文、视频、交互）` 被按顿号拆成了
 * `[在线科普作品（论文, 视频, 交互）]` 三段。此函数用**括号平衡**判定碎片归属，
 * 用顿号把同一逻辑段重新拼回。
 *
 * 实测：102 个片段中有 26 个长度 ≤5 字的碎片。
 */
function mergeFragments(titles) {
  const out = [];
  let buf = '';
  let depth = 0;
  const OPEN = /[（(【[]/g;
  const CLOSE = /[）)】\]]/g;

  for (const raw of titles) {
    const s = String(raw || '').trim();
    if (!s) continue;
    buf = buf ? `${buf}、${s}` : s;
    depth += (s.match(OPEN) || []).length - (s.match(CLOSE) || []).length;
    if (depth <= 0) {
      out.push(buf);
      buf = '';
      depth = 0;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * 标签推导。
 *
 * **上游没有 `tags` 字段**（实测 35 个字段中无此项），必须自行推导。
 *
 * 两轮策略，**准确率优先于召回率**（标签错比标签少更糟）：
 *   1) 只扫高置信字段（主题 / 标题 / 赛道），并跳过泛化标签；
 *   2) 高置信字段完全没有信息时，才用简介兜底，此时允许泛化标签。
 *
 * 简介里「交互游戏」「科普」「设计」这类词极易误命中，
 * 因此绝不作为第一轮来源。
 */
const GENERIC_TAG = '人工智能';

const TAG_RULES = [
  ['AI Agent', /AI\s*Agent|智能体|\bagent\b/i],
  ['大模型', /大模型|LLM|large language model|语言模型|\bGPT\b|Transformer/i],
  ['多模态', /多模态|multimodal/i],
  ['AIGC', /AIGC|生成式|文生图|文生视频|AI\s*绘画|可灵/i],
  ['具身智能', /具身|embodied|机器人|robotics/i],
  ['Web3', /Web3|区块链|blockchain|以太坊|ethereum|智能合约|ETHGlobal|Solana/i],
  ['数据竞赛', /数据竞赛|数据挖掘|算法大赛|Kaggle|天池|DataFountain|建模/i],
  ['小程序', /小程序|微信生态|miniprogram/i],
  ['游戏开发', /游戏开发|game\s*jam|GameJam/i],
  ['开源', /开源|open[\s-]?source/i],
  ['硬件', /硬件|hardware|嵌入式|\bIoT\b|芯片|钠电/i],
  ['医疗健康', /医疗|健康|生物|基因|医学/i],
  ['金融科技', /金融|支付|量化交易|保险/i],
  ['教育', /教育|教学|科普/i],
  ['视觉设计', /视觉设计|平面设计|UI\/UX|美学|交互设计|影像创作/i],
  ['数学', /数学|mathematic|定理|证明/i],
  ['空间科技', /航天|卫星|太空|space\s*apps|NASA|量子/i],
  ['交通出行', /交通|出行|自动驾驶|汽车/i],
  ['能源环境', /能源|碳中和|环境|气候/i],
  [GENERIC_TAG, /\bAI\b|人工智能|机器学习|machine learning/i],
];

function matchTags(text, max, opts = {}) {
  const { exclude = [], skipGeneric = false } = opts;
  const out = [];
  for (const [tag, re] of TAG_RULES) {
    if (exclude.includes(tag)) continue;
    if (skipGeneric && tag === GENERIC_TAG) continue;
    if (re.test(text)) out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

function deriveTags(raw, tracks, max = 4) {
  const primaryText = [raw.theme || '', raw.name || '', (tracks || []).join(' ')].join(' ');
  const primary = matchTags(primaryText, max, { skipGeneric: true });
  if (primary.length) return primary;
  return matchTags([raw.summary || '', raw.description || ''].join(' '), max);
}

/** 完整度评分：用于跨源 / 批内重复时**择优保留**，而非先到先得 */
const COMPLETENESS_WEIGHTS = {
  regDeadline: 4,
  authoritativeUrl: 3,
  posterRemote: 3,
  qrRemote: 2,
  prizePool: 2,
  tracks: 2,
  agenda: 2,
  venue: 1,
  city: 1,
  organizer: 1,
  theme: 1,
  summary: 1,
  entryUrl: 1,
  teamSize: 1,
  tags: 1,
};
function completeness(item) {
  let s = 0;
  for (const k of Object.keys(COMPLETENESS_WEIGHTS)) {
    const v = item[k];
    if (Array.isArray(v) ? v.length : v) s += COMPLETENESS_WEIGHTS[k];
  }
  return s + Math.min(String(item.title || '').length / 20, 1);
}

function namesOf(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === 'string' ? x : x && x.name))
    .filter(Boolean)
    .map((x) => String(x).trim());
}

/**
 * 单条映射。
 * @returns {object|null} 映射结果；缺 id / name 时返回 null（跳过）
 */
function mapCompetition(raw, opts = {}) {
  if (!raw || !raw.id || !raw.name) return null;

  const website = String(raw.website || '').trim();
  const reg = raw.registration || {};
  const regUrl = String(reg.url || '').trim();
  const entryUrl = regUrl || website;

  const siteHost = hostOf(website);
  const regHost = hostOf(regUrl);

  const startDate = toDate(raw.startDate);
  const endDate = toDate(raw.endDate);
  const regDeadline = toDate(raw.registrationDeadline);

  /* —— 待核验事项：直接进后台待办 —— */
  const notes = [];
  if (!regDeadline) notes.push('报名截止缺失，需回溯主办方页面补全');

  const authoritativeUrl = !website || isHosted(siteHost) ? '' : website;
  if (!authoritativeUrl) {
    const via = labelOf(siteHost) || siteHost || '未知';
    notes.push(`入口为托管平台（${via}），需回溯主办方自有域名`);
  }
  if (regUrl && isHosted(regHost) && regHost !== siteHost) {
    notes.push(`报名走托管表单（${labelOf(regHost)}），截止时间以主办方公告为准`);
  }
  if (!raw.coverImage) notes.push('无海报，需用生成式模板兜底');
  if (reg.mode === 'wechat-qr' && !reg.qrImage) notes.push('报名方式为公众号二维码，但未提供图片');

  const organizer = String(
    raw.hostOrganizer || namesOf(raw.organizers)[0] || ''
  ).trim();

  // 赛道：先去掉 Markdown，再合并被上游拆散的碎片（实测上游最多 7 项、有碎片，故放宽到 12）
  const tracks = mergeFragments(
    (Array.isArray(raw.tracks) ? raw.tracks : []).map((t) => stripMd(t && t.title))
  ).slice(0, 12);

  // 上游无 tags 字段，标签须自行推导
  const tags = deriveTags(raw, tracks);

  /**
   * 正文：`summary` 与 `description` 实测 34/37 完全重复，
   * 但存在 description 更完整的情况（如 MindSpore 量子黑客松：summary 仅 21 字
   * 「量子启发算法、组合优化赛道，需先完成热身赛」，description 有 98 字完整介绍）。
   *
   * **策略：无损保留。** 取信息量更大者作正文，另一个若有实质差异（未被包含）则存为附注，
   * 避免像 `summary || description` 那样把长文本丢掉。
   */
  const sText = stripMd(raw.summary);
  const dText = stripMd(raw.description);
  const content = dText.length > sText.length ? dText : sText;
  let contentAlt = dText.length > sText.length ? sText : dText;
  if (contentAlt && (!contentAlt.trim() || content.includes(contentAlt))) contentAlt = '';

  const prize = stripMd(raw.prizePool);
  const teamsText = stripMd(raw.teams);

  return {
    /* — 标识 — */
    slug: raw.slug,
    upstreamId: raw.id,
    title: raw.name,
    shortName: raw.shortName || raw.name,

    /* — 时间 — */
    startDate,
    endDate,
    regDeadline,
    dateRange: raw.dateRange || '',

    /* — 分类 — */
    mode: MODE_MAP[raw.mode] || '线上',
    modeRaw: raw.mode || '',
    formatRaw: raw.format || '',
    city: raw.city || '',
    country: raw.country || '',
    venue: raw.venue || '',
    location: raw.location || '',
    tags,
    theme: raw.theme || '',

    /* — 内容（数据层无损；短版本另存，仅供列表 / 卡片展示） — */
    summary: content,
    summaryShort: clip(content, 200),
    summaryAlt: contentAlt,
    tracks,
    agenda: (Array.isArray(raw.agenda) ? raw.agenda : [])
      .map((a) => ({
        time: (a && a.time) || '',
        title: (a && a.title) || '',
        detail: stripMd(a && a.detail),
      }))
      .filter((a) => a.time || a.title),
    organizers: namesOf(raw.organizers),
    sponsors: namesOf(raw.sponsors),
    organizer,
    prizePool: prize,
    prizePoolShort: clip(prize, 42),
    teamSize: teamsText,

    /* — 媒体（远端地址；入库前须转存云存储，绝不热链） — */
    posterRemote: raw.coverImage || '',
    qrRemote: reg.qrImage || '',
    logoRemote: raw.logo || '',
    poster: '',
    qr: '',
    posterHash: '',

    /* — 报名 — */
    entryUrl,
    regUrl,
    regMode: reg.mode || '',
    regSiteName: reg.siteName || '',

    /* — 溯源（本映射器的核心产出） — */
    sourceTier: UPSTREAM.tier,
    discoveredVia: UPSTREAM.name,
    upstreamEndpoint: UPSTREAM.endpoint,
    sourceUrl: website,
    sourceName: labelOf(siteHost),
    authoritativeUrl,
    verifiedAgainst: '',
    verifyState: 'pending',
    verifyNotes: notes,
    dedupeKey: dedupeKey(entryUrl || website),

    /* — 上游参考值：仅作提示，**不直接采用** — */
    upstreamStatusHint: raw.status || '',
    upstreamIsPast: !!raw.isPast,
    upstreamIsVerified: !!raw.isVerified,
    upstreamFeatured: !!raw.isFeatured,
    upstreamParticipantCount: raw.participantCount || 0,

    /* — 展示与运营 — */
    status: 'pending',
    statusAuto: '',
    infoUpdatedAt: '',
    lastVerifiedAt: '',
    deadlineChanged: false,
    deadlineHistory: [],
    isFeatured: false,
    viewCount: 0,
    favCount: 0,
    fetchedAt: opts.fetchedAt || '',
  };
}

/** 统计字段覆盖率 */
const COVERAGE_FIELDS = [
  ['title', (x) => x.title],
  ['startDate', (x) => x.startDate],
  ['endDate', (x) => x.endDate],
  ['regDeadline', (x) => x.regDeadline],
  ['mode', (x) => x.mode],
  ['city', (x) => x.city],
  ['venue', (x) => x.venue],
  ['organizer', (x) => x.organizer],
  ['tags', (x) => x.tags.length],
  ['theme', (x) => x.theme],
  ['summary', (x) => x.summary],
  ['summaryAlt', (x) => x.summaryAlt],
  ['tracks', (x) => x.tracks.length],
  ['agenda', (x) => x.agenda.length],
  ['organizers', (x) => x.organizers.length],
  ['sponsors', (x) => x.sponsors.length],
  ['prizePool', (x) => x.prizePool],
  ['teamSize', (x) => x.teamSize],
  ['posterRemote', (x) => x.posterRemote],
  ['qrRemote', (x) => x.qrRemote],
  ['entryUrl', (x) => x.entryUrl],
  ['authoritativeUrl', (x) => x.authoritativeUrl],
];

function summarize(rawList, items, skipped) {
  const n = items.length || 1;
  const pct = (f) => Math.round((items.filter(f).length / n) * 100);
  const byMode = {};
  const bySource = {};
  items.forEach((x) => {
    byMode[x.mode] = (byMode[x.mode] || 0) + 1;
    bySource[x.sourceName] = (bySource[x.sourceName] || 0) + 1;
  });
  return {
    upstreamCount: rawList.length,
    mappedCount: items.length,
    skippedCount: skipped.length,
    needVerify: items.filter((x) => x.verifyState === 'pending').length,
    noAuthority: items.filter((x) => !x.authoritativeUrl).length,
    upcoming: items.filter((x) => !x.upstreamIsPast).length,
    past: items.filter((x) => x.upstreamIsPast).length,
    withPoster: items.filter((x) => x.posterRemote).length,
    byMode,
    bySource,
    coverage: COVERAGE_FIELDS.map(([field, f]) => ({
      field,
      count: items.filter(f).length,
      pct: pct(f),
    })),
  };
}

/**
 * 批量映射 + 内部去重。
 * 跨源去重（与 L1 一手源合并）由上层 `mergeIntoDb` 负责，此处只处理批内重复。
 */
function mapAll(rawList, opts = {}) {
  const list = Array.isArray(rawList) ? rawList : [];
  const items = [];
  const skipped = [];
  const byKey = new Map(); // dedupeKey -> items 下标

  for (const raw of list) {
    const item = mapCompetition(raw, opts);
    if (!item) {
      skipped.push({ id: raw && raw.id, reason: '缺 id 或 name' });
      continue;
    }

    const key = item.dedupeKey;
    if (!key) {
      items.push(item);
      continue;
    }

    const prevIdx = byKey.get(key);
    if (prevIdx === undefined) {
      byKey.set(key, items.length);
      items.push(item);
      continue;
    }

    // 命中去重键：**择优保留完整度更高的一条**，而非先到先得。
    // 实测上游存在同名重复（如「腾讯云游戏赛」与其「2026」版共用同一入口）。
    const prev = items[prevIdx];
    const sNew = completeness(item);
    const sPrev = completeness(prev);
    const keep = sNew > sPrev ? item : prev;
    const drop = sNew > sPrev ? prev : item;
    items[prevIdx] = keep;
    skipped.push({
      id: drop.upstreamId,
      title: drop.title,
      reason: '重复，已择优合并',
      dupOf: keep.upstreamId,
      keptTitle: keep.title,
      scores: { kept: Math.max(sNew, sPrev), dropped: Math.min(sNew, sPrev) },
    });
  }

  return { items, skipped, stats: summarize(list, items, skipped) };
}

module.exports = {
  UPSTREAM,
  HOSTED_HOSTS,
  DOMAIN_LABEL,
  TAG_RULES,
  mapCompetition,
  mapAll,
  dedupeKey,
  completeness,
  hostOf,
  isHosted,
  labelOf,
  stripMd,
  mergeFragments,
  deriveTags,
  toDate,
};
