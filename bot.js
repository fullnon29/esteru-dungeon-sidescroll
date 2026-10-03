'use strict';
/* 밸런스 봇: 플레이어처럼 신규 시스템(제작·전직·분대·조합·요리사 보급·피로 로테이션)을 쓰며 50층 클리어까지 원정을 반복한다.
   node bot.js [시행횟수] [--compare]   — 중앙값 클리어 회차/기능 사용량 출력. --compare 는 기능별(제작·전직·분대·조합) 끈 결과와 비교. */
const C = require('./core.js');

const HIRE_PRIO = ['priest', 'thief', 'cook', 'knight', 'warrior', 'elf', 'monk', 'mage'];
const SQUAD_PRIO = ['cheer', 'guardian', 'sniper', 'disrupt', 'battery'];

function runBot(opts) {
  opts = Object.assign({ maxRuns: 3000, verbose: false, craft: true, promo: true, squad: true, combo: true }, opts || {});
  const s = C.newSave(); s.policy.retreat = 25;
  const st = { newTicks: 0, oldTicks: 0, crafts: 0, promos: 0, squadRuns: 0, squadSum: 0, wipes: 0, earlyWipes: 0, earlyRuns: 0, cookRuns: 0 };
  const crafted = new Set();
  let runs = 0;

  const buyCons = () => { for (const k of ['potion', 'antidote']) while ((s.cons[k] || 0) < 3 && s.gold > 200) { s.gold -= C.CONS[k].price; s.cons[k] = (s.cons[k] || 0) + 1; } };
  // 주점: 지금 나타난 후보 중에서만 고용(전설은 확률·실패 시 비용 손실). 원정에서 돌아올 때마다 후보가 바뀐다.
  const hirePass = () => {
    const rank = u => (HIRE_PRIO.indexOf(C.baseCls(u)) + 1 || 9) * 10 - C.RAR_ORDER.indexOf(u.rar || 'N');
    for (const u of C.tavCands(s).sort((a, b) => rank(a) - rank(b))) {
      for (let tries = 0; tries < 6 && s.gold > C.hireCost(u) + 500 && !u.hired && !u.left; tries++) { const r = C.tavernHire(s, u.id); if (r.ok || r.err) break; }
    }
  };
  const shop = () => {
    const tmax = Math.min(3, 1 + Math.floor(s.maxFloor / 10));
    for (const i of Object.values(C.ITEMS)) {
      if (i.legend || i.gen || i.craft || i.tier > tmax || !s.units.some(u => u.hired && C.canUse(u, i))) continue;
      if (s.gold > i.price + 400 && !s.gear.includes(i.id) && Math.random() < 0.3) { s.gold -= i.price; s.gear.push(i.id); }
    }
  };
  const equippedBases = () => { const o = new Set(); s.units.forEach(u => Object.values(u.equip).forEach(id => { if (id) o.add(id); })); s.gear.forEach(id => o.add(id)); return o; };
  const craftPass = () => {
    for (const base of C.craftBases()) {
      if (!s.bps[base] || !s.units.some(u => u.hired && C.canUse(u, C.ITEMS[base]))) continue;
      for (const g of ['L', 'H', 'N']) {
        const key = base + g; if (crafted.has(key) || (g === 'N' && !C.ITEMS[base].craft)) continue;
        if (s.gold < 1500 + 3 * C.recipeOf(base, g).gold) continue; // 골드 여유가 있을 때만
        if (!C.canCraft(s, base, g)) { C.craft(s, base, g); crafted.add(key); st.crafts++; break; }
      }
    }
  };
  const promoPass = () => {
    if (!s.promo && s.gold > C.PROMO_PRICE + 4000) C.buyPromo(s);
    while (s.promo > 0) {
      const u = s.units.filter(x => x.hired && C.canPromote(x)).sort((a, b) => b.lv - a.lv)[0]; if (!u) break;
      if (C.promote(s, u)) break; st.promos++;
    }
  };

  // 편성: (A) 레벨 우선 자동 편성 vs (B) 역할 우선(리더·도적·승려·요리사 먼저) 중 전투력 점수가 높은 쪽
  const placeOrder = (order) => {
    s.formation = {}; const xs = [4, 3, 5, 2, 6, 1, 7, 0, 8];
    for (const u of order) {
      const row = C.CLASSES[u.cls].row, ys = row === 'front' ? [5, 6] : row === 'back' ? [8, 7] : [7, 8]; let done = false;
      for (const y of ys) { for (const x of xs) { if (!C.unitAt(s, x, y) && !C.place(s, u, x, y)) { done = true; break; } } if (done) break; }
    }
  };
  const power = () => { const pt = s.units.filter(u => u.hired && s.formation[u.id]); const cb = opts.combo ? C.comboOf(pt) : { all: 1, def: 1, dup: false };
    let p = 0; for (const u of pt) { const x = C.stats(u); p += x.atk + x.def * 0.7 + x.hp * 0.15; } return p * (cb.dup ? 1 : cb.all) * (cb.dup ? 1 : (1 + (cb.def - 1) * 0.3)); };
  const formParty = () => {
    const ok = u => u.hired && C.canSortie(u) && !C.inSquad(s, u), pool = s.units.filter(ok);
    const rested = u => C.fatOf(u) >= 50 ? 0 : 1, byLv = (a, b) => rested(a) - rested(b) || b.lv - a.lv || C.costOf(a) - C.costOf(b);
    const A = pool.slice().sort(byLv); const ld = pool.filter(C.canLead).sort(byLv)[0]; if (ld) A.sort((a, b) => (b === ld) - (a === ld));
    const B = []; const take = u => { if (u && !B.includes(u)) B.push(u); };
    take(ld); for (const cls of ['thief', 'priest', 'cook']) take(pool.filter(u => C.baseCls(u) === cls).sort(byLv)[0]); pool.slice().sort(byLv).forEach(take);
    placeOrder(A); const pa = power(), fa = Object.assign({}, s.formation); placeOrder(B); const pb = power();
    if (pa >= pb) s.formation = fa;
    const placed = s.units.filter(u => s.formation[u.id]); const lead = placed.filter(C.canLead).sort(byLv)[0] || placed[0]; if (lead) s.policy.leader = lead.id;
  };
  const squadPass = () => {
    (s.squads || []).forEach((_, i) => C.setSquad(s, i, null));
    if (!opts.squad) return;
    for (let i = 0; i < C.squadSlots(s); i++) {
      for (const type of SQUAD_PRIO) {
        if (C.squadUsed(s) + C.SQUADS[type].cost > C.squadCap(s) || C.activeSquads(s).some(q => q.type === type)) continue;
        const used = [], picks = C.SQUADS[type].req.map(r => { const u = s.units.filter(x => x.hired && C.baseCls(x) === r && C.canSortie(x) && !s.formation[x.id] && !C.inSquad(s, x) && !used.includes(x.id)).sort((a, b) => b.lv - a.lv)[0]; if (u) used.push(u.id); return u; });
        if (picks.some(x => !x)) continue;
        C.setSquad(s, i, type); picks.forEach((u, p) => C.assignSquad(s, i, p, u.id)); break;
      }
    }
  };

  while (!s.cleared && runs < opts.maxRuns) {
    runs++;
    hirePass(); shop(); if (opts.craft) craftPass(); if (opts.promo) promoPass();
    C.autoEquip(s, { idle: true }); C.sellAllGear(s, C.SELL_RATE.shop); formParty(); squadPass(); // 남은 장비는 판매
    // 급료는 편성 확정 후 지불, 요리사가 있으면 자동 보급 / 없으면 40개까지 보충
    const wage = C.sortieWage(s); if (s.gold < wage) { s.gold += wage; } // 파산 방지(봇 전용)
    s.gold -= wage;
    const sp = C.supplyPlan(s); if (sp) { if (sp.buy > 0) C.buyFood(s, sp.buy); st.cookRuns++; } else if (s.food < 40) C.buyFood(s, Math.min(40 - Math.floor(s.food), Math.floor(s.gold / 6)));
    buyCons();
    const prevMax = s.maxFloor; // 신규 층 판정: 이번 원정 이전 최고 층보다 깊은 층
    const e = C.createExpedition(s, C.defaultStart(s)); // 1층 또는 열린 지름길(11·21·31·41층) 중 가장 깊은 곳에서 시작
    e.autoResolve = true; // 이벤트(행상인·뽑기·의뢰)는 봇이 자동 처리
    st.squadSum += e.squads.length; if (e.squads.length) st.squadRuns++;
    let t = 0; while (!e.done && t < 30000) { C.stepExpedition(e, 0.1); e.events = []; t++; if (e.floor > prevMax) st.newTicks++; else st.oldTicks++; }
    if (e.result === 'wipe') { st.wipes++; if (e.reached <= 10) st.earlyWipes++; }
    if (s.maxFloor <= 10) st.earlyRuns++;
    if (opts.verbose && (runs % 10 === 0 || s.cleared)) console.log('run', runs, 'result', e.result, 'floor', e.reached, 'max', s.maxFloor, 'gold', s.gold, 'food', Math.floor(s.food), 'squads', e.squads.map(q => q.type).join('/') || '-', 'lvs', s.units.filter(u => u.hired).map(u => u.lv).join(','));
  }
  const top = s.units.filter(u => u.hired).map(u => u.lv).sort((a, b) => b - a)[0];
  // 예상 플레이 시간(시간): 출시 규칙(기본 4배속, 신규 층 2배속 제한) + 캠프 정비 시간(회차당 CAMP_SEC초)
  const pace = C.TUNE.pace || 1, hours = ((st.newTicks * 0.1 / 2 + st.oldTicks * 0.1 / 4) * pace + runs * (opts.campSec || 120)) / 3600;
  return Object.assign({ hours, runs, cleared: s.cleared, topLv: top, units: s.units.filter(u => u.hired).length, promoted: s.units.filter(u => C.CLASSES[u.cls].promo).length }, st);
}

const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
function summarize(label, rs) {
  const fh = med(rs.map(r => r.hours)).toFixed(1);
  const f = k => med(rs.map(r => r[k]));
  console.log(`${label.padEnd(14)} 클리어 ${rs.filter(r => r.cleared).length}/${rs.length} · 회차 중앙 ${f('runs')} (최소 ${Math.min(...rs.map(r => r.runs))}~최대 ${Math.max(...rs.map(r => r.runs))}) · 예상 ${fh}시간 · 제작 ${f('crafts')} · 전직 ${f('promoted')} · 분대 가동 ${f('squadRuns')}회 · 요리사 동행 ${f('cookRuns')}회 · 전멸 ${f('wipes')} · 고용 ${f('units')}명`);
}
if (require.main === module) {
  const args = process.argv.slice(2), n = +args.find(a => /^\d+$/.test(a)) || 5;
  const trial = o => Array.from({ length: n }, () => runBot(o));
  summarize('전체 기능', trial({}));
  if (args.includes('--compare')) {
    summarize('제작 끔', trial({ craft: false })); summarize('전직 끔', trial({ promo: false })); summarize('분대 끔', trial({ squad: false })); summarize('조합 무시', trial({ combo: false }));
    summarize('모두 끔', trial({ craft: false, promo: false, squad: false, combo: false }));
  }
}
module.exports = { runBot, summarize };
