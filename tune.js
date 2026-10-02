// 밸런스 튜너: node tune.js  (TUNE 값 조합별로 봇을 여러 번 돌려 지표를 비교)
const C = require('./core.js');

function runBot(maxRuns) {
  const s = C.newSave();
  let runs = 0, earlyWipes = 0, wipes = 0, early = 0;
  const buyCons = () => { for (const k of ['potion', 'antidote']) { while ((s.cons[k] || 0) < 3 && s.gold > 200) { s.gold -= C.CONS[k].price; s.cons[k] = (s.cons[k] || 0) + 1; } } };
  const hireAll = () => { for (const u of s.units) { if (!u.hired && s.gold > C.hireCost(u) + 300) C.hireUnit(s, u); } };
  const shop = () => { const tmax = Math.min(3, 1 + Math.floor(s.maxFloor / 10)); for (const i of Object.values(C.ITEMS)) { if (i.legend || i.gen || i.tier > tmax || !s.units.some(u => u.hired && C.canUse(u, i))) continue; if (s.gold > i.price + 400 && !s.gear.includes(i.id) && Math.random() < 0.3) { s.gold -= i.price; s.gear.push(i.id); } } };
  while (!s.cleared && runs < maxRuns) {
    runs++; hireAll(); shop(); if (s.food < 40) C.buyFood(s, Math.min(40 - Math.floor(s.food), Math.floor(s.gold / 6))); C.autoEquip(s); C.autoFormation(s); buyCons();
    const e = C.createExpedition(s, Math.max(1, s.maxFloor - (runs % 3)));
    let t = 0; while (!e.done && t < 30000) { C.stepExpedition(e, 0.1); e.events = []; t++; }
    if (e.result === 'wipe') { wipes++; if (e.reached <= 10) earlyWipes++; }
    if (s.maxFloor <= 10) early++;
  }
  const lv = s.units.filter(u => u.hired).map(u => u.lv).sort((a, b) => b - a).slice(0, 4);
  return { runs, cleared: s.cleared, wipes, earlyWipes, earlyRuns: early, topLv: lv[0] };
}

function evalTune(over, trials) {
  Object.assign(C.TUNE, over);
  const r = [];
  for (let i = 0; i < trials; i++) r.push(runBot(300));
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return { over, medRuns: med(r.map(x => x.runs)), maxRuns: Math.max(...r.map(x => x.runs)), clearRate: r.filter(x => x.cleared).length / trials, wipes: med(r.map(x => x.wipes)), earlyWipes: med(r.map(x => x.earlyWipes)), earlyRuns: med(r.map(x => x.earlyRuns)), topLv: med(r.map(x => x.topLv)) };
}

if (require.main === module) {
  const base = Object.assign({}, C.TUNE);
  const grid = [];
  for (const expScale of [1, 1.6, 2.4]) for (const eAtk of [0.2, 0.3, 0.45]) grid.push({ expScale, eAtk });
  for (const g of grid) { Object.assign(C.TUNE, base); const r = evalTune(g, 6); console.log(JSON.stringify(r.over), 'med', r.medRuns, 'max', r.maxRuns, 'clr', r.clearRate, 'wipes', r.wipes, 'early', r.earlyWipes + '/' + r.earlyRuns, 'lv', r.topLv); }
}
module.exports = { runBot, evalTune };
