/* 未来造物赛场 · 全局逻辑
 *
 * 账号体系已移除（2026-10-07 决定）：不做登录、不接云服务、不依赖任何第三方。
 * 收藏策略：本机 Storage 为唯一事实来源 + 设备同步码做跨设备搬运。
 *
 * 原「wx.login → 云函数 login → openid → 云端 favorites」整套代码
 * 已原样归档在 .workbuddy/_backup/login-feature/，需要时可直接接回：
 *   utils-cloud.js / config.js / cloudfunctions-login/
 */
const KEY_FAV = 'zw_favs';
const EV = require('./data/events.js');
const sync = require('./utils/sync.js');

App({
  globalData: {
    favs: []
  },

  onLaunch() {
    this.globalData.favs = wx.getStorageSync(KEY_FAV) || [];
  },

  /* ---------- 收藏（只存本机） ---------- */
  isFav(id) {
    return this.globalData.favs.indexOf(id) >= 0;
  },

  toggleFav(id) {
    const list = this.globalData.favs.slice();
    const i = list.indexOf(id);
    const added = i < 0;
    if (added) list.push(id); else list.splice(i, 1);
    this.globalData.favs = list;
    wx.setStorageSync(KEY_FAV, list);
    return added;
  },

  favCount() {
    return this.globalData.favs.length;
  },

  /* ---------- 设备同步码（不依赖账号与网络） ---------- */
  exportSyncCode() {
    return sync.encode(EV, this.globalData.favs);
  },

  importSyncCode(code) {
    const r = sync.decode(EV, code);
    if (r.error) return r;
    const before = this.globalData.favs.length;
    const merged = this.globalData.favs.slice();
    for (let i = 0; i < r.ids.length; i++) {
      if (merged.indexOf(r.ids[i]) < 0) merged.push(r.ids[i]);
    }
    this.globalData.favs = merged;
    wx.setStorageSync(KEY_FAV, merged);
    return { added: merged.length - before, total: merged.length };
  }
});
