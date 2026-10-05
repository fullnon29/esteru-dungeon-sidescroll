'use strict';
/* AI 가 만든 "여러 동작이 줄마다 늘어선 시트"(평평한 회색 배경)를 게임용 전용 시트로 자른다.
 * 사용: node tools/slice_sheet.js 입력.png 설정.json
 * 설정 예: { "key":"warrior", "out":"assets/side/anim/warrior", "cell":256, "foot":0.8, "targetH":150,
 *            "rows":[{"act":"walk","n":9},{"act":"atk","n":8},{"act":"die","n":3},{"act":"heavy","n":9}],
 *            "idle":{"from":"walk","frame":0,"n":6,"bob":0.012} }
 * 처리: 배경색(테두리 중앙값)을 지우고(가장자리에서 이어진 영역만 → 갑옷 속 회색은 보존), 발밑 가로선을 지우고, 줄별로 프레임을 나눠
 *       발바닥 기준선(줄의 지면선)·다리 중심에 맞춰 같은 배율로 256 칸에 놓는다. 결과는 동작별 가로 스트립 PNG. */
const fs = require('fs'), path = require('path'), PNG = require('./lib_png.js');
const [, , inFile, cfgFile] = process.argv; if (!inFile || !cfgFile) { console.log('사용: node tools/slice_sheet.js 입력.png 설정.json'); process.exit(1); }
const cfg = Object.assign({ cell: 256, foot: 0.8, targetH: 150, tolBg: 28, margin: 8, footGap: 8 }, JSON.parse(fs.readFileSync(cfgFile, 'utf8')));
const img = PNG.read(inFile), W = img.w, H = img.h, D = img.data, N = W * H;
const med = c => { const a = []; for (let x = 0; x < W; x += 5) { a.push(D[x * 4 + c], D[((H - 1) * W + x) * 4 + c]); } for (let y = 0; y < H; y += 5) { a.push(D[y * W * 4 + c], D[(y * W + W - 1) * 4 + c]); } a.sort((x, y) => x - y); return a[a.length >> 1]; };
const BG = [med(0), med(1), med(2)], dist = i => Math.max(Math.abs(D[i * 4] - BG[0]), Math.abs(D[i * 4 + 1] - BG[1]), Math.abs(D[i * 4 + 2] - BG[2]));
const fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = dist(i) > cfg.tolBg ? 1 : 0;

/* 1) 행 구간(전경이 있는 가로 띠) */
const rowCnt = new Int32Array(H); for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += fg[y * W + x]; rowCnt[y] = n; }
const bands = []; { let s = -1; for (let y = 0; y < H; y++) { if (rowCnt[y] > 3) { if (s < 0) s = y; } else if (s >= 0) { if (y - s > 4) bands.push([s, y - 1]); s = -1; } } if (s >= 0) bands.push([s, H - 1]); }
if (bands.length !== cfg.rows.length) { console.error(`줄 수 불일치: 시트에서 ${bands.length}줄을 찾았고 설정은 ${cfg.rows.length}줄. 감지된 줄: ` + JSON.stringify(bands)); process.exit(2); }

/* 2) 발밑 가로선(지면선) 찾기·지우기: 세로 두께가 얇고 가로로 긴 전경 */
const vrun = new Int32Array(N), hrun = new Int32Array(N);
for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!fg[y * W + x]) { y++; continue; } let e = y; while (e < H && fg[e * W + x]) e++; for (let k = y; k < e; k++) vrun[k * W + x] = e - y; y = e; } }
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!fg[y * W + x]) { x++; continue; } let e = x; while (e < W && fg[y * W + e]) e++; for (let k = x; k < e; k++) hrun[y * W + k] = e - x; x = e; } }
const lineY = bands.map(([a, b]) => { let best = a, bn = -1; for (let y = a; y <= b; y++) { let n = 0; for (let x = 0; x < W; x++) if (fg[y * W + x] && vrun[y * W + x] <= 3 && hrun[y * W + x] >= 40) n++; if (n > bn) { bn = n; best = y; } } return best; });
for (let i = 0; i < N; i++) if (fg[i] && vrun[i] <= 3 && hrun[i] >= 40) fg[i] = 0;

/* 3) 가장자리에서 이어진 배경만 배경으로 (속이 회색인 갑옷은 살린다) */
const bgReach = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0; const push = i => { if (!bgReach[i] && !fg[i]) { bgReach[i] = 1; q[qt++] = i; } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
/* 알파: 배경과 이어지지 않은 곳 = 1, 경계 한 겹은 배경색과의 차이로 부드럽게, 배경에서 섞인 색은 되돌려(디프린지) */
const alpha = new Float32Array(N), rgb = new Float32Array(N * 3);
for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; let a;
  if (bgReach[i]) { let nearSubject = false; for (let dy = -1; dy <= 1 && !nearSubject; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !bgReach[yy * W + xx]) { nearSubject = true; break; } } a = nearSubject ? Math.min(1, Math.max(0, (dist(i) - 6) / (cfg.tolBg - 6))) : 0; } else a = 1;
  alpha[i] = a; for (let c = 0; c < 3; c++) { let v = D[i * 4 + c]; if (a > 0 && a < 1) v = BG[c] + (v - BG[c]) / a; rgb[i * 3 + c] = Math.max(0, Math.min(255, v)); } }

/* 4) 줄마다 프레임 나누기: 발 위치(밑 22% 띠의 가로 덩어리)로 프레임 수만큼 묶고, 연결된 덩어리(망토·칼끝 포함)는 발이 같은 프레임에 소속.
 *    두 프레임이 맞닿은 덩어리는 발 중심 사이의 가운데에서 가른다. owner[i] = 프레임 번호(줄 안에서). */
const owner = new Int16Array(N).fill(-1);
function split(band, n, rowIdx, cuts) {
  const [a, b] = band, bh = b - a + 1, zoneY = b - Math.round(bh * 0.22);
  const colCnt = new Int32Array(W); for (let x = 0; x < W; x++) { let c = 0; for (let y = zoneY; y <= b; y++) if (alpha[y * W + x] > 0.4) c++; colCnt[x] = c; }
  let cl = []; { let st = -1, last = -100; for (let x = 0; x < W; x++) { if (colCnt[x] > 0) { if (st < 0) st = x; last = x; } else if (st >= 0 && x - last > cfg.footGap) { cl.push([st, last]); st = -1; } } if (st >= 0) cl.push([st, last]); }
  cl = cl.filter(c => { let n2 = 0; for (let x = c[0]; x <= c[1]; x++) n2 += colCnt[x]; return n2 >= 12; });
  { /* 질량이 아주 작은 조각(칼끝·파편)을 먼저 버린다 — 프레임 수보다 많을 때만 */
    const mass = c => { let t = 0; for (let x = c[0]; x <= c[1]; x++) t += colCnt[x]; return t; };
    while (cl.length > n) { const ms = cl.map(mass), sorted = ms.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1], mi = ms.indexOf(Math.min(...ms)); if (ms[mi] < med * 0.3) cl.splice(mi, 1); else break; } }
  while (cl.length > n) { let bi = 0, bg = 1e9; for (let i = 0; i < cl.length - 1; i++) { const g = cl[i + 1][0] - cl[i][1]; if (g < bg) { bg = g; bi = i; } } cl.splice(bi, 2, [cl[bi][0], cl[bi + 1][1]]); }
  if (cuts && cuts.length === n - 1) { /* 설정에서 준 프레임 경계(가로 x 좌표)가 있으면 그대로 쓴다 */ const e = [0, ...cuts, W]; cl = Array.from({ length: n }, (_, i) => [e[i], e[i + 1] - 1]); }
  let equal = false; if (cl.length < n) { equal = true; console.warn(`  ⚠ 줄 ${rowIdx + 1}: 발 덩어리 ${cl.length}개 < ${n} → 균등 분할`); const x0 = cl.length ? cl[0][0] : 0, x1 = cl.length ? cl[cl.length - 1][1] : W - 1, wd = (x1 - x0 + 1) / n; cl = Array.from({ length: n }, (_, i) => [Math.round(x0 + wd * i), Math.round(x0 + wd * (i + 1)) - 1]); }
  if (process.env.SLICE_DEBUG) console.log("  clusters row " + (rowIdx + 1) + ":", JSON.stringify(cl));
  const fc = cl.map(c => { let sx = 0, sn = 0; for (let x = c[0]; x <= c[1]; x++) { sx += x * colCnt[x]; sn += colCnt[x]; } return sn ? sx / sn : (c[0] + c[1]) / 2; });
  /* 연결 덩어리 라벨링(8방향) */
  const lab = new Int32Array(W * bh).fill(-1), comps = [], stack = []; 
  for (let y = a; y <= b; y++) for (let x = 0; x < W; x++) { const i0 = (y - a) * W + x; if (lab[i0] >= 0 || alpha[y * W + x] <= 0.4) continue; const id = comps.length, comp = { px: [], foot: new Int32Array(n), x0: x, x1: x }; stack.length = 0; stack.push(y * W + x); lab[i0] = id;
    while (stack.length) { const i = stack.pop(), xx = i % W, yy = (i / W) | 0; comp.px.push(i); if (xx < comp.x0) comp.x0 = xx; if (xx > comp.x1) comp.x1 = xx; if (yy >= zoneY) for (let k = 0; k < n; k++) if (xx >= cl[k][0] && xx <= cl[k][1]) comp.foot[k]++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < a || nx >= W || ny > b) continue; const j0 = (ny - a) * W + nx; if (lab[j0] >= 0 || alpha[ny * W + nx] <= 0.4) continue; lab[j0] = id; stack.push(ny * W + nx); } } comps.push(comp); }
  const nearest = (x) => { let bk = 0, bd = 1e9; for (let k = 0; k < n; k++) { const d = Math.abs(x - fc[k]); if (d < bd) { bd = d; bk = k; } } return bk; };
  for (const comp of comps) { const withFoot = []; for (let k = 0; k < n; k++) if (comp.foot[k] > 4) withFoot.push(k);
    if (withFoot.length === 1) { for (const i of comp.px) owner[i] = withFoot[0]; }
    else if (withFoot.length > 1) { for (const i of comp.px) { const x = i % W; let bk = withFoot[0], bd = 1e9; for (const k of withFoot) { const d = Math.abs(x - fc[k]); if (d < bd) { bd = d; bk = k; } } owner[i] = bk; } }
    else { /* 발이 없는 조각: 가장 가까운 프레임에 붙인다(칼끝·망토 조각) */ let bk = 0, bd = 1e9; for (let k = 0; k < n; k++) { const d = Math.max(cl[k][0] - comp.x1, comp.x0 - cl[k][1], 0) + Math.abs((comp.x0 + comp.x1) / 2 - fc[k]) * 0.001; if (d < bd) { bd = d; bk = k; } } for (const i of comp.px) owner[i] = bk; } }
  /* 반투명 가장자리 픽셀도 이웃 소속을 따른다(2번 번짐) */
  for (let it = 0; it < 2; it++) { const upd = []; for (let y = a; y <= b; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (owner[i] >= 0 || alpha[i] <= 0) continue; let o = -1; for (let dy = -1; dy <= 1 && o < 0; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < a || nx >= W || ny > b) continue; const ow = owner[ny * W + nx]; if (ow >= 0) { o = ow; break; } } if (o >= 0) upd.push(i, o); } for (let u = 0; u < upd.length; u += 2) owner[upd[u]] = upd[u + 1]; }
  return fc.map((c, k) => ({ k, fc: c }));
}
const frames = []; /* {act, i, x0,x1,y0,y1, cx, ground, id, row} */
cfg.rows.forEach((row, r) => { const band = bands[r], segs = split(band, row.n, r, row.cuts); segs.forEach((sg, i) => { const id = r * 100 + i; let y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1; for (let y = band[0]; y <= band[1]; y++) for (let x = 0; x < W; x++) { const ix = y * W + x; if (owner[ix] === i && alpha[ix] > 0.4) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; } }
  const ground = Math.max(y1, lineY[r] - 1);
  let sx = 0, sn = 0; for (let y = Math.max(y0, y1 - Math.round((y1 - y0) * 0.3)); y <= y1; y++) for (let x = x0; x <= x1; x++) if (owner[y * W + x] === i && alpha[y * W + x] > 0.4) { sx += x; sn++; } /* 다리 중심 */
  frames.push({ act: row.act, i, x0, x1, y0, y1, cx: sn ? sx / sn : sg.fc, ground: Math.min(ground, y1 + 3), row: r, id, rowIdx: r }); }); console.log(`${row.act}: ${segs.length}프레임 (줄 ${band[0]}~${band[1]}, 지면선 y=${lineY[r]})`); });

/* 5) 같은 배율로 칸에 배치 (서 있는 첫 줄의 키 → targetH, 가장 넓은 프레임도 칸 안에 들어오게 제한) */
const C = cfg.cell, footY = Math.round(C * cfg.foot), half = C / 2 - cfg.margin;
const standH = (() => { const hs = frames.filter(f => f.row === 0).map(f => f.y1 - f.y0 + 1).sort((a, b) => a - b); return hs[hs.length >> 1]; })();
let extent = 0; for (const f of frames) extent = Math.max(extent, f.cx - f.x0, f.x1 - f.cx);
const sc = Math.min(cfg.targetH / standH, half / extent), headRoom = frames.reduce((m, f) => Math.max(m, f.ground - f.y0), 0) * sc;
console.log(`기준 키 ${standH}px → 배율 ${sc.toFixed(3)} (가로 한계 ${(half / extent).toFixed(3)}, 키 한계 ${(footY - cfg.margin) / (headRoom / sc || 1) | 0}); 가장 높은 프레임 ${Math.round(headRoom)}px / 허용 ${footY - cfg.margin}px`);
const scale2 = Math.min(sc, (footY - cfg.margin) / (headRoom / sc)), S = scale2;
function render(f, vs) { /* 한 프레임을 C×C RGBA 로. vs = 세로 배율 보정(숨쉬기) */
  const out = Buffer.alloc(C * C * 4); const ss = 2; /* 2×2 슈퍼샘플 */
  for (let oy = 0; oy < C; oy++) for (let ox = 0; ox < C; ox++) { let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) { const px = f.cx + (ox + (sx + .5) / ss - C / 2) / S, py = f.ground + (oy + (sy + .5) / ss - footY) / (S * (vs || 1)); const ix = Math.floor(px), iy = Math.floor(py); if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue; const i = iy * W + ix, a = alpha[i]; if (a <= 0) continue; /* 프레임 밖 이웃 침범 방지 */ if (owner[i] !== f.i || iy < bands[f.row][0] || iy > bands[f.row][1]) continue; /* 다른 프레임 소속 픽셀 제외 */ ar += rgb[i * 3] * a; ag += rgb[i * 3 + 1] * a; ab += rgb[i * 3 + 2] * a; aa += a; }
    const o = (oy * C + ox) * 4; if (aa > 0) { out[o] = Math.round(ar / aa); out[o + 1] = Math.round(ag / aa); out[o + 2] = Math.round(ab / aa); out[o + 3] = Math.round(aa / (ss * ss) * 255); } }
  return out; }
function strip(list) { const w = C * list.length, buf = Buffer.alloc(w * C * 4); list.forEach((fr, k) => { for (let y = 0; y < C; y++) fr.copy(buf, (y * w + k * C) * 4, y * C * 4, (y + 1) * C * 4); }); return { w, h: C, data: buf }; }
const outDir = path.resolve(cfg.out || `assets/side/anim/${cfg.key}`); fs.mkdirSync(outDir, { recursive: true });
const byAct = {}; for (const f of frames) (byAct[f.act] = byAct[f.act] || []).push(f);
for (const act of Object.keys(byAct)) { const list = byAct[act].map(f => render(f, 1)); PNG.write(path.join(outDir, act + '_0.png'), strip(list)); console.log('저장', act + '_0.png', list.length + '프레임'); }
if (cfg.idle && byAct[cfg.idle.from]) { const base = byAct[cfg.idle.from][cfg.idle.frame || 0], n = cfg.idle.n || 6, bob = cfg.idle.bob || 0.012, list = []; for (let k = 0; k < n; k++) list.push(render(base, 1 + bob * Math.sin(k / n * Math.PI * 2))); PNG.write(path.join(outDir, 'idle_0.png'), strip(list)); console.log('저장 idle_0.png', n + '프레임 (' + cfg.idle.from + ' ' + (cfg.idle.frame || 0) + '번을 숨쉬는 흉내)'); }
