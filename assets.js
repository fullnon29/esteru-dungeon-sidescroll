'use strict';
/* 에셋 로더 — 매니페스트에 경로가 있으면 이미지를 불러오고, 없거나 실패하면 null 을 돌려 기존 표현으로 대체 */
const Assets = (function () {
  const man = window.ASSET_MANIFEST || {};
  const imgs = {}, state = {};   // key: "group.name"
  let loaded = 0, total = 0;
  function loadAll() {
    for (const group in man) for (const name in man[group]) {
      const path = man[group][name]; if (!path) continue;
      const key = group + '.' + name; total++; state[key] = 'loading';
      const im = new Image();
      im.onload = () => { imgs[key] = im; state[key] = 'ok'; loaded++; };
      im.onerror = () => { state[key] = 'error'; };
      im.src = path;
    }
  }
  const get = (group, name) => imgs[group + '.' + name] || null;
  // 용병: 이름별 → 직업별 순으로 찾는다
  const unit = (group, u) => get(group, u.name) || get(group, u.cls);
  // 적/보스: 보스는 floor 기반
  const enemy = c => (c.boss ? get('sprites', 'boss' + c.floorKey) : null) || get('sprites', c.tplId) || null;
  function report() {
    let n = 0, ok = 0, err = [];
    for (const g in man) for (const k in man[g]) { n++; const key = g + '.' + k; if (state[key] === 'ok') ok++; else if (state[key] === 'error') err.push(key); }
    return { total: n, provided: Object.values(state).length, loaded: ok, missingFile: err };
  }
  loadAll();
  return { get, unit, enemy, report, has: () => loaded > 0 };
})();
