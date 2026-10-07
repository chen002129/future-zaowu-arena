/* 设备同步码：把「收藏了哪几场」编码成一串短码，在另一台设备粘贴即可还原。
 *
 * 存在的意义：产品不做账号体系（2026-10-07 决定），收藏只存本机。
 * 同步码不依赖账号、不依赖网络、不依赖 AppID，是跨设备搬运收藏的唯一手段 ——
 * 也正因为它零成本，才让「砍掉登录」这件事不影响可用性。
 *
 * 编码：ZW1 + [下标 × 收藏数] + 校验位
 *   下标用 base36，宽度按赛事总数自适应（36 场规模下单场仅 1 个字符，
 *   收藏全部 36 场也只有 40 个字符）。
 */

const PREFIX = 'zw1';

/* 下标的固定宽度：够表示 0 到 size-1 */
function width(size) {
  return Math.max(1, (Math.max(1, size - 1)).toString(36).length);
}

/* 简单校验位：防止复制不全或手动改动 */
function chk(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 36;
  return h.toString(36);
}

/* 收藏 id 列表 -> 短码；没有收藏时返回空串 */
function encode(ev, favIds) {
  const list = favIds || [];
  const idx = [];
  for (let i = 0; i < list.length; i++) {
    const n = ev.findIndex((e) => e.id === list[i]);
    if (n >= 0) idx.push(n);
  }
  if (!idx.length) return '';
  idx.sort((a, b) => a - b);
  const w = width(ev.length);
  const body = idx.map((n) => n.toString(36).padStart(w, '0')).join('');
  return PREFIX + body + chk(body);
}

/* 短码 -> { ids } 或 { error } */
function decode(ev, raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[^0-9a-z]/g, '');
  if (s.slice(0, 3) !== PREFIX || s.length < 5) return { error: '同步码格式不正确' };
  const body = s.slice(3, -1);
  if (chk(body) !== s.slice(-1)) return { error: '同步码不完整，请重新复制' };
  const w = width(ev.length);
  if (body.length % w) return { error: '同步码长度异常，可能来自别的版本' };
  const ids = [];
  for (let i = 0; i < body.length; i += w) {
    const e = ev[parseInt(body.slice(i, i + w), 36)];
    if (!e) return { error: '同步码里有本版本不认识的赛场' };
    ids.push(e.id);
  }
  return { ids: ids };
}

module.exports = { encode: encode, decode: decode };
