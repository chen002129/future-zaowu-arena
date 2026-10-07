'use strict';

/**
 * 本地验证脚本（不依赖云环境）
 *   node dev-run.js
 *
 * 职责：读取 fixture 快照 → 跑映射器 → 打印覆盖率与核验待办 → 导出 mapped-competitions.json
 */

const fs = require('fs');
const path = require('path');
const { mapAll, UPSTREAM } = require('./mappers/hackertrip');

const FIXTURE = path.join(__dirname, '_fixtures', 'hackertrip-feed.json');
const OUT = path.join(__dirname, '_fixtures', 'mapped-competitions.json');

function bar(pct) {
  const n = Math.round(pct / 5);
  return '█'.repeat(n) + '·'.repeat(20 - n);
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const fetchedAt = new Date().toISOString();
  const { items, skipped, stats } = mapAll(raw, { fetchedAt });

  console.log('='.repeat(66));
  console.log(`上游：${UPSTREAM.name}  ${UPSTREAM.endpoint}`);
  console.log(`层级：${UPSTREAM.tier}（只给线索，不作结论）`);
  console.log('='.repeat(66));

  console.log('\n【总体】');
  console.log(`  上游条数        ${stats.upstreamCount}`);
  console.log(`  成功映射        ${stats.mappedCount}`);
  console.log(`  跳过            ${stats.skippedCount}`);
  console.log(`  未开始 / 已结束  ${stats.upcoming} / ${stats.past}`);
  console.log(`  有海报          ${stats.withPoster}`);
  console.log(`  待核验（全部）   ${stats.needVerify}   ← 铁律：聚合源一律待核验`);
  console.log(`  无权威源        ${stats.noAuthority}   ← 入口是托管平台，需人工补主办方官网`);

  // ── 上游字段承接审计：逐个确认「主要信息有没有放进去」 ──
  const FIELD_MAP = [
    ['id', 'upstreamId', '上游唯一 ID，外部关联键'],
    ['name', 'title', '赛事名称'],
    ['shortName', 'shortName', '简称'],
    ['slug', 'slug', '稳定标识'],
    ['startDate', 'startDate', '开始日期'],
    ['endDate', 'endDate', '结束日期'],
    ['dateRange', 'dateRange', '日期简写'],
    ['registrationDeadline', 'regDeadline', '报名截止'],
    ['mode', 'mode', '线上 / 线下 / 混合'],
    ['format', 'formatRaw', '格式（实测与 mode 全同）'],
    ['city', 'city', '城市'],
    ['country', 'country', '国家'],
    ['venue', 'venue', '场馆完整地址'],
    ['location', 'location', '地理位置描述'],
    ['theme', 'theme', '主题'],
    ['summary', 'summary / summaryAlt', '简介正文（无损保留）'],
    ['description', 'summary / summaryAlt', '详细描述（无损保留）'],
    ['tracks', 'tracks', '赛道（含碎片合并）'],
    ['agenda', 'agenda', '赛程时间线'],
    ['prizePool', 'prizePool', '奖金池（无损保留）'],
    ['teams', 'teamSize', '组队要求'],
    ['hostOrganizer', 'organizer', '主办方'],
    ['organizers', 'organizers', '主办方列表'],
    ['sponsors', 'sponsors', '赞助方列表'],
    ['website', 'sourceUrl / entryUrl', '信息入口'],
    ['registration', 'regUrl / regMode / qrRemote / regSiteName', '报名方式与二维码'],
    ['coverImage', 'posterRemote', '赛事海报'],
    ['status', 'upstreamStatusHint', '上游状态（仅提示，不采用）'],
    ['isPast', 'upstreamIsPast', '是否已结束（仅提示）'],
    ['isVerified', 'upstreamIsVerified', '上游核验标记（仅提示）'],
    ['isFeatured', 'upstreamFeatured', '上游推荐位（仅提示）'],
    ['participantCount', 'upstreamParticipantCount', '参与人数'],
    ['logo', 'logoRemote', 'Logo —— ⚠ 上游 37 条全为空'],
    ['brief', '—', '⚠ 上游 37 条全为空，无内容可承接'],
    ['infoCards', '—', '⚠ 上游 37 条全为空，无内容可承接'],
  ];
  const upKeys = new Set();
  raw.forEach((r) => Object.keys(r).forEach((k) => upKeys.add(k)));
  const mappedKeys = new Set(FIELD_MAP.map((f) => f[0]));
  const unmapped = [...upKeys].filter((k) => !mappedKeys.has(k));

  console.log('\n【上游字段承接审计】');
  FIELD_MAP.forEach(([src, dst, note]) => {
    const has = raw.filter((r) => r[src] !== undefined && r[src] !== null && r[src] !== '' && !(Array.isArray(r[src]) && !r[src].length)).length;
    console.log(`  ${src.padEnd(20)} → ${dst.padEnd(42)} ${String(has).padStart(2)}/37  ${note}`);
  });
  console.log(`  上游共 ${upKeys.size} 个字段；未在映射表中出现的：${unmapped.length ? unmapped.join('、') : '无'}`);
  console.log('  注：上游无 `tags` 字段 → 由本映射器依据主题 / 标题 / 赛道自行推导');

  // ── 文本保全验证：确认数据层没有截断 ──
  console.log('\n【文本保全验证（确认无截断）】');
  const byUpId = new Map(raw.map((r) => [r.id, r]));
  let lossy = 0;
  items.forEach((x) => {
    const up = byUpId.get(x.upstreamId) || {};
    const upLen = Math.max(String(up.summary || '').length, String(up.description || '').length);
    if (x.summary.length + x.summaryAlt.length < upLen * 0.9) {
      lossy += 1;
      console.log(`  ⚠ ${x.title.slice(0, 28)}  上游 ${upLen} 字 → 映射后 ${x.summary.length + x.summaryAlt.length} 字`);
    }
  });
  const upPrize = items.filter((x) => {
    const up = byUpId.get(x.upstreamId) || {};
    return String(up.prizePool || '').length > x.prizePool.length + 2;
  });
  console.log(`  正文无损：${items.length - lossy}/${items.length}`);
  console.log(`  奖金无损：${items.length - upPrize.length}/${items.length}`);
  console.log(`  有附注文本（summary 与 description 存在差异）：${items.filter((x) => x.summaryAlt).length}`);

  console.log('\n【字段覆盖率】');
  for (const c of stats.coverage) {
    console.log(`  ${c.field.padEnd(18)} ${String(c.pct).padStart(3)}%  ${bar(c.pct)}  ${c.count}/${stats.mappedCount}`);
  }

  console.log('\n【模式分布】');
  Object.entries(stats.byMode).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}  ${v}`));

  console.log('\n【来源分布（前 12）】');
  Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(2)}  ${k || '(空)'}`));

  // 核验待办聚合
  const noteCount = {};
  items.forEach((x) => x.verifyNotes.forEach((nt) => {
    const key = nt.replace(/（[^）]*）/g, '（…）');
    noteCount[key] = (noteCount[key] || 0) + 1;
  }));
  console.log('\n【核验待办分布】');
  Object.entries(noteCount).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(2)}  ${k}`));

  if (skipped.length) {
    console.log('\n【跳过 / 去重明细】');
    skipped.forEach((s) => {
      console.log(`  ${String(s.id).slice(0, 8)}  ${s.reason}`);
      if (s.keptTitle) {
        console.log(`      丢弃「${s.title}」(${s.scores.dropped} 分) → 保留「${s.keptTitle}」(${s.scores.kept} 分)`);
      }
    });
  }

  console.log('\n【标签推导抽样】');
  items.filter((x) => x.tags.length).slice(0, 6)
    .forEach((x) => console.log(`  ${String(x.tags.join(' / ')).padEnd(30)} ← ${x.title.slice(0, 30)}`));
  console.log(`  有标签 ${items.filter((x) => x.tags.length).length}/${items.length}`
    + `，无标签（留给人工打标）${items.filter((x) => !x.tags.length).length}`);

  const fragItem = items.find((x) => x.tracks.length && x.tracks.some((t) => t.length > 20));
  if (fragItem) {
    console.log('\n【碎片合并抽样】');
    console.log(`  ${fragItem.title.slice(0, 34)}`);
    fragItem.tracks.forEach((t) => console.log(`    · ${t.slice(0, 70)}`));
  }

  console.log('\n【抽样：一条聚合源赛事的完整映射】');
  const sample = items.find((x) => x.authoritativeUrl) || items[0];
  console.log(JSON.stringify(sample, null, 2));

  fs.writeFileSync(OUT, JSON.stringify({ fetchedAt, upstream: UPSTREAM, stats, items }, null, 2), 'utf8');
  console.log(`\n已导出 ${path.relative(process.cwd(), OUT)}  （${items.length} 条）`);
}

main();
