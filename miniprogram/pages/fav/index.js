const D = require('../../utils/decorate.js');
const app = getApp();

Page({
  data: {
    list: []
  },

  onShow() {
    this.render();
  },

  render() {
    const favs = app.globalData.favs || [];
    const list = favs.map(D.decorateById).filter(function (x) { return !!x; });
    /* 已结束的沉底，其余按截止临近排 */
    list.sort(function (a, b) {
      if (a.ended !== b.ended) return a.ended ? 1 : -1;
      return a.dl - b.dl;
    });
    this.setData({ list: list });
  },

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

  goDiscover() {
    wx.switchTab({ url: '/pages/discover/index' });
  }
});
