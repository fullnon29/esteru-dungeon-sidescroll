// 밸런스 봇 1회 실행: node sim_test.js  (클리어까지 회차가 정상 범위인지 확인 — 봇 로직은 bot.js)
const { runBot } = require('./bot.js');
const start = Date.now();
const r = runBot({ verbose: true });
console.log('cleared', r.cleared, 'runs', r.runs, 'ms', Date.now() - start, '| 제작', r.crafts, '전직', r.promoted, '분대 가동', r.squadRuns, '요리사', r.cookRuns);
