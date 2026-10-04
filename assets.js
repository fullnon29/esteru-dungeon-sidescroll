'use strict';
/* 에셋 로더 — 매니페스트에 경로가 있으면 이미지를 불러오고, 없거나 실패하면 null 을 돌려 기존 표현으로 대체 */
const Assets = (function () {
  const man = window.ASSET_MANIFEST || {};
  const imgs = {}, state = {};   // key: "group.name"
  let loaded = 0, total = 0;
  function loadAll() {
    for (const group in man) if (group !== 'anims') for (const name in man[group]) {
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
    for (const g in man) if (g !== 'anims') for (const k in man[g]) { n++; const key = g + '.' + k; if (state[key] === 'ok') ok++; else if (state[key] === 'error') err.push(key); }
    return { total: n, provided: Object.values(state).length, loaded: ok, missingFile: err };
  }
  // 애니메이션: man.anims[이름] = { size, foot, fps:{동작}, path:'.../{act}_{dir}.png' } (가로 스트립, 프레임 128px 정사각, 방향 0~7). a.img[동작][방향]. 하나라도 못 불러오면 정지 이미지로 대체.
  const anims = {};
  function loadAnims() {
    const am = man.anims || {};
    for (const name in am) { const m = am[name], a = anims[name] = { m, img: {}, ok: false }; let left = 0, bad = false;
      for (const act in (m.fps || {})) { a.img[act] = []; for (let d = 0; d < 8; d++) { left++; const im = new Image(); im.onload = () => { a.img[act][d] = im; if (--left === 0 && !bad) a.ok = true; }; im.onerror = () => { bad = true; }; im.src = m.path.replace('{act}', act).replace('{dir}', d) + '?v=' + (window.ASSET_VER || ''); /* 시트가 바뀌어도 예전 그림이 캐시에서 나오지 않게 index.html 의 버전을 붙인다 */ } } }
  }
  // 용병 애니메이션: 이름 → 직업 → 기본 직업 순으로, 각각 `@무기-갑옷` → `@무기` → `@갑옷` → (없음) 순으로 시트를 찾는다. 갑옷 등급 mythic 은 없으면 plate 로 대체.
  const animFor = u => {
    const lk = Core.looks ? Core.looks(u) : {}, arm = lk.a === 'mythic' ? ['mythic', 'plate'] : lk.a ? [lk.a] : [], sufs = [];
    for (const a of arm) if (lk.w) sufs.push(lk.w + '-' + a);
    if (lk.w) sufs.push(lk.w); for (const a of arm) sufs.push(a); sufs.push('');
    for (const base of [u.name, u.cls, Core.baseCls ? Core.baseCls(u) : u.cls]) for (const s of sufs) { const a = anims[s ? base + '@' + s : base]; if (a && a.ok) return a; }
    return null;
  };
  // 적/보스 애니메이션: 보스는 'boss'+층, 일반 몹은 몹 id(tplId)로 찾는다.
  const animEnemy = c => { const a = (c.boss ? anims['boss' + c.floorKey] : null) || anims[c.tplId]; return a && a.ok ? a : null; };
  loadAll(); loadAnims();
  return { get, unit, enemy, report, anim: animFor, animEnemy, has: () => loaded > 0 };
})();
