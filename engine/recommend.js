// engine/recommend.js
// 效果推荐：根据意图/关键词返回候选效果。用法：RF.recommend('粒子爆炸')
(function (RF) {
  var TAGS = {
    fbmNoise: ['氛围', '底纹', '流动', '烟雾', '云', '背景', '有机'],
    noiseMask: ['遮罩', '裁切', '流动形状'],
    particles: ['粒子', '星点', '爆炸', '收拢', '涡旋', '散射', '飞散'],
    flowfield: ['流动', '丝绸', '粒子流', '风', '轨迹'],
    feedback: ['拖尾', '残影', '万花筒', '余晖', '时间厚度'],
    polygonRing: ['几何', '环绕', '多边形', '科技感'],
    ripples: ['波纹', '扩散', '冲击波', '水波', '同心圆'],
    gridWarp: ['网格', '点阵', '科技', '数据', '形变'],
    strokeGrow: ['描边', '生长', '路径', '线条'],
    morphPolygon: ['多边形', '旋转', '呼吸', '几何体', 'logo'],
    lissajous: ['曲线', '数学', '优雅', '利萨如', '轨道'],
    metaball: ['融合', '液体', '球体', '有机'],
    kaleidoscope: ['万花筒', '对称', '镜像', '图案'],
    typewriter: ['打字机', '逐字', '代码', '终端'],
    wordPop: ['弹入', '标题', '活泼', '逐字'],
    blurFocus: ['聚焦', '模糊', '清晰', '电影感'],
    titleCard: ['大标题', '标题卡', '品牌', '产品名', '主标'],
    lyricLine: ['歌词', 'MV', '高亮', '卡拉OK'],
    bezierText: ['曲线文字', '路径文字', '创意', '贝塞尔'],
    bulletList: ['列表', '特性', '要点', '列表项'],
    codeBlock: ['代码', '终端', '开发', '技术'],
    labelText: ['标签', '说明', '副标', '小字'],
    browserFrame: ['浏览器', '网页', '产品演示', '界面'],
    terminalWindow: ['终端', '命令行', '开发', '开源'],
    phoneFrame: ['手机', '移动端', 'App'],
    cardStack: ['卡片', '堆叠', '多图', '截图'],
    counterNumber: ['数字', '计数', '滚动', '数据'],
    progressRing: ['进度', '圆环', '百分比'],
    barChart: ['柱状图', '条形图', '数据', '对比'],
    lineChart: ['折线图', '趋势', '增长', '数据'],
    pieChart: ['饼图', '占比', '份额'],
    radarChart: ['雷达图', '多维', '能力'],
    cursor: ['光标', '鼠标', '操作演示'],
    clickRipple: ['点击', '交互', '波纹'],
    keyPress: ['键盘', '快捷键', '按键'],
    connector: ['连线', '箭头', '连接', '关系'],
    tagCloud: ['标签', '关键词', '技术栈'],
    geoShapes: ['几何', '装饰', '形状', '散布'],
    dotGrid: ['点阵', '网格', '科技', '背景'],
    gradientBlob: ['光斑', '渐变', '氛围', '柔和'],
    frameRect: ['边框', '强调', '矩形'],
    divider: ['分隔', '线条', '划分'],
    logoMark: ['logo', '标志', '符号', '品牌'],
    stripes: ['斜纹', '条纹', '底纹'],
    bigGlyph: ['装饰符', '引号', '大字'],
    subtitle: ['字幕', 'SRT', '对白'],
    image: ['图片', '素材', '截图'],
    video: ['视频', '录屏', '动态素材'],
    svg: ['svg', '矢量', '图标'],
  };

  function recommend(intent, limit) {
    limit = limit || 5;
    var q = String(intent || '').toLowerCase();
    var scores = {};
    Object.keys(TAGS).forEach(function (name) {
      if (!RF.effects[name]) return;
      var tags = TAGS[name];
      var s = 0;
      tags.forEach(function (tag) {
        if (q.indexOf(tag) >= 0) s += 3;
      });
      if (q.indexOf(name.toLowerCase()) >= 0) s += 10;
      var def = RF.effects[name];
      if (def.meta && def.meta.desc && q.length > 1 && def.meta.desc.toLowerCase().indexOf(q) >= 0) s += 5;
      if (s > 0) scores[name] = s;
    });
    var arr = Object.keys(scores).map(function (n) { return { name: n, score: scores[n] }; });
    arr.sort(function (a, b) { return b.score - a.score; });
    return arr.slice(0, limit).map(function (it) {
      var def = RF.effects[it.name];
      return {
        name: it.name,
        score: +it.score.toFixed(1),
        category: def.meta ? def.meta.category : '',
        desc: def.meta ? def.meta.desc : ''
      };
    });
  }

  RF.recommend = recommend;
})(window.RF = window.RF || {});
