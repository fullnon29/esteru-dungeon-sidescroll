'use strict';
/* 캔버스 렌더러 — 캠프 편성판 / 전투 무대 / 쿼터뷰 벽돌 미로. 상태 S 는 game.js 가 init 으로 넘겨준다. */
const Render = (function () {
  const C = Core;
  let S, cv, ctx;
  const W = 900, H = 520;
  const TW = 76, TH = 38, OX = 450, OY = 110;
  const iso = (gx, gy) => [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2];
  const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  function poly(pts, fill, stroke, lw) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
  function shade(hex, k) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    const n = parseInt(m[1], 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function emoji(ch, x, y, sz) { ctx.font = `${sz}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(ch, x, y); ctx.textBaseline = 'alphabetic'; }
  /* ---------- 스프라이트 애니메이션 (assets/manifest.js 의 anims, 프레임 15장 가로 스트립) ---------- */
  const animN = (a, act) => (a.m.n && a.m.n[act]) || 15; // 동작별 프레임 수(기본 15)
  const animEnt = c => (c.u ? Assets.anim(c.u) : Assets.animEnemy(c)); // 개체(용병 또는 적)의 애니메이션
  // 걸음 한 주기(양발 두 걸음)가 가는 거리(칸): 몸 높이의 약 0.8배. 전투판은 몸이 칸에 비해 크고, 미로는 작아서 값이 다르다.
  const STRIDE_MAZE = 1.65, MAX_CYCLES = 2.2; // MAX_CYCLES: 걸음 주기를 초당 이 횟수 이하로 제한(배속이 빠르면 보폭을 늘려 프레임이 건너뛰어 뒤로 도는 듯 보이는 것을 막는다)
  const animFps = (a, act) => (a.m.fps && a.m.fps[act]) || 15;
  // 방향 0~7: 화면 각도(0=오른쪽, 시계 방향)를 45° 단위로 반올림한 값. 0=E 1=SE 2=정면(S) 3=SW 4=W 5=NW 6=뒷모습(N) 7=NE
  const dirOf = (gdx, gdy) => { const ang = Math.atan2((gdx + gdy) * TH / 2, (gdx - gdy) * TW / 2) * 180 / Math.PI; return Math.round(((ang + 360) % 360) / 45) % 8; };
  const ACTION_ACT = { atk: 1, heavy: 1, sweep: 1, combo: 1, shoot: 1, cast: 1, guard: 1, taunt: 1, dodge: 1 };
  function animPlay(c, act, force, face) { // 일회성 동작. 같은 동작이 60% 넘게 진행되기 전엔 다시 시작하지 않고, 피격은 현재 동작이 40% 진행된 뒤에 끼어든다(사망은 못 끊음).
    const a = c && animEnt(c); if (!a) return;
    const cur = c.an; if (cur) { const prog = cur.t / animN(a, cur.act); if (cur.act === 'die' || (act === 'hurt' && prog < (ACTION_ACT[cur.act] ? 0.8 : 0.4)) || (cur.act === act && prog < 0.6)) return; } // 공격·스킬 동작은 80%까지 피격이 끊지 못한다(맞는 일이 잦아도 휘두르는 모습이 보이게)
    if (!force && cur && act !== 'hurt') return; c.an = { act, t: 0 }; if (face !== undefined) c.face = face;
  } // 일회성 동작(공격·시전·피격). 진행 중이면 덮어쓰지 않는다.
  function animBlit(a, act, dir, fr, sx, sy, scale) { // 발 위치(m.foot)를 (sx, sy)에 맞춰 그린다
    const im = (a.img[act] || a.img.idle)[dir]; if (!im) return false;
    const cl = a.m.cell || 128, sz = (a.m.size || 128) * (scale || 1), crisp = cl <= 64; // 칸 크기(기본 128). 64px 이하는 도트 그대로 확대
    if (crisp) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, fr * cl, 0, cl, cl, sx - sz / 2, sy - (a.m.foot || cl * 0.8) * sz / cl, sz, sz);
    if (crisp) ctx.imageSmoothingEnabled = true; return true;
  }
  // 방향 안정화: 새 방향이 0.15초 이상 이어져야 바뀐다(길이 꺾일 때 몸이 파르르 돌아가는 것 방지). 처음 값과 공격·시전의 즉시 방향은 바로 적용.
  function faceTo(o, cand, dt) {
    if (o.face === undefined) { o.face = cand; return; } if (cand === o.face) { o.fcand = undefined; return; }
    if (o.fcand !== cand) { o.fcand = cand; o.fct = 0; } o.fct += dt; if (o.fct >= 0.15) { o.face = cand; o.fcand = undefined; }
  }
  // 상태가 있는 개체(전투판·캠프). 이동 중이면 가는 쪽, 일회성 동작 중이면 그 방향 유지, 그 외에는 표적 쪽(없으면 def)을 바라본다.
  function animDraw(a, c, sx, sy, dt, moving, def) {
    if (c.an) { c.an.t += dt * animFps(a, c.an.act) * (S.exp && S.exp.battle ? animK() : 1); if (c.an.t >= animN(a, c.an.act)) c.an = null; }
    if (moving) { if (Math.hypot(c.x - c.dx, c.y - c.dy) > 0.01) faceTo(c, dirOf(c.x - c.dx, c.y - c.dy), dt); }
    else if (!c.an) { const t = c.curTgt; faceTo(c, t && t.alive ? dirOf(t.dx - c.dx, t.dy - c.dy) : (c.face === undefined ? def : c.face), dt); }
    if (c.face === undefined) c.face = def;
    if (c.an) return animBlit(a, c.an.act, c.face, Math.min(animN(a, c.an.act) - 1, Math.floor(c.an.t)), sx, sy);
    const act = moving ? 'walk' : 'idle'; c.ln = c.ln || { act, t: Math.random() * animN(a, act) };
    if (moving) return animBlit(a, 'walk', c.face, Math.floor((c.wph || 0) * animN(a, 'walk')) % animN(a, 'walk'), sx, sy); // 걸음은 실제로 걸은 거리에 맞춰 넘긴다(미끄러짐 방지)
    if (c.ln.act !== act) { c.ln.act = act; c.ln.t = 0; } c.ln.t += dt * animFps(a, act);
    return animBlit(a, act, c.face, Math.floor(c.ln.t) % animN(a, act), sx, sy);
  }
  function animLoop(a, act, dir, sx, sy, scale, seed) { return animBlit(a, act, dir, Math.floor(S.time * animFps(a, act) + (seed || 0)) % animN(a, act), sx, sy, scale); } // 상태 없는 반복 재생(주점·미로)
  function vignette(a) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, '#00000000'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function bgFill(kind, c0, c1) {
    const im = Assets.get('backgrounds', kind);
    if (im) { ctx.drawImage(im, 0, 0, W, H); return; }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* ---------- 이벤트 → 플로터 ---------- */
  const reduced = () => document.body.classList.contains('reduce') || shakeK() <= 0;
  const shakeK = () => (S && S.prefs && S.prefs.shake !== undefined ? S.prefs.shake : 1); // 흔들림 강도 배율 (설정)
  // 행동(공격·스킬) → 동작 후보. 앞쪽부터 그 용병의 시트에 있는 것을 쓴다(없으면 다음 후보).
  // 동작 이름: atk 기본 공격 · heavy 강타 · sweep 회전/범위 근접 · combo 연타 · shoot 원거리 · guard 방어 · taunt 도발 · cast 마법 · hurt 피격 · dodge 회피 · die 사망
  const SKILL_ANIM = { power: ['heavy', 'atk'], cleave: ['sweep', 'atk'], flurry: ['combo', 'atk'], volley: ['shoot', 'atk'], guard: ['guard', 'taunt', 'cast'], taunt: ['taunt', 'guard', 'cast'] };
  const pickAct = (a, chain) => chain.find(k => a.img[k]) || null;
  const animK = () => Math.min(3, Math.max(1, ((S && S.speed) || 1) / 1.5)); // 배속이 빠르면 모션·타격 타이밍도 함께 당긴다
  const hitDelay = (a, act) => { const n = animN(a, act), h = a.m.hit && a.m.hit[act] !== undefined ? a.m.hit[act] : Math.round(n * 0.4); return h / animFps(a, act) / animK(); }; // 타격 순간(프레임)까지의 초
  function later(sec, fn) { if (sec <= 0.02) fn(); else (S.later = S.later || []).push({ t: sec, fn }); }
  /* ---------- 이펙트(FX) 시트 재생: tools/fx_tool.html 로 만든 assets/fx/*.png (규격은 assets/README.md) ---------- */
  // 스킬 id → 이펙트 이름. 해당 이름의 시트가 없으면 이펙트 없이 기존 표시(이모지)를 쓴다. 기본 공격은 'hit'.
  const FX_BY = { power: 'heavy', cleave: 'slash', flurry: 'slash', kenki: 'slash', assassinate: 'slash', volley: 'hit', renkan: 'hit', pierce: 'hit', fire: 'fire', meteor: 'fire', ice: 'ice', thunder: 'lightning', heal: 'heal', bless: 'heal', antidote: 'heal', holy: 'buff', sacred: 'buff', sanctuary: 'buff', guard: 'buff', taunt: 'shockwave' };
  const fxName = v => v.t === 'atk' ? 'hit' : (FX_BY[v.sid] || (v.t === 'fire' ? 'fire' : v.t === 'heal' ? 'heal' : null));
  function fxPlay(name, v, delay, big) { // 이펙트의 타격 프레임이 공격 모션의 타격 순간(delay)과 만나도록 미리 시작한다
    const f = Assets.fx(name); if (!f) return false; const hitSec = (f.m.hit || 0) / f.m.fps / animK();
    later(Math.max(0, delay - hitSec), () => { (S.fxs = S.fxs || []).push({ f, gx: v.x, gy: v.y, t: 0, hit: false, big }); }); return true;
  }
  function procEvents(e) {
    S.areas = S.areas || []; S.tileShake = S.tileShake || {}; const bt = e.battle; let delay = 0; // delay: 직전 행동의 타격 순간. 피해·치유 표시·피격 모션은 이만큼 늦춰 휘두르는 모션과 맞춘다
    const unitAt = v => bt && bt.units.find(c => c.alive && Math.round(c.x) === Math.round(v.x) && Math.round(c.y) === Math.round(v.y));
    for (const v of e.events) {
      if (v.k === 'learn') { S.learnFx = S.learnFx || []; S.learnFx.push({ x: v.x, y: v.y, age: 0 }); }
      if (v.k === 'fx' && v.from) {
        const a = animEnt(v.from), face = dirOf(v.x - v.from.x, v.y - v.from.y), chain = v.t === 'atk' ? ['atk'] : (SKILL_ANIM[v.sid] || ['cast', 'atk']), act = a && pickAct(a, chain);
        if (act) { animPlay(v.from, act, true, face); delay = hitDelay(a, act); } else delay = 0;
        S.lastDelay = delay;
        if (v.n) S.floaters.push({ x: v.from.x, y: v.from.y, t: v.n, col: '#ffd86b', age: 0, up: 28, big: true });
        if (v.t === 'atk' && !a) { const [ax, ay] = iso(v.from.x, v.from.y), [bx, by] = iso(v.x, v.y), d = Math.hypot(bx - ax, by - ay) || 1; v.from.lx = (bx - ax) / d * 12; v.from.ly = (by - ay) / d * 12; v.from.lt = 0.18; } // 애니메이션 없는 개체만 앞으로 밀리는 연출
        const fxn = fxName(v), fxOk = fxn && fxPlay(fxn, v, delay, v.t !== 'atk'); // 이펙트 시트가 있으면 그걸로, 없으면 아래 이모지 표시
        if (!fxOk && (v.t === 'fire' || v.t === 'skill' || v.t === 'heal')) later(delay, () => S.floaters.push({ x: v.x, y: v.y, t: v.t === 'fire' ? '🔥' : v.t === 'heal' ? '✨' : '⚡', col: '#fff', age: 0, fx: true }));
      }
      if (v.k === 'area') later(delay, () => { S.areas.push({ cells: v.cells, col: v.col, age: 0 }); if (v.big && !reduced()) S.frameShake = { t: 0.4, d: 0.4, amp: 16 * shakeK() }; });
      if (v.k === 'dmg') later(delay, () => {
        const tg = unitAt(v), a = tg && animEnt(tg);
        if (a && !v.poison) { const guarding = (tg.guard || 0) > bt.t; animPlay(tg, (guarding && pickAct(a, ['guard'])) || 'hurt'); } // 방어 태세 중이면 막는 모션, 아니면 피격
        if (v.crit && !reduced()) S.tileShake[v.x + ',' + v.y] = 0.45; // 치명타: 맞은 타일이 크게 흔들리고 번쩍인다
        if (v.crit) S.floaters.push({ x: v.x, y: v.y, t: '치명타!', col: '#ffd24a', age: 0, big: true, crit: true, up: 44 }); // 머리 위 치명타 문구
        S.floaters.push({ x: v.x, y: v.y, t: (v.crit ? '💥' : '') + (v.poison ? '☠' : '') + v.v, col: v.side === 'p' ? '#ff8a8a' : '#ffffff', age: 0, big: v.crit });
      });
      else if (v.k === 'miss') later(delay, () => { const tg = unitAt(v), a = tg && animEnt(tg), act = a && pickAct(a, ['dodge']); if (act) animPlay(tg, act, true); S.floaters.push({ x: v.x, y: v.y, t: 'MISS', col: '#9fb2ff', age: 0 }); });
      else if (v.k === 'heal') later(delay, () => S.floaters.push({ x: v.x, y: v.y, t: '+' + v.v, col: '#7cf0a0', age: 0 }));
    }
  }
  /* ---------- 캠프 편성판 / 전투 무대 ---------- */
  function boardEntities() {
    const out = [];
    if (S.exp && S.exp.battle) { S.exp.battle.units.forEach(c => { if (c.alive) out.push(c); }); return out; }
    S.save.units.forEach(u => {
      const p = S.save.formation[u.id]; if (!u.hired || !p) return;
      const c = C.CLASSES[u.cls]; S._ents = S._ents || {};
      let en = S._ents[u.id]; if (!en) en = S._ents[u.id] = { dx: p[0], dy: p[1] };
      en.side = 'p'; en.name = u.name; en.icon = c.icon; en.color = c.color; en.x = p[0]; en.y = p[1]; en.size = 1; en.noBar = true; en.u = u; en.cost = Core.costOf(u); en.id = u.id; en.isLeader = u.id === S.save.policy.leader;
      out.push(en);
    });
    return out;
  }
  function mix(h1, h2, k) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16), f = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return '#' + [f(16), f(8), f(0)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function drawBoard(dt) {
    const camp = !S.exp, bt = S.exp && S.exp.battle ? S.exp.battle : null, hg = bt ? bt.hgt : null, terr = bt ? bt.terr : null, HST = 26; // 전투판 고저차 1단 높이(기존 7 → 14 → 26)
    const elAt = (x, y) => hg ? hg[clamp(Math.round(y), 0, 8)][clamp(Math.round(x), 0, 8)] * HST : 0;
    // 흔들림: 화면(범위 마법) · 타일(치명타)
    if (S.later && S.later.length) { const q = S.later; S.later = []; for (const it of q) { it.t -= dt; if (it.t <= 0) it.fn(); else S.later.push(it); } } // 타격 순간에 맞춰 늦춘 표시들
    ctx.save(); S.areas = S.areas || []; S.tileShake = S.tileShake || {};
    const fs = S.frameShake; if (fs && fs.t > 0) { const am = fs.amp * (fs.t / fs.d); ctx.translate((Math.random() - 0.5) * 2 * am, (Math.random() - 0.5) * 2 * am); fs.t -= dt; }
    const jit = {}; for (const k in S.tileShake) { S.tileShake[k] -= dt; if (S.tileShake[k] <= 0) delete S.tileShake[k]; else { const r = S.tileShake[k] / 0.45, am = 15 * shakeK() * r; jit[k] = [Math.sin(S.time * 75) * am, Math.cos(S.time * 91) * am * 0.8 - am * 0.35, r]; } } // 감쇠 진동 + 번쩍임(r)
    const jOf = (x, y) => jit[x + ',' + y] || [0, 0];
    bgFill(camp ? 'camp' : 'arena', '#1a1d29', '#0b0d13');
    const floorNo = S.exp ? S.exp.floor : S.save.maxFloor;
    ctx.fillStyle = '#ffffff0d'; ctx.font = '700 72px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`B${floorNo}F`, 24, 80);
    const selId = S.dragId || S.sel, sel = camp && selId ? S.save.units.find(u => u.id === selId) : null;
    for (let s = 0; s <= 16; s++) for (let gx = 0; gx < 9; gx++) {
      const gy = s - gx; if (gy < 0 || gy > 8) continue;
      let [sx, sy] = iso(gx, gy); const mine = gy >= 5, foe = gy <= 3, alt = (gx + gy) % 2, th = terr ? terr[gy][gx] : null, jt = jOf(gx, gy);
      sx += jt[0]; sy += jt[1];
      let top = alt ? '#2a2f3d' : '#252a37';
      if (mine) top = gy <= 6 ? (alt ? '#2a3d5c' : '#263753') : (alt ? '#223049' : '#1e2a41'); else if (foe) top = alt ? '#3b2a31' : '#35262d';
      let outline = '#00000055', lw = 1;
      if (sel && C.zoneOk(sel.cls, gy)) { top = alt ? '#3d6396' : '#385c8d'; }
      if (camp && S.hover && S.hover[0] === gx && S.hover[1] === gy) {
        if (sel) { const ok = C.zoneOk(sel.cls, gy); top = ok ? '#6b9cf0' : '#a04a4a'; outline = ok ? '#cfe0ff' : '#ffb0b0'; lw = 2; }
        else top = '#4d78b8';
      }
      const el = hg ? hg[gy][gx] * HST : 0, sy2 = sy - el;
      if (jt[2]) { top = mix(top, '#ffffff', Math.min(0.75, jt[2] * 0.8)); outline = '#ffffff'; lw = 2.5; } // 치명타로 흔들리는 타일은 하얗게 번쩍인다
      if (th) { const pulse = th === 'volcano' ? 0.45 + 0.1 * Math.sin(S.time * 3 + gx + gy) : 0.5; top = mix(top, C.THEMES[th].col, pulse); outline = th === 'resonance' ? '#c9a6ff' : '#00000055'; lw = th === 'resonance' ? 1.5 : 1; }
      if (hg && hg[gy][gx] > 0) top = shade(top, 1 + hg[gy][gx] * 0.07);
      poly([[sx - TW / 2, sy2], [sx, sy2 + TH / 2], [sx, sy + TH / 2 + 9], [sx - TW / 2, sy + 9]], '#161922');
      poly([[sx + TW / 2, sy2], [sx, sy2 + TH / 2], [sx, sy + TH / 2 + 9], [sx + TW / 2, sy + 9]], '#10121a');
      poly([[sx, sy2 - TH / 2], [sx + TW / 2, sy2], [sx, sy2 + TH / 2], [sx - TW / 2, sy2]], top, outline, lw);
      if (th) { ctx.globalAlpha = 0.5; ctx.font = `11px ${EMOJI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(C.THEMES[th].icon, sx, sy2 + 4); ctx.globalAlpha = 1; }
      if (hg && hg[gy][gx] > 0) { ctx.fillStyle = '#ffffff55'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▲'.repeat(hg[gy][gx]), sx, sy2 + 3); }
    }
    // 범위 스킬이 닿는 칸의 색 (0.7초 동안 서서히 사라짐)
    for (const ar of S.areas) {
      ar.age += dt; const a = 1 - ar.age / 0.7; if (a <= 0) continue;
      for (const [gx, gy] of ar.cells) {
        const [jx, jy] = jOf(gx, gy), [sx0, sy0] = iso(gx, gy), el = hg ? hg[gy][gx] * HST : 0, sx = sx0 + jx, sy2 = sy0 + jy - el;
        ctx.globalAlpha = Math.max(0, a) * 0.6; poly([[sx, sy2 - TH / 2], [sx + TW / 2, sy2], [sx, sy2 + TH / 2], [sx - TW / 2, sy2]], ar.col, '#ffffffcc', 2); ctx.globalAlpha = 1;
      }
    }
    S.areas = S.areas.filter(a => a.age < 0.7);
    if (camp) {
      ctx.font = '600 12px "Malgun Gothic",sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#8fb4f0';
      let [lx, ly] = iso(0, 5.5); ctx.fillText('전열', lx - 44, ly + 4); [lx, ly] = iso(0, 7.5); ctx.fillText('후열', lx - 44, ly + 4);
      ctx.fillStyle = '#c98b8b'; [lx, ly] = iso(8.4, 1.5); ctx.textAlign = 'left'; ctx.fillText('적 진영', lx + 44, ly + 4);
    }
    const ents = boardEntities();
    ents.forEach(c => {
      if (c.dx === undefined) { c.dx = c.x; c.dy = c.y; } const ox = c.dx, oy = c.dy;
      if (animEnt(c)) { const d = Math.hypot(c.x - c.dx, c.y - c.dy); if (d > 0.0005) { const st = Math.min(d, dt * Math.max(5, d * 4)); c.dx += (c.x - c.dx) / d * st; c.dy += (c.y - c.dy) / d * st; } } // 일정한 속도(칸/초)로 이동
      else { c.dx += (c.x - c.dx) * Math.min(1, dt * 9); c.dy += (c.y - c.dy) * Math.min(1, dt * 9); }
      const mv = Math.hypot(c.dx - ox, c.dy - oy); c.wt = (c.wt || 0) + mv; c.wph = (c.wph || 0) + mv / Math.max(1.1, mv / Math.max(dt, 1e-3) / MAX_CYCLES); c.mvT = mv > 0.0004 ? 0.1 : Math.max(0, (c.mvT || 0) - dt);
      if (c.lt > 0) c.lt -= dt;
    });
    ents.sort((a, b) => (a.dx + a.dy) - (b.dx + b.dy));
    const lineMode = (S.prefs && S.prefs.lines) || 'all';
    if (bt && lineMode !== 'off') { // 표적선: 적→대원은 주황(도발로 묶이면 진한 빨강), 대원→적은 파랑, 치유는 초록 점선
      ctx.save(); ctx.setLineDash([5, 4]);
      for (const c of ents) {
        const t = c.curTgt; if (!t || !t.alive || !c.alive) continue;
        if (c.side === 'p' && (lineMode === 'enemy' || bt.t - (c.curT || 0) > 2.5)) continue;
        const forced = c.side === 'e' && (t.tauntUntil || 0) > bt.t, [ax, ay] = iso(c.dx, c.dy), [tx, ty] = iso(t.dx, t.dy), y0 = ay - elAt(c.dx, c.dy) - 12, y1 = ty - elAt(t.dx, t.dy) - 12;
        ctx.lineWidth = forced ? 2.6 : c.side === 'e' ? 1.7 : 1.4;
        ctx.strokeStyle = c.curKind === 'heal' ? '#5be08acc' : c.side === 'e' ? (forced ? '#ff4a4af0' : '#ff9a5a99') : '#6aa8ffaa';
        ctx.beginPath(); ctx.moveTo(ax, y0); ctx.lineTo(tx, y1); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(tx, y1, 3.2, 0, 7); ctx.fill(); ctx.setLineDash([5, 4]);
      }
      ctx.restore();
    }
    for (const c of ents) {
      let [sx, sy] = iso(c.dx, c.dy); sy -= elAt(c.dx, c.dy); const r = 17 * (c.size || 1);
      { const j = jOf(Math.round(c.dx), Math.round(c.dy)); sx += j[0]; sy += j[1]; }
      if (c.lt > 0) { sx += c.lx * (c.lt / 0.18); sy += c.ly * (c.lt / 0.18); }
      const lifted = camp && S.dragId === c.id; if (lifted) ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(sx, sy + 4, r * 0.9, r * 0.4, 0, 0, 7); ctx.fill();
      const cy = sy - 12 - (c.size > 1 ? 8 : 0);
      const aa = animEnt(c), img = aa ? null : c.u ? Assets.unit('sprites', c.u) : Assets.enemy(c);
      if (aa) animDraw(aa, c, sx, sy + 4, dt, c.mvT > 0, !bt ? 2 : c.side === 'e' ? 3 : 7);
      else if (img) { const h = 58 * (c.size || 1), w = img.width * h / img.height; ctx.drawImage(img, sx - w / 2, sy + 6 - h, w, h); }
      else {
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(sx, cy, r, 0, 7); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = c.side === 'p' ? '#8fc0ff' : '#ff8f8f'; ctx.stroke();
        emoji(c.icon, sx, cy + 1, Math.round(20 * (c.size || 1)));
      }
      if (!c.noBar) { const w = 40 * (c.size || 1), p = Math.max(0, c.hp / c.maxhp); ctx.fillStyle = '#000a'; ctx.fillRect(sx - w / 2, cy - r - 10, w, 5); ctx.fillStyle = p < 0.25 ? '#ef6b6b' : p < 0.55 ? '#f0a34a' : '#6fd08c'; ctx.fillRect(sx - w / 2, cy - r - 10, w * p, 5); }
      if (c.isLeader) { ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86b'; ctx.fillText('★', sx - r + 2, cy - r + 2); }
      if (c.poisoned) emoji('☠️', sx + r - 2, cy - r + 2, 12);
      if (c.cost) { ctx.fillStyle = '#e2b659'; ctx.beginPath(); ctx.arc(sx + r - 2, cy + r - 4, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1608'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.cost, sx + r - 2, cy + r - 0.5); }
      if (c.noBar || c.side === 'e') { ctx.font = '11px "Malgun Gothic",sans-serif'; ctx.fillStyle = '#d6dcee'; ctx.textAlign = 'center'; ctx.fillText(c.name, sx, sy + 22); }
      if (c.abilTxt) { ctx.font = `10px ${EMOJI}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(c.abilTxt, sx, sy + 33); } // 몬스터 특수 능력 아이콘
      if (bt && c.side === 'p' && (c.tauntUntil || 0) > bt.t) emoji('🛡️', sx - r + 2, cy - r - 12, 14);
      ctx.globalAlpha = 1;
    }
    // 쓰러진 대원: 사망 동작을 재생하고 마지막 프레임에서 잠시 머문 뒤 사라진다
    S.ghosts = S.ghosts || [];
    if (bt) for (const c of bt.units) if (!c.alive && !c.ghosted && animEnt(c)) { c.ghosted = true; S.ghosts.push({ c, age: -(S.lastDelay || 0) }); }
    S.ghosts = S.ghosts.filter(g => (g.age += dt * (g.age < 0 ? 1 : animK())) < 2.2);
    for (const g of S.ghosts) {
      const a = animEnt(g.c); if (!a) continue; const [gx0, gy0] = iso(g.c.dx, g.c.dy);
      ctx.globalAlpha = g.age > 1.4 ? Math.max(0, 1 - (g.age - 1.4) / 0.8) : 1;
      const gf = g.c.face === undefined ? 7 : g.c.face, gyy = gy0 - elAt(g.c.dx, g.c.dy) + 4;
      if (g.age < 0) animBlit(a, 'idle', gf, 0, gx0, gyy); // 치명타가 들어가는 순간까지는 그대로 서 있는다
      else animBlit(a, 'die', gf, Math.min(animN(a, 'die') - 1, Math.floor(g.age * animFps(a, 'die'))), gx0, gyy);
      ctx.globalAlpha = 1;
    }
    // 스킬 습득 이펙트: 머리 위로 반짝이는 전구 + 주위를 도는 별빛
    S.learnFx = (S.learnFx || []).filter(f => (f.age += dt) < 2.4);
    for (const f of S.learnFx) {
      const [lx, ly] = iso(f.x, f.y), by = ly - elAt(f.x, f.y) - 70 - Math.min(f.age, 0.6) * 14 + Math.sin(f.age * 7) * 2, a = Math.min(1, (2.4 - f.age) / 0.7);
      ctx.save(); ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(lx, by, 2, lx, by, 34); g.addColorStop(0, '#fff3a0cc'); g.addColorStop(1, '#fff3a000'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, by, 34, 0, 7); ctx.fill();
      emoji('💡', lx, by, 30 + Math.sin(f.age * 10) * 2);
      for (let k = 0; k < 6; k++) { const an = f.age * 3 + k * Math.PI / 3, rr = 20 + 6 * Math.sin(f.age * 6 + k); emoji('✨', lx + Math.cos(an) * rr, by + Math.sin(an) * rr * 0.7, 10); }
      ctx.font = '700 13px "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText('스킬 습득!', lx, by - 26); ctx.fillStyle = '#ffe27a'; ctx.fillText('스킬 습득!', lx, by - 26);
      ctx.restore();
    }
    // 이펙트(FX) 시트: 프레임은 모션과 같은 배속 규칙(animK)으로 진행. 타격 프레임에 도달하면 화면 흔들림·히트스톱(스킬만) 적용
    if (S.fxs && S.fxs.length) {
      const k = animK(); ctx.save(); ctx.imageSmoothingEnabled = false;
      for (const x of S.fxs) { const m = x.f.m, fr = Math.floor(x.t * m.fps * k); x.t += dt;
        if (!x.hit && fr >= (m.hit || 0)) { x.hit = true; if (!reduced() && m.shake > 0) S.frameShake = { t: 0.14, d: 0.14, amp: m.shake * shakeK() }; if (x.big && !reduced() && m.hitStop > 0) S.freeze = Math.min(0.09, m.hitStop / m.fps / k); }
        if (fr >= m.n) { x.done = true; continue; }
        const [sx, sy] = iso(x.gx, x.gy); ctx.drawImage(x.f.img, fr * m.cell, 0, m.cell, m.cell, sx - m.cell / 2, sy - elAt(x.gx, x.gy) - 34 - m.cell / 2, m.cell, m.cell); }
      S.fxs = S.fxs.filter(x => !x.done); ctx.restore();
    }
    for (const f of S.floaters) {
      f.age += dt; const [sx, sy] = iso(f.x, f.y), a = 1 - f.age / (f.fx ? 0.5 : 1.0); if (a <= 0) continue;
      ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
      ctx.font = `${f.crit ? '900 24' : f.fx ? 26 : f.big ? 19 : 15}px ${EMOJI}`; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.t, sx, sy - 34 - f.age * 30 - (f.up || 0)); ctx.fillStyle = f.col; ctx.fillText(f.t, sx, sy - 34 - f.age * 30 - (f.up || 0));
      ctx.globalAlpha = 1;
    }
    S.floaters = S.floaters.filter(f => f.age < 1.0);
    vignette(0.45);
    ctx.restore();
  }

  /* ---------- 주점 (Phase 6): 후보 5~7명이 무대에 서 있고, 클릭해서 데려온다 ---------- */
  function tavernSlots() {
    const cands = C.tavCands(S.save), n = cands.length, out = [];
    cands.forEach((u, i) => { out.push({ u, x: n === 1 ? W / 2 : 90 + i * (W - 180) / (n - 1), y: 345 + (i % 2) * 14 }); });
    return out;
  }
  function tavernAt(ev) {
    const [mx, my] = mouse(ev); let best = null, bd = 1e9;
    for (const s of tavernSlots()) { const d = Math.hypot(mx - s.x, my - (s.y - 40)); if (d < 62 && d < bd) { bd = d; best = s.u.id; } }
    return best;
  }
  function drawTavern(dt) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1b12'); g.addColorStop(0.62, '#3a2417'); g.addColorStop(0.62, '#241610'); g.addColorStop(1, '#120a07'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const bg = Assets.get('backgrounds', 'tavern'); if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.fillStyle = '#00000033'; for (let i = 0; i < 9; i++) ctx.fillRect(0, 330 + i * 24, W, 2); // 마룻바닥 줄
    for (const x of [120, 450, 780]) { ctx.fillStyle = '#ffd68a'; ctx.globalAlpha = 0.5 + 0.1 * Math.sin(S.time * 3 + x); ctx.beginPath(); ctx.arc(x, 70, 20, 0, 7); ctx.fill(); ctx.globalAlpha = 1; emoji('🏮', x, 70, 30); }
    ctx.font = '800 26px "Malgun Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2d9a8'; ctx.fillText('🍺 주점 — 오늘의 손님', W / 2, 44);
    ctx.font = '13px "Malgun Gothic",sans-serif'; ctx.fillStyle = '#b89e78'; ctx.fillText('마음에 드는 용병을 클릭하세요 · 후보는 원정에서 돌아올 때마다 바뀝니다', W / 2, 66);
    const slots = tavernSlots(), hov = S.tavernHover; let tip = null;
    if (!slots.length) { ctx.font = '700 18px "Malgun Gothic",sans-serif'; ctx.fillStyle = '#d9c19a'; ctx.fillText('오늘은 손님이 없습니다 — 출현변경권으로 다른 손님을 부를 수 있어요', W / 2, 260); }
    for (const s of slots) {
      const u = s.u, c = C.CLASSES[u.cls], rk = C.rarOf(u), R = C.RARITY[rk], on = hov === u.id, sc = on ? 1.12 : 1, r = 40 * sc, cy = s.y - 40;
      ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, r * 0.95, r * 0.32, 0, 0, 7); ctx.fill();
      if (rk !== 'N') { const gl = ctx.createRadialGradient(s.x, cy, r * 0.6, s.x, cy, r * (rk === 'L' ? 2.0 : 1.6)); gl.addColorStop(0, R.color + (rk === 'L' ? '88' : '55')); gl.addColorStop(1, R.color + '00'); ctx.fillStyle = gl; ctx.globalAlpha = rk === 'L' ? 0.75 + 0.25 * Math.sin(S.time * 4 + s.x) : 1; ctx.beginPath(); ctx.arc(s.x, cy, r * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      const img = Assets.unit('sprites', u), aa = Assets.anim(u);
      if (aa) animLoop(aa, 'idle', 2, s.x, s.y + 6, 1.45 * sc, slots.indexOf(s) * 3);
      else if (img) { const h = 96 * sc, w = img.width * h / img.height; ctx.drawImage(img, s.x - w / 2, s.y + 6 - h, w, h); }
      else { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(s.x, cy, r, 0, 7); ctx.fill(); ctx.lineWidth = on ? 4 : 2.5; ctx.strokeStyle = on ? '#fff' : R.color; ctx.stroke(); emoji(c.icon, s.x, cy + 2, Math.round(44 * sc)); }
      ctx.font = '700 14px "Malgun Gothic",sans-serif'; ctx.fillStyle = on ? '#fff' : '#ecdcc0'; ctx.fillText(u.name, s.x, s.y + 28);
      ctx.font = '11px "Malgun Gothic",sans-serif'; ctx.fillStyle = R.color; ctx.fillText(`${c.name}${rk !== 'N' ? ' · ' + R.name : ''}`, s.x, s.y + 43);
      ctx.fillStyle = '#e2b659'; ctx.fillText(`💰 ${C.hireCost(u)}G`, s.x, s.y + 58);
      if (rk === 'L' && (u.fails || 0) > 0) { ctx.fillStyle = '#ff9a9a'; ctx.fillText(`실패 ${u.fails}/${C.TAV.legendFailMax}`, s.x, s.y + 72); }
      if (on) tip = s;
    }
    if (tip) { // 호버 툴팁: 능력치 요약
      const u = tip.u, st = C.stats(u), lines = [`${u.name} · ${C.CLASSES[u.cls].name} Lv${u.lv}`, `HP ${st.hp} · 공 ${st.atk} · 방 ${st.def} · 속 ${st.spd.toFixed(0)}`, `사거리 ${st.range} · 도발 ${st.taunt.toFixed(1)} · 코스트 ${C.costOf(u)}`, C.rarOf(u) === 'L' ? `고용 성공률 약 ${Math.round(C.legendChance(S.save) * 100)}%` : '클릭하면 자세히 보고 고용합니다'];
      const bw = 214, bh = 78, bx = Math.max(8, Math.min(W - bw - 8, tip.x - bw / 2)), by = tip.y - 160;
      ctx.fillStyle = '#0d0907ee'; ctx.strokeStyle = '#c9a56a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; lines.forEach((t, i) => { ctx.font = i === 0 ? '700 13px "Malgun Gothic",sans-serif' : '12px "Malgun Gothic",sans-serif'; ctx.fillStyle = i === 0 ? '#ffe9b8' : '#d8c6a6'; ctx.fillText(t, bx + 10, by + 20 + i * 17); }); ctx.textAlign = 'center';
    }
    vignette(0.5);
  }

  /* ---------- 쿼터뷰 벽돌 미로 (지3 탐사 화면) ---------- */
  const MTW = 28, MTH = 14, MX = 338, MY = 46, WALL_H = 11, FLOOR_H = 3, ZOOM = 1.75;
  const misoXY = (gx, gy) => [MX + (gx - gy) * MTW / 2, MY + (gx + gy) * MTH / 2];
  const HSTEP = 8; let curM = null; // 미로 고저차 1단 높이(2배)
  const elevAt = (x, y) => curM && curM.hgt ? curM.hgt[clamp(Math.round(y), 0, curM.h - 1)][clamp(Math.round(x), 0, curM.w - 1)] * HSTEP : 0;
  const misoXYe = (gx, gy) => { const p = misoXY(gx, gy); return [p[0], p[1] - elevAt(gx, gy)]; };
  let bgCanvas = null, camXY = [338, 150];
  function makeBG() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5e93e0'); g.addColorStop(0.55, '#b9d6f7'); g.addColorStop(1, '#e8f1fb'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffffffaa'; for (let i = 0; i < 14; i++) { const cx = (i * 163 + 40) % W, cy = 30 + (i * 71) % 190; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx + k * 22, cy + (k % 2) * 6, 38, 12, 0, 0, 7); x.fill(); } }
    const mount = (base, col, seed) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); let px = 0; for (let i = 0; i <= 12; i++) { const h = 90 + ((i * seed * 37) % 110); x.lineTo(px, base - h); px += W / 12; } x.lineTo(W, H); x.fill(); };
    mount(360, '#5c6f93', 7); mount(400, '#4a5a7a', 11);
    x.fillStyle = '#ffffffcc'; for (let i = 0; i < 9; i++) { const px = 40 + i * 105, py = 205 + (i * 37) % 90; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 20, py + 38); x.lineTo(px - 20, py + 38); x.fill(); }
    const m2 = x.createLinearGradient(0, 380, 0, H); m2.addColorStop(0, '#6fae48'); m2.addColorStop(1, '#3f7a2c'); x.fillStyle = m2; x.beginPath(); x.moveTo(0, 470); x.quadraticCurveTo(300, 360, 900, 520); x.lineTo(900, 520); x.lineTo(0, 520); x.fill();
    x.fillStyle = '#00000014'; x.fillRect(0, 0, W, H);
    return c;
  }
  function mcube(sx, sy, h, top, left, right, brick) {
    const hw = MTW / 2, hh = MTH / 2;
    poly([[sx - hw, sy - h], [sx, sy - h + hh], [sx, sy + hh], [sx - hw, sy]], left, '#00000033');
    poly([[sx + hw, sy - h], [sx, sy - h + hh], [sx, sy + hh], [sx + hw, sy]], right, '#00000033');
    poly([[sx, sy - h - hh], [sx + hw, sy - h], [sx, sy - h + hh], [sx - hw, sy - h]], top, '#00000033');
    if (brick) { ctx.strokeStyle = '#00000040'; ctx.lineWidth = 1; for (const k of [0.35, 0.68]) { const o = h * k; ctx.beginPath(); ctx.moveTo(sx - hw, sy - o); ctx.lineTo(sx, sy - o + hh); ctx.lineTo(sx + hw, sy - o); ctx.stroke(); } }
  }
  function mdiamond(sx, sy, fill, stroke, pad) { const p = pad || 0; poly([[sx, sy - FLOOR_H - MTH / 2 - p], [sx + MTW / 2 + p, sy - FLOOR_H], [sx, sy - FLOOR_H + MTH / 2 + p], [sx - MTW / 2 - p, sy - FLOOR_H]], fill, stroke, 1.5); }
  function tileImg(name, sx, sy) { const im = Assets.get('tiles', name); if (!im) return false; const w = MTW * 1.0, h = im.height * w / im.width; ctx.drawImage(im, sx - w / 2, sy + MTH / 2 - h, w, h); return true; }
  function objImg(name, sx, sy, sz) { const im = Assets.get('objects', name); if (!im) return false; const w = sz, h = im.height * w / im.width; ctx.drawImage(im, sx - w / 2, sy - h + 2, w, h); return true; }
  const D8_ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function drawMaze(dt) {
    const e = S.exp, m = e.map; curM = m;
    const bgi = Assets.get('backgrounds', 'maze');
    if (bgi) ctx.drawImage(bgi, 0, 0, W, H); else { if (!bgCanvas) bgCanvas = makeBG(); ctx.drawImage(bgCanvas, 0, 0); }
    e.ents = e.ents || {}; e.cam = e.cam || { x: e.pos.x, y: e.pos.y };
    // 논리 이동은 한 틱에 0~1칸씩 불규칙하게 온다(걸음 간격 0.14초 대 처리 단위 0.1초). 그대로 따라가면 걷다 서기를 반복해 절뚝여 보이므로
    // ① 최근 3초의 평균 속도(J.v)로 일정하게 걷고 ② 목표를 한 칸 뒤(trail[0])로 잡아 완충(논리보다 2~3칸 뒤처짐)을 둬서 틱이 한두 번 비어도 멈추지 않게 한다.
    const J = e.fl = e.fl || { rt: 0, lx: e.pos.x, ly: e.pos.y, lt: 0, cum: 0, h: [], v: 0 }; J.rt += dt;
    if (e.pos.x !== J.lx || e.pos.y !== J.ly) { const dist = Math.hypot(e.pos.x - J.lx, e.pos.y - J.ly); if (dist < 3) J.cum += dist; J.lx = e.pos.x; J.ly = e.pos.y; J.lt = J.rt; }
    J.h.push([J.rt, J.cum]); while (J.h.length > 2 && J.rt - J.h[1][0] > 3) J.h.shift();
    { const o = J.h[0], span = J.rt - o[0]; if (span > 0.5) J.v = (J.cum - o[1]) / span; } // 창이 짧을 땐 이전 값 유지
    if (J.rt - J.lt > 2) J.v *= Math.exp(-dt * 2); // 틱이 오래 멈추면(이벤트·일시정지) 서서히 선다
    const alive = e.party.filter(u => u.hp > 0);
    alive.forEach((u, i) => {
      const tgt = e.trail[i] || e.trail[e.trail.length - 1] || e.pos; let en = e.ents[u.id]; // 선두는 한 칸 뒤, 뒤따르는 대원은 그만큼 더 뒤
      if (!en) en = e.ents[u.id] = { dx: tgt.x, dy: tgt.y };
      if (Math.abs(en.dx - e.pos.x) > 6 || Math.abs(en.dy - e.pos.y) > 6) { en.dx = tgt.x; en.dy = tgt.y; }
      const ox = en.dx, oy = en.dy, dd = Math.hypot(tgt.x - en.dx, tgt.y - en.dy);
      if (dd > 0.015) { const want = J.v * 0.95 + dd * 0.12 + Math.max(0, dd - 4) * 1.5; en.sv = en.sv === undefined ? want : en.sv + (want - en.sv) * Math.min(1, dt * 2.5); const st = Math.min(dd, dt * en.sv); en.dx += (tgt.x - en.dx) / dd * st; en.dy += (tgt.y - en.dy) / dd * st; } else { en.dx = tgt.x; en.dy = tgt.y; }
      // 걷기 애니메이션용: 실제로 움직인 거리만큼 걸음 위상을 진행시키고, 가는 방향을 바라본다(멈추면 잠시 뒤 대기로 전환)
      const mv = Math.hypot(en.dx - ox, en.dy - oy), left = Math.hypot(tgt.x - en.dx, tgt.y - en.dy);
      if (mv > 0.004 && !S.paused) { en.wt = (en.wt || 0) + mv; en.wph = (en.wph || 0) + mv / Math.max(STRIDE_MAZE, J.v / MAX_CYCLES); en.mvT = 0.18; } else en.mvT = Math.max(0, (en.mvT || 0) - dt);
      if (left > 0.06) faceTo(en, dirOf(tgt.x - en.dx, tgt.y - en.dy), dt);
    });
    { // 카메라는 선두의 부드러운 위치를 따라간다(끊기는 논리 좌표를 따라가면 화면이 출렁인다)
      const ld = alive.length ? e.ents[alive[0].id] : null, tx = ld ? ld.dx : e.pos.x, ty = ld ? ld.dy : e.pos.y;
      if (Math.abs(e.cam.x - tx) > 8 || Math.abs(e.cam.y - ty) > 8) { e.cam.x = tx; e.cam.y = ty; }
      e.cam.x += (tx - e.cam.x) * Math.min(1, dt * 5); e.cam.y += (ty - e.cam.y) * Math.min(1, dt * 5);
      camXY = misoXY(e.cam.x, e.cam.y);
      ctx.save(); ctx.translate(450, 280); ctx.scale(ZOOM, ZOOM); ctx.translate(-camXY[0], -camXY[1]);
    }
    const buckets = {}, put = (gx, gy, fn) => { const k = Math.round(gx + gy); (buckets[k] = buckets[k] || []).push(fn); };
    m.chests.forEach(c => { if (m.seen[c.y][c.x]) put(c.x, c.y, () => { const [sx, sy] = misoXYe(c.x, c.y); ctx.globalAlpha = c.open ? 0.4 : 1; if (!objImg(c.open ? 'chest_open' : (c.big ? 'chest_big' : 'chest'), sx, sy, 22)) emoji(c.big ? '🎁' : '📦', sx, sy - 8, 15); ctx.globalAlpha = 1; }); });
    m.traps.forEach(t => { if (t.found && !t.gone) put(t.x, t.y, () => { const [sx, sy] = misoXYe(t.x, t.y); if (!objImg('trap', sx, sy, 18)) emoji('⚠️', sx, sy - 6, 13); }); });
    (m.events || []).forEach(v => { if (!v.used && m.seen[v.y][v.x]) put(v.x, v.y, () => { const [sx, sy] = misoXYe(v.x, v.y); mdiamond(sx, sy, '#ffd24a44', '#ffd24a', 1 + Math.sin(S.time * 4)); emoji(C.EVT[v.type].icon, sx, sy - 9, 17); }); });
    m.springs.forEach(sp => { if (m.seen[sp.y][sp.x]) put(sp.x, sp.y, () => { const [sx, sy] = misoXYe(sp.x, sp.y); ctx.globalAlpha = sp.used ? 0.4 : 1; if (!objImg('spring', sx, sy, 22)) emoji('⛲', sx, sy - 8, 15); ctx.globalAlpha = 1; }); });
    m.groups.forEach(g => { if (g.alive && m.seen[g.y][g.x]) put(g.x, g.y, () => {
      const [sx, sy] = misoXYe(g.x, g.y), r = g.boss ? 11 : 8;
      mdiamond(sx, sy, g.boss ? '#5a0f1f' : (g.golden ? '#4a3600' : (g.elite ? '#3a1250' : (g.special ? '#102a40' : '#111'))), g.boss ? '#ff5a6a' : (g.golden ? '#ffd24a' : (g.elite ? '#c77dff' : (g.special ? '#6ab0ff' : '#000'))), g.golden ? 1 + Math.sin(S.time * 5) : 0);
      const eimg = g.boss ? Assets.get('sprites', 'boss' + e.floor) : Assets.get('sprites', g.tpls[0]);
      if (eimg) { const h = g.boss ? 30 : 22, w = eimg.width * h / eimg.height; ctx.drawImage(eimg, sx - w / 2, sy - h + 4, w, h); }
      else { ctx.fillStyle = '#000a'; ctx.beginPath(); ctx.arc(sx, sy - 11, r, 0, 7); ctx.fill(); emoji(g.icon, sx, sy - 11, g.boss ? 17 : 12); }
      if (g.elite) emoji('☠️', sx + 8, sy - 19, 10);
      if (g.special) emoji('❗', sx + 8, sy - 19, 10);
      if (g.golden) emoji('✨', sx + 8, sy - 19 + Math.sin(S.time * 6) * 1.5, 11);
      if (g.tpls.length > 1) { ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(sx + 8, sy - 19, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.tpls.length, sx + 8, sy - 16); }
    }); });
    alive.slice().reverse().forEach((u, k) => {
      const en = e.ents[u.id], lead = u === alive[0], cl = C.CLASSES[u.cls];
      put(en.dx, en.dy, () => {
        const [sx, sy] = misoXYe(en.dx, en.dy), bob = S.paused ? 0 : Math.abs(Math.sin(S.time * 9 + k)) * 2;
        ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(sx, sy - 1, 8, 3.5, 0, 0, 7); ctx.fill();
        const img = Assets.unit('sprites', u), aa = Assets.anim(u);
        if (aa) { const fc = en.face === undefined ? 2 : en.face; if (en.mvT > 0) animBlit(aa, 'walk', fc, Math.floor((en.wph || 0) * animN(aa, 'walk')) % animN(aa, 'walk'), sx, sy + 1, 0.62); else animLoop(aa, 'idle', fc, sx, sy + 1, 0.62, k * 3); if (lead) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 4, 0, 0, 7); ctx.stroke(); } }
        else if (img) { const h = 26, w = img.width * h / img.height; ctx.drawImage(img, sx - w / 2, sy + 1 - h - bob, w, h); if (lead) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 4, 0, 0, 7); ctx.stroke(); } }
        else {
          ctx.fillStyle = cl.color; ctx.beginPath(); ctx.arc(sx, sy - 10 - bob, 8, 0, 7); ctx.fill();
          ctx.lineWidth = lead ? 2.5 : 1.5; ctx.strokeStyle = lead ? '#ff3b3b' : '#e6ecff'; ctx.stroke();
          emoji(cl.icon, sx, sy - 10 - bob, 11);
        }
        if (u.poison) emoji('☠️', sx + 8, sy - 18, 8);
      });
    });
    const mtc = m.themes && m.themes.length ? C.THEMES[m.themes[0]].col : null, fl = c => mtc ? mix(c, mtc, 0.22) : c; // 층 주 테마 색조
    const dirK = e.directive, pathSet = new Set((e.path || []).slice(0, 14).map(p => p[1] * 100 + p[0]));
    const nearD = (x, y) => Math.max(Math.abs(x - e.pos.x), Math.abs(y - e.pos.y));
    for (let s = 0; s <= m.w + m.h - 2; s++) {
      for (let gx = Math.max(0, s - m.h + 1); gx <= Math.min(m.w - 1, s); gx++) {
        const gy = s - gx; if (!m.seen[gy][gx]) continue;
        const t = m.grid[gy][gx], [sx, sy0] = misoXY(gx, gy), el = m.hgt ? m.hgt[gy][gx] * HSTEP : 0, sy = sy0 - el;
        if (t === 0) { if (!tileImg('wall', sx, sy0)) { let wb = 0; if (m.hgt) for (const [ddx, ddy] of D8_) { const nx = gx + ddx, ny = gy + ddy; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && m.grid[ny][nx] !== 0) wb = Math.max(wb, m.hgt[ny][nx]); } mcube(sx, sy0, WALL_H + wb * HSTEP, '#e29a6b', '#bd6f47', '#8d4e33', true); } }
        else {
          const room = m.rid[gy][gx] >= 0, chk = (gx + gy) % 2;
          if (!tileImg(room ? 'floor_room' : 'floor_corridor', sx, sy)) mcube(sx, sy0, FLOOR_H + el, fl(room ? (chk ? '#d6cbb4' : '#cdc1a8') : '#c2b69b'), fl('#8f8571'), fl('#6e6556'), false);
          { const zt = m.tz ? m.tz[gy][gx] : null; if (zt) { mdiamond(sx, sy, C.THEMES[zt].col + (zt === 'volcano' ? 'aa' : '99')); if ((gx + gy) % 3 === 0) emoji(C.THEMES[zt].icon, sx, sy - 4, 7); } }
          if (nearD(gx, gy) > 7) mdiamond(sx, sy, '#10203a55');
          if (t === 5) { if (!tileImg('stairs_down', sx, sy)) { mdiamond(sx, sy, '#4a3b8a'); emoji('⬇', sx, sy - 6, 12); } }
          else if (t === 6) { if (!tileImg('stairs_up', sx, sy)) emoji('⬆', sx, sy - 6, 11); }
          else if (t === 3) { if (!tileImg('door', sx, sy)) emoji('🚪', sx, sy - 8, 14); }
          else if (t === 4) { if (!tileImg('lock', sx, sy)) emoji('🔒', sx, sy - 8, 13); }
          if (pathSet.has(gy * 100 + gx)) { ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(sx, sy - FLOOR_H, 2, 0, 7); ctx.fill(); }
          if (dirK && dirK.x === gx && dirK.y === gy) mdiamond(sx, sy, null, '#ffd24a', 2 + Math.sin(S.time * 6) * 1.5);
          if (S.hover && S.hover[0] === gx && S.hover[1] === gy) mdiamond(sx, sy, '#ffffff44', '#fff');
        }
      }
      (buckets[s] || []).forEach(fn => fn());
    }
    ctx.restore();
  }

  /* ---------- 공개 ---------- */
  function mouse(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height]; }
  function cellAt(ev) {
    const [mx, my] = mouse(ev), dx = (mx - OX) / (TW / 2), dy = (my - OY) / (TH / 2), gx = Math.round((dx + dy) / 2), gy = Math.round((dy - dx) / 2);
    return gx >= 0 && gy >= 0 && gx < 9 && gy < 9 ? [gx, gy] : null;
  }
  function mazeTile(ev) {
    const [px, py] = mouse(ev), mx = (px - 450) / ZOOM + camXY[0], my = (py - 280) / ZOOM + camXY[1];
    const dx = (mx - MX) / (MTW / 2), dy = (my + 3 - MY) / (MTH / 2), bx = Math.round((dx + dy) / 2), by = Math.round((dy - dx) / 2);
    // 고저차가 있으면 타일이 위로 솟아 평면 투영과 어긋나므로, 주변 타일의 (높이 반영) 화면 위치와 가장 가까운 칸을 고른다
    let best = null, bd = 9;
    for (let ox = -3; ox <= 3; ox++) for (let oy = -3; oy <= 3; oy++) {
      const gx = bx + ox, gy = by + oy; if (gx < 0 || gy < 0 || gx >= curM.w || gy >= curM.h) continue;
      const el = curM && curM.hgt ? curM.hgt[gy][gx] * HSTEP : 0, [sx, sy] = misoXY(gx, gy);
      const d = Math.abs(mx - sx) / (MTW / 2) + Math.abs(my + 3 - (sy - el)) / (MTH / 2);
      if (d < bd) { bd = d; best = [gx, gy]; }
    }
    return best && bd <= 1.2 ? best : null;
  }
  function draw(dt) {
    if (S.freeze > 0) { S.freeze -= dt; dt = 0; } // 히트스톱: 타격 순간 화면 연출만 잠깐 멈춘다(전투 계산은 그대로)
    S.time += dt;
    ctx.clearRect(0, 0, W, H);
    if (S.exp && !S.exp.battle) { drawMaze(dt); vignette(0.25); } else if (!S.exp && S.tab === 'tavern') drawTavern(dt); else drawBoard(dt);
  }
  function init(state, canvas) { S = state; cv = canvas; ctx = cv.getContext('2d'); }
  return { init, draw, cellAt, mazeTile, tavernAt, procEvents, W, H };
})();
