  /* ---------------- 标签 ---------------- */
  const FONT_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
  const FONT_DISPLAY = '"Songti SC","Noto Serif SC",serif';
  const FONT_MONO = '"SF Mono",ui-monospace,monospace';
  const LABEL_OFFSET = {
    北京市: [2, -18], 天津市: [26, 8], 上海市: [30, -2], 香港特别行政区: [26, 14],
    澳门特别行政区: [-24, 18], 江苏省: [8, -12], 浙江省: [14, 10], 宁夏回族自治区: [-6, -6],
    海南省: [0, 12], 台湾省: [0, 0], 河北省: [-4, 6], 安徽省: [0, 2]
  };
  let labelRects = [];
  const DEBUG = { labels: [], draws: 0, attempts: 0, rejects: 0, err: null };

