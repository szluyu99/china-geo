/* ============================================================
   中国地理图谱 — 应用逻辑
   ============================================================ */
(() => {
  'use strict';

  const C = window.CN_CONTENT;
  const GEO = window.CN_GEO;
  const RAD = Math.PI / 180;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (n, d = 0) => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });

  const REGION_ORDER = ['华北', '东北', '华东', '华中', '华南', '西南', '西北'];
  const CLIM = Object.fromEntries(C.climates.map((c) => [c.id, c]));
  const STEP = Object.fromEntries(C.steps.map((s) => [s.id, s]));
  const CROPS = C.crops || [];
  const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));
  const PROV_BY_NAME = Object.fromEntries(C.provinces.map((p) => [p.name, p]));
  const RANK = (() => {
    const byArea = C.provinces.slice().sort((a, b) => b.area - a.area).map((p) => p.name);
    const byPop = C.provinces.slice().sort((a, b) => b.pop - a.pop).map((p) => p.name);
    const index = (list) => Object.fromEntries(list.map((n, i) => [n, i + 1]));
    return { area: index(byArea), pop: index(byPop) };
  })();
  const TAB_NAME = {
    explore: '地理分区', landform: '地势三级阶梯', climate: '气候类型',
    agri: '农业分区', water: '水系', notes: '速记', quiz: '闯关'
  };

  const state = {
    tab: 'explore',
    fill: 'region',
    layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false },
    selected: null,
    hover: null,
    iso: null,        // 'jan' | 'jul' | 'ppt' | null 等温线 / 等降水量线
    compare: null,    // 对比模式：先记住第一个省，再点第二个省
    bubble: null,     // 'pop' | 'area' | null 气泡图
    hoverMountain: null,
    hoverRiver: null,
    selectedMountain: null,
    selectedRiver: null,
    highlightClimate: null,
    hi: null,
    profileLon: null,
    focusLandform: null,
    quiz: null,
    quizMarks: {},
    view: { k: 1, tx: 0, ty: 0 },
    reveal: 0,
    revealT0: 0,
    forceLabelsUntil: 0,
    dimOthers: null,
    theme: 'night',
    layersTouched: false,
    preQuizLayers: null
  };


