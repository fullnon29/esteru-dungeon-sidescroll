'use strict';
/* 게임 로직 (DOM 비의존). 브라우저에서는 window.Core, Node에서는 module.exports */
const Core = (function () {
  const GRID = 9, FRONT_Y = [5, 6], BACK_Y = [7, 8], MAXF = 50, MAXLV = 50;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- 직업 ---------- */
  // row: 'front' 전열(y5-6) / 'back' 후열(y7-8) / 'any'
  const CLASSES = {
    warrior: { hpGrow: 1.2, name: '전사', icon: '⚔️', cost: 3, hp: 110, atk: 16, def: 6, spd: 10, range: 1, hire: 200, color: '#c0563b', row: 'front', eva: 0 },
    knight:  { hpGrow: 1.2, name: '기사', icon: '🛡️', cost: 4, hp: 160, atk: 12, def: 12, spd: 7, range: 1, hire: 260, color: '#6b7fa8', row: 'front', eva: 0 },
    monk:    { hpGrow: 1.1, name: '무투가', icon: '👊', cost: 3, hp: 100, atk: 13, def: 5, spd: 13, range: 1, hire: 220, color: '#c98b2e', row: 'front', eva: 0.05 },
    elf:     { hpGrow: 1.0, name: '엘프', icon: '🧝', cost: 3, hp: 80, atk: 15, def: 3, spd: 14, range: 1, hire: 240, color: '#4f9d5d', row: 'any', eva: 0.08 },
    mage:    { hpGrow: 0.8, name: '마술사', icon: '🔮', cost: 4, hp: 70, atk: 20, def: 2, spd: 9, range: 3, hire: 280, color: '#8a5cc8', row: 'back', eva: 0 },
    priest:  { hpGrow: 0.8, name: '승려', icon: '✨', cost: 4, hp: 80, atk: 8, def: 3, spd: 9, range: 3, hire: 260, color: '#d8c35a', row: 'back', eva: 0 },
    thief:   { hpGrow: 0.8, name: '도적', icon: '🗡️', cost: 2, hp: 75, atk: 12, def: 3, spd: 16, range: 1, hire: 160, color: '#5a5f6b', row: 'back', eva: 0.2 },
  };
  const ROW_TXT = { front: '전열 전용', back: '후열 전용', any: '전·후열' };

  /* ---------- 스킬 (장비 착용 시 사용 / 숙련되면 영구 습득) ---------- */
  const SKILLS = {
    power:  { name: '강타', type: 'single', mult: 1.9, uses: 4, master: 12 },
    cleave: { name: '회전베기', type: 'adjacent', mult: 1.25, uses: 3, master: 12 },
    volley: { name: '일제사격', type: 'line', mult: 1.0, range: 4, uses: 3, master: 12 },
    fire:   { name: '파이어볼', type: 'aoe', mult: 1.5, range: 4, magic: true, uses: 3, master: 12 },
    ice:    { name: '아이스 랜스', type: 'single', mult: 2.1, range: 4, magic: true, uses: 3, master: 12 },
    thunder:{ name: '번개', type: 'line', mult: 1.1, range: 5, magic: true, uses: 3, master: 12 },
    heal:   { name: '힐', type: 'heal', uses: 5, master: 10 },
    bless:  { name: '대치유', type: 'healall', uses: 2, master: 8 },
    holy:   { name: '턴 언데드', type: 'holy', mult: 2.4, range: 4, magic: true, uses: 3, master: 10 },
    antidote:{ name: '해독', type: 'cure', uses: 4, master: 8 },
    guard:  { name: '방어태세', type: 'guard', uses: 3, master: 8 },
  };

  /* ---------- 장비 ---------- */
  // slot: weapon / sub / armor / acc1 / acc2
  const SLOTS = { weapon: '무기', sub: '보조장비', armor: '갑옷', acc1: '장신구(목/투구/망토)', acc2: '장신구(반지)' };
  const ITEMS = {};
  const TIER_PRICE = [0, 100, 300, 800, 2000, 5000];
  function it(id, name, slot, tier, o) { ITEMS[id] = Object.assign({ id, name, slot, tier, price: TIER_PRICE[tier] }, o); }
  it('w_dagger', '단검', 'weapon', 1, { atk: 6, eva: 0.03 });
  it('w_sword', '한손검', 'weapon', 1, { atk: 6, skill: 'power' });
  it('w_bow', '사냥활', 'weapon', 1, { atk: 5, range: 3, skill: 'volley' });
  it('w_rod', '불꽃 지팡이', 'weapon', 2, { atk: 18, skill: 'fire' });
  it('w_mace', '성직자의 철퇴', 'weapon', 2, { atk: 14, skill: 'heal' });
  it('w_great', '양손검', 'weapon', 3, { atk: 40, skill: 'cleave' });
  it('w_lance', '장창', 'weapon', 3, { atk: 38, skill: 'power' });
  it('w_icerod', '서리의 지팡이', 'weapon', 3, { atk: 36, skill: 'ice' });
  it('w_longbow', '장궁', 'weapon', 4, { atk: 78, range: 3, skill: 'volley' });
  it('w_flame', '화염검', 'weapon', 4, { atk: 80, skill: 'fire' });
  it('w_saint', '성검 에스테르', 'weapon', 5, { atk: 140, skill: 'power' });
  it('s_buckler', '작은 방패', 'sub', 1, { def: 3 });
  it('s_shield', '대방패', 'sub', 2, { def: 10, skill: 'guard' });
  it('s_book', '마법서', 'sub', 2, { atk: 8, skill: 'thunder' });
  it('s_holybook', '성서', 'sub', 3, { def: 8, hp: 60, skill: 'holy' });
  it('s_tower', '타워 실드', 'sub', 4, { def: 40, hp: 120, skill: 'guard' });
  it('a_leather', '가죽갑옷', 'armor', 1, { def: 4, hp: 10 });
  it('a_chain', '사슬갑옷', 'armor', 2, { def: 12, hp: 40 });
  it('a_robe', '신관의 법의', 'armor', 3, { def: 16, hp: 80, skill: 'bless' });
  it('a_plate', '판금갑옷', 'armor', 3, { def: 28, hp: 100 });
  it('a_mithril', '미스릴 갑옷', 'armor', 4, { def: 55, hp: 250 });
  it('a_dragon', '용린갑옷', 'armor', 5, { def: 95, hp: 500 });
  it('c_amulet', '수호부적', 'acc1', 2, { hp: 60, def: 4 });
  it('c_helm', '강철 투구', 'acc1', 2, { def: 8, hp: 30 });
  it('c_cape', '그림자 망토', 'acc1', 4, { eva: 0.15, def: 20, spd: 3 });
  it('c_herb', '해독의 목걸이', 'acc1', 2, { hp: 30, skill: 'antidote' });
  it('r_power', '힘의 반지', 'acc2', 1, { atk: 3 });
  it('r_boots', '질풍의 반지', 'acc2', 2, { spd: 3, eva: 0.08 });
  it('r_blessr', '수호의 반지', 'acc2', 3, { hp: 100, def: 10, skill: 'bless' });
  it('r_crown', '용사의 인장', 'acc2', 5, { atk: 50, def: 40, hp: 300 });

  // 전설 장비("!"): 매 드롭마다 무작위 이름/효과
  const LEG_PRE = ['고대의', '불멸의', '저주받은', '신들의', '서리의', '폭풍의', '황혼의'];
  function makeLegend(floor) {
    const slot = pick(Object.keys(SLOTS)), t = clamp(Math.ceil(floor / 10) + 1, 2, 5);
    const k = [0, 1, 1, 3, 6, 10][t] || 3;
    const base = { weapon: ['검', '창', '지팡이', '활'], sub: ['방패', '성서'], armor: ['갑주', '로브'], acc1: ['목걸이', '망토', '투구'], acc2: ['반지'] }[slot];
    const o = { slot, tier: t, price: TIER_PRICE[t] * 2, legend: true };
    o.name = pick(LEG_PRE) + ' ' + pick(base) + '!';
    if (slot === 'weapon') o.atk = Math.round(14 * k * rnd(1.1, 1.5));
    else if (slot === 'armor' || slot === 'sub') { o.def = Math.round(8 * k * rnd(1.1, 1.5)); o.hp = Math.round(25 * k); }
    else { o.hp = Math.round(30 * k * rnd(0.8, 1.4)); o.atk = Math.round(4 * k * rnd(0.8, 1.4)); o.spd = ri(1, 4); }
    if (Math.random() < 0.7) o.skill = pick(Object.keys(SKILLS));
    o.id = 'L' + Date.now().toString(36) + ri(100, 999);
    ITEMS[o.id] = o;
    return o.id;
  }

  const CONS = {
    potion: { name: '회복약', price: 30, desc: '대상 HP 35% 회복' },
    elixir: { name: '고급 회복약', price: 120, desc: '대상 HP 80% 회복' },
    antidote: { name: '해독제', price: 25, desc: '독 해제' },
    ether: { name: '에테르', price: 150, desc: '대상의 스킬 횟수 전부 회복' },
    revive: { name: '부활의 깃털', price: 220, desc: '전투불능 → HP 50%로 부활' },
    escape: { name: '귀환의 두루마리', price: 80, desc: '즉시 귀환 (일시정지 중 사용)' },
  };

  /* ---------- 적 ---------- */
  const ENEMIES = [
    { id: 'slime', name: '슬라임', fam: '슬라임', icon: '🟢', band: 0, hp: 45, atk: 9, def: 1, spd: 8, range: 1 },
    { id: 'goblin', name: '고블린', fam: '고블린', icon: '👺', band: 0, hp: 50, atk: 11, def: 2, spd: 11, range: 1 },
    { id: 'gobarch', name: '고블린 궁수', fam: '고블린', icon: '🏹', band: 0, hp: 38, atk: 11, def: 1, spd: 10, range: 3 },
    { id: 'bat', name: '큰박쥐', fam: '짐승', icon: '🦇', band: 0, hp: 30, atk: 8, def: 1, spd: 14, range: 1, poison: 0.25 },
    { id: 'skel', name: '스켈레톤', fam: '언데드', icon: '💀', band: 1, hp: 60, atk: 14, def: 8, spd: 9, range: 1, undead: true },
    { id: 'ghost', name: '유령', fam: '언데드', icon: '👻', band: 1, hp: 55, atk: 16, def: 5, spd: 13, range: 2, magic: true, undead: true },
    { id: 'spider', name: '독거미', fam: '짐승', icon: '🕷️', band: 1, hp: 50, atk: 12, def: 3, spd: 12, range: 1, poison: 0.4 },
    { id: 'orc', name: '오크', fam: '오크', icon: '👹', band: 2, hp: 100, atk: 18, def: 10, spd: 9, range: 1 },
    { id: 'golem', name: '골렘', fam: '골렘', icon: '🗿', band: 2, hp: 180, atk: 15, def: 24, spd: 5, range: 1 },
    { id: 'shaman', name: '오크 주술사', fam: '오크', icon: '🧙', band: 2, hp: 70, atk: 20, def: 3, spd: 10, range: 3, magic: true },
    { id: 'vamp', name: '뱀파이어', fam: '언데드', icon: '🧛', band: 2, hp: 100, atk: 18, def: 12, spd: 12, range: 1, undead: true },
    { id: 'demon', name: '악마', fam: '악마', icon: '😈', band: 3, hp: 120, atk: 22, def: 14, spd: 11, range: 1 },
    { id: 'wyvern', name: '와이번', fam: '용족', icon: '🐲', band: 3, hp: 160, atk: 20, def: 20, spd: 14, range: 1 },
    { id: 'succ', name: '서큐버스', fam: '악마', icon: '💋', band: 3, hp: 90, atk: 22, def: 4, spd: 12, range: 3, magic: true },
    { id: 'dragon', name: '드래곤', fam: '용족', icon: '🐉', band: 4, hp: 240, atk: 24, def: 28, spd: 9, range: 2, magic: true },
    { id: 'dknight', name: '흑기사', fam: '악마', icon: '🥷', band: 4, hp: 180, atk: 28, def: 26, spd: 10, range: 1 },
    { id: 'lich', name: '리치', fam: '언데드', icon: '☠️', band: 4, hp: 150, atk: 26, def: 12, spd: 10, range: 3, magic: true, undead: true },
  ];
  // 황금 이벤트 몹 — 일반 풀에는 섞이지 않고, 층마다 낮은 확률로 따로 나타난다.
  const GOLDEN = [
    { id: 'ggob', name: '황금 고블린', fam: '황금', icon: '👺', hp: 260, atk: 12, def: 20, spd: 16, range: 1, golden: true, expMul: 14, goldMul: 15, minF: 2, fleeIn: 26 },
    { id: 'gbat', name: '황금 박쥐', fam: '황금', icon: '🦇', hp: 200, atk: 22, def: 28, spd: 24, range: 1, golden: true, expMul: 20, goldMul: 15, minF: 6, fleeIn: 20 },
  ];
  // 조건부 특수 몹 — 미믹(상자), 원혼(동료가 쓰러진 층), 도적단(노획물이 많을 때)
  const SPECIALS = [
    { id: 'mimic', name: '미믹', fam: '특수', icon: '📦', hp: 170, atk: 20, def: 14, spd: 12, range: 1, special: true, expMul: 4, goldMul: 4 },
    { id: 'spirit', name: '원혼', fam: '언데드', icon: '👻', hp: 130, atk: 18, def: 5, spd: 15, range: 2, magic: true, undead: true, special: true, expMul: 3, goldMul: 2 },
    { id: 'bandit', name: '도적단원', fam: '도적', icon: '🗡️', hp: 120, atk: 17, def: 9, spd: 17, range: 1, special: true, expMul: 3, goldMul: 6 },
  ];
  const BOSSES = {
    5: { name: '고블린 대왕', icon: '👺', hp: 4, atk: 1.3, def: 1.2, spd: 11, range: 1, skills: ['cleave'] },
    15: { name: '독거미 여왕', icon: '🕷️', hp: 7, atk: 1.5, def: 1.3, spd: 13, range: 1, poison: 0.4, skills: ['power'] },
    25: { name: '골렘 군주', icon: '🗿', hp: 9, atk: 1.6, def: 1.9, spd: 7, range: 1, skills: ['cleave', 'power'] },
    35: { name: '불사의 흑기사', icon: '🥷', hp: 10, atk: 1.8, def: 1.6, spd: 11, range: 1, skills: ['power', 'cleave'] },
    45: { name: '심연의 용', icon: '🐲', hp: 12, atk: 1.9, def: 1.7, spd: 10, range: 3, magic: true, skills: ['fire', 'cleave'] },
    10: { name: '다크 엘프 군주', icon: '🧝‍♂️', hp: 7, atk: 1.5, def: 1.3, spd: 12, range: 3, magic: true, skills: ['volley'] },
    20: { name: '지하의 히드라', icon: '🐍', hp: 9, atk: 1.6, def: 1.4, spd: 9, range: 3, magic: true, skills: ['fire'] },
    30: { name: '리치 왕', icon: '☠️', hp: 9, atk: 1.7, def: 1.4, spd: 10, range: 3, magic: true, undead: true, skills: ['thunder'] },
    40: { name: '마룡 라프닐', icon: '🐉', hp: 11, atk: 1.8, def: 1.5, spd: 10, range: 2, magic: true, skills: ['fire', 'cleave'] },
    50: { name: '흑왕', icon: '👑', hp: 14, atk: 2.0, def: 1.7, spd: 11, range: 2, magic: true, skills: ['cleave', 'fire', 'thunder'] },
  };
  const bandOf = f => Math.min(4, Math.floor((f - 1) / 10));
  const poolOf = f => { const b = bandOf(f); return ENEMIES.filter(e => e.band === b || e.band === b - 1); };
  const famsOf = f => [...new Set(poolOf(f).map(e => e.fam))];

  /* ---------- 능력치 ---------- */
  /* 원작(지오컨플릭트3) 분석값 기반 — ref/README.md 참고.
     경험치 누적표(레벨 2~49)는 원작 그대로, 50레벨은 간격을 이어 붙임. */
  const EXP_CUM = [0, 0, 100, 200, 400, 700, 1200, 1900, 2900, 4200, 5700, 7500, 9500, 13500, 19000, 26000, 34000, 46000, 60000, 76000, 94000, 114000, 136000, 160000, 186000, 214000, 244000, 276000, 310000, 346000, 384000, 424000, 466000, 510000, 560000, 620000, 690000, 770000, 860000, 960000, 1080000, 1230000, 1400000, 1550000, 1720000, 1910000, 2120000, 2320000, 2540000, 2800000, 3100000];
  // 조정값 (시뮬레이터로 튜닝). 성장은 원작처럼 "레벨당 선형 증가" — HP는 완만, ATK/DEF는 기본값 대비 크게.
  const TUNE = { expScale: 1, growHp: 0.035, growAtk: 0.12, growDef: 0.30, eHp: 0.30, eAtk: 0.12, eDef: 0.15, eHp10: 0.18, eAtk10: 0.13 };
  const needExp = lv => Math.max(1, Math.round((EXP_CUM[Math.min(lv + 1, 50)] - EXP_CUM[lv]) * TUNE.expScale));
  // 적 1마리 경험치: 원작 일반 적 EXP 2(1층) → 약 1700(후반) 의 지수 곡선
  const enemyExp = (f, boss) => Math.round(2 * Math.pow(850, (f - 1) / 49) * (boss ? 8 + 20 * f / 50 : 1));
  function skillsOf(u) {
    const s = new Set(u.learned || []);
    for (const slot in SLOTS) { const i = u.equip[slot]; if (i && ITEMS[i] && ITEMS[i].skill) s.add(ITEMS[i].skill); }
    return [...s];
  }
  function maxCharges(u, sid) { return SKILLS[sid].uses + ((u.learned || []).includes(sid) ? 1 : 0); }
  function resetCharges(u) { u.charges = {}; for (const s of skillsOf(u)) u.charges[s] = maxCharges(u, s); }
  function ensureCharges(u) { u.charges = u.charges || {}; for (const s of skillsOf(u)) if (u.charges[s] === undefined) u.charges[s] = maxCharges(u, s); }
  function stats(u) {
    const c = CLASSES[u.cls], L = u.lv - 1;
    let hp = Math.round(c.hp * (1 + TUNE.growHp * L * (c.hpGrow || 1))), atk = Math.round(c.atk * (1 + TUNE.growAtk * L)), def = Math.round(c.def * (1 + TUNE.growDef * L)), spd = c.spd, eva = c.eva, rng = c.range;
    for (const slot in SLOTS) {
      const i = ITEMS[u.equip[slot]]; if (!i) continue;
      rng += i.range || 0; hp += i.hp || 0; atk += i.atk || 0; def += i.def || 0; spd += i.spd || 0; eva += i.eva || 0;
    }
    return { hp, atk, def, spd, eva: Math.min(eva, 0.5), range: rng };
  }

  /* ---------- 세이브 ---------- */
  const ROSTER = [
    ['레온', 'warrior', 1], ['아델', 'knight', 0], ['실비아', 'elf', 1], ['마르코', 'mage', 0], ['루나', 'priest', 1], ['핀', 'thief', 1],
    ['가론', 'monk', 0], ['헬가', 'warrior', 0], ['오스카', 'knight', 0], ['에리스', 'mage', 0], ['티티스', 'elf', 0], ['세라', 'priest', 0],
  ];
  function newSave() {
    const units = ROSTER.map((r, i) => ({ id: i + 1, name: r[0], cls: r[1], lv: 1, exp: 0, hp: 0, equip: { weapon: null, sub: null, armor: null, acc1: null, acc2: null }, learned: [], mastery: {}, charges: {}, hired: !!r[2] }));
    const byName = n => units.find(u => u.name === n);
    byName('레온').equip.weapon = 'w_sword'; byName('실비아').equip.weapon = 'w_bow';
    byName('루나').equip.weapon = 'w_mace'; byName('핀').equip.weapon = 'w_dagger';
    const s = {
      v: 2, gold: 600, day: 1, maxFloor: 1, cleared: false, units,
      gear: ['a_leather', 'a_leather', 's_buckler', 'r_power'], cons: { potion: 3, antidote: 1, escape: 1 },
      formation: {}, policy: { retreat: 25, skill: 'mid', explore: 'full', stance: 'attack', target: 'nearest', leader: 1, downRetreat: false },
      quests: { board: [], active: [], done: 0 }, qid: 1,
    };
    units.forEach(u => { u.hp = stats(u).hp; resetCharges(u); });
    autoFormation(s); genQuests(s);
    return s;
  }
  function restoreLegends(s) { // 저장된 전설 장비 정의 복원용
    (s.legends || []).forEach(l => { ITEMS[l.id] = l; });
  }
  function registerLegend(s, id) { s.legends = s.legends || []; if (!s.legends.find(l => l.id === id)) s.legends.push(ITEMS[id]); }

  const costCap = s => 10 + Math.floor(s.maxFloor / 4);
  const usedCost = s => s.units.filter(u => u.hired && s.formation[u.id]).reduce((a, u) => a + CLASSES[u.cls].cost, 0);
  function zoneOk(cls, y) {
    const r = CLASSES[cls].row;
    if (y < 5) return false;
    if (r === 'front') return FRONT_Y.includes(y);
    if (r === 'back') return BACK_Y.includes(y);
    return true;
  }
  function unitAt(s, x, y) { return s.units.find(u => u.hired && s.formation[u.id] && s.formation[u.id][0] === x && s.formation[u.id][1] === y); }
  function place(s, u, x, y) {
    if (!u.hired) return '고용하지 않은 용병입니다';
    if (!zoneOk(u.cls, y) || x < 0 || x >= GRID) return `${CLASSES[u.cls].name}은(는) ${ROW_TXT[CLASSES[u.cls].row]} 입니다`;
    const o = unitAt(s, x, y); if (o && o.id !== u.id) return '이미 다른 용병이 있습니다';
    const was = s.formation[u.id];
    const used = usedCost(s) - (was ? CLASSES[u.cls].cost : 0) + CLASSES[u.cls].cost;
    if (used > costCap(s)) return `코스트 초과 (${used}/${costCap(s)})`;
    s.formation[u.id] = [x, y]; return null;
  }
  function autoFormation(s) {
    s.formation = {};
    const xs = [4, 3, 5, 2, 6, 1, 7, 0, 8];
    const order = s.units.filter(u => u.hired).sort((a, b) => b.lv - a.lv || CLASSES[a.cls].cost - CLASSES[b.cls].cost);
    for (const u of order) {
      const ys = CLASSES[u.cls].row === 'front' ? [5, 6] : CLASSES[u.cls].row === 'back' ? [8, 7] : [7, 8];
      let done = false;
      for (const y of ys) { for (const x of xs) { if (!unitAt(s, x, y) && !place(s, u, x, y)) { done = true; break; } } if (done) break; }
    }
  }

  /* ---------- 의뢰 ---------- */
  function genQuests(s) {
    const mf = s.maxFloor, b = [];
    for (let i = 0; i < 4; i++) {
      const type = pick(['hunt', 'hunt', 'reach', 'chest', 'flawless']), q = { id: s.qid++, type, progress: 0 };
      if (type === 'hunt') { q.fam = pick(famsOf(mf)); q.need = ri(4, 8) + Math.floor(mf / 6); q.reward = q.need * (25 + mf * 4); q.title = `마물 토벌: ${q.fam} ${q.need}마리`; }
      else if (type === 'reach') { q.need = Math.min(MAXF, mf + ri(1, 3)); q.reward = 150 + q.need * 30; q.title = `${q.need}층 도달`; }
      else if (type === 'chest') { q.need = ri(2, 4); q.reward = q.need * (60 + mf * 8); q.title = `보물상자 ${q.need}개 회수`; }
      else { q.need = ri(3, 5); q.reward = q.need * (50 + mf * 6); q.title = `성 경비: 전투불능 없이 ${q.need}회 승리`; }
      b.push(q);
    }
    s.quests.board = b;
  }
  function questEvent(s, type, val, log) {
    const done = [];
    for (const q of s.quests.active) {
      if (q.type !== type) continue;
      if (type === 'hunt') { if (q.fam === val) q.progress++; }
      else if (type === 'reach') { if (val >= q.need) q.progress = q.need; }
      else q.progress++;
      if (q.progress >= q.need) done.push(q);
    }
    for (const q of done) {
      s.gold += q.reward; s.quests.done++;
      s.quests.active = s.quests.active.filter(x => x !== q);
      log(`📜 의뢰 완료! [${q.title}] 보수 ${q.reward}G`, 'good');
    }
  }

  /* ---------- 드롭 ---------- */
  function dropItem(floor) {
    if (Math.random() < 0.06) { return makeLegend(floor); }
    const tmax = Math.min(5, 1 + Math.floor(floor / 10));
    const c = Object.values(ITEMS).filter(i => !i.legend && i.tier <= tmax && i.tier >= Math.max(1, tmax - 1));
    return pick(c).id;
  }

  /* ---------- 전투 ---------- */
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const scaleHp = f => f <= 10 ? 1 + TUNE.eHp10 * (f - 1) : 1 + TUNE.eHp10 * 9 + TUNE.eHp * (f - 10);
  const scaleAtk = f => f <= 10 ? 1 + TUNE.eAtk10 * (f - 1) : 1 + TUNE.eAtk10 * 9 + TUNE.eAtk * (f - 10);
  const scaleDef = f => f <= 10 ? 1 + TUNE.eAtk10 * (f - 1) : 1 + TUNE.eAtk10 * 9 + TUNE.eDef * (f - 10);
  function mkEnemy(t, f, x, y, boss, mod) {
    mod = mod || {};
    const mul = scaleHp(f);
    const hpm = boss ? t.hp : 1, am = boss ? t.atk : 1, dm = boss ? t.def : 1;
    const hp = Math.round((boss ? 60 : t.hp) * mul * hpm * (mod.hp || 1));
    return {
      side: 'e', tplId: t.id, floorKey: f, name: (mod.elite ? '정예 ' : '') + t.name, icon: t.icon, color: boss ? '#8b1f3f' : (t.golden ? '#b8860b' : (mod.elite ? '#6b2d8b' : '#7a3b3b')), golden: !!t.golden, elite: !!mod.elite, special: !!t.special, boss: !!boss, fam: t.fam || '보스', undead: !!t.undead,
      x, y, dx: x, dy: y, hp, maxhp: hp, atk: Math.round((boss ? 20 : t.atk) * scaleAtk(f) * am * (mod.atk || 1)), def: Math.round((boss ? 8 : t.def) * scaleDef(f) * dm * (mod.def || 1)),
      spd: t.spd, eva: 0, range: t.range, magic: !!t.magic, poison: t.poison || 0, skills: t.skills || null, gauge: rnd(0, 6), alive: true, guard: 0,
      exp: Math.round(enemyExp(f, boss) * (t.expMul || 1) * (mod.exp || 1)), gold: Math.round((5 + f * 2) * (boss ? 8 : 1) * (t.goldMul || 1) * (mod.gold || 1)), size: boss ? 1.5 : 1,
    };
  }
  // 고저차: 전투 무대 9×9 에 0~3 단의 언덕을 무작위로 만든다 (높은 쪽이 낮은 쪽을 공격하면 +6%/단, 최대 ±3단)
  function genHeights() {
    const h = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let k = ri(2, 4); k > 0; k--) {
      const cx = ri(0, 8), cy = ri(0, 8), H = ri(1, 3), R = ri(2, 4);
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) h[y][x] = Math.max(h[y][x], clamp(Math.round(H - Math.hypot(x - cx, y - cy) * H / R), 0, 3));
    }
    return h;
  }
  const ENEMY_BY_ID = {}; ENEMIES.concat(GOLDEN, SPECIALS).forEach(t => { ENEMY_BY_ID[t.id] = t; });
  function createBattle(exp, group) {
    const s = exp.save, f = exp.floor, units = [];
    const leaderId = s.policy.leader;
    for (const u of exp.party) {
      if (u.hp <= 0) continue;
      const p = s.formation[u.id], st = stats(u);
      units.push({ side: 'p', u, name: u.name, icon: CLASSES[u.cls].icon, color: CLASSES[u.cls].color, x: p[0], y: p[1], dx: p[0], dy: p[1], hp: u.hp, maxhp: st.hp, atk: st.atk, def: st.def, spd: st.spd, eva: st.eva, range: st.range, magic: u.cls === 'mage' || u.cls === 'priest', gauge: rnd(0, 6), alive: true, guard: 0, poisoned: !!u.poison, isLeader: u.id === leaderId, size: 1 });
    }
    const occ = new Set(), enemies = [];
    const free = () => { for (let k = 0; k < 60; k++) { const x = ri(0, 8), y = ri(0, 3); if (!occ.has(x + ',' + y)) { occ.add(x + ',' + y); return [x, y]; } } return [ri(0, 8), ri(0, 3)]; };
    for (const id of group.tpls) {
      if (id === 'boss') { occ.add('4,1'); enemies.push(mkEnemy(BOSSES[f], f, 4, 1, true)); }
      else { const [x, y] = free(); enemies.push(mkEnemy(ENEMY_BY_ID[id], f, x, y, false, group.elite ? { hp: 1.8, atk: 1.25, def: 1.2, exp: 2.5, gold: 3, elite: true } : null)); }
    }
    const gT = group.golden ? ENEMY_BY_ID[group.tpls[0]] : null;
    const hgt = genHeights();
    return { exp, save: s, floor: f, units: units.concat(enemies), t: 0, nextRetreatCheck: 1, events: [], result: null, guardian: !!group.boss, group, fallen: 0, policy: s.policy, hgt, golden: !!group.golden, fleeT: gT ? gT.fleeIn : 0, bless: (exp.bless || 0) > 0 };
  }
  const alive = (b, side) => b.units.filter(c => c.alive && c.side === side);
  function leaderMul(b) {
    const lid = b.policy.leader; const inParty = b.exp.party.find(u => u.id === lid && b.exp.party.includes(u));
    if (!inParty) return 1;
    return inParty.hp > 0 ? 1.08 : 0.9;
  }
  const mulFor = (b, c) => c.side === 'p' ? leaderMul(b) * (b.bless ? 1.15 : 1) : 1;
  const ev = (b, o) => b.events.push(o);

  function setHp(c, v) { c.hp = clamp(Math.round(v), 0, c.maxhp); if (c.u) c.u.hp = c.hp; }
  function syncPlayer(c) { const st = stats(c.u); c.maxhp = st.hp; c.atk = st.atk; c.def = st.def; c.spd = st.spd; c.eva = st.eva; c.range = st.range; c.hp = c.u.hp; }

  function damage(b, att, tgt, mult, magic, skill) {
    if (!tgt.alive) return;
    if (!magic && Math.random() < tgt.eva) { ev(b, { k: 'miss', x: tgt.x, y: tgt.y }); return; }
    if (b.hgt) mult *= clamp(1 + 0.06 * (b.hgt[att.y][att.x] - b.hgt[tgt.y][tgt.x]), 0.8, 1.25);
    const a = att.atk * mulFor(b, att) * mult, d = tgt.def * (tgt.guard > b.t ? 2 : 1) * mulFor(b, tgt);
    let dmg = a * rnd(0.9, 1.1) - d * (magic ? 0.25 : 0.5);
    const crit = Math.random() < 0.08; if (crit) dmg *= 1.5;
    dmg = Math.max(Math.ceil(a * 0.1), Math.round(dmg));
    setHp(tgt, tgt.hp - dmg); if (tgt.side === 'p') b.pHurt = b.t;
    ev(b, { k: 'dmg', x: tgt.x, y: tgt.y, v: dmg, crit, side: tgt.side });
    if (att.poison && tgt.side === 'p' && !tgt.poisoned && Math.random() < att.poison) { tgt.poisoned = true; tgt.u.poison = true; ev(b, { k: 'log', m: `☠️ ${tgt.name}이(가) 독에 걸렸다!`, c: 'bad' }); }
    if (tgt.hp <= 0) die(b, tgt, att);
  }
  function die(b, c) {
    c.alive = false;
    if (c.side === 'e') {
      const e = b.exp, s = b.save;
      e.loot.gold += c.gold; e.kills++;
      giveExp(b, c.exp);
      if (Math.random() < (c.boss ? 1 : 0.1)) { const id = dropItem(b.floor); if (ITEMS[id].legend) registerLegend(s, id); e.loot.items.push(id); ev(b, { k: 'log', m: `🎁 ${ITEMS[id].name} 획득`, c: 'good' }); }
      questEvent(s, 'hunt', c.fam, (m, cl) => ev(b, { k: 'log', m, c: cl }));
      if (c.elite && Math.random() < 0.6) { const id = dropItem(b.floor); if (ITEMS[id].legend) registerLegend(s, id); e.loot.items.push(id); ev(b, { k: 'log', m: `☠️ 정예 몹 전리품: ${ITEMS[id].name}`, c: 'good' }); }
      if (c.golden) {
        const id = dropItem(b.floor); if (ITEMS[id].legend) registerLegend(s, id); e.loot.items.push(id);
        e.bless = 4; e.goldenKills = (e.goldenKills || 0) + 1;
        ev(b, { k: 'log', m: `✨ ${c.name} 처치! 경험치 ${c.exp} · ${ITEMS[id].name} 획득 · 황금의 축복(3회 전투 공·방 +15%)`, c: 'good' });
      }
    } else {
      b.fallen++; b.exp.fallFloor = b.floor; ev(b, { k: 'log', m: `💔 ${c.name} 전투불능!`, c: 'bad' });
    }
  }
  function giveExp(b, amt) {
    for (const c of b.units) {
      if (c.side !== 'p' || !c.alive) continue;
      const u = c.u; u.exp += amt;
      while (u.exp >= needExp(u.lv) && u.lv < MAXLV) {
        u.exp -= needExp(u.lv); const old = c.maxhp; u.lv++;
        const nm = stats(u).hp; u.hp = Math.min(nm, u.hp + (nm - old)); syncPlayer(c);
        ev(b, { k: 'log', m: `⭐ ${u.name} Lv${u.lv} 으로 상승!`, c: 'good' });
      }
    }
  }
  function heal(b, c, tgt, amt) {
    const before = tgt.hp; setHp(tgt, tgt.hp + amt);
    ev(b, { k: 'heal', x: tgt.x, y: tgt.y, v: tgt.hp - before });
  }
  function consume(c, sid) {
    if (!c.u) return;
    c.u.charges[sid] = (c.u.charges[sid] || 0) - 1;
    if (!(c.u.learned || []).includes(sid)) {
      c.u.mastery[sid] = (c.u.mastery[sid] || 0) + 1;
      if (c.u.mastery[sid] >= SKILLS[sid].master) { c.u.learned.push(sid); c.u.charges[sid] = (c.u.charges[sid] || 0) + 1; ev(c.b, { k: 'log', m: `📖 ${c.u.name}이(가) [${SKILLS[sid].name}]을(를) 완전히 습득했다!`, c: 'good' }); }
    }
  }
  function useSkill(b, c, sid, foes, allies) {
    const sk = SKILLS[sid], rng = sk.range || c.range;
    const inR = foes.filter(o => dist(c, o) <= rng).sort((p, q) => dist(c, p) - dist(c, q));
    c.b = b;
    switch (sk.type) {
      case 'single': { if (!inR.length) return false; ev(b, { k: 'fx', x: inR[0].x, y: inR[0].y, t: 'skill', n: sk.name, from: c }); damage(b, c, inR[0], sk.mult, !!sk.magic); break; }
      case 'holy': {
        const t = inR.find(o => o.undead) || inR[0]; if (!t) return false;
        ev(b, { k: 'fx', x: t.x, y: t.y, t: 'skill', n: sk.name, from: c }); damage(b, c, t, t.undead ? sk.mult * 1.8 : sk.mult * 0.6, true); break;
      }
      case 'aoe': { if (!inR.length) return false; const t = inR[0]; ev(b, { k: 'fx', x: t.x, y: t.y, t: 'fire', n: sk.name, from: c }); foes.filter(o => dist(t, o) <= 1).forEach(o => damage(b, c, o, sk.mult, true)); break; }
      case 'adjacent': { const adj = foes.filter(o => dist(c, o) <= 1); if (!adj.length) return false; ev(b, { k: 'fx', x: c.x, y: c.y, t: 'skill', n: sk.name, from: c }); adj.forEach(o => damage(b, c, o, sk.mult, false)); break; }
      case 'line': { if (!inR.length) return false; ev(b, { k: 'fx', x: inR[0].x, y: inR[0].y, t: 'skill', n: sk.name, from: c }); inR.slice(0, 3).forEach(o => damage(b, c, o, sk.mult, !!sk.magic)); break; }
      case 'heal': { const t = allies.filter(a => a.hp < a.maxhp).sort((p, q) => p.hp / p.maxhp - q.hp / q.maxhp)[0]; if (!t) return false; ev(b, { k: 'fx', x: t.x, y: t.y, t: 'heal', n: sk.name, from: c }); heal(b, c, t, c.atk * 1.8 + t.maxhp * 0.15); break; }
      case 'healall': { ev(b, { k: 'fx', x: c.x, y: c.y, t: 'heal', n: sk.name, from: c }); allies.forEach(a => heal(b, c, a, c.atk * 1.0 + a.maxhp * 0.1)); break; }
      case 'cure': { const t = allies.find(a => a.poisoned); if (!t) return false; t.poisoned = false; t.u.poison = false; ev(b, { k: 'log', m: `💊 ${t.name}의 독이 해독됐다`, c: 'good' }); break; }
      case 'guard': { c.guard = b.t + 6; ev(b, { k: 'fx', x: c.x, y: c.y, t: 'skill', n: sk.name, from: c }); break; }
    }
    if (c.u) consume(c, sid);
    return true;
  }
  function trySkillP(b, c, foes, allies) {
    const u = c.u, avail = skillsOf(u).filter(s => (u.charges[s] || 0) > 0);
    if (!avail.length) return false;
    const ratio = allies.reduce((a, o) => a + o.hp / o.maxhp, 0) / allies.length;
    const freq = { low: 0.12, mid: 0.35, high: 0.7 }[b.policy.skill] || 0.35;
    const need = s => {
      const k = SKILLS[s], t = k.type, rng = k.range || c.range;
      if (t === 'heal') return allies.some(a => a.hp / a.maxhp < 0.55);
      if (t === 'healall') return ratio < 0.6;
      if (t === 'cure') return allies.some(a => a.poisoned);
      if (t === 'guard') return c.hp / c.maxhp < 0.7 && foes.some(o => dist(c, o) <= 2) && c.guard <= b.t;
      if (t === 'adjacent') return foes.some(o => dist(c, o) <= 1);
      return foes.some(o => dist(c, o) <= rng);
    };
    const cand = avail.filter(need);
    if (!cand.length) return false;
    const sup = cand.filter(s => ['heal', 'healall', 'cure'].includes(SKILLS[s].type));
    if (sup.length) return useSkill(b, c, sup[0], foes, allies);
    if (Math.random() < freq) return useSkill(b, c, pick(cand), foes, allies);
    return false;
  }
  function moveToward(b, c, t) {
    let best = null, bd = dist(c, t) * 100 + Math.abs(c.x - t.x) + Math.abs(c.y - t.y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (b.units.some(o => o.alive && o.x === nx && o.y === ny)) continue;
      const d = Math.max(Math.abs(nx - t.x), Math.abs(ny - t.y)) * 100 + Math.abs(nx - t.x) + Math.abs(ny - t.y);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (best) { c.x = best[0]; c.y = best[1]; }
  }
  function act(b, c) {
    const foes = b.units.filter(o => o.alive && o.side !== c.side), allies = b.units.filter(o => o.alive && o.side === c.side);
    if (!foes.length) return;
    if (c.side === 'p') { if (trySkillP(b, c, foes, allies)) return; }
    else if (c.skills && Math.random() < 0.25) { if (useSkill(b, c, pick(c.skills), foes, allies)) return; }
    let t;
    const byDist = foes.slice().sort((p, q) => dist(c, p) - dist(c, q) || p.hp - q.hp);
    if (c.side === 'p' && b.policy.target === 'weakest') {
      const inr = foes.filter(o => dist(c, o) <= c.range);
      t = (inr.length ? inr : foes).slice().sort((p, q) => p.hp - q.hp)[0];
    } else t = byDist[0];
    const d = dist(c, t);
    if (d <= c.range) {
      ev(b, { k: 'fx', x: t.x, y: t.y, t: 'atk', from: c });
      damage(b, c, t, 1, c.magic);
      if (c.u && c.u.cls === 'monk' && t.alive && Math.random() < 0.35) damage(b, c, t, 0.8, false);
    } else if (c.side === 'e' || b.policy.stance === 'attack' || (b.pHurt !== undefined && b.t - b.pHurt < 6)) moveToward(b, c, t);
  }
  function stepBattle(b, dt) {
    if (b.result) return;
    b.t += dt;
    const ready = [];
    for (const c of b.units) { if (!c.alive) continue; c.gauge += c.spd * dt; if (c.gauge >= 10) ready.push(c); }
    ready.sort((p, q) => q.gauge - p.gauge);
    for (const c of ready) {
      if (!c.alive || b.result) continue; c.gauge = Math.max(0, c.gauge - 10); act(b, c);
      if (!alive(b, 'e').length) { b.result = 'win'; break; }
      if (!alive(b, 'p').length) { b.result = 'lose'; break; }
    }
    if (b.result) return;
    // 독
    if (b.t >= (b.nextPoison || 2)) {
      b.nextPoison = b.t + 2;
      for (const c of alive(b, 'p')) if (c.poisoned) { const d = Math.max(1, Math.round(c.maxhp * 0.04)); setHp(c, c.hp - d); ev(b, { k: 'dmg', x: c.x, y: c.y, v: d, side: 'p', poison: true }); if (c.hp <= 0) { die(b, c); } }
      if (!alive(b, 'p').length) { b.result = 'lose'; return; }
    }
    // 황금 몹은 제한 시간이 지나면 도망친다
    if (b.fleeT && b.t >= b.fleeT) {
      const gm = b.units.find(c => c.side === 'e' && c.golden && c.alive);
      if (gm) { b.result = 'escape'; ev(b, { k: 'log', m: `💨 ${gm.name}이(가) 도망쳤다…`, c: 'warn' }); return; }
    }
    // 퇴각 판단 (3편: 후퇴 확률)
    if (b.t >= b.nextRetreatCheck) {
      b.nextRetreatCheck = b.t + 1;
      const ps = b.units.filter(c => c.side === 'p'), tot = ps.reduce((a, c) => a + c.maxhp, 0), cur = ps.reduce((a, c) => a + c.hp, 0);
      const pct = cur / tot * 100;
      const down = b.policy.downRetreat && b.fallen > 0;
      if ((pct < b.policy.retreat || down) && !b.guardian0) {
        if (Math.random() < (b.guardian ? 0.55 : (b.group && b.group.elite ? 0.6 : 0.7))) { b.result = 'retreat'; ev(b, { k: 'log', m: '🏃 후퇴 판단! 파티가 전장을 이탈한다', c: 'warn' }); }
        else ev(b, { k: 'log', m: '후퇴를 시도했지만 적이 놓아주지 않는다…', c: 'warn' });
      }
    }
  }

  /* ---------- 미궁 생성 (쿼터뷰 벽돌 미로) ---------- */
  const MW = 39, MH = 23, STEP = 0.14;
  const T = { WALL: 0, COR: 1, ROOM: 2, DOOR: 3, LOCK: 4, STAIRS: 5, UP: 6, OPEN: 7 };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  function floodDist(grid, sx, sy, blockLock) {
    const d = Array.from({ length: MH }, () => Array(MW).fill(-1)), q = [[sx, sy]]; d[sy][sx] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || d[ny][nx] >= 0) continue;
        const t = grid[ny][nx]; if (t === T.WALL || (blockLock && t === T.LOCK)) continue;
        d[ny][nx] = d[y][x] + 1; q.push([nx, ny]);
      }
    }
    return d;
  }
  function genGroup(f, boss) {
    const pool = poolOf(f);
    const n = Math.min(5, ri(1, 2) + Math.floor(f / 16) + (Math.random() < 0.35 ? 1 : 0));
    const tpls = [];
    if (boss) { tpls.push('boss'); for (let i = 0; i < Math.min(3, ri(1, 2) + Math.floor(f / 25)); i++) tpls.push(pick(pool).id); }
    else for (let i = 0; i < n; i++) tpls.push(pick(pool).id);
    const lead = boss ? BOSSES[f].icon : ENEMY_BY_ID[tpls[0]].icon;
    return { tpls, boss: !!boss, alive: true, icon: lead, x: 0, y: 0 };
  }
  function genElite(f) {
    const pool = poolOf(f), n = Math.min(3, 2 + (f >= 20 ? 1 : 0)), tpls = [];
    for (let i = 0; i < n; i++) tpls.push(pick(pool).id);
    return { tpls, boss: false, alive: true, elite: true, wander: true, icon: ENEMY_BY_ID[tpls[0]].icon, name: '정예 몹', x: 0, y: 0 };
  }
  function genGolden(f) {
    const c = GOLDEN.filter(g => f >= g.minF); if (!c.length) return null;
    const t = pick(c);
    return { tpls: [t.id], boss: false, alive: true, icon: t.icon, golden: true, name: t.name, x: 0, y: 0 };
  }
  function tryGen(f) {
    const grid = Array.from({ length: MH }, () => Array(MW).fill(0)), rid = Array.from({ length: MH }, () => Array(MW).fill(-1));
    let rooms = [];
    for (let i = 0; i < 80 && rooms.length < 9; i++) {
      const w = ri(4, 8), h = ri(3, 5), x = ri(2, MW - w - 3), y = ri(2, MH - h - 3);
      if (rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), deg: 0 });
    }
    if (rooms.length < 6) return null;
    rooms.sort((a, b) => a.cx - b.cx); rooms.forEach((r, i) => { r.id = i; });
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { grid[y][x] = T.ROOM; rid[y][x] = r.id; }
    const carve = (a, b) => {
      let x = a.cx, y = a.cy; const hf = Math.random() < 0.5;
      const sx = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); if (grid[y][x] === 0) grid[y][x] = T.COR; } };
      const sy = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); if (grid[y][x] === 0) grid[y][x] = T.COR; } };
      if (hf) { sx(); sy(); } else { sy(); sx(); }
      a.deg++; b.deg++;
    };
    for (let i = 0; i < rooms.length - 1; i++) carve(rooms[i], rooms[i + 1]);
    for (let k = 0; k < 2; k++) { const i = ri(0, rooms.length - 3); carve(rooms[i], rooms[i + 2]); }
    const r0 = rooms[0], start = { x: r0.cx, y: r0.cy };
    const d0 = floodDist(grid, start.x, start.y, false);
    let sr = rooms[1]; for (const r of rooms) if (r.id !== 0 && d0[r.cy][r.cx] > d0[sr.cy][sr.cx]) sr = r;
    const stairs = { x: sr.cx, y: sr.cy };
    grid[start.y][start.x] = T.UP; grid[stairs.y][stairs.x] = T.STAIRS;
    // 금고방: 막다른 방의 입구를 잠근다 (도적이 있어야 열림)
    const entrances = r => { const out = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === T.COR && D4.some(([dx, dy]) => inb(x + dx, y + dy) && rid[y + dy][x + dx] === r.id)) out.push([x, y]); return out; };
    const vaults = [];
    const leaves = rooms.filter(r => r.deg === 1 && r.id !== 0 && r.id !== sr.id).sort(() => Math.random() - 0.5).slice(0, 2);
    for (const r of leaves) {
      const en = entrances(r); if (!en.length) continue;
      en.forEach(([x, y]) => { grid[y][x] = T.LOCK; });
      const d = floodDist(grid, start.x, start.y, true);
      const ok = d[stairs.y][stairs.x] >= 0 && rooms.every(q => q.id === r.id || vaults.includes(q) || d[q.cy][q.cx] >= 0);
      if (ok) vaults.push(r); else en.forEach(([x, y]) => { grid[y][x] = T.COR; });
    }
    // 일반 문
    for (const r of rooms) if (!vaults.includes(r)) for (const [x, y] of entrances(r)) if (grid[y][x] === T.COR && Math.random() < 0.55) grid[y][x] = T.DOOR;
    const used = new Set([start.y * MW + start.x, stairs.y * MW + stairs.x]);
    const dist = floodDist(grid, start.x, start.y, true);
    const randTile = (pred) => { for (let k = 0; k < 300; k++) { const x = ri(1, MW - 2), y = ri(1, MH - 2), t = grid[y][x]; if ((t === T.ROOM || t === T.COR) && !used.has(y * MW + x) && pred(x, y)) { used.add(y * MW + x); return { x, y }; } } return null; };
    const chests = [], traps = [], springs = [], groups = [];
    const nCh = 3 + ri(0, 1) + (f >= 20 ? 1 : 0);
    for (let i = 0; i < nCh; i++) { const p = randTile((x, y) => rid[y][x] >= 0 && rid[y][x] !== 0 && !vaults.some(v => v.id === rid[y][x])); if (p) chests.push({ x: p.x, y: p.y, big: false, open: false }); }
    for (const v of vaults) for (let i = 0; i < 2; i++) { const p = randTile((x, y) => rid[y][x] === v.id); if (p) chests.push({ x: p.x, y: p.y, big: i === 0, open: false }); }
    const nTr = 4 + Math.floor(f / 8) + ri(0, 2);
    for (let i = 0; i < nTr; i++) { const p = randTile((x, y) => rid[y][x] !== 0 && !vaults.some(v => v.id === rid[y][x]) && dist[y][x] > 2); if (p) traps.push({ x: p.x, y: p.y, found: false, gone: false }); }
    if (Math.random() < 0.45) { const p = randTile((x, y) => rid[y][x] > 0 && !vaults.some(v => v.id === rid[y][x])); if (p) springs.push({ x: p.x, y: p.y, used: false }); }
    const bossFloor = f % 5 === 0, nG = 5 + Math.floor(f / 10) + ri(0, 2);
    if (bossFloor) { const g = genGroup(f, true); g.x = stairs.x; g.y = stairs.y; groups.push(g); }
    for (let i = 0; i < nG; i++) { const p = randTile((x, y) => dist[y][x] >= 6 && !groups.some(g => cheb(g, { x, y }) < 3)); if (p) { const g = genGroup(f, false); g.x = p.x; g.y = p.y; groups.push(g); } }
    if (f >= 3) for (let k = 0; k < (f >= 25 && Math.random() < 0.5 ? 2 : 1); k++) if (Math.random() < 0.7) { const el = genElite(f); const p = randTile((x, y) => dist[y][x] >= 8 && !groups.some(g => cheb(g, { x, y }) < 3)); if (p) { el.x = p.x; el.y = p.y; groups.push(el); } }
    if (f >= 3) chests.forEach(c => { if (!c.big && Math.random() < 0.12) c.mimic = true; });
    if (f >= 2 && Math.random() < 0.28) { const gg = genGolden(f); const p = gg && randTile((x, y) => dist[y][x] >= 6 && !groups.some(g => cheb(g, { x, y }) < 2)); if (p) { gg.x = p.x; gg.y = p.y; groups.push(gg); } }
    // 이동맵 고저차: 시작점에서 퍼져 나가며 0~3 단 (같은 방은 평탄, 통로/방 경계에서 가끔 ±1)
    const hgt = Array.from({ length: MH }, () => Array(MW).fill(0)), hq = [[start.x, start.y]], hseen = new Set([start.y * MW + start.x]);
    for (let i = 0; i < hq.length; i++) {
      const [x, y] = hq[i];
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || grid[ny][nx] === 0 || hseen.has(ny * MW + nx)) continue;
        hseen.add(ny * MW + nx);
        const sameRoom = rid[ny][nx] >= 0 && rid[ny][nx] === rid[y][x];
        hgt[ny][nx] = sameRoom ? hgt[y][x] : clamp(hgt[y][x] + (Math.random() < 0.12 ? (Math.random() < 0.5 ? -1 : 1) : 0), 0, 3);
        hq.push([nx, ny]);
      }
    }
    return { w: MW, h: MH, hgt, grid, rid, rooms, start, stairs, chests, traps, springs, groups, vaults: vaults.map(v => v.id), seen: Array.from({ length: MH }, () => Array(MW).fill(false)), floor: f };
  }
  function genFloor(f) { for (let i = 0; i < 200; i++) { const m = tryGen(f); if (m) return m; } throw new Error('map gen failed'); }

  /* ---------- 원정 ---------- */
  const wageOf = party => party.reduce((a, u) => a + 10 + u.lv * 4, 0);
  const hasThief = e => e.party.some(u => u.cls === 'thief' && u.hp > 0);
  const elog = (e, m, c) => { e.log.push({ m, c: c || '' }); e.events.push({ k: 'log', m, c }); };
  function reveal(e) {
    const m = e.map, { x, y } = e.pos;
    const mark = (tx, ty) => {
      if (!inb(tx, ty) || m.seen[ty][tx]) return; m.seen[ty][tx] = true;
      if (m.grid[ty][tx] !== 0) for (const [dx, dy] of D8) { const nx = tx + dx, ny = ty + dy; if (inb(nx, ny) && m.grid[ny][nx] === 0) m.seen[ny][nx] = true; }
    };
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 7) { const tx = x + dx, ty = y + dy; if (inb(tx, ty) && m.grid[ty][tx] !== 0) mark(tx, ty); }
    const r = m.rid[y][x];
    if (r >= 0) { const rm = m.rooms[r]; for (let yy = rm.y; yy < rm.y + rm.h; yy++) for (let xx = rm.x; xx < rm.x + rm.w; xx++) mark(xx, yy); }
  }
  function setFloor(e, f) {
    const s = e.save; e.floor = f; e.map = genFloor(f); e.pos = { x: e.map.start.x, y: e.map.start.y }; e.trail = []; e.directive = null; e.path = []; e.hist = [];
    e.reached = Math.max(e.reached, f); s.maxFloor = Math.max(s.maxFloor, f);
    reveal(e); questEvent(s, 'reach', f, (m, c) => elog(e, m, c));
    elog(e, `⬇ ${f}층에 도착했다`, 'floor');
  }
  function createExpedition(save, startFloor) {
    const party = save.units.filter(u => u.hired && save.formation[u.id]);
    party.forEach(u => { u.poison = false; ensureCharges(u); });
    const e = { save, party, floor: startFloor, map: null, pos: null, trail: [], directive: null, path: [], phase: 'explore', moveT: 0.5, healT: 0, battle: null, log: [], events: [], loot: { gold: 0, items: [] }, kills: 0, done: false, result: null, chests: 0, reached: startFloor, text: '', startFloor };
    save.maxFloor = Math.max(save.maxFloor, startFloor);
    setFloor(e, startFloor);
    return e;
  }
  function startBattle(e, g) {
    e.battle = createBattle(e, g); e.phase = 'battle';
    const names = e.battle.units.filter(c => c.side === 'e').map(c => c.name);
    elog(e, g.boss ? `⚔️ 수호자 출현! ${names[0]} 외 ${names.length - 1}` : `⚔️ 적과 조우: ${names.join(', ')}`, g.boss ? 'warn' : '');
  }
  function openChest(e, big) {
    const f = e.floor, g = Math.round(rnd(0.8, 1.4) * (30 + f * 15) * (big ? 2 : 1));
    e.loot.gold += g; e.chests++;
    let m = `📦 ${big ? '큰 ' : ''}보물상자! ${g}G`;
    if (Math.random() < (big ? 0.8 : 0.35)) { const id = dropItem(f); if (ITEMS[id].legend) registerLegend(e.save, id); e.loot.items.push(id); m += ` + ${ITEMS[id].name}`; }
    if (Math.random() < 0.3) { const k = pick(['potion', 'potion', 'antidote', 'elixir']); e.save.cons[k] = (e.save.cons[k] || 0) + 1; m += ` + ${CONS[k].name}`; }
    elog(e, m, 'good'); questEvent(e.save, 'chest', null, (mm, c) => elog(e, mm, c));
  }
  function triggerTrap(e, pre) {
    const t = e.party.filter(u => u.hp > 0).sort(() => Math.random() - 0.5).slice(0, 2);
    t.forEach(u => { const d = Math.max(1, Math.round(stats(u).hp * rnd(0.08, 0.15))); u.hp = Math.max(1, u.hp - d); if (Math.random() < 0.35) u.poison = true; });
    elog(e, `⚠️ ${pre || ''}함정 발동! ${t.map(u => u.name).join(', ')} 피해${t.some(u => u.poison) ? ' (독)' : ''}`, 'bad');
  }
  function finish(e, result) {
    const s = e.save; e.done = true; e.result = result; e.phase = 'done';
    if (result === 'wipe') { s.gold += Math.floor(e.loot.gold * 0.5); e.lost = true; }
    else { s.gold += e.loot.gold; e.loot.items.forEach(i => s.gear.push(i)); }
    s.day++;
    s.units.forEach(u => { u.hp = stats(u).hp; u.poison = false; resetCharges(u); });
    if (result === 'clear') s.cleared = true;
    genQuests(s);
  }

  /* --- 경로 탐색 (탐사한 칸만 이동 가능) --- */
  function bfsPath(e, goal) {
    const m = e.map, thief = hasThief(e), { x: sx, y: sy } = e.pos, key = (x, y) => y * MW + x;
    const prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      if (i > 0 && goal(x, y)) { const path = []; let k = key(x, y); while (k !== key(sx, sy)) { path.push([k % MW, Math.floor(k / MW)]); k = prev.get(k); } return path.reverse(); }
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || prev.has(key(nx, ny)) || !m.seen[ny][nx]) continue;
        const t = m.grid[ny][nx]; if (t === T.WALL || (t === T.LOCK && !thief)) continue;
        prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
      }
    }
    return null;
  }
  function pickTarget(e) {
    const m = e.map, pol = e.save.policy, thief = hasThief(e);
    const alive = e.party.filter(u => u.hp > 0);
    const pcts = alive.length ? alive.reduce((a, u) => a + u.hp, 0) / alive.reduce((a, u) => a + stats(u).hp, 0) : 1;
    if (e.directive) {
      const d = e.directive;
      if (e.pos.x === d.x && e.pos.y === d.y) e.directive = null;
      else { const p = bfsPath(e, (x, y) => x === d.x && y === d.y); if (p) return { path: p, why: '지시한 위치로 이동' }; e.directive = null; }
    }
    const F = {
      chest: (x, y) => m.chests.some(c => !c.open && c.x === x && c.y === y && m.seen[y][x]),
      front: (x, y) => D4.some(([dx, dy]) => inb(x + dx, y + dy) && !m.seen[y + dy][x + dx]),
      lock: (x, y) => m.grid[y][x] === T.LOCK,
      mon: (x, y) => m.groups.some(g => g.alive && m.seen[g.y][g.x] && cheb({ x, y }, g) <= 1),
      stairs: (x, y) => m.grid[y][x] === T.STAIRS,
      spring: (x, y) => m.springs.some(s => !s.used && s.x === x && s.y === y && m.seen[y][x]),
    };
    const T_ = { chest: '보물상자로 이동', front: '미탐색 구역 탐색', lock: '잠긴 문을 열러 이동', mon: '적을 찾아 이동', stairs: '계단으로 이동', spring: '치유의 샘으로 이동' };
    const get = k => { const p = bfsPath(e, F[k]); return p ? { path: p, why: T_[k] } : null; };
    if (pcts < 0.7) { const s = get('spring'); if (s) return s; }
    if (pcts >= 0.5 && m.groups.some(g => g.alive && g.golden && m.seen[g.y][g.x])) { const p = bfsPath(e, (x, y) => m.groups.some(g => g.alive && g.golden && m.seen[g.y][g.x] && cheb({ x, y }, g) <= 1)); if (p) return { path: p, why: '✨ 황금 몹을 쫓는다!' }; }
    const mode = pol.explore;
    let order;
    if (mode === 'stairs') {
      const st = get('stairs'); if (st) return st;
      const c = get('chest'); if (c && c.path.length <= 5) return c;
      order = ['front', 'chest', 'mon'];
    } else if (mode === 'treasure') order = ['chest', thief ? 'lock' : null, 'front', 'mon', 'stairs'];
    else {
      const c = get('chest'), f = get('front');
      if (c && f) return c.path.length <= f.path.length ? c : f;
      if (c || f) return c || f;
      order = [thief ? 'lock' : null, 'mon', 'stairs'];
    }
    for (const k of order) { if (!k) continue; const r = get(k); if (r) return r; }
    return null;
  }
  function healWalk(e) {
    const ps = e.party.filter(u => u.hp > 0), low = ps.slice().sort((a, b) => a.hp / stats(a).hp - b.hp / stats(b).hp)[0];
    if (!low || low.hp / stats(low).hp >= 0.6) return;
    for (const u of ps) {
      for (const sid of ['heal', 'bless']) {
        if (skillsOf(u).includes(sid) && (u.charges[sid] || 0) > 0) {
          const st = stats(u); u.charges[sid]--;
          if (sid === 'heal') low.hp = Math.min(stats(low).hp, low.hp + Math.round(st.atk * 1.8 + stats(low).hp * 0.15));
          else ps.forEach(a => { a.hp = Math.min(stats(a).hp, a.hp + Math.round(st.atk + stats(a).hp * 0.1)); });
          elog(e, `✨ ${u.name}의 ${SKILLS[sid].name}로 파티 회복`, 'good'); return;
        }
      }
    }
  }
  function descend(e) { e.floor++; for (const u of e.party) if (u.hp > 0) u.hp = Math.min(stats(u).hp, u.hp + Math.round(stats(u).hp * 0.05)); setFloor(e, e.floor); }
  function arrive(e) {
    const m = e.map, { x, y } = e.pos, t = m.grid[y][x];
    reveal(e);
    for (const g of m.groups) if (g.golden && g.alive && !g.announced && m.seen[g.y][g.x]) { g.announced = true; elog(e, `✨ ${g.name} 발견! 제한 시간 안에 잡으면 큰 보상!`, 'good'); }
    if (t === T.DOOR) m.grid[y][x] = T.OPEN;
    if (t === T.LOCK) { m.grid[y][x] = T.OPEN; elog(e, '🔓 도적이 잠긴 문을 열었다!', 'good'); }
    for (const g of m.groups) if (g.elite && g.alive && !g.announced && m.seen[g.y][g.x]) { g.announced = true; elog(e, '☠️ 정예 몹이 배회하고 있다! 강하지만 전리품이 좋다', 'warn'); }
    const c = m.chests.find(c => !c.open && c.x === x && c.y === y);
    if (c) {
      if (c.mimic) {
        c.mimic = false; const g = { tpls: ['mimic'], boss: false, alive: true, special: true, icon: '📦', name: '미믹', x, y, chest: c, announced: true }; m.groups.push(g);
        elog(e, hasThief(e) ? '🔎 도적이 눈치챘지만 이미 늦었다! 상자는 미믹이었다!' : '📦 상자가 이빨을 드러냈다! 미믹이다!', 'warn'); startBattle(e, g); return;
      }
      c.open = true; openChest(e, c.big);
    }
    const tr = m.traps.find(t2 => !t2.gone && t2.x === x && t2.y === y); if (tr) { tr.gone = true; triggerTrap(e, ''); }
    const sp = m.springs.find(s => !s.used && s.x === x && s.y === y);
    if (sp && e.party.some(u => u.hp > 0 && u.hp < stats(u).hp * 0.85)) { sp.used = true; e.party.forEach(u => { if (u.hp > 0) u.hp = Math.min(stats(u).hp, u.hp + Math.round(stats(u).hp * 0.4)); }); elog(e, '⛲ 치유의 샘! 파티의 HP가 회복되었다', 'good'); }
    if (t === T.STAIRS) descend(e);
  }
  // 정예 몹 배회 / 추격 (3걸음마다 한 칸, 추격 몹은 2걸음마다)
  function moveWanderers(e) {
    const m = e.map; e.stepN = (e.stepN || 0) + 1;
    for (const g of m.groups) {
      if (!g.alive || !g.wander || g.boss) continue;
      if (e.stepN % (g.chase ? 2 : 3)) continue;
      const cand = [];
      for (const [dx, dy] of D4) {
        const nx = g.x + dx, ny = g.y + dy; if (!inb(nx, ny)) continue;
        const t = m.grid[ny][nx]; if (t === T.WALL || t === T.LOCK || t === T.STAIRS || t === T.DOOR) continue;
        if (m.groups.some(o => o !== g && o.alive && o.x === nx && o.y === ny)) continue;
        if (nx === e.pos.x && ny === e.pos.y) continue;
        cand.push([nx, ny]);
      }
      if (!cand.length) continue;
      let q;
      if (g.chase || (cheb(g, e.pos) <= 7 && m.seen[g.y][g.x] && Math.random() < 0.6)) { cand.sort((a, b) => (Math.abs(a[0] - e.pos.x) + Math.abs(a[1] - e.pos.y)) - (Math.abs(b[0] - e.pos.x) + Math.abs(b[1] - e.pos.y))); q = cand[0]; }
      else q = pick(cand);
      g.x = q[0]; g.y = q[1];
    }
  }
  function spawnNear(e, g, dmin, dmax) {
    const m = e.map, d = floodDist(m.grid, e.pos.x, e.pos.y, true), c = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = m.grid[y][x];
      if (d[y][x] >= dmin && d[y][x] <= dmax && t !== T.WALL && t !== T.STAIRS && t !== T.LOCK && t !== T.DOOR && !m.groups.some(o => o.alive && o.x === x && o.y === y)) c.push([x, y]);
    }
    if (!c.length) return false;
    const q = pick(c); g.x = q[0]; g.y = q[1]; m.groups.push(g); m.seen[q[1]][q[0]] = true; return true;
  }
  // 조건부 특수 몹: 원혼(이 층에서 동료가 쓰러졌을 때), 도적단(노획 골드가 많을 때)
  function checkSpecials(e) {
    e.spawned = e.spawned || {};
    if (e.floor >= 5 && e.fallFloor === e.floor && !e.spawned['s' + e.floor] && Math.random() < 0.04) {
      const g = { tpls: ['spirit', 'spirit'], boss: false, alive: true, special: true, wander: true, chase: true, icon: '👻', name: '원혼', announced: true, x: 0, y: 0 };
      if (spawnNear(e, g, 4, 7)) { e.spawned['s' + e.floor] = 1; elog(e, '👻 쓰러진 동료의 원혼이 나타났다!', 'warn'); }
    }
    if (e.floor >= 6 && e.loot.gold >= 260 * e.floor && !e.spawned['b' + e.floor] && Math.random() < 0.015) {
      const g = { tpls: ['bandit', 'bandit', 'bandit'], boss: false, alive: true, special: true, wander: true, chase: true, icon: '🗡️', name: '도적단', announced: true, x: 0, y: 0 };
      if (spawnNear(e, g, 5, 8)) { e.spawned['b' + e.floor] = 1; elog(e, '🗡️ 노획물을 노리는 도적단이 나타났다!', 'warn'); }
    }
  }
  function stepMove(e) {
    const m = e.map, pol = e.save.policy, thief = hasThief(e);
    const tot = e.party.reduce((a, u) => a + stats(u).hp, 0), cur = e.party.reduce((a, u) => a + u.hp, 0);
    if (cur / tot * 100 < pol.retreat) { elog(e, '🏃 체력이 한계다. 미궁에서 귀환한다', 'warn'); finish(e, 'retreat'); return; }
    if (pol.downRetreat && e.party.some(u => u.hp <= 0)) { elog(e, '전투불능자가 발생하여 귀환한다', 'warn'); finish(e, 'retreat'); return; }
    if (thief) for (const t of m.traps) {
      if (t.gone) continue; const d = cheb(e.pos, t);
      if (!t.found && d <= 2) { t.found = true; elog(e, '🔎 도적이 함정을 발견했다'); }
      if (t.found && d <= 1) { t.gone = true; if (Math.random() < 0.85) elog(e, '⚠️ 도적이 함정을 해제했다', 'good'); else triggerTrap(e, '해제 실패! '); }
    }
    const g = m.groups.find(g => g.alive && cheb(e.pos, g) <= 1); if (g) { startBattle(e, g); return; }
    e.healT += STEP; if (e.healT > 2) { e.healT = 0; healWalk(e); }
    moveWanderers(e); checkSpecials(e);
    const tg = pickTarget(e);
    if (!tg) { m.seen.forEach(r => r.fill(true)); e.text = '길을 찾는 중…'; return; }
    e.path = tg.path; e.text = `${e.floor}층 · ${tg.why}`;
    // 안전장치: 같은 두세 칸만 오가며 진전이 없으면 귀환
    e.hist = e.hist || []; e.hist.push(e.pos.x * 100 + e.pos.y); if (e.hist.length > 60) e.hist.shift();
    if (e.hist.length >= 60 && new Set(e.hist).size <= 3) { elog(e, '길이 막혀 더 나아가지 못한다. 귀환한다', 'warn'); finish(e, 'retreat'); return; }
    const nx = tg.path[0]; e.trail.unshift({ x: e.pos.x, y: e.pos.y }); if (e.trail.length > 8) e.trail.pop();
    e.pos = { x: nx[0], y: nx[1] }; arrive(e);
    if (e.party.every(u => u.hp <= 0)) finish(e, 'wipe');
  }
  function setDirective(e, x, y) {
    const m = e.map; if (!inb(x, y) || !m.seen[y][x] || m.grid[y][x] === 0) return '갈 수 없는 위치입니다';
    if (m.grid[y][x] === T.LOCK && !hasThief(e)) return '🔒 도적이 없어 열 수 없습니다';
    e.directive = { x, y }; return null;
  }
  function stepExpedition(e, dt) {
    if (e.done) return;
    if (e.phase === 'explore') {
      e.moveT += dt; let n = 0;
      while (e.moveT >= STEP && e.phase === 'explore' && !e.done && n++ < 6) { e.moveT -= STEP; stepMove(e); }
      return;
    }
    if (e.phase === 'battle') {
      const b = e.battle; stepBattle(b, dt);
      for (const x of b.events) e.events.push(x);
      b.events.forEach(x => { if (x.k === 'log') e.log.push({ m: x.m, c: x.c || '' }); }); b.events = [];
      if (!b.result) return;
      if (e.bless > 0 && b.result !== 'retreat') e.bless--;
      if (b.result === 'escape') {
        b.group.alive = false; e.phase = 'explore'; e.moveT = -0.4; e.battle = null;
        if (e.party.every(u => u.hp <= 0)) finish(e, 'wipe');
        return;
      }
      if (b.result === 'win') {
        b.group.alive = false; elog(e, '🏆 승리!', 'good');
        if (b.group.chest) { b.group.chest.open = true; openChest(e, true); }
        if (b.fallen === 0) questEvent(e.save, 'flawless', null, (m, c) => elog(e, m, c));
        e.phase = 'explore'; e.moveT = -0.4; e.battle = null;
        if (b.group.boss && e.floor >= MAXF) { elog(e, '👑 흑왕을 쓰러뜨렸다! 50층 미궁 완전 정복!', 'good'); finish(e, 'clear'); return; }
        if (e.party.every(u => u.hp <= 0)) finish(e, 'wipe');
      } else if (b.result === 'retreat') { e.battle = null; finish(e, 'retreat'); }
      else { e.battle = null; elog(e, '💀 파티가 전멸했다…', 'bad'); finish(e, 'wipe'); }
    }
  }
  function manualRetreat(e) { if (e.done) return; if (e.battle) e.battle = null; finish(e, 'retreat'); }

  /* ---------- 소모품 ---------- */
  function useConsumable(e, id, unit) {
    const s = e.save; if ((s.cons[id] || 0) <= 0) return '수량이 없습니다';
    const st = stats(unit), b = e.battle, c = b && b.units.find(o => o.u === unit);
    const hpAdd = a => { unit.hp = Math.min(st.hp, unit.hp + Math.round(a)); if (c) { c.hp = unit.hp; } };
    if (id === 'escape') { s.cons[id]--; elog(e, '📜 귀환의 두루마리를 사용했다', 'warn'); manualRetreat(e); return null; }
    if (id === 'revive') { if (unit.hp > 0) return '전투불능인 대상에게만 사용할 수 있습니다'; unit.hp = Math.round(st.hp * 0.5); if (c) { c.alive = true; c.hp = unit.hp; } else if (b) { /* 이번 전투엔 불참 */ } }
    else if (unit.hp <= 0) return '전투불능 상태입니다 (부활의 깃털 필요)';
    else if (id === 'potion') hpAdd(st.hp * 0.35);
    else if (id === 'elixir') hpAdd(st.hp * 0.8);
    else if (id === 'antidote') { if (!unit.poison) return '독 상태가 아닙니다'; unit.poison = false; if (c) c.poisoned = false; }
    else if (id === 'ether') resetCharges(unit);
    s.cons[id]--; elog(e, `🧪 ${unit.name}에게 ${CONS[id].name} 사용`, 'good'); return null;
  }

  /* ---------- 장비 관리 ---------- */
  function equip(s, u, slot, itemId) {
    const old = u.equip[slot]; if (old) s.gear.push(old);
    if (itemId) { const i = s.gear.indexOf(itemId); if (i < 0) return; s.gear.splice(i, 1); }
    u.equip[slot] = itemId || null;
    u.hp = Math.min(u.hp, stats(u).hp); ensureCharges(u);
  }
  function autoEquip(s) {
    const score = i => (i.atk || 0) * 1.2 + (i.def || 0) + (i.hp || 0) * 0.15 + (i.skill ? 15 * i.tier : 0) + (i.spd || 0) * 4;
    for (const u of s.units) {
      if (!u.hired) continue;
      for (const slot in SLOTS) {
        const cur = ITEMS[u.equip[slot]], cands = s.gear.map(id => ITEMS[id]).filter(i => i.slot === slot);
        if (!cands.length) continue;
        cands.sort((a, b) => score(b) - score(a));
        if (!cur || score(cands[0]) > score(cur)) equip(s, u, slot, cands[0].id);
      }
    }
  }
  function describe(i) {
    const p = [];
    if (i.atk) p.push('공+' + i.atk); if (i.def) p.push('방+' + i.def); if (i.hp) p.push('HP+' + i.hp);
    if (i.range) p.push('사거리+' + i.range); if (i.spd) p.push('속+' + i.spd); if (i.eva) p.push('회피+' + Math.round(i.eva * 100) + '%');
    if (i.skill) p.push('[' + SKILLS[i.skill].name + ']');
    return p.join(' ');
  }

  return { GRID, FRONT_Y, BACK_Y, MAXF, MAXLV, CLASSES, ROW_TXT, SKILLS, SLOTS, ITEMS, CONS, ENEMIES, BOSSES, famsOf, needExp, TUNE, EXP_CUM, GOLDEN, SPECIALS, skillsOf, maxCharges, resetCharges, ensureCharges, stats, newSave, setDirective, genFloor, MW, MH, T, restoreLegends, costCap, usedCost, zoneOk, unitAt, place, autoFormation, genQuests, questEvent, createExpedition, stepExpedition, manualRetreat, useConsumable, equip, autoEquip, describe, wageOf, dropItem, registerLegend };
})();
if (typeof module !== 'undefined') module.exports = Core; else window.Core = Core;
