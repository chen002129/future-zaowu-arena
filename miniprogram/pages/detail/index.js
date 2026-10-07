const EV = require('../../data/events.js');
const F = require('../../utils/format.js');
const app = getApp();

const TIER1 = ['LUMA', '阿里云天池', '腾讯云官网', 'GOSIM 官网', 'lablab.ai', 'ETHGlobal'];
const CHG = { 'caltech-mathathon': '2026-09-28' };

function hostOf(url) {
  if (!url) return '';
  return String(url).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

Page({
  data: {
    ready: false,
    e: null
  },

  onLoad(opts) {
    const id = decodeURIComponent((opts && opts.id) || '');
    const raw = EV.filter(function (x) { return x.id === id; })[0];
    if (!raw) {
      wx.showToast({ title: '赛事不存在', icon: 'none' });
      return;
    }
    this.raw = raw;

    const tier = raw.tier || (TIER1.indexOf(raw.src) >= 0 ? 'primary' : 'aggregator');
    const chgFrom = CHG[raw.id] || null;
    const now = new Date();
    const todayISO = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    this.setData({
      ready: true,
      e: {
        id: raw.id,
        title: raw.title,
        city: raw.city || '线上',
        mode: raw.mode || '线上',
        prize: raw.prize || '奖金待公布',
        deadlineText: F.fmtDate(raw.deadline),
        deadlineFull: raw.deadline ? F.fmtFull(raw.deadline) : '待公布',
        chgFromText: chgFrom ? F.fmtFull(chgFrom) : '',
        changed: !!chgFrom,
        poster: raw.poster || '',
        posterOk: !!raw.poster,
        featured: !!raw.featured,
        summary: raw.summary || '',
        tracks: raw.tracks || [],
        tracksText: (raw.tracks || []).join('；'),
        tech: raw.tech || [],
        qr: raw.qr || '',
        url: raw.website || '',
        /* 信息速览 */
        dateRange: raw.dateRange || '',
        teamSize: raw.teamSize || '',
        organizer: raw.organizer || '',
        themeText: raw.theme || (raw.tags || []).join(' · '),
        /* 官方时间线：past = 已经过的节点置灰 */
        agenda: (raw.agenda || []).filter(function (a) { return a && a.t; }).map(function (a) {
          return { d: a.d || '', t: a.t, past: !!(a.d && a.d < todayISO) };
        })
      }
    });

    this.tick();
    this.timer = setInterval(this.tick.bind(this), 20000);
    this.setData({ faved: app.isFav(raw.id) });
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  /* 倒计时：剩余 ≤7 天整体转红 */
  tick() {
    if (!this.raw) return;
    const c = F.countdown(this.raw.deadline);
    this.setData({
      cd: {
        ended: c.ended,
        soon: !!c.soon,
        label: c.ended ? '报名已截止' : '距离报名截止',
        text: c.text
      }
    });
  },

  posterErr() {
    this.setData({ 'e.posterOk': false });
  },

  toggleFav() {
    const now = app.toggleFav(this.raw.id);
    this.setData({ faved: now });
    wx.showToast({ title: now ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  /**
   * 小程序不能直接打开外部网页，所以报名入口 = 复制链接 + （有二维码时）长按识别。
   * 不做 web-view：主办方域名我们无法备案为业务域名。
   */
  copyUrl() {
    if (!this.data.e.url) {
      wx.showToast({ title: '本条未收录报名链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.e.url,
      success: () => {
        wx.showToast({ title: '报名链接已复制', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.e ? this.data.e.title : '未来造物赛场',
      path: '/pages/detail/index?id=' + encodeURIComponent(this.raw ? this.raw.id : '')
    };
  }
});
