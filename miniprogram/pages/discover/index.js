const D = require('../../utils/decorate.js');
const FLASHES = require('../../data/flashes.js');
const F = require('../../utils/format.js');

Page({
  data: {
    q: '',
    filter: '全部',
    sort: 'fresh',
    chips: [],
    list: [],
    seclbl: '正在报名',
    seccnt: '',
    flashTxt: '',
    flashTime: ''
  },

  onLoad() {
    const f = FLASHES[0] || { txt: '', m: 0 };
    this.setData({
      chips: D.buildChips(),
      flashTxt: f.txt,
      flashTime: F.ago(f.m)
    });
    this.render();
  },

  render() {
    const q = (this.data.q || '').trim().toLowerCase();
    const filter = this.data.filter;

    let list = D.EV.map(D.decorate);

    list = list.filter(function (e) {
      if (!filter || filter === '全部') return true;
      if (filter === '线上' || filter === '线下') return e.mode === filter;
      return e.tags.indexOf(filter) >= 0;
    });

    if (q) {
      list = list.filter(function (e) {
        return (e.title + e.src + e.tags.join('')).toLowerCase().indexOf(q) >= 0;
      });
    }

    /* 默认「最新更新」：先看发生了什么新事；可切「临近截止」。已结束一律沉底 */
    if (this.data.sort === 'fresh') {
      list.sort(function (a, b) {
        if (a.ended !== b.ended) return a.ended ? 1 : -1;
        return a.up - b.up;
      });
    } else {
      list.sort(function (a, b) {
        if (a.ended !== b.ended) return a.ended ? 1 : -1;
        return a.dl - b.dl;
      });
    }

    const soon = list.filter(function (e) { return !e.ended && e.dl <= 7; }).length;
    const todayNew = list.filter(function (e) { return e.fresh; }).length;

    this.setData({
      list: list,
      seclbl: filter === '全部' ? (soon ? '即将截止' : '正在报名') : filter,
      seccnt: list.length + ' 场 · 今日 ' + todayNew + ' 更新'
    });
  },

  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.render();
  },

  onChip(e) {
    this.setData({ filter: e.currentTarget.dataset.t });
    this.render();
  },

  onSort(e) {
    this.setData({ sort: e.currentTarget.dataset.s });
    this.render();
  },

  /* 海报加载失败 → 回落到模板海报，不留灰块 */
  posterErr(e) {
    const patch = {};
    patch['list[' + e.currentTarget.dataset.index + '].posterOk'] = false;
    this.setData(patch);
  },

  openDetail(e) {
    wx.navigateTo({
      url: '/pages/detail/index?id=' + encodeURIComponent(e.currentTarget.dataset.id)
    });
  },

  goNews() {
    wx.switchTab({ url: '/pages/news/index' });
  }
});
