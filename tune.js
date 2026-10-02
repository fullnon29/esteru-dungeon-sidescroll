// 밸런스 튜너: node tune.js  (TUNE 값 조합별로 봇을 여러 번 돌려 지표를 비교 — 봇 로직은 bot.js)
const C = require('./core.js');
const { runBot: botRun } = require('./bot.js');

function runBot(maxRuns) {
  const r = botRun({ maxRuns });
  return { runs: r.runs, cleared: r.cleared, wipes: r.wipes, earlyWipes: r.earlyWipes, earlyRuns: r.earlyRuns, topLv: r.topLv };
}

function evalTune(over, trials) {
  Object.assign(C.TUNE, over);
  const r = [];
  for (let i = 0; i < trials; i++) r.push(runBot(400));
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return { over, medRuns: med(r.map(x => x.runs)), maxRuns: Math.max(...r.map(x => x.runs)), clearRate: r.filter(x => x.cleared).length / trials, wipes: med(r.map(x => x.wipes)), earlyWipes: med(r.map(x => x.earlyWipes)), earlyRuns: med(r.map(x => x.earlyRuns)), topLv: med(r.map(x => x.topLv)) };
}

if (require.main === module) {
  const base = Object.assign({}, C.TUNE);
  const grid = [];
  for (const expScale of [1, 0.8, 0.6]) for (const eAtk of [0.12, 0.09, 0.06]) grid.push({ expScale, eAtk });
  for (const g of grid) { Object.assign(C.TUNE, base); const r = evalTune(g, 6); console.log(JSON.stringify(r.over), 'med', r.medRuns, 'max', r.maxRuns, 'clr', r.clearRate, 'wipes', r.wipes, 'early', r.earlyWipes + '/' + r.earlyRuns, 'lv', r.topLv); }
}
module.exports = { runBot, evalTune };
