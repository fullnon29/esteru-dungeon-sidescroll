'use strict';
/* 횡스크롤 전투 프로토타입 (에스테르의 미궁 포크).
 * 핵심 규칙 — 쿼터뷰판에서 이동 순간이동·동작 중첩이 생기던 구조를 바꾼다:
 *  1) 전투를 "시간 기반 동작"으로 직접 진행한다: 유닛마다 동시에 하나의 동작(act)만 가진다(이동·공격·점프). 동작은 정해진 길이로 끝까지 재생된다.
 *  2) 이동은 칸 단위 틱이 아니라 연속(px/s). 고정 시간 간격(1/120초)으로 적분하므로 배속이 높아도 프레임을 건너뛰지 않고, 걸음 프레임은 걸은 거리로 정한다.
 *  3) 피격은 동작을 덮어쓰지 않는다: 공격 준비 중이면 버티고(깜빡임·밀림만), 그 외에는 짧게 경직(stun)한다.
 *  4) 고저차: 지형은 높이 단계(LV px) 플랫폼. 단차를 만나면 점프 동작(포물선)으로 오르내린다.
 *  5) 오의 연출은 cine.js 를 그대로 쓴다(연출 동안 전투 정지, 일격 시점에 피해). */
(function () {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const LV = 46, BASE_Y = 400, WORLD = 1700, DT = 1 / 120, STRIDE = 96;
  const TERRAIN = [[0, 420, 0], [420, 640, 1], [640, 860, 2], [860, 1060, 1], [1060, 1280, 2], [1280, WORLD, 1]]; // [시작x, 끝x, 높이 단계]
  const hAt = x => { for (const t of TERRAIN) if (x >= t[0] && x < t[1]) return t[2] * LV; return TERRAIN[TERRAIN.length - 1][2] * LV; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
  const sgn = v => v >= 0 ? 1 : -1;
  const ANIM = () => Assets.animEnemy({ tplId: 'knight' }); // 기사 시트(128px, 8방향, 동작별 15프레임)
  const FPS = { idle: 10, walk: 14, atk: 18, heavy: 16, hurt: 15, die: 12, dodge: 20 }, HITF = { atk: 8 };

  /* ---------- 유닛 정의 ---------- */
  const ROLES = {
    warrior: { name: '레온', hp: 280, atk: 34, def: 6, spd: 150, range: 78, cdMax: 0.45, special: { cine: 'kenki', name: '검기 난무', mode: 'aoe', radius: 190, mult: 2.0, range: 150 } },
    elf: { name: '실비아', hp: 170, atk: 30, def: 3, spd: 130, range: 340, ranged: true, cdMax: 0.8, special: { cine: 'pierce', name: '관통 사격', mode: 'line', len: 560, mult: 1.8, range: 430 } },
    priest: { name: '루나', hp: 190, atk: 18, def: 3, spd: 120, range: 300, ranged: true, cdMax: 1.0, special: { cine: 'sanctuary', name: '성역', mode: 'heal', mult: 0, range: 99999 } },
    thief: { name: '핀', hp: 160, atk: 38, def: 2, spd: 215, range: 70, cdMax: 0.3, special: { cine: 'assassinate', name: '암살', mode: 'single', mult: 3.2, range: 220 } },
  };
  const FOES = {
    grunt: { name: '잡병', hp: 190, atk: 22, def: 4, spd: 125, range: 72, cdMax: 0.6, tint: 'sepia(1) saturate(4) hue-rotate(-25deg)' },
    archer: { name: '궁수', hp: 120, atk: 20, def: 2, spd: 110, range: 310, ranged: true, cdMax: 1.1, tint: 'sepia(1) saturate(3) hue-rotate(60deg)' },
    brute: { name: '거한', hp: 460, atk: 42, def: 8, spd: 90, range: 86, cdMax: 0.8, tint: 'sepia(1) saturate(3) hue-rotate(250deg)', scale: 1.25 },
  };

  const S = { units: [], proj: [], fxs: [], floaters: [], t: 0, acc: 0, speed: 1, paused: false, follow: true, cine: null, freezeT: 0, result: null, resultT: 0, cam: { x: 300, y: 0 }, metrics: { maxFramePx: 0, frames: 0, overlap: 0, simSteps: 0 } };

  function mkUnit(side, key, x, lane) {
    const d = (side === 'p' ? ROLES : FOES)[key];
    return { id: S.units.length, side, key, name: d.name, x, y: hAt(x), hp: d.hp, max: d.hp, atk: d.atk, def: d.def, spd: d.spd, range: d.range, ranged: !!d.ranged, cdMax: d.cdMax, cd: rnd(0, 0.4), special: d.special || null, sp: side === 'p' ? rnd(35, 70) : 0, tint: d.tint || '', scale: d.scale || 1,
      face: side === 'p' ? 0 : 4, act: null, stun: 0, flash: 0, kx: 0, wp: Math.random(), alive: true, deathT: 0, ov: null, lane, idleT: Math.random() * 3, wait: 0 };
  }
  function reset() {
    S.units = []; S.proj = []; S.fxs = []; S.floaters = []; S.t = 0; S.acc = 0; S.cine = null; S.freezeT = 0; S.result = null; S.resultT = 0;
    ['warrior', 'thief', 'elf', 'priest'].forEach((k, i) => S.units.push(mkUnit('p', k, 130 + i * 62, i)));
    const set = ['grunt', 'grunt', 'archer', 'brute', 'grunt', 'archer'];
    set.forEach((k, i) => S.units.push(mkUnit('e', k, 1000 + i * 95 + rnd(-15, 15), i % 4)));
    S.cam.x = 420; S.cam.y = 0;
  }
  const foesOf = u => S.units.filter(o => o.alive && o.side !== u.side), alliesOf = u => S.units.filter(o => o.alive && o.side === u.side);

  /* ---------- 전투 진행(고정 시간 간격) ---------- */
  function decide(u) {
    const foes = foesOf(u); if (!foes.length) { u.act = null; return; }
    let tgt = foes[0]; for (const o of foes) if (Math.abs(o.x - u.x) < Math.abs(tgt.x - u.x)) tgt = o;
    const d = Math.abs(tgt.x - u.x), dir = sgn(tgt.x - u.x); u.face = dir > 0 ? 0 : 4;
    if (u.special && u.sp >= 100 && d <= u.special.range && !S.cine && u.side === 'p') { startSpecial(u, tgt); return; }
    if (d <= u.range) { if (u.cd <= 0) u.act = { type: 'atk', t: 0, dur: 15 / FPS.atk, hitAt: HITF.atk / FPS.atk, target: tgt, done: false }; return; } // 사거리 안: 쿨다운이 끝나면 공격(아니면 대기)
    const blocked = foes.some(o => Math.abs(o.x - (u.x + dir * 8)) < 44 && Math.abs(o.x - u.x) < 60); // 적 몸을 뚫고 지나가지 않는다
    if (!blocked) u.act = { type: 'move', t: 0, dir, tgt };
  }
  function hit(att, tgt, mult, opt) {
    if (!tgt.alive) return; opt = opt || {};
    const dmg = Math.max(1, Math.round(att.atk * rnd(0.9, 1.1) * mult - tgt.def * 0.4)), crit = Math.random() < 0.1, v = crit ? Math.round(dmg * 1.5) : dmg;
    tgt.hp -= v; tgt.flash = 0.1; tgt.kx = (att.x < tgt.x ? 1 : -1) * (opt.big ? 16 : 8); if (att.side === 'p') att.sp = Math.min(100, att.sp + 9); else tgt.sp = Math.min(100, tgt.sp + 6);
    S.floaters.push({ x: tgt.x, y: tgt.y + 118 * tgt.scale, text: (crit ? '💥' : '') + v, col: tgt.side === 'p' ? '#ff8a8a' : '#fff', t: 0, big: crit });
    if (!opt.noFx) spawnFx(opt.fx || 'hit', tgt.x, tgt.y);
    const armored = tgt.act && tgt.act.type === 'atk' && tgt.act.t < tgt.act.hitAt; // 공격 준비 중이면 버틴다(동작 중첩·끊김 방지)
    if (tgt.hp <= 0) { tgt.alive = false; tgt.act = null; tgt.deathT = 0; return; }
    if (!armored && !(tgt.act && tgt.act.type === 'jump')) { tgt.stun = Math.max(tgt.stun, opt.big ? 0.45 : 0.28); tgt.act = null; }
  }
  function spawnFx(name, x, y) { const f = Assets.fx(name); if (f) S.fxs.push({ name, x, y, t: 0 }); }
  function updateUnit(u, dt) {
    u.cd = Math.max(0, u.cd - dt); u.flash = Math.max(0, u.flash - dt); u.kx *= Math.pow(0.0004, dt); u.idleT += dt; if (u.ov) { u.ov.t += dt; if (u.ov.t >= u.ov.dur) u.ov = null; }
    if (u.side === 'p') u.sp = Math.min(100, u.sp + dt * 2.2);
    if (u.stun > 0) { u.stun -= dt; return; }
    if (!u.act) decide(u); if (!u.act) return; const a = u.act; a.t += dt;
    if (a.type === 'move') {
      if (!a.tgt.alive || a.t > 0.3) { u.act = null; return; } // 짧게 이동하고 매번 다시 판단(표적 변경·사거리 도달)
      const nx = clamp(u.x + a.dir * u.spd * dt, 20, WORLD - 20), d = Math.abs(a.tgt.x - nx);
      if (d < 44 || Math.abs(a.tgt.x - u.x) <= u.range) { u.act = null; return; }
      if (Math.abs(hAt(nx) - hAt(u.x)) > 1) { u.act = { type: 'jump', t: 0, dur: 0.42, x0: u.x, x1: u.x + a.dir * 46, y0: u.y, y1: hAt(u.x + a.dir * 46) }; return; } // 단차: 점프로 오르내림
      u.wp += Math.abs(nx - u.x) / STRIDE; u.x = nx; u.y = hAt(nx);
    } else if (a.type === 'jump') {
      const p = clamp(a.t / a.dur, 0, 1); u.x = lerp(a.x0, a.x1, p); u.y = lerp(a.y0, a.y1, p) + Math.sin(Math.PI * p) * 38; u.wp += (a.x1 - a.x0) / a.dur * dt / STRIDE;
      if (p >= 1) { u.x = a.x1; u.y = a.y1; u.act = null; }
    } else if (a.type === 'atk') {
      if (!a.done && a.t >= a.hitAt) { a.done = true; if (u.ranged) S.proj.push({ x: u.x + sgn(a.target.x - u.x) * 26, y: u.y + 60, from: u, tgt: a.target, v: 560, mult: 1 }); else hit(u, a.target, 1); }
      if (a.t >= a.dur) { u.act = null; u.cd = u.cdMax; }
    }
  }
  function tick(dt) {
    S.t += dt;
    for (const u of S.units) { if (!u.alive) { u.deathT += dt; continue; } updateUnit(u, dt); if (S.cine) return; }
    for (const p of S.proj) { if (!p.tgt.alive) { p.dead = true; continue; } const dx = p.tgt.x - p.x, dy = p.tgt.y + 60 - p.y, d = Math.hypot(dx, dy), s = p.v * dt; if (d <= s + 12) { hit(p.from, p.tgt, p.mult); p.dead = true; } else { p.x += dx / d * s; p.y += dy / d * s; } }
    S.proj = S.proj.filter(p => !p.dead);
    if (!S.result) { const pa = S.units.some(u => u.side === 'p' && u.alive), ea = S.units.some(u => u.side === 'e' && u.alive); if (!pa || !ea) { S.result = pa ? '승리!' : '패배…'; S.resultT = 0; } }
  }

  /* ---------- 오의 연출 ---------- */
  function startSpecial(u, tgt) {
    const sp = u.special, def = window.CINE_MANIFEST && window.CINE_MANIFEST[sp.cine]; if (!def) return; u.sp = 0; u.face = sgn(tgt.x - u.x) > 0 ? 0 : 4;
    S.cine = { def, t: 0, prev: -1, caster: u, tgt, name: sp.name, cs: null, done: false, ts: 1 };
  }
  const fxInfo = name => { const f = Assets.fx(name); return f ? { fps: f.m.fps, n: f.m.n } : null; };
  function applySpecial(c) {
    const u = c.caster, sp = u.special, foes = foesOf(u);
    if (sp.mode === 'aoe') foes.filter(o => Math.abs(o.x - u.x) <= sp.radius).forEach(o => hit(u, o, sp.mult, { big: true, noFx: true }));
    else if (sp.mode === 'single') hit(u, c.tgt, sp.mult, { big: true, noFx: true });
    else if (sp.mode === 'line') foes.filter(o => sgn(o.x - u.x) === sgn(c.tgt.x - u.x) && Math.abs(o.x - u.x) <= sp.len).forEach(o => hit(u, o, sp.mult, { big: true, noFx: true }));
    else if (sp.mode === 'heal') alliesOf(u).forEach(o => { const v = 90; o.hp = Math.min(o.max, o.hp + v); S.floaters.push({ x: o.x, y: o.y + 118, text: '+' + v, col: '#7cf0a0', t: 0 }); });
  }
  function cineTick(dtc) {
    const c = S.cine; const t0 = c.prev; c.t += dtc; const k = 1;
    for (const st of Cine.events(c.def, t0, c.t)) { if (st.type === 'freeze') S.freezeT = Math.min(0.25, st.dur || 0.1); else if (st.type === 'anim') c.caster.ov = { act: st.act in FPS ? st.act : 'heavy', t: 0, dur: st.dur || 0.4 }; }
    if (!c.done && c.t >= c.def.hit) { c.done = true; applySpecial(c); }
    c.cs = Cine.sample(c.def, c.t, fxInfo); c.ts = c.cs.ts;
    if (c.t >= c.def.dur) { if (!c.done) applySpecial(c); S.cine = null; }
  }

  /* ---------- 배경·지형 ---------- */
  const R = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
  const mountains = Array.from({ length: 40 }, (_, i) => ({ x: i * 90, h: 70 + R() * 130 })), ruins = Array.from({ length: 30 }, (_, i) => ({ x: i * 150 + R() * 60, w: 36 + R() * 40, h: 90 + R() * 170, tower: R() < 0.45 })), trees = Array.from({ length: 50 }, (_, i) => ({ x: i * 80 + R() * 40, h: 80 + R() * 70 }));
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141b36'); g.addColorStop(0.5, '#3c3f6e'); g.addColorStop(0.8, '#a76a6b'); g.addColorStop(1, '#e0a07a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sg = ctx.createRadialGradient(W * 0.72, H * 0.55, 10, W * 0.72, H * 0.55, 220); sg.addColorStop(0, 'rgba(255,220,160,.9)'); sg.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    const px = f => -(S.cam.x * f) % 3600, py = f => S.cam.y * f;
    ctx.fillStyle = '#4a4f86'; ctx.beginPath(); ctx.moveTo(-200, H); for (const m of mountains) { const x = m.x + px(0.12); ctx.lineTo(x, BASE_Y - 70 - m.h + py(0.2)); } ctx.lineTo(W + 600, H); ctx.fill();
    ctx.fillStyle = '#2d3156'; for (const r of ruins) { const x = r.x + px(0.3); if (x < -80 || x > W + 80) continue; ctx.fillRect(x, BASE_Y - 60 - r.h + py(0.4), r.w, r.h + 80); if (r.tower) { ctx.fillRect(x - 6, BASE_Y - 60 - r.h + py(0.4) - 14, r.w + 12, 14); for (let k = 0; k < 3; k++) ctx.fillRect(x - 6 + k * (r.w / 2), BASE_Y - 60 - r.h + py(0.4) - 24, 8, 10); } }
    ctx.fillStyle = '#191c33'; for (const t of trees) { const x = t.x + px(0.6); if (x < -40 || x > W + 40) continue; const y = BASE_Y - 30 + py(0.7); ctx.fillRect(x - 3, y - t.h * 0.45, 6, t.h * 0.45 + 40); ctx.beginPath(); ctx.arc(x, y - t.h * 0.55, t.h * 0.32, 0, 7); ctx.fill(); }
  }
  const scrX = x => x - S.cam.x + W / 2, scrY = y => BASE_Y - y + S.cam.y;
  function drawTerrain() {
    for (const [a, b, h] of TERRAIN) {
      const x0 = scrX(a), x1 = scrX(b); if (x1 < -10 || x0 > W + 10) continue; const top = scrY(h * LV);
      const g = ctx.createLinearGradient(0, top, 0, H); g.addColorStop(0, '#5b5468'); g.addColorStop(1, '#2a2638'); ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, H - top + 40);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1; for (let y = top + 22; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); for (let x = x0 + ((y / 22 | 0) % 2 ? 24 : 0); x < x1; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); } }
      ctx.fillStyle = '#6f9a5a'; ctx.fillRect(x0, top - 6, x1 - x0, 9); ctx.fillStyle = '#8fc070'; ctx.fillRect(x0, top - 6, x1 - x0, 3); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x1 - 4, top, 4, H); // 윗면 풀 + 옆면 그림자
    }
  }

  /* ---------- 유닛 그리기 ---------- */
  function unitAnim(u) { // → { act, fr }
    const A = ANIM(); if (!A) return null;
    if (!u.alive) return { act: 'die', fr: Math.min(14, Math.floor(u.deathT * FPS.die)) };
    if (u.ov) return { act: u.ov.act, fr: Math.min(14, Math.floor(u.ov.t / u.ov.dur * 15)) };
    if (u.stun > 0) return { act: 'hurt', fr: Math.min(14, Math.floor((1 - u.stun / 0.3) * 8)) };
    const a = u.act; if (a && a.type === 'atk') return { act: 'atk', fr: Math.min(14, Math.floor(a.t / a.dur * 15)) };
    if (a && a.type === 'jump') return { act: 'dodge', fr: Math.min(14, Math.floor(a.t / a.dur * 15)) };
    if (a && a.type === 'move') return { act: 'walk', fr: Math.floor(u.wp * 15) % 15 };
    return { act: 'idle', fr: Math.floor(u.idleT * FPS.idle) % 15 };
  }
  function drawUnit(u) {
    const A = ANIM(), an = unitAnim(u); const sx = scrX(u.x + u.kx), sy = scrY(u.y) + u.lane * 3;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 34 * u.scale, 8, 0, 0, 7); ctx.fill(); if (u.alive) { ctx.strokeStyle = u.side === 'p' ? 'rgba(106,168,255,.9)' : 'rgba(255,110,90,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 30 * u.scale, 7, 0, 0, 7); ctx.stroke(); } // 팀 색 고리
    if (!A || !an) { ctx.fillStyle = u.side === 'p' ? '#6aa8ff' : '#ff6a6a'; ctx.fillRect(sx - 14, sy - 60, 28, 60); return; }
    const im = (A.img[an.act] || A.img.idle)[u.face]; if (!im) return; const sz = 128 * u.scale, foot = (A.m.foot || 102) * sz / 128;
    ctx.save(); if (!u.alive) ctx.globalAlpha = clamp(1 - (u.deathT - 0.9) / 0.8, 0, 1); ctx.filter = u.flash > 0 ? 'brightness(4) saturate(0)' : (u.tint || 'none');
    ctx.imageSmoothingEnabled = false; ctx.drawImage(im, an.fr * 128, 0, 128, 128, sx - sz / 2, sy - foot, sz, sz); ctx.restore();
    if (u.alive) { const w = 46, p = u.hp / u.max, y = sy - 112 * u.scale; ctx.fillStyle = '#000a'; ctx.fillRect(sx - w / 2, y, w, 5); ctx.fillStyle = u.side === 'p' ? (p < 0.3 ? '#ef6b6b' : '#6fd08c') : '#e07a5a'; ctx.fillRect(sx - w / 2, y, w * p, 5); if (u.side === 'p') { ctx.fillStyle = '#000a'; ctx.fillRect(sx - w / 2, y + 6, w, 3); ctx.fillStyle = u.sp >= 100 ? '#ffd24a' : '#6aa8ff'; ctx.fillRect(sx - w / 2, y + 6, w * u.sp / 100, 3); } }
  }
  function drawFx() {
    for (const f of S.fxs) { const o = Assets.fx(f.name); if (!o) continue; const m = o.m, fr = Math.floor(f.t * m.fps); if (fr >= m.n) { f.done = true; continue; } const sz = m.cell * (m.scale || 1), sx = scrX(f.x), sy = scrY(f.y);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(o.img, fr * m.cell, 0, m.cell, m.cell, sx + (m.ox || 0) - sz / 2, sy + (m.oy === undefined ? -34 : m.oy) - sz / 2, sz, sz); }
    if (S.cine && S.cine.cs) for (const x of S.cine.cs.fx) { const o = Assets.fx(x.name); if (!o) continue; const m = o.m, u = x.at === 'caster' ? S.cine.caster : S.cine.tgt, sz = m.cell * (x.scale !== undefined ? x.scale : (m.scale || 1)), ox = x.ox !== undefined ? x.ox : (m.ox || 0), oy = x.oy !== undefined ? x.oy : (m.oy === undefined ? -34 : m.oy);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(o.img, x.fr * m.cell, 0, m.cell, m.cell, scrX(u.x) + ox - sz / 2, scrY(u.y) + oy - sz / 2, sz, sz); }
  }
  function drawProj() { for (const p of S.proj) { const sx = scrX(p.x), sy = scrY(p.y), dir = sgn(p.tgt.x - p.x); ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - dir * 26, sy); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill(); } }
  function drawFloaters() { for (const f of S.floaters) { const a = 1 - f.t / 1.0; if (a <= 0) continue; ctx.globalAlpha = a; ctx.font = (f.big ? '900 24px' : '700 18px') + ' "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; const y = scrY(f.y) - f.t * 46; ctx.strokeText(f.text, scrX(f.x), y); ctx.fillStyle = f.col; ctx.fillText(f.text, scrX(f.x), y); ctx.globalAlpha = 1; } }
  function drawHud() {
    const ps = S.units.filter(u => u.side === 'p'); ps.forEach((u, i) => { const x = 10 + i * 232, y = H - 56; ctx.fillStyle = 'rgba(10,12,20,.78)'; ctx.fillRect(x, y, 222, 46); ctx.strokeStyle = u.alive ? '#3c4670' : '#552'; ctx.strokeRect(x + .5, y + .5, 221, 45);
      ctx.font = '700 13px "Malgun Gothic",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = u.alive ? '#fff' : '#777'; ctx.fillText(u.name, x + 8, y + 17); ctx.fillStyle = '#000a'; ctx.fillRect(x + 8, y + 24, 150, 7); ctx.fillStyle = '#6fd08c'; ctx.fillRect(x + 8, y + 24, 150 * Math.max(0, u.hp) / u.max, 7); ctx.fillStyle = '#000a'; ctx.fillRect(x + 8, y + 34, 150, 5); ctx.fillStyle = u.sp >= 100 ? '#ffd24a' : '#6aa8ff'; ctx.fillRect(x + 8, y + 34, 150 * u.sp / 100, 5);
      ctx.fillStyle = '#cfd6ee'; ctx.font = '11px sans-serif'; ctx.fillText(`${Math.max(0, Math.round(u.hp))}/${u.max}`, x + 164, y + 31); if (u.sp >= 100) { ctx.fillStyle = '#ffd24a'; ctx.fillText('오의 ✦', x + 164, y + 43); } });
    ctx.textAlign = 'right'; ctx.font = '700 13px "Malgun Gothic",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`적 ${S.units.filter(u => u.side === 'e' && u.alive).length}기 · ×${S.speed}`, W - 12, 22);
    if (S.result) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H * 0.4, W, 70); ctx.textAlign = 'center'; ctx.font = '900 40px "Malgun Gothic",sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(S.result, W / 2, H * 0.4 + 50); ctx.fillStyle = '#ffe27a'; ctx.fillText(S.result, W / 2, H * 0.4 + 50); }
  }
  function drawOverlay() {
    const c = S.cine; if (!c || !c.cs) return; const cs = c.cs;
    for (const f of cs.flash) { ctx.fillStyle = f.color; ctx.globalAlpha = clamp(f.a, 0, 1); ctx.fillRect(0, 0, W, H); } ctx.globalAlpha = 1;
    if (cs.banner) { const b = cs.banner, p = b.p, a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1, slide = Math.pow(1 - Math.min(1, p / 0.2), 2) * 100, text = (b.text || '{skill}').replace('{skill}', c.name || ''), y0 = b.pos === 'bottom' ? H - 100 : 44; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, y0, W, 38); ctx.font = '900 26px "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(text, W / 2 - slide, y0 + 28); ctx.fillStyle = '#ffe27a'; ctx.fillText(text, W / 2 - slide, y0 + 28); ctx.restore(); }
  }
  function render() {
    ctx.save(); ctx.clearRect(0, 0, W, H); const cs = S.cine && S.cine.cs;
    if (cs && cs.shake > 0) ctx.translate(rnd(-1, 1) * cs.shake, rnd(-1, 1) * cs.shake);
    if (cs && cs.zoom !== 1) { const c = S.cine, pt = u => [scrX(u.x), scrY(u.y) - 50], a = pt(c.caster), b = pt(c.tgt), f = cs.focus === 'caster' ? a : cs.focus === 'mid' ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : b; ctx.translate(f[0], f[1]); ctx.scale(cs.zoom, cs.zoom); ctx.translate(-f[0], -f[1]); }
    drawBackground(); drawTerrain();
    if (cs && cs.dim > 0) { ctx.fillStyle = 'rgba(0,0,0,' + cs.dim + ')'; ctx.fillRect(-W, -H, W * 3, H * 3); } // 지형·배경만 어둡게, 유닛은 밝게
    for (const u of [...S.units].sort((a, b) => (a.y - b.y) || (a.lane - b.lane))) drawUnit(u);
    drawProj(); drawFx(); drawFloaters(); ctx.restore(); drawHud(); drawOverlay();
  }

  /* ---------- 메인 루프 ---------- */
  function camera(dt) {
    const al = S.units.filter(u => u.alive); if (!al.length || !S.follow) return;
    const cx = al.reduce((a, u) => a + u.x, 0) / al.length, cy = al.reduce((a, u) => a + u.y, 0) / al.length, k = Math.min(1, dt * 3);
    S.cam.x += (clamp(cx, W / 2, WORLD - W / 2) - S.cam.x) * k; S.cam.y += (cy * 0.7 - S.cam.y) * k;
  }
  function frame(dtReal) {
    dtReal = Math.min(dtReal, 0.1); const before = S.units.map(u => u.x + u.kx), yb = S.units.map(u => u.y);
    if (S.freezeT > 0) S.freezeT -= dtReal;
    else if (S.cine) cineTick(dtReal * Math.min(3, S.speed));
    else if (!S.paused) { S.acc += dtReal * S.speed; let n = 0; while (S.acc >= DT && n++ < 4000 && !S.cine) { tick(DT); S.acc -= DT; S.metrics.simSteps++; } }
    for (const u of S.units) { const o = S.units.indexOf(u); const d = Math.hypot(u.x + u.kx - before[o], u.y - yb[o]); if (u.alive && d > S.metrics.maxFramePx) S.metrics.maxFramePx = d; if (u.act && u.ov && u.ov.act === 'atk') S.metrics.overlap++; }
    const ts = S.cine ? S.cine.ts : 1, dtv = dtReal * ts; if (!S.paused && !S.freezeT) { for (const f of S.floaters) f.t += dtv; S.floaters = S.floaters.filter(f => f.t < 1); for (const f of S.fxs) f.t += dtv * Math.min(3, S.speed); S.fxs = S.fxs.filter(f => !f.done); }
    if (S.result) { S.resultT += dtReal; if (S.resultT > 2.5) reset(); }
    camera(dtReal); S.metrics.frames++; render();
  }

  /* ---------- UI ---------- */
  let last = performance.now(); const loop = now => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
  const setSpeed = k => { S.speed = k; document.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === k)); };
  $('bPause').onclick = () => { S.paused = !S.paused; $('bPause').textContent = S.paused ? '▶ 재생' : '⏸ 일시정지'; };
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => setSpeed(+b.dataset.sp));
  $('bNew').onclick = reset; $('bCam').onclick = () => { S.follow = !S.follow; $('bCam').classList.toggle('on', S.follow); };
  const forceSpecial = () => { const u = S.units.filter(o => o.side === 'p' && o.alive && o.special).sort((a, b) => b.sp - a.sp)[0], t = u && foesOf(u).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0]; if (u && t && !S.cine) { u.sp = 100; startSpecial(u, t); } };
  $('bSpecial').onclick = forceSpecial;
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); $('bPause').click(); } else if (/^[1-4]$/.test(e.key)) setSpeed([1, 2, 4, 8][+e.key - 1]); else if (e.key === 's' || e.key === 'S') forceSpecial(); else if (e.key === 'r' || e.key === 'R') reset(); });
  setInterval(() => { const m = S.metrics; $('metrics').textContent = `전투 ${S.t.toFixed(1)}초 · 한 프레임 최대 이동 ${m.maxFramePx.toFixed(1)}px · 동작 중첩 ${m.overlap}회 · 고정 시간 단계 ${m.simSteps}`; }, 500);
  reset(); window.__side = { S, frame, render, reset, tick, hAt, TERRAIN, forceSpecial, setSpeed };
  requestAnimationFrame(loop);
})();
