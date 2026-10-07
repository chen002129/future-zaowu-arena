const app = getApp();
const cfg = require('../../config');

/* 只有这些场景进入小程序时，微信才允许展示「关注公众号」组件。
   核心是「扫小程序码进来」——这是公众号导流最自然的路径。 */
const OA_SCENES = [
  1011, // 扫描二维码
  1017, // 前往小程序体验版的入口页
  1025, // 扫描一维码
  1047, // 扫描小程序码
  1124, // 扫「一物一码」打开小程序
  1089, // 聊天主界面下拉，「最近使用」
  1090, // 长按右上角菜单唤出最近使用历史
  1104, // 聊天主界面下拉，「我的小程序」
  1131, // 浮窗
  1187, // 新版浮窗
  1038, // 从另一个小程序返回
  1041  // 从插件小程序返回小程序
];

Page({
  data: {
    favCount: 0,
    syncCode: '',
    syncIn: '',
    syncMsg: '',
    // 渠道入口：留空则整块不渲染
    hasFinder: false,
    hasOaArticle: false,
    hasChannels: false,
    showOfficialAccount: false
  },

  onLoad() {
    const hasFinder = !!cfg.finderUserName;
    const hasOaArticle = !!cfg.oaArticleUrl;

    let scene = 0;
    try {
      scene = (wx.getLaunchOptionsSync && wx.getLaunchOptionsSync().scene) || 0;
    } catch (e) {
      scene = 0;
    }

    this.setData({
      hasFinder,
      hasOaArticle,
      hasChannels: hasFinder || hasOaArticle,
      showOfficialAccount: !!cfg.enableOfficialAccount && OA_SCENES.indexOf(scene) >= 0
    });
  },

  onShow() {
    this.setData({ favCount: app.favCount() });
  },

  /* ---------- 视频号：打开视频号主页 ---------- */
  openChannels() {
    if (!cfg.finderUserName) {
      wx.showToast({ title: '视频号还没配置，稍后再来', icon: 'none' });
      return;
    }
    if (!wx.openChannelsUserProfile) {
      wx.showToast({ title: '当前微信版本不支持，请升级微信', icon: 'none' });
      return;
    }
    wx.openChannelsUserProfile({
      finderUserName: cfg.finderUserName,
      fail: () => wx.showToast({ title: '打开视频号失败，请稍后重试', icon: 'none' })
    });
  },

  /* ---------- 公众号：打开公众号文章 ---------- */
  openOaArticle() {
    if (!cfg.oaArticleUrl) {
      wx.showToast({ title: '公众号还没配置，稍后再来', icon: 'none' });
      return;
    }
    if (!wx.openOfficialAccountArticle) {
      // 基础库低于 3.4.8：降级为复制链接，用户可到微信里打开
      wx.setClipboardData({
        data: cfg.oaArticleUrl,
        success: () => wx.showToast({ title: '链接已复制，可在微信中打开', icon: 'none' })
      });
      return;
    }
    wx.openOfficialAccountArticle({
      url: cfg.oaArticleUrl,
      fail: () => wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' })
    });
  },

  goFav() {
    wx.switchTab({ url: '/pages/fav/index' });
  },

  /* ---------- 设备同步码：不依赖 AppID、不依赖账号、不依赖网络 ---------- */
  makeSync() {
    const code = app.exportSyncCode();
    if (!code) {
      this.setData({ syncCode: '', syncMsg: '还没有收藏，先去收藏几个赛场再来生成' });
      return;
    }
    this.setData({
      syncCode: code,
      syncMsg: '共 ' + app.favCount() + ' 个收藏 · 点一下即可复制'
    });
  },

  copySync() {
    if (!this.data.syncCode) {
      wx.showToast({ title: '请先生成同步码', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.syncCode,
      success: () => wx.showToast({ title: '同步码已复制', icon: 'none' })
    });
  },

  onSyncInput(e) {
    this.setData({ syncIn: e.detail.value });
  },

  doImportSync() {
    const raw = this.data.syncIn;
    if (!raw) {
      wx.showToast({ title: '请先粘贴同步码', icon: 'none' });
      return;
    }
    const r = app.importSyncCode(raw);
    if (r.error) {
      this.setData({ syncMsg: r.error });
      wx.showToast({ title: r.error, icon: 'none' });
      return;
    }
    this.setData({
      syncIn: '',
      syncCode: '',
      favCount: app.favCount(),
      syncMsg: r.added
        ? '已导入 ' + r.added + ' 个，现在共 ' + r.total + ' 个收藏'
        : '这些收藏本机已经有了'
    });
    wx.showToast({ title: '收藏已更新', icon: 'success' });
  }
});
