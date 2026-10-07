const FLASHES = require('../../data/flashes.js');
const NEWS = require('../../data/articles.js');
const F = require('../../utils/format.js');

Page({
  data: {
    fl: [],
    news: []
  },

  onLoad() {
    /* 节点颜色区分：自动监测（蓝）/ 重要（红）/ 人工发布（灰） */
    const fl = FLASHES.map(function (f) {
      return {
        txt: f.txt,
        src: f.src,
        time: F.ago(f.m),
        node: f.hot ? 'hot' : (f.auto ? '' : 'man')
      };
    });
    this.setData({ fl: fl, news: NEWS });
  }
});
