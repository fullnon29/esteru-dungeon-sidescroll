// 맵 검증: node map_test.js
//  - 500층 분량 생성: 잠긴 문 없이 계단 도달 가능, 보스층에 보스 존재, 층 깊이별 크기, 생성 시간
//  - 보스층 고정맵: 같은 층을 두 번 만들면 배치가 완전히 같고, 일반 층은 다르다
//  - 평균 탐사 틱(강한 파티, 이벤트 자동 처리)
const C = require('./core.js'); let bad = 0, vaults = 0;
const t0 = Date.now(), sizes = {};
for (let i = 0; i < 500; i++) {
  const f = 1 + i % 50, m = C.genFloor(f), W = m.w, H = m.h; sizes[f] = W + 'x' + H;
  const q = [[m.start.x, m.start.y]], seen = new Set([m.start.y * W + m.start.x]);
  for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const t = m.grid[ny][nx]; if (t === 0 || t === 4 || seen.has(ny * W + nx)) continue; seen.add(ny * W + nx); q.push([nx, ny]); } }
  if (!seen.has(m.stairs.y * W + m.stairs.x)) bad++;
  vaults += m.vaults.length; if (f % 5 === 0 && !m.groups.some(g => g.boss)) bad++;
}
console.log('bad', bad, 'vaults', vaults, '| 500층 생성', Date.now() - t0, 'ms | 크기 1층', sizes[1], '25층', sizes[25], '50층', sizes[50]);
const sig = m => JSON.stringify([m.w, m.h, m.grid, m.chests.map(c => [c.x, c.y]), m.groups.map(g => [g.x, g.y, g.tpls.join()])]);
const b1 = sig(C.genFloor(10)), b2 = sig(C.genFloor(10)), n1 = sig(C.genFloor(12)), n2 = sig(C.genFloor(12));
console.log('보스층(10) 고정맵 동일:', b1 === b2, '| 일반층(12) 매번 다름:', n1 !== n2);
const s = C.newSave(); let steps = 0;
for (let f = 1; f <= 20; f++) { s.maxFloor = f; s.units.forEach(u => { u.lv = 40; u.hp = C.stats(u).hp; }); const e = C.createExpedition(s, f); e.autoResolve = true; const f0 = e.floor; let n = 0; while (!e.done && e.floor === f0 && n < 20000) { C.stepExpedition(e, 0.14); e.events = []; n++; } steps += n; }
console.log('avg ticks/floor', steps / 20);
