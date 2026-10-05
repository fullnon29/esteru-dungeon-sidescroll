'use strict';
/* 전투 이펙트 그래프(assets/fxpxf/*.pxf.json) 생성기 — 우리 쪽 디자인. 실행: node tools/gen_fxpxf.js && node tools/build_fxpxf.js
 * 그래프 형식은 pxf.graph@1 (fxgraph.js 가 렌더). 값을 바꿔 다시 생성하거나, tools/pxf_tool.html 에서 직접 고쳐 저장해도 된다. */
const fs = require('fs'), path = require('path'), FX = require('../fxgraph.js');
const dir = path.join(__dirname, '..', 'assets', 'fxpxf');
const K = (...a) => ({ k: a }); /* 키프레임 [프레임, 값, 이징?] 목록 */
function graph(name, frames, fps, impact, nodes, links, size) {
  return { format: 'pxf.graph@1', name, settings: { size: size || 64, frames, fps, loop: false }, nodes: nodes.map((n, i) => ({ id: n[0], type: n[1], x: 40 + (i % 5) * 200, y: 40 + Math.floor(i / 5) * 160, params: n[2] || {} })), links: links.map(([f, t, p]) => ({ f, t, p: p || 0 })), game: { pivot: [.5, .5], logicalSize: size || 64, blend: 'normal', impactFrame: impact } };
}
const fade = (last, hold) => ['fade', 'Tint', { amount: 0, opacity: K([0, 1], [hold, 1, 'in'], [last, 0]) }];
const OUT = ['out', 'Output', { alpha: 'soft', threshold: .1 }];
const G = {};

G.hit = graph('타격', 10, 24, 1, [
  ['star', 'Shape', { shape: 'star', points: 6, size: K([0, 4, 'out3'], [2, 15], [6, 7], [9, 0]), size2: .3, rot: 12 }],
  ['ring', 'Shape', { shape: 'ring', size: K([0, 2, 'out'], [3, 11], [9, 19]), size2: .18, intensity: .7 }],
  ['sparks', 'Particles', { count: 11, seed: 21, start: 0, life: .65, lifeVar: .25, area: 'circle', aw: 4, dirMode: 'outward', speed: 1.7, speedVar: .35, drag: .09, sizeA: 2, sizeB: .6, pshape: 'square', bright: .9 }],
  ['b1', 'Blend', { mode: 'max' }], ['b2', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#6e2410', '#e0561c', '#ffc23a', '#fff6c8'], cutoff: .06 }],
  fade(9, 5), OUT,
], [['star', 'b1', 0], ['ring', 'b1', 1], ['b1', 'b2', 0], ['sparks', 'b2', 1], ['b2', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.slash = graph('베기', 10, 24, 3, [
  ['arc1', 'Arc', { x: .45, y: .55, radius: 24, thick: K([0, 4], [3, 14, 'out'], [9, 3]), start: -80, sweep: 130, head: K([0, 0, 'out3'], [5, 1.2]), tail: .85, taper: 1.3, aspect: .85, rot: -18 }],
  ['arc2', 'Arc', { x: .45, y: .55, radius: 18, thick: K([1, 2], [4, 6], [9, 2]), start: -70, sweep: 140, head: K([1, 0, 'out3'], [6, 1.1]), tail: .5, taper: 1.5, aspect: .85, rot: -18, intensity: .8 }],
  ['b', 'Blend', { mode: 'max' }],
  ['spark', 'Particles', { count: 6, seed: 4, start: .3, life: .4, area: 'ring', aw: 30, dirMode: 'outward', speed: 1.2, drag: .08, sizeA: 1.5, sizeB: .5, pshape: 'diamond', bright: .8 }],
  ['b2', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#24336e', '#5f8dff', '#c4defe', '#ffffff'], cutoff: .07 }],
  fade(9, 4), OUT,
], [['arc1', 'b', 0], ['arc2', 'b', 1], ['b', 'b2', 0], ['spark', 'b2', 1], ['b2', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.shockwave = graph('충격파', 14, 24, 1, [
  ['ring', 'Shape', { shape: 'ring', y: .6, aspect: .5, size: K([0, 3, 'out3'], [5, 22, 'out'], [13, 30]), size2: K([0, .4], [6, .12], [13, .05]), intensity: .85 }],
  ['echo', 'Echo', { copies: 2, step: 2, decay: .55 }],
  ['dust', 'Particles', { count: 14, seed: 9, start: .05, life: .7, area: 'ring', aw: 14, dirMode: 'outward', speed: 1.3, drag: .07, gravity: -.01, sizeA: 3, sizeB: 1, pshape: 'square', fade: 'out', bright: .6 }],
  ['core', 'Shape', { shape: 'circle', y: .6, aspect: .5, size: K([0, 10, 'out'], [3, 6], [5, 0]), falloff: .6 }],
  ['b1', 'Blend', { mode: 'max' }], ['b2', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#5a4a3a', '#b09070', '#e8d8b0', '#ffffff'], cutoff: .06 }],
  fade(13, 6), OUT,
], [['ring', 'echo'], ['echo', 'b1', 0], ['core', 'b1', 1], ['b1', 'b2', 0], ['dust', 'b2', 1], ['b2', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.buff = graph('강화', 16, 20, 2, [
  ['base', 'Shape', { shape: 'ring', y: .78, aspect: .35, size: K([0, 6, 'out'], [6, 20], [15, 22]), size2: .2, intensity: K([0, 0], [3, .9], [12, .5, 'in'], [15, 0]) }],
  ['rise', 'Particles', { count: 30, seed: 33, emit: 'stream', start: 0, span: .75, life: .5, lifeVar: .3, area: 'box', x: .5, y: .82, aw: 28, ah: 4, dirMode: 'fixed', angle: -90, spread: 24, speed: 1.1, speedVar: .4, drag: .02, sizeA: 3, sizeB: 1.2, pshape: 'plus', fade: 'out', bright: .85 }],
  ['b', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#6a3a0a', '#e8a020', '#ffe070', '#fffbe0'], cutoff: .06 }],
  fade(15, 9), OUT,
], [['base', 'b', 0], ['rise', 'b', 1], ['b', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.lightning = graph('번개', 12, 24, 2, [
  ['bolt', 'Lightning', { x0: .56, y0: 0, x1: .5, y1: .78, detail: 5, jag: .32, branch: .35, branchLen: .3, seed: 7, rate: 2, thick: 2, grow: K([0, 0, 'out3'], [2, 1]), intensity: K([0, 1], [8, 1], [11, .2]) }],
  ['flash', 'Shape', { shape: 'circle', y: .78, aspect: .55, size: K([1, 4, 'out3'], [3, 17], [11, 10]), falloff: .7, intensity: K([1, 0], [2, 1], [11, 0]) }],
  ['b', 'Blend', { mode: 'max' }],
  ['glow', 'Glow', { radius: 2, strength: .8 }],
  ['pal', 'Palette', { colors: ['#262a78', '#5f6dff', '#c2d2ff', '#ffffff'], cutoff: .07 }],
  fade(11, 6), OUT,
], [['bolt', 'b', 0], ['flash', 'b', 1], ['b', 'glow'], ['glow', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.fire = graph('화염', 16, 20, 3, [
  ['noise', 'Noise', { type: 'fbm', scaleX: 4, scaleY: 5, octaves: 3, seed: 12, scrollY: -1, contrast: 1.8, bias: .05 }],
  ['body', 'Shape', { shape: 'circle', y: .56, size: K([0, 5, 'out3'], [4, 19, 'out'], [11, 21], [15, 12]), falloff: .85 }],
  ['mask', 'Mask', { mode: 'multiply', strength: 1 }],
  ['core', 'Shape', { shape: 'circle', y: .56, size: K([0, 3, 'out3'], [3, 12], [10, 7], [14, 0]), falloff: .5 }],
  ['b1', 'Blend', { mode: 'add' }],
  ['embers', 'Particles', { count: 14, seed: 41, emit: 'stream', start: .1, span: .6, life: .5, area: 'circle', x: .5, y: .6, aw: 18, dirMode: 'fixed', angle: -90, spread: 70, speed: 1, gravity: -.015, drag: .03, sizeA: 2, sizeB: .6, pshape: 'square', fade: 'out', bright: .8 }],
  ['b2', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#4a0d12', '#a3231b', '#e8591c', '#ffb030', '#fff1b8'], cutoff: .12 }],
  fade(15, 8), OUT,
], [['noise', 'mask', 0], ['body', 'mask', 1], ['mask', 'b1', 0], ['core', 'b1', 1], ['b1', 'b2', 0], ['embers', 'b2', 1], ['b2', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

G.heal = graph('회복', 16, 20, 2, [
  ['cross', 'Shape', { shape: 'cross', y: .46, size: K([0, 0, 'out3'], [4, 11], [10, 9], [15, 0]), size2: .28, intensity: K([0, 0], [3, 1], [11, .8], [15, 0]) }],
  ['ring', 'Shape', { shape: 'ring', y: .78, aspect: .35, size: K([0, 5, 'out'], [8, 21], [15, 24]), size2: .1, intensity: K([0, 0], [2, .9], [12, .4], [15, 0]) }],
  ['rise', 'Particles', { count: 14, seed: 77, emit: 'stream', start: 0, span: .65, life: .5, area: 'box', x: .5, y: .8, aw: 22, ah: 4, angle: -90, spread: 18, speed: .9, speedVar: .3, drag: .02, sizeA: 2, sizeB: 1, pshape: 'plus', fade: 'out', bright: .85 }],
  ['b1', 'Blend', { mode: 'max' }], ['b2', 'Blend', { mode: 'max' }],
  ['pal', 'Palette', { colors: ['#145a2a', '#35c96a', '#a8ffc0', '#ffffff'], cutoff: .06 }],
  fade(15, 9), OUT,
], [['cross', 'b1', 0], ['ring', 'b1', 1], ['b1', 'b2', 0], ['rise', 'b2', 1], ['b2', 'pal'], ['pal', 'fade'], ['fade', 'out']]);

/* 화면에서 이펙트 크기 배율(game.scale): 캐릭터가 커진 만큼 이펙트가 화면을 덮지 않게 */
const GAME_SCALE = { hit: 0.5, slash: 0.75, shockwave: 0.75, buff: 0.65, lightning: 0.8, fire: 0.75, heal: 0.6 };
for (const [k, v] of Object.entries(GAME_SCALE)) G[k].game.scale = v;
fs.mkdirSync(dir, { recursive: true });
for (const [name, g] of Object.entries(G)) {
  const r = FX.render(g), alpha = r.data.map(d => { let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  const msg = (r.warnings.length ? ' ⚠ 미지원:' + r.warnings : '') + (alpha[alpha.length - 1] ? ' ⚠ 마지막 프레임이 투명하지 않음' : '') + (Math.max(...alpha) === 0 ? ' ⚠ 전부 비어 있음' : '');
  fs.writeFileSync(path.join(dir, name + '.pxf.json'), JSON.stringify(g, null, 1));
  console.log(name.padEnd(10), 'px/frame', alpha.join(','), msg);
}
