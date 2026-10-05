'use strict';
/* 횡스크롤 전투 프로토타입 v2 (에스테르의 미궁 포크) — 격자 타일 횡스크롤.
 * 전장 = 3~5행(ROWS) × 사실상 무한한 열의 격자 타일. 원근으로 눕혀 그려 먼 줄이 좁고 가까운 줄이 넓은 사다리꼴(칸마다 사다리꼴).
 * 타일마다 고저차(0~3단계). 전투의 진행(이동)은 앞뒤(열 방향)로만 한다 — 줄(행)은 대형 위치일 뿐 줄 바꿈 이동은 없다.
 * 쿼터뷰판의 순간이동·동작 중첩 문제를 막는 규칙(그대로 유지):
 *  1) 유닛마다 동시에 하나의 동작(act: step·atk)만 가진다. 동작은 정해진 길이로 끝까지 재생된다.
 *  2) 이동은 "한 칸 걷기" 동작(고정 길이)을 이어 붙인다. 목적 칸은 시작 때 예약해 겹치지 않고, 전투 진행은 고정 시간 간격(1/120초)이라
 *     배속이 높아도 동작을 건너뛰지 않는다. 걸음 프레임은 동작 진행도로 정한다.
 *  3) 피격은 동작을 덮어쓰지 않는다(공격 준비 중이면 버티고, 그 외엔 짧게 경직).
 *  4) 오의 연출은 cine.js 재사용(연출 동안 전투 정지, 일격 시점에 피해). */
(function () {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const TILE_W = 104, LV = 44, FAR_Y = 232, NEAR_Y = 478, S_FAR = 0.56, DT = 1 / 120, STEP_BASE = 0.36;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a), sgn = v => v >= 0 ? 1 : -1;
  const ANIM = () => Assets.animEnemy({ tplId: 'knight' }); // 기사 시트(128px, 8방향, 동작별 15프레임) — 좌/우(0/4)만 사용
  const FPS = { idle: 10, walk: 14, atk: 18, heavy: 16, hurt: 15, die: 12, dodge: 20 }, HITF = { atk: 8 };

  /* ---------- 격자·원근 ---------- */
  let ROWS = 4, ys = [];
  function layout() { const w = Array.from({ length: ROWS }, (_, r) => lerp(S_FAR, 1, (r + 0.5) / ROWS)), tot = w.reduce((a, b) => a + b, 0); ys = [FAR_Y]; w.forEach(x => ys.push(ys[ys.length - 1] + (NEAR_Y - FAR_Y) * x / tot)); }
  const sAt = b => lerp(S_FAR, 1, b / ROWS), yAt = b => { const i = clamp(Math.floor(b), 0, ROWS - 1); return lerp(ys[i], ys[i + 1], b - i); };
  const S = { units: [], proj: [], fxs: [], floaters: [], occ: new Map(), t: 0, acc: 0, speed: 1, paused: false, follow: true, cine: null, freezeT: 0, result: null, resultT: 0, wave: 0, waveT: 0, cam: { c: 4 }, metrics: { maxFramePx: 0, frames: 0, overlap: 0, simSteps: 0, kills: 0 } };
  // 높이: 열 구간마다 고원(plateau) + 줄마다 작은 요철. 무한히 이어지는 결정적 함수.
  const hCache = new Map();
  function Hh(c, r) { const k = c * 8 + r; let v = hCache.get(k); if (v === undefined) { const seg = Math.floor(c / 5), base = Math.round(1.6 + 1.3 * Math.sin(seg * 1.7) + 0.8 * Math.sin(seg * 0.6 + 1)), bump = ((c * 7 + r * 13 + seg * 3) % 11 === 0) ? 1 : 0; v = clamp(base + bump, 0, 3); hCache.set(k, v); } return v; }
  // 타일 경계 좌표(c: 열, rf: 줄 경계 0~ROWS, h: 높이 단계) → 화면
  function proj(c, rf, h) { const s = sAt(rf); return { x: W / 2 + (c - S.cam.c) * TILE_W * s, y: yAt(rf) - h * LV * s, s }; }

  /* ---------- 유닛 ---------- */
  const ROLES = {
    warrior: { name: '레온', hp: 280, atk: 34, def: 6, spd: 150, range: 1, cdMax: 0.45, special: { cine: 'kenki', name: '검기 난무', mode: 'aoe', radius: 2, mult: 2.0, range: 2 } },
    elf: { name: '실비아', hp: 170, atk: 30, def: 3, spd: 130, range: 5, ranged: true, cdMax: 0.8, special: { cine: 'pierce', name: '관통 사격', mode: 'line', len: 7, mult: 1.8, range: 6 } },
    priest: { name: '루나', hp: 190, atk: 18, def: 3, spd: 120, range: 4, ranged: true, cdMax: 1.0, special: { cine: 'sanctuary', name: '성역', mode: 'heal', mult: 0, range: 99 } },
    thief: { name: '핀', hp: 160, atk: 38, def: 2, spd: 215, range: 1, cdMax: 0.3, special: { cine: 'assassinate', name: '암살', mode: 'single', mult: 3.2, range: 3 } },
  };
  const FOES = {
    grunt: { name: '잡병', hp: 190, atk: 15, def: 4, spd: 125, range: 1, cdMax: 0.6, tint: 'sepia(1) saturate(4) hue-rotate(-25deg)' },
    archer: { name: '궁수', hp: 120, atk: 14, def: 2, spd: 110, range: 5, ranged: true, cdMax: 1.1, tint: 'sepia(1) saturate(3) hue-rotate(60deg)' },
    brute: { name: '거한', hp: 460, atk: 28, def: 8, spd: 90, range: 1, cdMax: 0.8, tint: 'sepia(1) saturate(3) hue-rotate(250deg)', scale: 1.2 },
  };
  const key = (c, r) => c + ',' + r;
  function mkUnit(side, k, c, r) {
    const d = (side === 'p' ? ROLES : FOES)[k];
    const u = { id: S.units.length, side, key: k, name: d.name, c, r, cf: c + 0.5, hf: Hh(c, r), hp: d.hp, max: d.hp, atk: d.atk, def: d.def, spd: d.spd, range: d.range, ranged: !!d.ranged, cdMax: d.cdMax, cd: rnd(0, 0.4), special: d.special || null, sp: side === 'p' ? rnd(35, 70) : 0,
      tint: d.tint || '', scale: d.scale || 1, face: side === 'p' ? 0 : 4, act: null, stun: 0, flash: 0, kx: 0, wp: 0, alive: true, deathT: 0, ov: null, idleT: Math.random() * 3 };
    S.occ.set(key(c, r), u); return u;
  }
  function freeTile(c, r) { return !S.occ.has(key(c, r)); }
  function reset() {
    S.units = []; S.proj = []; S.fxs = []; S.floaters = []; S.occ.clear(); S.t = 0; S.acc = 0; S.cine = null; S.freezeT = 0; S.result = null; S.resultT = 0; S.wave = 0; S.waveT = 0; layout();
    const lanes = i => Math.round(i * (ROWS - 1) / 3);
    [['warrior', 4, 1], ['thief', 3, 2], ['elf', 1, 0], ['priest', 2, 3]].forEach(([k, c, i]) => S.units.push(mkUnit('p', k, c, clamp(lanes(i), 0, ROWS - 1))));
    spawnWave(); S.cam.c = 7;
  }
  function spawnWave() {
    S.wave++; const front = Math.max(...S.units.filter(u => u.side === 'p' && u.alive).map(u => u.c)), n = Math.min(3 + Math.ceil(S.wave * 0.7), ROWS * 3), kinds = ['grunt', 'grunt', 'archer', 'brute', 'grunt', 'archer'];
    let placed = 0, c = front + 12; while (placed < n) { for (let r = 0; r < ROWS && placed < n; r++) if (freeTile(c, r) && Math.random() < 0.7) { S.units.push(mkUnit('e', kinds[(placed + S.wave) % kinds.length], c, r)); placed++; } c++; }
  }
  const foesOf = u => S.units.filter(o => o.alive && o.side !== u.side), alliesOf = u => S.units.filter(o => o.alive && o.side === u.side);

  /* ---------- 전투 진행 ---------- */
  function startStep(u, dir) {
    const c1 = u.c + dir; if (!freeTile(c1, u.r)) return false; S.occ.set(key(c1, u.r), u); // 목적 칸 예약
    u.act = { type: 'step', t: 0, dur: STEP_BASE * 150 / u.spd, c0: u.c, c1, h0: Hh(u.c, u.r), h1: Hh(c1, u.r) }; return true;
  }
  function decide(u) {
    const foes = foesOf(u);
    if (!foes.length) { if (u.side === 'p') { u.face = 0; startStep(u, 1); } return; } // 적이 없으면 아군은 앞으로 행군
    let tgt = foes[0]; for (const o of foes) if (Math.abs(o.c - u.c) < Math.abs(tgt.c - u.c) || (Math.abs(o.c - u.c) === Math.abs(tgt.c - u.c) && Math.abs(o.r - u.r) < Math.abs(tgt.r - u.r))) tgt = o;
    const dc = tgt.c - u.c, dist = Math.abs(dc); if (dc !== 0) u.face = dc > 0 ? 0 : 4;
    if (u.special && u.sp >= 100 && dist <= u.special.range && !S.cine && u.side === 'p') { startSpecial(u, tgt); return; }
    if (dist <= u.range) { if (u.cd <= 0) u.act = { type: 'atk', t: 0, dur: 15 / FPS.atk, hitAt: HITF.atk / FPS.atk, target: tgt, done: false }; return; } // 사거리(열 거리) 안: 쿨다운 끝나면 공격
    startStep(u, sgn(dc)); // 앞뒤 이동만(줄 바꿈 없음). 앞 칸이 막히면 대기
  }
  function hit(att, tgt, mult, opt) {
    if (!tgt.alive) return; opt = opt || {};
    const dmg = Math.max(1, Math.round(att.atk * rnd(0.9, 1.1) * mult - tgt.def * 0.4)), crit = Math.random() < 0.1, v = crit ? Math.round(dmg * 1.5) : dmg;
    tgt.hp -= v; tgt.flash = 0.1; tgt.kx = sgn(tgt.c - att.c || 1) * (opt.big ? 0.22 : 0.1); if (att.side === 'p') att.sp = Math.min(100, att.sp + 9); else tgt.sp = Math.min(100, tgt.sp + 6);
    S.floaters.push({ c: tgt.cf, r: tgt.r + 0.5, h: tgt.hf, text: (crit ? '💥' : '') + v, col: tgt.side === 'p' ? '#ff8a8a' : '#fff', t: 0, big: crit });
    if (!opt.noFx) spawnFx(opt.fx || 'hit', tgt);
    const armored = tgt.act && tgt.act.type === 'atk' && tgt.act.t < tgt.act.hitAt;
    if (tgt.hp <= 0) { tgt.alive = false; tgt.deathT = 0; S.metrics.kills++; S.occ.delete(key(tgt.c, tgt.r)); if (tgt.act && tgt.act.type === 'step') S.occ.delete(key(tgt.act.c1, tgt.r)); tgt.act = null; return; } /* 쓰러지면 점유한 칸(걷던 중이면 예약 칸도)을 비운다 — 시체가 길을 막아 교착되던 문제 */
    if (!armored && !(tgt.act && tgt.act.type === 'step')) { tgt.stun = Math.max(tgt.stun, opt.big ? 0.45 : 0.28); tgt.act = null; } // 걷는 중이면 경직 없이 이어 걷는다(동작 끊김 방지)
  }
  const spawnFx = (name, u) => { if (Assets.fx(name)) S.fxs.push({ name, u, t: 0 }); };
  function updateUnit(u, dt) {
    u.cd = Math.max(0, u.cd - dt); u.flash = Math.max(0, u.flash - dt); u.kx *= Math.pow(0.0004, dt); u.idleT += dt; if (u.ov) { u.ov.t += dt; if (u.ov.t >= u.ov.dur) u.ov = null; }
    if (u.side === 'p') u.sp = Math.min(100, u.sp + dt * 2.2);
    if (u.stun > 0) { u.stun -= dt; return; }
    if (!u.act) decide(u); if (!u.act) return; const a = u.act; a.t += dt;
    if (a.type === 'step') {
      const p = clamp(a.t / a.dur, 0, 1); u.cf = lerp(a.c0, a.c1, p) + 0.5; u.hf = lerp(a.h0, a.h1, p) + Math.sin(Math.PI * p) * (a.h0 !== a.h1 ? 0.5 : 0.06); u.wp = p;
      if (p >= 1) { S.occ.delete(key(a.c0, u.r)); u.c = a.c1; u.cf = a.c1 + 0.5; u.hf = a.h1; u.act = null; }
    } else if (a.type === 'atk') {
      if (!a.done && a.t >= a.hitAt) { a.done = true; if (u.ranged) S.proj.push({ cf: u.cf, rf: u.r + 0.5, hf: u.hf + 1.2, from: u, tgt: a.target, v: 9, mult: 1 }); else hit(u, a.target, 1); }
      if (a.t >= a.dur) { u.act = null; u.cd = u.cdMax; }
    }
  }
  function tick(dt) {
    S.t += dt;
    for (const u of S.units) { if (!u.alive) { u.deathT += dt; continue; } updateUnit(u, dt); if (S.cine) return; }
    for (const p of S.proj) { if (!p.tgt.alive) { p.dead = true; continue; } const dc = p.tgt.cf - p.cf, dr = p.tgt.r + 0.5 - p.rf, dh = p.tgt.hf + 1.0 - p.hf, d = Math.hypot(dc, dr), s = p.v * dt; if (d <= s + 0.15) { hit(p.from, p.tgt, p.mult); p.dead = true; } else { p.cf += dc / d * s; p.rf += dr / d * s; p.hf += dh / d * s; } }
    S.proj = S.proj.filter(p => !p.dead);
    if (!S.result) {
      const pa = S.units.some(u => u.side === 'p' && u.alive), ea = S.units.some(u => u.side === 'e' && u.alive);
      if (!pa) { S.result = '패배…'; S.resultT = 0; } else if (!ea) { S.waveT += dt; if (S.waveT > 1.0) { S.waveT = 0; for (const u of S.units) if (u.side === 'p' && u.alive) { u.hp = Math.min(u.max, u.hp + u.max * 0.45); u.sp = Math.min(100, u.sp + 25); S.floaters.push({ c: u.cf, r: u.r + 0.5, h: u.hf, text: '회복', col: '#7cf0a0', t: 0 }); } spawnWave(); } } /* 웨이브를 넘기면 아군이 일부 회복(프로토타입 밸런스) */ // 적을 모두 쓰러뜨리면 행군 → 다음 무리가 앞쪽에서 나타난다(열은 사실상 무한)
    }
  }

  /* ---------- 오의 연출 ---------- */
  function startSpecial(u, tgt) { const sp = u.special, def = window.CINE_MANIFEST && window.CINE_MANIFEST[sp.cine]; if (!def) return; u.sp = 0; u.face = tgt.c >= u.c ? 0 : 4; S.cine = { def, t: 0, prev: -1, caster: u, tgt, name: sp.name, cs: null, done: false, ts: 1 }; }
  const fxInfo = name => { const f = Assets.fx(name); return f ? { fps: f.m.fps, n: f.m.n } : null; };
  function applySpecial(c) {
    const u = c.caster, sp = u.special, foes = foesOf(u);
    if (sp.mode === 'aoe') foes.filter(o => Math.abs(o.c - u.c) <= sp.radius).forEach(o => hit(u, o, sp.mult, { big: true, noFx: true }));
    else if (sp.mode === 'single') hit(u, c.tgt, sp.mult, { big: true, noFx: true });
    else if (sp.mode === 'line') foes.filter(o => sgn(o.c - u.c) === sgn(c.tgt.c - u.c) && Math.abs(o.c - u.c) <= sp.len).forEach(o => hit(u, o, sp.mult, { big: true, noFx: true }));
    else if (sp.mode === 'heal') alliesOf(u).forEach(o => { const v = 90; o.hp = Math.min(o.max, o.hp + v); S.floaters.push({ c: o.cf, r: o.r + 0.5, h: o.hf, text: '+' + v, col: '#7cf0a0', t: 0 }); });
  }
  function cineTick(dtc) {
    const c = S.cine, t0 = c.prev; c.t += dtc;
    for (const st of Cine.events(c.def, t0, c.t)) { if (st.type === 'freeze') S.freezeT = Math.min(0.25, st.dur || 0.1); else if (st.type === 'anim') c.caster.ov = { act: st.act in FPS ? st.act : 'heavy', t: 0, dur: st.dur || 0.4 }; }
    if (!c.done && c.t >= c.def.hit) { c.done = true; applySpecial(c); }
    c.cs = Cine.sample(c.def, c.t, fxInfo); c.ts = c.cs.ts; c.prev = c.t;
    if (c.t >= c.def.dur) { if (!c.done) applySpecial(c); S.cine = null; }
  }

  /* ---------- 그리기: 배경·타일 ---------- */
  const R0 = (() => { let s = 777; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
  const mountains = Array.from({ length: 60 }, (_, i) => ({ x: i * 90, h: 60 + R0() * 120 })), ruins = Array.from({ length: 40 }, (_, i) => ({ x: i * 150 + R0() * 60, w: 36 + R0() * 40, h: 70 + R0() * 150, tower: R0() < 0.45 }));
  const mixc = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = s => Math.round(((n >> s) & 255) * (1 - k)); return `rgb(${f(16)},${f(8)},${f(0)})`; };
  function drawBackground(dim) {
    const g = ctx.createLinearGradient(0, 0, 0, FAR_Y + 30); g.addColorStop(0, '#141b36'); g.addColorStop(0.55, '#3c3f6e'); g.addColorStop(1, '#c0766f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sg = ctx.createRadialGradient(W * 0.7, FAR_Y - 30, 10, W * 0.7, FAR_Y - 30, 200); sg.addColorStop(0, 'rgba(255,220,160,.85)'); sg.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    const px = f => -((S.cam.c * TILE_W * f) % 5400);
    ctx.fillStyle = '#4a4f86'; ctx.beginPath(); ctx.moveTo(-200, FAR_Y + 6); for (const m of mountains) ctx.lineTo(m.x + px(0.1), FAR_Y - m.h); ctx.lineTo(W + 800, FAR_Y + 6); ctx.fill();
    ctx.fillStyle = '#2d3156'; for (const r of ruins) { const x = r.x + px(0.22); if (x < -80 || x > W + 80) continue; ctx.fillRect(x, FAR_Y - r.h * 0.8, r.w, r.h * 0.8 + 10); if (r.tower) { ctx.fillRect(x - 6, FAR_Y - r.h * 0.8 - 12, r.w + 12, 12); for (let k = 0; k < 3; k++) ctx.fillRect(x - 6 + k * (r.w / 2), FAR_Y - r.h * 0.8 - 22, 8, 10); } }
    if (dim > 0) { ctx.fillStyle = 'rgba(0,0,0,' + dim + ')'; ctx.fillRect(0, 0, W, H); }
  }
  const TOP = ['#5f7a4e', '#6b8a58', '#7a9a66', '#8fb078'], FACE = '#4b4458', FACE2 = '#3a3447';
  function quad(a, b, c, d, fill, stroke) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
  function drawTile(c, r, dim) {
    const h = Hh(c, r), p00 = proj(c, r, h), p10 = proj(c + 1, r, h), p11 = proj(c + 1, r + 1, h), p01 = proj(c, r + 1, h);
    const hn = r + 1 < ROWS ? Hh(c, r + 1) : -4; // 앞(가까운) 줄 이웃보다 높으면 앞면이 보인다
    if (h > hn) quad(p01, p11, proj(c + 1, r + 1, hn), proj(c, r + 1, hn), mixc(FACE, dim), 'rgba(0,0,0,.35)');
    if (c >= S.cam.c) { const hl = Hh(c - 1, r); if (h > hl) quad(p00, p01, proj(c, r + 1, hl), proj(c, r, hl), mixc(FACE2, dim), 'rgba(0,0,0,.35)'); } // 카메라 중심 기준 보이는 옆면
    if (c + 1 <= S.cam.c) { const hr = Hh(c + 1, r); if (h > hr) quad(p10, p11, proj(c + 1, r + 1, hr), proj(c + 1, r, hr), mixc(FACE2, dim), 'rgba(0,0,0,.35)'); }
    quad(p00, p10, p11, p01, mixc(TOP[h] || TOP[3], dim), 'rgba(0,0,0,.3)'); // 윗면(사다리꼴) + 격자선
    if (h > 0) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y); ctx.stroke(); }
  }

  /* ---------- 그리기: 유닛·이펙트·HUD ---------- */
  function unitAnim(u) {
    if (!u.alive) return { act: 'die', fr: Math.min(14, Math.floor(u.deathT * FPS.die)) };
    if (u.ov) return { act: u.ov.act, fr: Math.min(14, Math.floor(u.ov.t / u.ov.dur * 15)) };
    if (u.stun > 0) return { act: 'hurt', fr: Math.min(14, Math.floor((1 - u.stun / 0.3) * 8)) };
    const a = u.act; if (a && a.type === 'atk') return { act: 'atk', fr: Math.min(14, Math.floor(a.t / a.dur * 15)) };
    if (a && a.type === 'step') return { act: 'walk', fr: Math.floor(a.t / a.dur * 15) % 15 };
    return { act: 'idle', fr: Math.floor(u.idleT * FPS.idle) % 15 };
  }
  const footOf = u => proj(u.cf + u.kx, u.r + 0.5, u.hf);
  function drawUnit(u) {
    const A = ANIM(), an = unitAnim(u), f = footOf(u), sc = f.s * u.scale; if (!A || !an) return;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, 34 * sc, 8 * sc, 0, 0, 7); ctx.fill();
    if (u.alive) { ctx.strokeStyle = u.side === 'p' ? 'rgba(106,168,255,.95)' : 'rgba(255,110,90,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, 30 * sc, 7 * sc, 0, 0, 7); ctx.stroke(); }
    const im = (A.img[an.act] || A.img.idle)[u.face]; if (!im) return; const sz = 128 * sc, foot = (A.m.foot || 102) * sz / 128;
    ctx.save(); if (!u.alive) ctx.globalAlpha = clamp(1 - (u.deathT - 0.9) / 0.8, 0, 1); ctx.filter = u.flash > 0 ? 'brightness(4) saturate(0)' : (u.tint || 'none'); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, an.fr * 128, 0, 128, 128, f.x - sz / 2, f.y - foot, sz, sz); ctx.restore();
    if (u.alive) { const w = 46 * f.s, p = u.hp / u.max, y = f.y - 112 * sc; ctx.fillStyle = '#000a'; ctx.fillRect(f.x - w / 2, y, w, 5); ctx.fillStyle = u.side === 'p' ? (p < 0.3 ? '#ef6b6b' : '#6fd08c') : '#e07a5a'; ctx.fillRect(f.x - w / 2, y, w * p, 5); if (u.side === 'p') { ctx.fillStyle = '#000a'; ctx.fillRect(f.x - w / 2, y + 6, w, 3); ctx.fillStyle = u.sp >= 100 ? '#ffd24a' : '#6aa8ff'; ctx.fillRect(f.x - w / 2, y + 6, w * u.sp / 100, 3); } }
  }
  function fxDraw(name, f, fr, ox, oy, scl) { const o = Assets.fx(name); if (!o) return; const m = o.m, sz = m.cell * scl * f.s; ctx.imageSmoothingEnabled = false; ctx.drawImage(o.img, fr * m.cell, 0, m.cell, m.cell, f.x + ox * f.s - sz / 2, f.y + oy * f.s - sz / 2, sz, sz); }
  function drawFx() {
    for (const x of S.fxs) { const o = Assets.fx(x.name); if (!o) continue; const fr = Math.floor(x.t * o.m.fps); if (fr >= o.m.n) { x.done = true; continue; } fxDraw(x.name, footOf(x.u), fr, o.m.ox || 0, o.m.oy === undefined ? -34 : o.m.oy, o.m.scale || 1); }
    if (S.cine && S.cine.cs) for (const x of S.cine.cs.fx) { const o = Assets.fx(x.name); if (!o) continue; const m = o.m, u = x.at === 'caster' ? S.cine.caster : S.cine.tgt; fxDraw(x.name, footOf(u), x.fr, x.ox !== undefined ? x.ox : (m.ox || 0), x.oy !== undefined ? x.oy : (m.oy === undefined ? -34 : m.oy), x.scale !== undefined ? x.scale : (m.scale || 1)); }
  }
  function drawProj() { for (const p of S.proj) { const f = proj(p.cf, p.rf, p.hf), d = sgn(p.tgt.cf - p.cf); ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 3 * f.s; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - d * 26 * f.s, f.y); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, 3 * f.s, 0, 7); ctx.fill(); } }
  function drawFloaters() { for (const fl of S.floaters) { const a = 1 - fl.t / 1.0; if (a <= 0) continue; const f = proj(fl.c, fl.r, fl.h); ctx.globalAlpha = a; ctx.font = (fl.big ? '900 24px' : '700 18px') + ' "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; const y = f.y - 118 * f.s - fl.t * 46; ctx.strokeText(fl.text, f.x, y); ctx.fillStyle = fl.col; ctx.fillText(fl.text, f.x, y); ctx.globalAlpha = 1; } }
  function drawHud() {
    const ps = S.units.filter(u => u.side === 'p'); ps.forEach((u, i) => { const x = 10 + i * 232, y = H - 56; ctx.fillStyle = 'rgba(10,12,20,.78)'; ctx.fillRect(x, y, 222, 46); ctx.strokeStyle = u.alive ? '#3c4670' : '#552'; ctx.strokeRect(x + .5, y + .5, 221, 45);
      ctx.font = '700 13px "Malgun Gothic",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = u.alive ? '#fff' : '#777'; ctx.fillText(u.name, x + 8, y + 17); ctx.fillStyle = '#000a'; ctx.fillRect(x + 8, y + 24, 150, 7); ctx.fillStyle = '#6fd08c'; ctx.fillRect(x + 8, y + 24, 150 * Math.max(0, u.hp) / u.max, 7); ctx.fillStyle = '#000a'; ctx.fillRect(x + 8, y + 34, 150, 5); ctx.fillStyle = u.sp >= 100 ? '#ffd24a' : '#6aa8ff'; ctx.fillRect(x + 8, y + 34, 150 * u.sp / 100, 5);
      ctx.fillStyle = '#cfd6ee'; ctx.font = '11px sans-serif'; ctx.fillText(`${Math.max(0, Math.round(u.hp))}/${u.max}`, x + 164, y + 31); if (u.sp >= 100) { ctx.fillStyle = '#ffd24a'; ctx.fillText('오의 ✦', x + 164, y + 43); } });
    ctx.textAlign = 'right'; ctx.font = '700 13px "Malgun Gothic",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`웨이브 ${S.wave} · 적 ${S.units.filter(u => u.side === 'e' && u.alive).length}기 · ${ROWS}줄 · ×${S.speed}`, W - 12, 22);
    if (S.result) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H * 0.4, W, 70); ctx.textAlign = 'center'; ctx.font = '900 40px "Malgun Gothic",sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(S.result, W / 2, H * 0.4 + 50); ctx.fillStyle = '#ffe27a'; ctx.fillText(S.result, W / 2, H * 0.4 + 50); }
  }
  function drawOverlay() {
    const c = S.cine; if (!c || !c.cs) return; const cs = c.cs;
    for (const f of cs.flash) { ctx.fillStyle = f.color; ctx.globalAlpha = clamp(f.a, 0, 1); ctx.fillRect(0, 0, W, H); } ctx.globalAlpha = 1;
    if (cs.banner) { const b = cs.banner, p = b.p, a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1, slide = Math.pow(1 - Math.min(1, p / 0.2), 2) * 100, text = (b.text || '{skill}').replace('{skill}', c.name || ''), y0 = b.pos === 'bottom' ? H - 100 : 44; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, y0, W, 38); ctx.font = '900 26px "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(text, W / 2 - slide, y0 + 28); ctx.fillStyle = '#ffe27a'; ctx.fillText(text, W / 2 - slide, y0 + 28); ctx.restore(); }
  }
  function render() {
    ctx.save(); ctx.clearRect(0, 0, W, H); const cs = S.cine && S.cine.cs, dim = cs ? cs.dim : 0;
    if (cs && cs.shake > 0) ctx.translate(rnd(-1, 1) * cs.shake, rnd(-1, 1) * cs.shake);
    if (cs && cs.zoom !== 1) { const c = S.cine, pt = u => { const f = footOf(u); return [f.x, f.y - 50 * f.s]; }, a = pt(c.caster), b = pt(c.tgt), fc = cs.focus === 'caster' ? a : cs.focus === 'mid' ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : b; ctx.translate(fc[0], fc[1]); ctx.scale(cs.zoom, cs.zoom); ctx.translate(-fc[0], -fc[1]); }
    drawBackground(dim);
    const c0 = Math.floor(S.cam.c - (W / 2) / (TILE_W * S_FAR)) - 2, c1 = Math.ceil(S.cam.c + (W / 2) / (TILE_W * S_FAR)) + 2, cols = []; for (let c = c0; c <= c1; c++) cols.push(c); cols.sort((a, b) => Math.abs(b + 0.5 - S.cam.c) - Math.abs(a + 0.5 - S.cam.c)); // 바깥 → 카메라 중심(옆면 겹침 순서)
    for (let r = 0; r < ROWS; r++) { // 먼 줄부터: 타일 → 그 줄의 유닛 (가까운 줄의 높은 타일이 먼 줄 유닛을 가린다)
      for (const c of cols) drawTile(c, r, dim);
      for (const u of S.units.filter(o => o.r === r).sort((a, b) => a.cf - b.cf)) if (u.cf > c0 - 1 && u.cf < c1 + 1) drawUnit(u);
    }
    drawProj(); drawFx(); drawFloaters(); ctx.restore(); drawHud(); drawOverlay();
  }

  /* ---------- 메인 루프 ---------- */
  function frame(dtReal) {
    dtReal = Math.min(dtReal, 0.1); const before = new Map(S.units.map(u => { const f = footOf(u); return [u, [f.x, f.y]]; }));
    if (S.freezeT > 0) S.freezeT -= dtReal;
    else if (S.cine) cineTick(dtReal * Math.min(3, S.speed));
    else if (!S.paused) { S.acc += dtReal * S.speed; let n = 0; while (S.acc >= DT && n++ < 4000 && !S.cine) { tick(DT); S.acc -= DT; S.metrics.simSteps++; } }
    for (const u of S.units) { if (!u.alive) continue; const f = footOf(u), b = before.get(u); if (!b) continue; const d = Math.hypot(f.x - b[0], f.y - b[1]); /* 이번 프레임에 새로 나타난 유닛(웨이브)은 제외 */ if (d > S.metrics.maxFramePx) S.metrics.maxFramePx = d; }
    const ts = S.cine ? S.cine.ts : 1, dtv = dtReal * ts; if (!S.paused && !S.freezeT) { for (const f of S.floaters) f.t += dtv; S.floaters = S.floaters.filter(f => f.t < 1); for (const f of S.fxs) f.t += dtv * Math.min(3, S.speed); S.fxs = S.fxs.filter(f => !f.done); }
    if (S.result) { S.resultT += dtReal; if (S.resultT > 2.5) reset(); }
    if (S.follow) { const al = S.units.filter(u => u.side === 'p' && u.alive); if (al.length) { const tc = al.reduce((a, u) => a + u.cf, 0) / al.length + 2.2; S.cam.c += (tc - S.cam.c) * Math.min(1, dtReal * 3); } }
    S.metrics.frames++; render();
  }

  /* ---------- UI ---------- */
  let last = performance.now(); const loop = now => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
  const setSpeed = k => { S.speed = k; document.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === k)); };
  const setRows = n => { ROWS = n; document.querySelectorAll('[data-rows]').forEach(b => b.classList.toggle('on', +b.dataset.rows === n)); reset(); };
  $('bPause').onclick = () => { S.paused = !S.paused; $('bPause').textContent = S.paused ? '▶ 재생' : '⏸ 일시정지'; };
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => setSpeed(+b.dataset.sp)); document.querySelectorAll('[data-rows]').forEach(b => b.onclick = () => setRows(+b.dataset.rows));
  $('bNew').onclick = reset; $('bCam').onclick = () => { S.follow = !S.follow; $('bCam').classList.toggle('on', S.follow); };
  const forceSpecial = () => { const u = S.units.filter(o => o.side === 'p' && o.alive && o.special).sort((a, b) => b.sp - a.sp)[0], t = u && foesOf(u).sort((a, b) => Math.abs(a.c - u.c) - Math.abs(b.c - u.c))[0]; if (u && t && !S.cine) { u.sp = 100; startSpecial(u, t); } };
  $('bSpecial').onclick = forceSpecial;
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); $('bPause').click(); } else if (/^[1-4]$/.test(e.key)) setSpeed([1, 2, 4, 8][+e.key - 1]); else if (e.key === 's' || e.key === 'S') forceSpecial(); else if (e.key === 'r' || e.key === 'R') reset(); else if (/^[!@#]$/.test(e.key)) setRows({ '!': 3, '@': 4, '#': 5 }[e.key]); });
  setInterval(() => { const m = S.metrics; $('metrics').textContent = `전투 ${S.t.toFixed(1)}초 · 웨이브 ${S.wave} · 처치 ${m.kills} · 한 프레임 최대 이동 ${m.maxFramePx.toFixed(1)}px · 고정 시간 단계 ${m.simSteps}`; }, 500);
  layout(); reset(); window.__side = { S, frame, render, reset, tick, Hh, setSpeed, setRows, forceSpecial, proj, footOf };
  requestAnimationFrame(loop);
})();
