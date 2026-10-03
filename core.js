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
    cook:    { hpGrow: 0.9, name: '요리사', icon: '🍳', cost: 2, hp: 85, atk: 9, def: 4, spd: 10, range: 1, hire: 180, color: '#d98c4a', row: 'back', eva: 0.05 },
  };
  const ROW_TXT = { front: '전열 전용', back: '후열 전용', any: '전·후열' };
  // 전직 직업 (DEVNOTE 3-B): 기본 직업의 상위. 능력치 ×1.3(속도 +1), 코스트 +1. 직업 판정은 baseCls(u)를 사용.
  const PROMO = {
    warrior: ['swordsaint', '검성', '🌟', 'kenki'], knight: ['paladin', '성기사', '⚜️', 'sacred'], monk: ['monkmaster', '수도승', '☯️', 'renkan'],
    elf: ['archmarshal', '궁수 대장', '🏹', 'pierce'], mage: ['archmage', '대마도사', '🌌', 'meteor'], priest: ['highpriest', '대사제', '👼', 'sanctuary'], thief: ['assassin', '암살자', '🥷', 'assassinate'],
  };
  for (const base in PROMO) {
    const [id, name, icon, skill] = PROMO[base], b = CLASSES[base];
    CLASSES[id] = Object.assign({}, b, { base, promo: true, name, icon, skill, cost: b.cost + 1, hp: Math.round(b.hp * 1.3), atk: Math.round(b.atk * 1.3), def: Math.round(b.def * 1.3), spd: b.spd + 1, hire: Math.round(b.hire * 2.5) });
  }
  const baseCls = u => (CLASSES[u.cls] && CLASSES[u.cls].base) || u.cls;

  /* ---------- 등급 (용병·아이템 공통, DEVNOTE P1) ---------- */
  // mul=아이템 수치 배율, grow=용병 성장 배율, hireMul=고용비, costAdd=편성 코스트 가산, luck=용병 행운 범위, chance=아이템 기본 확률
  const RARITY = {
    N: { name: '일반', color: '#9aa0a6', mul: 1, grow: 1.0, hireMul: 1, costAdd: 0, luck: [0, 5], chance: 0.70, opts: 0 },
    U: { name: '우수', color: '#5cc26b', mul: 1.1, grow: 1.1, hireMul: 1.5, costAdd: 1, luck: [3, 10], chance: 0.22, opts: 0 },
    H: { name: '고급', color: '#4a90e2', mul: 1.25, grow: 1.2, hireMul: 2.5, costAdd: 2, luck: [6, 15], chance: 0.07, opts: 1 },
    L: { name: '전설', color: '#e0b030', mul: 1.5, grow: 1.35, hireMul: 5, costAdd: 3, luck: [10, 25], chance: 0.01, opts: 2 },
  };
  const RAR_ORDER = ['N', 'U', 'H', 'L'];

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
    flurry: { name: '연속 찌르기', type: 'flurry', mult: 0.9, uses: 4, master: 12 },
    // 전직 전용 스킬 — 스킬셋 업로드 전까지의 임시 구성(기존 스킬 유형 재사용), 숙련 습득 대상 아님(master 99)
    kenki:       { name: '검기 난무', type: 'adjacent', mult: 1.7, uses: 3, master: 99 },
    sacred:      { name: '성스러운 일격', type: 'holy', mult: 2.2, range: 2, magic: true, uses: 3, master: 99 },
    renkan:      { name: '연환권', type: 'flurry', mult: 1.1, uses: 3, master: 99 },
    pierce:      { name: '관통 사격', type: 'line', mult: 1.3, range: 5, uses: 3, master: 99 },
    meteor:      { name: '메테오', type: 'aoe', mult: 2.2, range: 5, magic: true, uses: 2, master: 99 },
    sanctuary:   { name: '성역', type: 'healall', uses: 3, master: 99 },
    assassinate: { name: '암살', type: 'single', mult: 3.2, uses: 3, master: 99 },
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
  // 신규 직업 전용 장비 — 제작 전용(대장간 도면 필요, Phase 3). CRAFT_ENABLED=false 로 바꾸면 상점에서 임시 판매.
  const CRAFT_ENABLED = true;
  it('w_knuckle', '철제 권갑', 'weapon', 1, { atk: 6, eva: 0.02, craft: true });
  it('w_claw', '강철 권갑', 'weapon', 3, { atk: 36, spd: 2, skill: 'power', craft: true });
  it('w_dfist', '용투 권갑', 'weapon', 4, { atk: 76, spd: 3, skill: 'cleave', craft: true });
  it('a_mrobe', '마도사의 로브', 'armor', 2, { def: 9, hp: 35, atk: 5, craft: true });
  it('a_archrobe', '대마도사의 로브', 'armor', 4, { def: 30, hp: 140, atk: 14, craft: true });
  it('w_cleaver', '식칼', 'weapon', 1, { atk: 7, craft: true });
  it('w_wok', '무쇠 프라이팬', 'weapon', 3, { atk: 34, def: 6, skill: 'guard', craft: true });
  it('s_dagger', '보조 단검', 'sub', 1, { atk: 4, eva: 0.03, craft: true });
  it('s_twin', '쌍날 단도', 'sub', 3, { atk: 22, spd: 2, eva: 0.05, skill: 'flurry', craft: true });
  it('s_fang', '그림자 송곳니', 'sub', 4, { atk: 45, spd: 3, eva: 0.08, skill: 'flurry', craft: true });

  /* ---------- 직업 제한 (DEVNOTE 1-B) ---------- */
  const FRONT2 = ['warrior', 'knight'];
  const RESTRICT = {
    w_cleaver: ['cook'], w_wok: ['cook'],
    w_dagger: ['thief', 'elf', 'monk', 'cook'], w_sword: ['warrior', 'knight', 'elf'], w_bow: ['elf', 'thief'], w_longbow: ['elf', 'thief'],
    w_great: ['warrior'], w_lance: FRONT2, w_flame: ['warrior', 'knight', 'mage'], w_saint: FRONT2,
    w_rod: ['mage'], w_icerod: ['mage'], w_mace: ['priest', 'knight'],
    w_knuckle: ['monk'], w_claw: ['monk'], w_dfist: ['monk'],
    s_buckler: ['warrior', 'knight', 'thief', 'elf', 'priest', 'cook'], s_shield: FRONT2, s_tower: FRONT2, s_book: ['mage', 'priest'], s_holybook: ['priest'],
    s_dagger: ['thief'], s_twin: ['thief'], s_fang: ['thief'],
    a_leather: ['warrior', 'monk', 'elf', 'thief', 'cook'], a_chain: ['warrior', 'knight', 'elf', 'thief', 'monk', 'cook'], a_plate: FRONT2, a_mithril: FRONT2,
    a_robe: ['priest', 'mage'], a_dragon: ['warrior', 'knight', 'monk'], a_mrobe: ['mage'], a_archrobe: ['mage'],
    c_cape: ['thief', 'elf'],
  };
  for (const id in RESTRICT) ITEMS[id].classes = RESTRICT[id];
  const canUse = (u, i) => !i || !i.classes || i.classes.includes(baseCls(u));

  // 전설 장비("!"): 매 드롭마다 무작위 이름/효과
  const LEG_PRE = ['고대의', '불멸의', '저주받은', '신들의', '서리의', '폭풍의', '황혼의'];
  function makeLegend(floor) {
    const slot = pick(Object.keys(SLOTS)), t = clamp(Math.ceil(floor / 10) + 1, 2, 5);
    const k = [0, 1, 1, 3, 6, 10][t] || 3;
    const base = { weapon: ['검', '창', '지팡이', '활', '권갑'], sub: ['방패', '성서'], armor: ['갑주', '로브'], acc1: ['목걸이', '망토', '투구'], acc2: ['반지'] }[slot];
    const LEG_CLS = { 검: ['warrior', 'knight', 'elf'], 창: FRONT2, 지팡이: ['mage', 'priest'], 활: ['elf', 'thief'], 권갑: ['monk'], 방패: FRONT2.concat('priest'), 성서: ['priest'], 갑주: FRONT2, 로브: ['mage', 'priest'], 망토: ['thief', 'elf'] };
    const o = { slot, tier: t, price: TIER_PRICE[t] * 2, legend: true, rarity: 'L' };
    const bn = pick(base);
    o.name = pick(LEG_PRE) + ' ' + bn + '!';
    if (LEG_CLS[bn]) o.classes = LEG_CLS[bn];
    if (slot === 'weapon') o.atk = Math.round(14 * k * rnd(1.1, 1.5));
    else if (slot === 'armor' || slot === 'sub') { o.def = Math.round(8 * k * rnd(1.1, 1.5)); o.hp = Math.round(25 * k); }
    else { o.hp = Math.round(30 * k * rnd(0.8, 1.4)); o.atk = Math.round(4 * k * rnd(0.8, 1.4)); o.spd = ri(1, 4); }
    if (Math.random() < 0.7) o.skill = pick(Object.keys(SKILLS).filter(k => k !== 'flurry'));
    o.id = 'L' + Date.now().toString(36) + ri(100, 999);
    ITEMS[o.id] = o;
    return o.id;
  }
  // 우수/고급 장비: 기본 장비에 등급 배율과 옵션을 입혀 새 항목으로 생성(세이브에 저장 — registerLegend)
  const OPT_POOL = ['hp', 'def', 'atk', 'spd', 'eva'];
  function makeRarityItem(baseId, rar) {
    const b = ITEMS[baseId], R = RARITY[rar], k = [0, 1, 2, 4, 7, 12][b.tier] || 1;
    const o = Object.assign({}, b, { id: baseId + '~' + rar + Date.now().toString(36) + ri(100, 999), rarity: rar, gen: true, base: baseId, name: R.name + ' ' + b.name });
    for (const st of ['atk', 'def', 'hp']) if (o[st]) o[st] = Math.round(o[st] * R.mul);
    const used = new Set();
    for (let n = 0; n < R.opts; n++) {
      let st; do { st = pick(OPT_POOL); } while (used.has(st)); used.add(st);
      o[st] = (o[st] || 0) + ({ hp: 12 * k, def: 2 * k, atk: 2 * k, spd: 1, eva: 0.03 }[st]);
    }
    o.price = Math.round(b.price * R.mul * (1 + R.opts * 0.3));
    ITEMS[o.id] = o;
    return o.id;
  }
  const partyLuck = party => party && party.length ? party.reduce((a, u) => a + (u.luck || 0), 0) / party.length : 0;
  // 등급 판정: 기본 확률 + 행운(파티 평균 1당 +0.4%p, 상한 +15%p) + 보스/정예 가산
  function rollRarity(luck, kind) {
    let b = Math.min(0.15, luck * 0.004) + (kind === 'boss' ? 0.12 : kind === 'elite' ? 0.05 : 0);
    const pL = RARITY.L.chance + b * 0.3, pH = RARITY.H.chance + b * 0.7, pU = RARITY.U.chance;
    const r = Math.random();
    if (r < pL) return 'L'; if (r < pL + pH) return 'H'; if (r < pL + pH + pU) return 'U'; return 'N';
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
  // 식용 태그 (DEVNOTE 2-D): 'harmless' 무해 / 'poison' 유독(요리사가 해독 처리해 식량화) / 'none' 식용불가. premium=고급 식량(×2)
  const EDIBLE = { slime: 'harmless', goblin: 'harmless', gobarch: 'harmless', bat: 'poison', spider: 'poison', orc: 'harmless', shaman: 'harmless', wyvern: 'harmless', dragon: 'harmless', ggob: 'harmless', gbat: 'poison' };
  const PREMIUM = new Set(['wyvern', 'dragon']);
  ENEMIES.concat(GOLDEN, SPECIALS).forEach(t => { t.edible = EDIBLE[t.id] || 'none'; });
  { const BE = { 5: 'harmless', 15: 'poison', 20: 'poison', 40: 'harmless', 45: 'harmless' }; for (const f in BOSSES) BOSSES[f].edible = BE[f] || 'none'; BOSSES[40].premium = BOSSES[45].premium = true; }
  const bandOf = f => Math.min(4, Math.floor((f - 1) / 10));
  const poolOf = f => { const b = bandOf(f); return ENEMIES.filter(e => e.band === b || e.band === b - 1); };
  const famsOf = f => [...new Set(poolOf(f).map(e => e.fam))];

  /* ---------- 능력치 ---------- */
  /* 원작(지오컨플릭트3) 분석값 기반 — ref/README.md 참고.
     경험치 누적표(레벨 2~49)는 원작 그대로, 50레벨은 간격을 이어 붙임. */
  const EXP_CUM = [0, 0, 100, 200, 400, 700, 1200, 1900, 2900, 4200, 5700, 7500, 9500, 13500, 19000, 26000, 34000, 46000, 60000, 76000, 94000, 114000, 136000, 160000, 186000, 214000, 244000, 276000, 310000, 346000, 384000, 424000, 466000, 510000, 560000, 620000, 690000, 770000, 860000, 960000, 1080000, 1230000, 1400000, 1550000, 1720000, 1910000, 2120000, 2320000, 2540000, 2800000, 3100000];
  // 조정값 (시뮬레이터로 튜닝). 성장은 원작처럼 "레벨당 선형 증가" — HP는 완만, ATK/DEF는 기본값 대비 크게.
  // food: perStep=이동 1칸·1명당 소모, price=개당 가격, yield=[기본, 층당] 식용 몹 처치 시 식량(요리사 동행), start=새 게임 식량
  // fatigue: rest=휴식 용병 귀환 회복, work=출전 용병 귀환 회복, death=전투불능 시 감소, starve=식량 0 이동당 피로 감소
  // pace: 게임 진행 속도의 기본 배율 역수(1=기본). 클수록 모든 배속에서 느려진다(플레이 시간 조정용)
  const TUNE = { pace: 13, food: { perStep: 0.012, price: 6, yield: [0.4, 0.03], start: 20 }, fatigue: { rest: 25, work: 5, death: 25, starve: 0.25, cook: 2 }, expScale: 4, growHp: 0.035, growAtk: 0.12, growDef: 0.30, eHp: 0.30, eAtk: 0.12, eDef: 0.15, eHp10: 0.18, eAtk10: 0.13 };
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
  // 피로도 (DEVNOTE 2-A): 100=정상. 50 미만 공·방 −10% / 25 미만 −25%·회피 −10%p / 0 출격 불가
  const fatOf = u => u.fatigue === undefined ? 100 : u.fatigue;
  const fatMul = u => { const f = fatOf(u); return f >= 50 ? 1 : f >= 25 ? 0.9 : 0.75; };
  const canSortie = u => fatOf(u) > 0;
  const rarOf = u => RARITY[u.rar] ? u.rar : 'N';
  const growOf = u => u.growMul || RARITY[rarOf(u)].grow;
  const costOf = u => CLASSES[u.cls].cost + RARITY[rarOf(u)].costAdd;
  // 요리사 자동 보급: 요리사가 출전 파티에 있으면 최소 5층 분량(층당 약 200걸음)까지 식량을 자동 구매해 채운다.
  // 급료를 지불한 뒤 남은 골드 범위에서만 구매한다. 요리사가 없으면 null.
  const SUPPLY_FLOORS = 7, STEPS_PER_FLOOR = 300; // 요리사 자동 보급 목표: 7층 분량 (층이 넓어져 층당 약 300걸음 기준)
  function supplyPlan(s) {
    const party = s.units.filter(u => u.hired && s.formation[u.id] && canSortie(u));
    if (!party.some(u => baseCls(u) === 'cook')) return null;
    const members = party.length + squadUnits(s).length;
    const target = Math.round(members * TUNE.food.perStep * STEPS_PER_FLOOR * SUPPLY_FLOORS * comboOf(party).foodMul * 10) / 10;
    const need = Math.max(0, Math.ceil(target - s.food)), avail = Math.max(0, s.gold - sortieWage(s));
    const buy = Math.min(need, Math.floor(avail / TUNE.food.price));
    return { target, need, buy, cost: buy * TUNE.food.price, short: buy < need };
  }
  const PROMO_PRICE = 2500;
  function buyPromo(s) { if (s.gold < PROMO_PRICE) return false; s.gold -= PROMO_PRICE; s.promo = (s.promo || 0) + 1; return true; }
  function buyFood(s, n) { const c = n * TUNE.food.price; if (s.gold < c) return false; s.gold -= c; s.food = Math.round((s.food + n) * 100) / 100; return true; }
  const hireCost = u => Math.round(CLASSES[u.cls].hire * RARITY[rarOf(u)].hireMul);
  const canLead = u => rarOf(u) === 'H' || rarOf(u) === 'L';
  function stats(u) {
    const c = CLASSES[u.cls], L = (u.lv - 1) * growOf(u);
    let hp = Math.round(c.hp * (1 + TUNE.growHp * L * (c.hpGrow || 1))), atk = Math.round(c.atk * (1 + TUNE.growAtk * L)), def = Math.round(c.def * (1 + TUNE.growDef * L)), spd = c.spd, eva = c.eva, rng = c.range;
    for (const slot in SLOTS) {
      const i = ITEMS[u.equip[slot]]; if (!i) continue;
      rng += i.range || 0; hp += i.hp || 0; atk += i.atk || 0; def += i.def || 0; spd += i.spd || 0; eva += i.eva || 0;
    }
    const fm = fatMul(u); atk = Math.round(atk * fm); def = Math.round(def * fm); if (fm < 0.8) eva = Math.max(0, eva - 0.1);
    return { hp, atk, def, spd, eva: Math.min(eva, 0.5), range: rng };
  }

  /* ---------- 세이브 ---------- */
  // [이름, 직업, 시작 고용, 등급] — 12명은 기존 세이브와 id 호환(1~12), 13~18은 v3 신규, 19~20은 요리사(Phase 2)
  const ROSTER = [
    ['레온', 'warrior', 1, 'H'], ['아델', 'knight', 0, 'N'], ['실비아', 'elf', 1, 'N'], ['마르코', 'mage', 0, 'N'], ['루나', 'priest', 1, 'N'], ['핀', 'thief', 1, 'N'],
    ['가론', 'monk', 0, 'N'], ['헬가', 'warrior', 0, 'N'], ['오스카', 'knight', 0, 'N'], ['에리스', 'mage', 0, 'N'], ['티티스', 'elf', 0, 'N'], ['세라', 'priest', 0, 'N'],
    ['카이', 'thief', 0, 'U'], ['바울', 'monk', 0, 'U'], ['이사벨', 'knight', 0, 'U'], ['리아', 'elf', 0, 'U'], ['클로에', 'priest', 0, 'H'], ['카산드라', 'mage', 0, 'L'],
    ['마르타', 'cook', 0, 'N'], ['구스타프', 'cook', 0, 'U'],
  ];
  const lumin = r => RARITY[r].luck;
  function mkUnit(i, r, legacy) {
    const rar = r[3] || 'N';
    const u = { id: i + 1, name: r[0], cls: r[1], rar, fatigue: 100, lv: 1, exp: 0, hp: 0, equip: { weapon: null, sub: null, armor: null, acc1: null, acc2: null }, learned: [], mastery: {}, charges: {}, hired: !!r[2] };
    u.growMul = RARITY[rar].grow;
    u.luck = legacy ? lumin(rar)[0] : (rar === 'L' ? lumin(rar)[0] : ri(lumin(rar)[0], lumin(rar)[1])); // 전설은 고용 주사위로 확정
    return u;
  }
  // 고용 처리. 전설은 주사위(성장 배율 1.25~1.45, 결과에 따라 시작 행운 상승, 실패 없음)
  function hireUnit(s, u) {
    const cost = hireCost(u); if (s.gold < cost || u.hired) return null;
    s.gold -= cost; u.hired = true;
    let dice = null;
    if (rarOf(u) === 'L' && !u.rolled) {
      const g = Math.round(rnd(1.25, 1.45) * 100) / 100, R = RARITY.L.luck;
      u.growMul = g; u.luck = clamp(Math.round(R[0] + (g - 1.25) / 0.2 * (R[1] - R[0]) * 0.6 + rnd(0, (R[1] - R[0]) * 0.4)), R[0], R[1]);
      u.rolled = true; dice = { grow: g, luck: u.luck };
    }
    u.hp = stats(u).hp; resetCharges(u);
    return { cost, dice };
  }
  function newSave() {
    const units = ROSTER.map((r, i) => mkUnit(i, r, false));
    const byName = n => units.find(u => u.name === n);
    byName('레온').equip.weapon = 'w_sword'; byName('실비아').equip.weapon = 'w_bow';
    byName('루나').equip.weapon = 'w_mace'; byName('핀').equip.weapon = 'w_dagger';
    const s = {
      v: 3, opts: { autoEquip: true, autoIdle: false }, squads: [], comp: {}, mats: {}, bps: Object.fromEntries(START_BPS.map(id => [id, true])), promo: 0, food: TUNE.food.start, gold: 600, day: 1, maxFloor: 1, cleared: false, units,
      gear: ['a_leather', 'a_leather', 's_buckler', 'r_power'], cons: { potion: 3, antidote: 1, escape: 1 },
      formation: {}, policy: { retreat: 25, skill: 'mid', explore: 'full', stance: 'attack', target: 'nearest', leader: 1, downRetreat: false },
      quests: { board: [], active: [], done: 0 }, qid: 1,
    };
    units.forEach(u => { u.hp = stats(u).hp; resetCharges(u); });
    autoFormation(s); genQuests(s);
    return s;
  }
  // v2 → v3: 기존 용병은 전부 일반(레온 포함 — 고급 시작은 새 게임 한정), 행운=등급 하한, 신규 용병 추가, 옵션 기본값
  function migrateSave(s) {
    if (!s || (s.v !== 2 && s.v !== 3)) return null;
    s.opts = Object.assign({ autoEquip: true, autoIdle: false }, s.opts || {});
    for (const u of s.units) {
      if (!RARITY[u.rar]) u.rar = 'N';
      if (!u.growMul) u.growMul = RARITY[u.rar].grow;
      if (u.luck === undefined) u.luck = lumin(u.rar)[0];
      if (u.fatigue === undefined) u.fatigue = 100;
    }
    if (s.food === undefined) s.food = TUNE.food.start;
    if (!s.squads) s.squads = []; if (!s.comp) s.comp = {};
    if (!s.mats) s.mats = {}; if (!s.bps) s.bps = Object.fromEntries(START_BPS.map(id => [id, true])); if (s.promo === undefined) s.promo = 0;
    ROSTER.forEach((r, i) => { if (!s.units.find(u => u.id === i + 1)) s.units.push(mkUnit(i, r, false)); });
    s.v = 3;
    return s;
  }
  function restoreLegends(s) { // 저장된 전설 장비 정의 복원용
    (s.legends || []).forEach(l => { ITEMS[l.id] = l; });
  }
  function registerLegend(s, id) { s.legends = s.legends || []; if (!s.legends.find(l => l.id === id)) s.legends.push(ITEMS[id]); }

  const costCap = s => 10 + Math.floor(s.maxFloor / 4);
  const usedCost = s => s.units.filter(u => u.hired && s.formation[u.id]).reduce((a, u) => a + costOf(u), 0);
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
    if (!canSortie(u)) return '피로가 한계입니다 (휴식 필요)';
    if (inSquad(s, u)) return '분대에 배정된 용병입니다 (분대 탭에서 해제)';
    if (!zoneOk(u.cls, y) || x < 0 || x >= GRID) return `${CLASSES[u.cls].name}은(는) ${ROW_TXT[CLASSES[u.cls].row]} 입니다`;
    const o = unitAt(s, x, y); if (o && o.id !== u.id) return '이미 다른 용병이 있습니다';
    const was = s.formation[u.id];
    const used = usedCost(s) - (was ? costOf(u) : 0) + costOf(u);
    if (used > costCap(s)) return `코스트 초과 (${used}/${costCap(s)})`;
    s.formation[u.id] = [x, y]; return null;
  }
  function autoFormation(s) {
    s.formation = {};
    const xs = [4, 3, 5, 2, 6, 1, 7, 0, 8];
    const ld = s.policy.leader; // 리더는 항상 먼저 편성(고급 이상이라 코스트가 높아 밀리는 것 방지)
    const order = s.units.filter(u => u.hired && canSortie(u) && !inSquad(s, u)).sort((a, b) => (b.id === ld) - (a.id === ld) || b.lv - a.lv || costOf(a) - costOf(b));
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

  /* ---------- 재료 · 도면 · 대장간 (DEVNOTE 3-A) ---------- */
  // 몹 계열 → [일반 재료, 정예 재료]. 보스는 층별 고유 희귀 재료('b5'…'b50'), 지형 재료는 테마별.
  const FAM_MAT = { 슬라임: ['slime', 'e_slime'], 고블린: ['cloth', 'e_goblin'], 짐승: ['leather', 'e_beast'], 언데드: ['bone', 'e_undead'], 오크: ['iron', 'e_orc'], 골렘: ['stone', 'e_golem'], 악마: ['ash', 'e_demon'], 용족: ['scale', 'e_dragon'] };
  const MATS = {
    slime: '슬라임 점액', cloth: '낡은 천', leather: '질긴 가죽', bone: '뼈 조각', iron: '철 조각', stone: '돌 조각', ash: '검은 재', scale: '비늘 조각',
    e_slime: '슬라임 핵', e_goblin: '고블린 문장', e_beast: '야수의 송곳니', e_undead: '망령의 파편', e_orc: '오크 전투 문양', e_golem: '골렘의 핵', e_demon: '악마의 뿔', e_dragon: '용의 심장 비늘',
    b5: '고블린 대왕의 왕관', b10: '다크 엘프의 인장', b15: '독거미 여왕의 독낭', b20: '히드라의 송곳니', b25: '골렘 군주의 심장석', b30: '리치 왕의 두개골', b35: '흑기사의 흑철', b40: '라프닐의 역린', b45: '심연의 용안', b50: '흑왕의 파편',
    t_swamp: '늪의 진흙', t_desert: '사막의 유리', t_river: '강변의 수정', t_volcano: '용암석', t_resonance: '공진 결정',
  };
  const matKind = id => id[0] === 'b' && /^b\d+$/.test(id) ? 'boss' : id.startsWith('e_') ? 'elite' : id.startsWith('t_') ? 'terrain' : 'common';
  const BOSS_FLOOR = [5, 15, 25, 35, 45]; // 장비 티어(1~5) → 요구 보스 재료 층
  const FAMS = Object.keys(FAM_MAT);
  const famOfItem = id => FAMS[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % FAMS.length];
  function addMats(bag, id, n) { bag[id] = Math.round(((bag[id] || 0) + n) * 100) / 100; }
  // 제작 가능 기반 장비: 직업 전용(craft) + 고급/전설 업그레이드용 일반 장비(T2+, 직업 제한 있는 것)
  const craftBases = () => Object.values(ITEMS).filter(i => !i.legend && !i.gen && (i.craft || (i.tier >= 2 && i.classes))).map(i => i.id);
  const START_BPS = ['w_knuckle', 'w_cleaver', 's_dagger', 'a_mrobe'];
  function rollBlueprint(s, floor, kind) {
    const tmax = Math.min(5, 2 + Math.floor(floor / 10)), pool = craftBases().filter(id => ITEMS[id].tier <= tmax && !(s.bps && s.bps[id]));
    if (!pool.length) return null;
    const ex = pool.filter(id => ITEMS[id].craft), ordinary = pool.filter(id => !ITEMS[id].craft);
    return pick(ex.length && (!ordinary.length || Math.random() < 0.6) ? ex : ordinary);
  }
  // 적 처치 시 재료·도면·전직서 드롭 (일반 < 정예 < 보스)
  function dropLoot(b, c) {
    const e = b.exp, L = e.loot; L.mats = L.mats || {}; L.bps = L.bps || []; L.promo = L.promo || 0;
    const fm = FAM_MAT[c.fam], log = (m) => ev(b, { k: 'log', m, c: 'good' }), add = (id, n) => { addMats(L.mats, id, n); return `${MATS[id]} ×${n}`; };
    const got = [];
    if (c.boss) {
      got.push(add('b' + b.floor, 1));
      const fams = [...new Set(poolOf(b.floor).map(x => x.fam))].filter(f => FAM_MAT[f]); for (let k = 0; k < 2; k++) { const f = pick(fams); if (f) got.push(add(FAM_MAT[f][0], ri(1, 2))); }
      if (Math.random() < 0.45) { const id = rollBlueprint(b.exp.save, b.floor, 'boss'); if (id && !L.bps.includes(id)) { L.bps.push(id); got.push(`📐도면 ${ITEMS[id].name}`); } }
      if (Math.random() < 0.25) { L.promo++; got.push('📜전직서'); }
    } else if (c.elite && fm) {
      got.push(add(fm[0], ri(1, 2))); if (Math.random() < 0.7) got.push(add(fm[1], 1));
      if (Math.random() < 0.08) { const id = rollBlueprint(b.exp.save, b.floor, 'elite'); if (id && !L.bps.includes(id)) { L.bps.push(id); got.push(`📐도면 ${ITEMS[id].name}`); } }
    } else if (fm && !c.golden && !c.special && Math.random() < 0.3) got.push(add(fm[0], 1));
    const th = b.exp.map && b.exp.map.themes;
    if (th && th.length && !c.special && Math.random() < (c.boss || c.elite ? 0.6 : 0.18)) got.push(add('t_' + pick(th), 1));
    if (got.length && (c.boss || c.elite)) log(`🎒 재료 획득: ${got.join(', ')}`);
  }
  // 제작 레시피: grade 'N'(전용 장비만) / 'H' 고급 / 'L' 전설. 전설은 보스 재료 3개 필수.
  function recipeOf(baseId, grade) {
    const b = ITEMS[baseId], t = b.tier, fam = famOfItem(baseId), up = t >= 3 ? 1 : 0;
    const R = { N: { c: 3 + t, e: 1 + up, bs: 1, tr: 0, g: 1 }, H: { c: 5 + t, e: 2 + up, bs: 2, tr: 0, g: 2 }, L: { c: 8 + t, e: 3 + up, bs: 3, tr: 2, g: 4 } }[grade];
    return { base: baseId, grade, gold: Math.max(100, Math.round(b.price * R.g)), need: [[FAM_MAT[fam][0], R.c], [FAM_MAT[fam][1], R.e], ['b' + BOSS_FLOOR[t - 1], R.bs]], terrain: R.tr };
  }
  const terrainHave = s => Object.keys(s.mats || {}).filter(k => k.startsWith('t_')).reduce((a, k) => a + Math.floor(s.mats[k]), 0);
  function canCraft(s, baseId, grade) {
    const b = ITEMS[baseId]; if (!b || !(s.bps && s.bps[baseId])) return '도면이 없습니다';
    if (grade === 'N' && !b.craft) return '이 장비의 일반 등급은 제작하지 않습니다 (드롭·상점)';
    const r = recipeOf(baseId, grade);
    if (s.gold < r.gold) return '골드가 부족합니다';
    for (const [m, n] of r.need) if ((s.mats[m] || 0) < n) return `${MATS[m]} 부족`;
    if (terrainHave(s) < r.terrain) return '지형 재료 부족';
    return null;
  }
  function craft(s, baseId, grade) {
    const why = canCraft(s, baseId, grade); if (why) return { err: why };
    const r = recipeOf(baseId, grade); s.gold -= r.gold;
    for (const [m, n] of r.need) addMats(s.mats, m, -n);
    let left = r.terrain; for (const k of Object.keys(s.mats).filter(k => k.startsWith('t_')).sort((a, b) => s.mats[b] - s.mats[a])) { const x = Math.min(left, Math.floor(s.mats[k])); addMats(s.mats, k, -x); left -= x; }
    // 행운: 확률로 한 등급 상승 (파티 평균 행운 1당 +0.4%p, 상한 15%p)
    const luck = partyLuck(s.units.filter(u => u.hired && s.formation[u.id]));
    let rar = grade; const up = Math.random() < Math.min(0.15, luck * 0.004); if (up && rar !== 'L') rar = RAR_ORDER[RAR_ORDER.indexOf(rar) + 1];
    let id = baseId;
    if (rar !== 'N') { id = makeRarityItem(baseId, rar); registerLegend(s, id); }
    s.gear.push(id);
    return { id, rar, upgraded: up && rar !== grade };
  }

  /* ---------- 전직 (DEVNOTE 3-B) ---------- */
  const PROMO_LV = 20;
  const canPromote = u => !CLASSES[u.cls].promo && !!PROMO[u.cls] && u.lv >= PROMO_LV;
  function promote(s, u) {
    if (!canPromote(u)) return `Lv${PROMO_LV} 이상의 기본 직업만 전직할 수 있습니다`;
    if ((s.promo || 0) <= 0) return '전직서가 없습니다';
    const [id, , , skill] = PROMO[u.cls]; s.promo--; u.cls = id;
    u.learned = u.learned || []; if (!u.learned.includes(skill)) u.learned.push(skill);
    ensureCharges(u); u.hp = stats(u).hp;
    if (s.formation[u.id] && usedCost(s) > costCap(s)) delete s.formation[u.id]; // 코스트 +1로 상한을 넘으면 편성에서 제외
    return null;
  }

  /* ---------- 직업 조합 보너스 (DEVNOTE 3-C) ---------- */
  // 상한 5%대(비전투 효과 예외). 같은 직업 3명 이상이면 모든 보너스 없음(중복 억제).
  function comboOf(party) {
    const out = { list: [], all: 1, def: 1, skillUses: 0, rangePlus: 0, foodMul: 1, dup: false };
    if (!party.length) return out;
    const cnt = {}; party.forEach(u => { const k = baseCls(u); cnt[k] = (cnt[k] || 0) + 1; });
    if (Object.values(cnt).some(n => n >= 3)) { out.dup = true; return out; }
    if (cnt.warrior && cnt.priest && cnt.thief) { out.all = 1.03; out.list.push({ name: '균형 편성', desc: '전 스탯 +3%' }); }
    if (party.filter(u => CLASSES[u.cls].row === 'front').length >= 3) { out.def = 1.05; out.list.push({ name: '전열 방벽', desc: '방어 +5% (전열 3명 이상)' }); }
    if (cnt.mage && cnt.priest) { out.skillUses = 1; out.list.push({ name: '후열 합주', desc: '모든 스킬 사용 횟수 +1' }); }
    if (cnt.elf) { out.rangePlus = 1; out.list.push({ name: '엘프의 눈', desc: '원거리 직업 사거리 +1' }); }
    if (cnt.cook) { out.foodMul = 0.85; out.list.push({ name: '야전 취사', desc: '식량 소모 −15%' }); }
    return out;
  }

  /* ---------- 분대 (DEVNOTE Phase 4) ---------- */
  // 본대 전투를 돕는 화면 밖 지원 편성. 전용 코스트 풀을 쓰고, 요구 직업 조합을 모두 채워야 발동한다.
  const SQUADS = {
    cheer:    { name: '응원 분대', icon: '📣', cost: 7, req: ['priest', 'elf'], desc: '전투 시작 시 아군 전체 공·방 +10%' },
    disrupt:  { name: '교란 분대', icon: '🌀', cost: 6, req: ['thief', 'mage'], desc: '적 전체 속도 −15%, 명중 −12%p' },
    guardian: { name: '수호 분대', icon: '🛡️', cost: 8, req: ['knight', 'priest'], desc: '아군이 치명타로 쓰러질 때 전투당 1회 HP 1로 버팀' },
    battery:  { name: '마법 포대 분대', icon: '☄️', cost: 11, req: ['mage', 'mage', 'priest'], desc: '9초마다 전범위 마법 (적이 많을수록 개별 피해 감소) · 마력공진 구역의 적은 맞지 않음' },
    sniper:   { name: '저격 분대', icon: '🎯', cost: 8, req: ['elf', 'thief', 'elf'], desc: '7초마다 가장 위험한 적 저격 (보스는 피해 제한) · 마력공진 구역의 적은 지정 불가' },
  };
  const squadSlots = s => s.maxFloor >= 46 ? 4 : s.maxFloor >= 31 ? 3 : s.maxFloor >= 16 ? 2 : s.maxFloor >= 6 ? 1 : 0; // 5·15·30·45층 클리어
  const squadCap = s => 6 + Math.floor(s.maxFloor / 3);
  const inSquad = (s, u) => (s.squads || []).some(q => q.members.includes(u.id));
  function squadErr(s, q) { // 편성이 유효하지 않은 이유(유효하면 null)
    const d = SQUADS[q.type]; if (!d) return '분대 종류 미선택';
    for (let i = 0; i < d.req.length; i++) {
      const u = s.units.find(x => x.id === q.members[i]);
      if (!u || !u.hired) return `${CLASSES[d.req[i]].name} 미배정`;
      if (baseCls(u) !== d.req[i] || !canSortie(u)) return `${u.name}: 조건 불충족(직업·피로)`;
      if (s.formation[u.id]) return `${u.name}은(는) 본대에 편성됨`;
    }
    return null;
  }
  function activeSquads(s) { // 슬롯 순서대로, 코스트 풀 안에서 유효한 분대만
    const out = []; let used = 0;
    (s.squads || []).slice(0, squadSlots(s)).forEach(q => { if (q.type && !out.some(o => o.type === q.type) && !squadErr(s, q) && used + SQUADS[q.type].cost <= squadCap(s)) { used += SQUADS[q.type].cost; out.push(q); } }); // 같은 종류는 효과가 겹치지 않아 첫 슬롯만 발동
    return out;
  }
  const squadUsed = s => activeSquads(s).reduce((a, q) => a + SQUADS[q.type].cost, 0);
  const squadUnits = s => activeSquads(s).flatMap(q => q.members.map(id => s.units.find(u => u.id === id)));
  function setSquad(s, idx, type) {
    s.squads = s.squads || []; while (s.squads.length <= idx) s.squads.push({ type: null, members: [] });
    s.squads[idx] = { type: type || null, members: type ? SQUADS[type].req.map(() => null) : [] };
  }
  function assignSquad(s, idx, pos, uid) {
    const q = s.squads[idx]; if (!q || !q.type) return '분대 종류를 먼저 고르세요';
    if (!uid) { q.members[pos] = null; return null; }
    const u = s.units.find(x => x.id === uid); if (!u || !u.hired) return '고용한 용병만 배정할 수 있습니다';
    if (baseCls(u) !== SQUADS[q.type].req[pos]) return `${CLASSES[SQUADS[q.type].req[pos]].name} 직업이 필요합니다`;
    if (!canSortie(u)) return '피로가 한계입니다';
    if (s.squads.some((o, i) => o.members.includes(uid) && !(i === idx && o.members[pos] === uid))) return '이미 다른 분대에 배정되어 있습니다';
    delete s.formation[uid]; q.members[pos] = uid; return null;
  }
  const sortieWage = s => wageOf(s.units.filter(u => u.hired && s.formation[u.id] && canSortie(u)).concat(squadUnits(s)));
  // 전투 중 분대 효과(마법 포대·저격): 마력공진 구역의 적은 대상에서 제외
  function squadTick(b) {
    if (!b.sq || !b.sq.size) return;
    const foes = alive(b, 'e'), ps = alive(b, 'p'); if (!foes.length || !ps.length) return;
    const avg = ps.reduce((a, c) => a + c.atk, 0) / ps.length, ok = o => cellTh(b, o) !== 'resonance', pseudo = { side: 'p', atk: avg, x: 4, y: 8, name: '분대', poison: 0 };
    if (b.sq.has('battery') && b.t >= (b.nextBat || 6)) {
      b.nextBat = b.t + 9; const tg = foes.filter(ok);
      if (tg.length) { ev(b, { k: 'area', cells: tg.map(o => [o.x, o.y]), col: '#b48cff', big: true }); ev(b, { k: 'log', m: '☄️ 마법 포대 분대의 일제 포격!', c: 'good' }); const cap = Math.min(1, 3 / tg.length); tg.forEach(o => damage(b, pseudo, o, 1.4 * cap, true)); }
      else ev(b, { k: 'log', m: '🔮 마력공진이 포격을 흩어 버렸다', c: 'warn' });
    }
    if (b.sq.has('sniper') && b.t >= (b.nextSnp || 5)) {
      b.nextSnp = b.t + 7; const tg = foes.filter(ok).filter(o => o.alive).sort((p, q) => q.atk - p.atk)[0];
      if (tg) {
        let dmg = Math.max(1, Math.round(avg * 3.0 - tg.def * 0.25)); if (tg.boss) dmg = Math.min(dmg, Math.round(tg.maxhp * 0.06));
        ev(b, { k: 'area', cells: [[tg.x, tg.y]], col: '#ffd24a', big: false }); ev(b, { k: 'log', m: `🎯 저격 분대가 ${tg.name}을(를) 저격!`, c: 'good' });
        setHp(tg, tg.hp - dmg); ev(b, { k: 'dmg', x: tg.x, y: tg.y, v: dmg, crit: true, side: 'e' }); if (tg.hp <= 0) die(b, tg, pseudo);
      }
    }
  }

  /* ---------- 드롭 ---------- */
  // o: { luck: 파티 평균 행운, kind: 'boss' | 'elite' }
  function dropItem(floor, o) {
    o = o || {};
    const rar = rollRarity(o.luck || 0, o.kind);
    if (rar === 'L') return makeLegend(floor);
    const tmax = Math.min(5, 1 + Math.floor(floor / 10));
    const c = Object.values(ITEMS).filter(i => !i.legend && !i.gen && !i.craft && i.tier <= tmax && i.tier >= Math.max(1, tmax - 1));
    let pool = c;
    if (o.party && Math.random() < 0.7) { const f = c.filter(i => o.party.some(u => canUse(u, i))); if (f.length) pool = f; } // 현재 파티가 쓸 수 있는 장비 위주
    const base = pick(pool).id;
    return rar === 'N' ? base : makeRarityItem(base, rar);
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
      edible: t.edible || 'none', premium: !!(t.premium || PREMIUM.has(t.id)),
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
  /* ---------- 지형 테마 (DEVNOTE 2-E 재설계) ---------- */
  // 층 테마 → 미로 위험 구역(tz) + 전투판 지형 칸(terr). col=칸 색(렌더용)
  const THEMES = {
    swamp:     { name: '늪', icon: '🌿', minF: 5, col: '#4f6b34', desc: '이동이 느려짐' },
    desert:    { name: '사막', icon: '🏜️', minF: 10, col: '#c9a95a', desc: '식량 소모 ×2 · 전투 속도 −15%' },
    river:     { name: '강변', icon: '🌊', minF: 15, col: '#3f78b8', desc: '피로 증감 · 전투 회피 −10%p·번개 +30%' },
    volcano:   { name: '화산', icon: '🌋', minF: 25, col: '#b5452a', desc: '화상 · 전투 중 지속 피해' },
    resonance: { name: '마력공진', icon: '🔮', minF: 35, col: '#8a5cc8', desc: '전투 중 구역 안에서 스킬 불가' },
  };
  function floorThemes(f) { // 층마다 고정(결정적): 5층부터 주 테마 1개, 30% 확률로 부 테마
    if (f < 5) return [];
    const pool = Object.keys(THEMES).filter(k => THEMES[k].minF <= f);
    let h = (f * 2654435761) >>> 0; const nx = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
    const main = pool[Math.floor(nx() * pool.length)], out = [main];
    if (pool.length > 1 && nx() < 0.3) { const o = pool.filter(k => k !== main); out.push(o[Math.floor(nx() * o.length)]); }
    return out;
  }
  // 미로 위험 구역: 걸을 수 있는 타일에 테마별 덩어리(반경 3~5)를 만든다. tz[y][x] = 테마 id | null
  function genZones(m, themes) {
    const tz = Array.from({ length: m.h }, () => Array(m.w).fill(null));
    themes.forEach((th, i) => {
      for (let k = themes.length === 1 ? 8 : 6; k > 0; k--) {
        const cx = ri(2, m.w - 3), cy = ri(2, m.h - 3), R = ri(3, 5);
        for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
          if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.grid[y][x] === 0) continue;
          if (Math.hypot(x - cx, y - cy) <= R && !tz[y][x]) tz[y][x] = th;
        }
      }
    });
    return tz;
  }
  // 전투판(9×9) 지형 칸: 주 테마 패치(위험 구역에서 시작하면 비율↑). 마력공진은 반경 2칸 원형 1~2개(국소)
  function genTerrain(themes, onZone) {
    const g = Array.from({ length: 9 }, () => Array(9).fill(null));
    themes.forEach((th, i) => {
      if (th === 'resonance') {
        for (let k = ri(1, onZone ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0)); k > 0; k--) {
          const cx = ri(1, 7), cy = ri(0, 8);
          for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (Math.hypot(x - cx, y - cy) <= 2 && !g[y][x]) g[y][x] = th;
        }
        return;
      }
      const want = Math.round(81 * (i === 0 ? (onZone ? 0.5 : 0.22) : 0.12)); let have = 0, guard = 0;
      while (have < want && guard++ < 400) {
        let x = ri(0, 8), y = ri(0, 8);
        for (let s = ri(5, 14); s > 0 && have < want; s--) { if (!g[y][x]) { g[y][x] = th; have++; } x = clamp(x + ri(-1, 1), 0, 8); y = clamp(y + ri(-1, 1), 0, 8); }
      }
    });
    return g;
  }
  const cellTh = (b, c) => b.terr ? b.terr[clamp(c.y, 0, 8)][clamp(c.x, 0, 8)] : null;
  const ENEMY_BY_ID = {}; ENEMIES.concat(GOLDEN, SPECIALS).forEach(t => { ENEMY_BY_ID[t.id] = t; });
  function createBattle(exp, group) {
    const s = exp.save, f = exp.floor, units = [];
    const leaderId = s.policy.leader;
    for (const u of exp.party) {
      if (u.hp <= 0) continue;
      const p = s.formation[u.id], st = stats(u);
      units.push({ side: 'p', u, name: u.name, icon: CLASSES[u.cls].icon, color: CLASSES[u.cls].color, x: p[0], y: p[1], dx: p[0], dy: p[1], hp: u.hp, maxhp: st.hp, atk: st.atk, def: st.def, spd: st.spd, eva: st.eva, range: st.range, magic: baseCls(u) === 'mage' || baseCls(u) === 'priest', gauge: rnd(0, 6), alive: true, guard: 0, poisoned: !!u.poison, isLeader: u.id === leaderId, size: 1 });
    }
    units.forEach(c => applyCombo(c, exp.combo)); // 직업 조합 보너스
    const occ = new Set(), enemies = [];
    const free = () => { for (let k = 0; k < 60; k++) { const x = ri(0, 8), y = ri(0, 3); if (!occ.has(x + ',' + y)) { occ.add(x + ',' + y); return [x, y]; } } return [ri(0, 8), ri(0, 3)]; };
    for (const id of group.tpls) {
      if (id === 'boss') { occ.add('4,1'); enemies.push(mkEnemy(BOSSES[f], f, 4, 1, true)); }
      else { const [x, y] = free(); enemies.push(mkEnemy(ENEMY_BY_ID[id], f, x, y, false, group.elite ? { hp: 1.8, atk: 1.25, def: 1.2, exp: 2.5, gold: 3, elite: true } : null)); }
    }
    const gT = group.golden ? ENEMY_BY_ID[group.tpls[0]] : null;
    const sq = new Set((exp.squads || []).map(q => q.type));
    if (sq.has('disrupt')) enemies.forEach(c => { c.spd *= 0.85; c.blind = 0.12; }); // 교란 분대
    const hgt = genHeights();
    const mp = exp.map, zt = mp && mp.tz && group.y !== undefined && mp.tz[group.y] ? mp.tz[group.y][group.x] : null;
    const terr = mp && mp.themes && mp.themes.length ? genTerrain(mp.themes, !!zt) : null;
    return { sq, terr, exp, save: s, floor: f, units: units.concat(enemies), t: 0, nextRetreatCheck: 1, events: [], result: null, guardian: !!group.boss, group, fallen: 0, policy: s.policy, hgt, golden: !!group.golden, fleeT: gT ? gT.fleeIn : 0, bless: (exp.bless || 0) > 0 };
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
  function applyCombo(c, cb) { // 조합 보너스 + 응원 분대(cb.cheer)
    if (!cb) return;
    const all = cb.dup ? 1 : cb.all, dx = cb.dup ? 1 : cb.def, ch = cb.cheer || 1;
    c.atk = Math.round(c.atk * all * ch); c.def = Math.round(c.def * all * dx * ch); c.spd *= all; c.maxhp = Math.round(c.maxhp * all);
    if (!cb.dup && cb.rangePlus && c.range >= 3) c.range += cb.rangePlus;
  }
  function syncPlayer(c, cb) { const st = stats(c.u); c.maxhp = st.hp; c.atk = st.atk; c.def = st.def; c.spd = st.spd; c.eva = st.eva; c.range = st.range; c.hp = c.u.hp; applyCombo(c, cb); }

  function damage(b, att, tgt, mult, magic, skill) {
    if (!tgt.alive) return;
    if (!magic && Math.random() < tgt.eva + (att.blind || 0) - (cellTh(b, tgt) === 'river' ? 0.1 : 0)) { ev(b, { k: 'miss', x: tgt.x, y: tgt.y }); return; }
    if (b.hgt) mult *= clamp(1 + 0.06 * (b.hgt[att.y][att.x] - b.hgt[tgt.y][tgt.x]), 0.8, 1.25);
    const a = att.atk * mulFor(b, att) * mult, d = tgt.def * (tgt.guard > b.t ? 2 : 1) * mulFor(b, tgt);
    let dmg = a * rnd(0.9, 1.1) - d * (magic ? 0.25 : 0.5);
    const crit = Math.random() < 0.08; if (crit) dmg *= 1.5;
    dmg = Math.max(Math.ceil(a * 0.1), Math.round(dmg));
    if (tgt.side === 'p' && crit && b.sq && b.sq.has('guardian') && !b.guardUsed && tgt.hp - dmg <= 0) { // 수호 분대: 치명타로 쓰러질 때 전투당 1회 HP 1로 버팀
      dmg = Math.max(0, tgt.hp - 1); b.guardUsed = true; ev(b, { k: 'log', m: `🛡️ 수호 분대가 ${tgt.name}의 쓰러짐을 막았다!`, c: 'good' });
    }
    setHp(tgt, tgt.hp - dmg); if (tgt.side === 'p') b.pHurt = b.t;
    ev(b, { k: 'dmg', x: tgt.x, y: tgt.y, v: dmg, crit, side: tgt.side });
    if (att.poison && tgt.side === 'p' && !tgt.poisoned && Math.random() < att.poison) { tgt.poisoned = true; tgt.u.poison = true; ev(b, { k: 'log', m: `☠️ ${tgt.name}이(가) 독에 걸렸다!`, c: 'bad' }); }
    if (tgt.hp <= 0) die(b, tgt, att);
  }
  function die(b, c) {
    c.alive = false;
    if (c.side === 'e') {
      const e = b.exp, s = b.save;
      e.loot.gold += c.gold; e.kills++; cqCheck(e);
      giveExp(b, c.exp); dropLoot(b, c);
      // 요리사 동행 시 식용 몹을 식량으로 (유독 몹은 해독 처리해 ×0.8)
      if (c.edible && c.edible !== 'none' && b.units.some(o => o.side === 'p' && o.alive && o.u && baseCls(o.u) === 'cook')) {
        const Y = TUNE.food.yield;
        const n = Math.round((Y[0] + Y[1] * b.floor) * (c.boss ? 4 : c.elite ? 1.5 : 1) * (c.premium ? 2 : 1) * (c.edible === 'poison' ? 0.8 : 1) * 100) / 100;
        s.food = Math.round((s.food + n) * 100) / 100; b.foodGain = (b.foodGain || 0) + n;
      }
      if (Math.random() < (c.boss ? 1 : 0.1)) { const id = dropItem(b.floor, { party: e.party, luck: partyLuck(e.party), kind: c.boss ? 'boss' : c.elite ? 'elite' : null }); if (ITEMS[id].legend || ITEMS[id].gen) registerLegend(s, id); e.loot.items.push(id); ev(b, { k: 'log', m: `🎁 ${ITEMS[id].name} 획득`, c: 'good' }); }
      questEvent(s, 'hunt', c.fam, (m, cl) => ev(b, { k: 'log', m, c: cl }));
      if (c.elite && Math.random() < 0.6) { const id = dropItem(b.floor, { party: e.party, luck: partyLuck(e.party), kind: 'elite' }); if (ITEMS[id].legend || ITEMS[id].gen) registerLegend(s, id); e.loot.items.push(id); ev(b, { k: 'log', m: `☠️ 정예 몹 전리품: ${ITEMS[id].name}`, c: 'good' }); }
      if (c.golden) {
        const id = dropItem(b.floor, { party: e.party, luck: partyLuck(e.party) }); if (ITEMS[id].legend || ITEMS[id].gen) registerLegend(s, id); e.loot.items.push(id);
        e.bless = 4; e.goldenKills = (e.goldenKills || 0) + 1;
        ev(b, { k: 'log', m: `✨ ${c.name} 처치! 경험치 ${c.exp} · ${ITEMS[id].name} 획득 · 황금의 축복(3회 전투 공·방 +15%)`, c: 'good' });
      }
    } else {
      b.fallen++; b.exp.fallFloor = b.floor; ev(b, { k: 'log', m: `💔 ${c.name} 전투불능!`, c: 'bad' });
      if (c.u) c.u.fatigue = Math.max(0, fatOf(c.u) - TUNE.fatigue.death);
    }
  }
  function giveExp(b, amt) {
    for (const c of b.units) {
      if (c.side !== 'p' || !c.alive) continue;
      const u = c.u; u.exp += amt;
      while (u.exp >= needExp(u.lv) && u.lv < MAXLV) {
        u.exp -= needExp(u.lv); const old = c.maxhp; u.lv++;
        const nm = stats(u).hp; u.hp = Math.min(nm, u.hp + (nm - old)); syncPlayer(c, b.exp.combo);
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
  // 범위 스킬 시각화: 닿는 칸 목록 + 색 (불=주황 / 얼음=파랑 / 번개=노랑 / 신성=금 / 회복=초록). big=범위 마법 → 화면 흔들림
  const SKILL_COL = { fire: '#ff7a2a', ice: '#4fa8ff', thunder: '#ffe14a', holy: '#ffd86b', heal: '#5be08a', bless: '#5be08a', antidote: '#5be08a', guard: '#9fb2ff' };
  const box = (cx, cy, r) => { const o = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < GRID && y < GRID) o.push([x, y]); return o; };
  function area(b, sid, cells, big) { const sk = SKILLS[sid]; ev(b, { k: 'area', cells, col: SKILL_COL[sid] || (sk.magic ? '#b48cff' : '#ff6a6a'), big: !!big }); }
  function useSkill(b, c, sid, foes, allies) {
    const sk = SKILLS[sid], rng = sk.range || c.range;
    const inR = foes.filter(o => dist(c, o) <= rng).sort((p, q) => dist(c, p) - dist(c, q));
    c.b = b;
    switch (sk.type) {
      case 'single': { if (!inR.length) return false; area(b, sid, [[inR[0].x, inR[0].y]]); ev(b, { k: 'fx', x: inR[0].x, y: inR[0].y, t: 'skill', n: sk.name, from: c }); damage(b, c, inR[0], sk.mult, !!sk.magic); break; }
      case 'holy': {
        const t = inR.find(o => o.undead) || inR[0]; if (!t) return false;
        area(b, sid, [[t.x, t.y]]);
        ev(b, { k: 'fx', x: t.x, y: t.y, t: 'skill', n: sk.name, from: c }); damage(b, c, t, t.undead ? sk.mult * 1.8 : sk.mult * 0.6, true); break;
      }
      case 'aoe': { if (!inR.length) return false; const t = inR[0]; area(b, sid, box(t.x, t.y, 1), !!sk.magic); ev(b, { k: 'fx', x: t.x, y: t.y, t: 'fire', n: sk.name, from: c }); foes.filter(o => dist(t, o) <= 1).forEach(o => damage(b, c, o, sk.mult, true)); break; }
      case 'adjacent': { const adj = foes.filter(o => dist(c, o) <= 1); if (!adj.length) return false; area(b, sid, box(c.x, c.y, 1).filter(q => q[0] !== c.x || q[1] !== c.y)); ev(b, { k: 'fx', x: c.x, y: c.y, t: 'skill', n: sk.name, from: c }); adj.forEach(o => damage(b, c, o, sk.mult, false)); break; }
      case 'line': { if (!inR.length) return false; const hit = inR.slice(0, 3); area(b, sid, hit.map(o => [o.x, o.y]), !!sk.magic); ev(b, { k: 'fx', x: inR[0].x, y: inR[0].y, t: 'skill', n: sk.name, from: c }); hit.forEach(o => damage(b, c, o, sk.mult * (sid === 'thunder' && cellTh(b, o) === 'river' ? 1.3 : 1), !!sk.magic)); break; }
      case 'heal': { const t = allies.filter(a => a.hp < a.maxhp).sort((p, q) => p.hp / p.maxhp - q.hp / q.maxhp)[0]; if (!t) return false; area(b, sid, [[t.x, t.y]]); ev(b, { k: 'fx', x: t.x, y: t.y, t: 'heal', n: sk.name, from: c }); heal(b, c, t, c.atk * 1.8 + t.maxhp * 0.15); break; }
      case 'healall': { area(b, sid, allies.map(a => [a.x, a.y])); ev(b, { k: 'fx', x: c.x, y: c.y, t: 'heal', n: sk.name, from: c }); allies.forEach(a => heal(b, c, a, c.atk * 1.0 + a.maxhp * 0.1)); break; }
      case 'cure': { const t = allies.find(a => a.poisoned); if (!t) return false; t.poisoned = false; t.u.poison = false; ev(b, { k: 'log', m: `💊 ${t.name}의 독이 해독됐다`, c: 'good' }); break; }
      case 'guard': { c.guard = b.t + 6; area(b, sid, [[c.x, c.y]]); ev(b, { k: 'fx', x: c.x, y: c.y, t: 'skill', n: sk.name, from: c }); break; }
      case 'flurry': { if (!inR.length) return false; const t = inR[0]; area(b, sid, [[t.x, t.y]]); ev(b, { k: 'fx', x: t.x, y: t.y, t: 'skill', n: sk.name, from: c }); damage(b, c, t, sk.mult, false); if (t.alive) damage(b, c, t, sk.mult, false); break; }
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
    const sealed = cellTh(b, c) === 'resonance'; // 마력공진 구역 안: 스킬 불가(기본공격·소모품은 허용)
    if (c.side === 'p') { if (!sealed && trySkillP(b, c, foes, allies)) return; }
    else if (!sealed && c.skills && Math.random() < 0.25) { if (useSkill(b, c, pick(c.skills), foes, allies)) return; }
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
      if (c.u && baseCls(c.u) === 'monk' && t.alive && Math.random() < 0.35) damage(b, c, t, 0.8, false);
    } else if (c.side === 'e' || b.policy.stance === 'attack' || (b.pHurt !== undefined && b.t - b.pHurt < 6)) { if (cellTh(b, c) === 'swamp' && (c.mv = !c.mv)) return; moveToward(b, c, t); } // 늪: 이동이 절반으로 느려짐
  }
  function stepBattle(b, dt) {
    if (b.result) return;
    b.t += dt;
    const ready = [];
    for (const c of b.units) { if (!c.alive) continue; c.gauge += c.spd * dt * (cellTh(b, c) === 'desert' ? 0.85 : 1); if (c.gauge >= 10) ready.push(c); }
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
    // 화산 칸: 3초마다 최대 HP 2% 화상
    if (b.terr && b.t >= (b.nextLava || 3)) {
      b.nextLava = b.t + 3;
      for (const c of b.units) if (c.alive && cellTh(b, c) === 'volcano') { const d = Math.max(1, Math.round(c.maxhp * 0.02)); setHp(c, c.hp - d); ev(b, { k: 'dmg', x: c.x, y: c.y, v: d, side: c.side, poison: true }); if (c.hp <= 0) die(b, c); }
      if (!alive(b, 'e').length) { b.result = 'win'; return; }
      if (!alive(b, 'p').length) { b.result = 'lose'; return; }
    }
    squadTick(b); // 분대 지원 사격
    if (!alive(b, 'e').length) { b.result = 'win'; return; }
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
  const MW = 55, MH = 33, STEP = 0.14; // 층 넓이: 기존 39×23 의 약 2배
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
    for (let i = 0; i < 170 && rooms.length < 18; i++) {
      const w = ri(4, 8), h = ri(3, 5), x = ri(2, MW - w - 3), y = ri(2, MH - h - 3);
      if (rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), deg: 0 });
    }
    if (rooms.length < 12) return null;
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
    for (let k = 0; k < 4; k++) { const i = ri(0, rooms.length - 3); carve(rooms[i], rooms[i + 2]); }
    const r0 = rooms[0], start = { x: r0.cx, y: r0.cy };
    const d0 = floodDist(grid, start.x, start.y, false);
    let sr = rooms[1]; for (const r of rooms) if (r.id !== 0 && d0[r.cy][r.cx] > d0[sr.cy][sr.cx]) sr = r;
    const stairs = { x: sr.cx, y: sr.cy };
    grid[start.y][start.x] = T.UP; grid[stairs.y][stairs.x] = T.STAIRS;
    // 금고방: 막다른 방의 입구를 잠근다 (도적이 있어야 열림)
    const entrances = r => { const out = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y][x] === T.COR && D4.some(([dx, dy]) => inb(x + dx, y + dy) && rid[y + dy][x + dx] === r.id)) out.push([x, y]); return out; };
    const vaults = [];
    const leaves = rooms.filter(r => r.deg === 1 && r.id !== 0 && r.id !== sr.id).sort(() => Math.random() - 0.5).slice(0, 3);
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
    const nCh = 8 + ri(0, 3) + (f >= 20 ? 2 : 0);
    for (let i = 0; i < nCh; i++) { const p = randTile((x, y) => rid[y][x] >= 0 && rid[y][x] !== 0 && !vaults.some(v => v.id === rid[y][x])); if (p) chests.push({ x: p.x, y: p.y, big: false, open: false }); }
    for (const v of vaults) for (let i = 0; i < 2; i++) { const p = randTile((x, y) => rid[y][x] === v.id); if (p) chests.push({ x: p.x, y: p.y, big: i === 0, open: false }); }
    const nTr = 8 + Math.floor(f / 4) + ri(0, 3);
    for (let i = 0; i < nTr; i++) { const p = randTile((x, y) => rid[y][x] !== 0 && !vaults.some(v => v.id === rid[y][x]) && dist[y][x] > 2); if (p) traps.push({ x: p.x, y: p.y, found: false, gone: false }); }
    for (let k = 0; k < 2; k++) if (Math.random() < 0.45) { const p = randTile((x, y) => rid[y][x] > 0 && !vaults.some(v => v.id === rid[y][x])); if (p) springs.push({ x: p.x, y: p.y, used: false }); }
    const bossFloor = f % 5 === 0, nG = 14 + Math.floor(f / 4) + ri(0, 3);
    if (bossFloor) { const g = genGroup(f, true); g.x = stairs.x; g.y = stairs.y; groups.push(g); }
    for (let i = 0; i < nG; i++) { const p = randTile((x, y) => dist[y][x] >= 6 && !groups.some(g => cheb(g, { x, y }) < 3)); if (p) { const g = genGroup(f, false); g.x = p.x; g.y = p.y; groups.push(g); } }
    if (f >= 3) for (let k = 0; k < (f >= 25 ? 4 : 3); k++) if (Math.random() < 0.7) { const el = genElite(f); const p = randTile((x, y) => dist[y][x] >= 8 && !groups.some(g => cheb(g, { x, y }) < 3)); if (p) { el.x = p.x; el.y = p.y; groups.push(el); } }
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
  const hasThief = e => e.party.some(u => baseCls(u) === 'thief' && u.hp > 0);
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
    e.map.themes = floorThemes(f); e.map.tz = genZones(e.map, e.map.themes); e.foodMul = 1; e.volcSteps = 0; placeEvents(e);
    reveal(e); questEvent(s, 'reach', f, (m, c) => elog(e, m, c));
    elog(e, `⬇ ${f}층에 도착했다`, 'floor');
    if (e.map.themes.length) elog(e, `${e.map.themes.map(k => THEMES[k].icon + ' ' + THEMES[k].name).join(' + ')} 지형 — ${e.map.themes.map(k => THEMES[k].desc).join(' / ')}`, 'warn');
  }
  function createExpedition(save, startFloor) {
    const party = save.units.filter(u => u.hired && save.formation[u.id] && canSortie(u));
    party.forEach(u => { u.poison = false; ensureCharges(u); });
    const combo = comboOf(party), squads = activeSquads(save); // 분대: 전투 지원(화면 밖)
    if (squads.some(q => q.type === 'cheer')) combo.cheer = 1.1;
    if (combo.skillUses) party.forEach(u => { for (const k in u.charges) u.charges[k] += combo.skillUses; }); // 후열 합주: 귀환 시 resetCharges 로 원복
    const e = { prevMax: save.maxFloor, combo, squads, squadMembers: squadUnits(save), comboFood: combo.foodMul, save, party, floor: startFloor, map: null, pos: null, trail: [], directive: null, path: [], phase: 'explore', moveT: 0.5, healT: 0, battle: null, log: [], events: [], loot: { gold: 0, items: [] }, kills: 0, done: false, result: null, chests: 0, reached: startFloor, text: '', startFloor };
    save.maxFloor = Math.max(save.maxFloor, startFloor);
    setFloor(e, startFloor);
    return e;
  }
  function startBattle(e, g) {
    e.battle = createBattle(e, g); e.phase = 'battle';
    const names = e.battle.units.filter(c => c.side === 'e').map(c => c.name);
    elog(e, g.boss ? `⚔️ 수호자 출현! ${names[0]} 외 ${names.length - 1}` : `⚔️ 적과 조우: ${names.join(', ')}`, g.boss ? 'warn' : '');
    if (g.boss) ban(e, '⚔️', '수호자 출현!', names[0], 'bad');
  }
  function openChest(e, big) {
    const f = e.floor, g = Math.round(rnd(0.8, 1.4) * (30 + f * 15) * (big ? 2 : 1));
    e.loot.gold += g; e.chests++;
    let m = `📦 ${big ? '큰 ' : ''}보물상자! ${g}G`;
    if (Math.random() < (big ? 0.8 : 0.35)) { const id = dropItem(f, { party: e.party, luck: partyLuck(e.party) }); if (ITEMS[id].legend || ITEMS[id].gen) registerLegend(e.save, id); e.loot.items.push(id); m += ` + ${ITEMS[id].name}`; }
    if (Math.random() < 0.3) { const k = pick(['potion', 'potion', 'antidote', 'elixir']); e.save.cons[k] = (e.save.cons[k] || 0) + 1; m += ` + ${CONS[k].name}`; }
    elog(e, m, 'good'); ban(e, big ? '🎁' : '📦', big ? '큰 보물상자!' : '보물상자', m.replace(/^📦 (큰 )?보물상자! /, ''), 'good'); questEvent(e.save, 'chest', null, (mm, c) => elog(e, mm, c)); cqCheck(e);
  }
  function triggerTrap(e, pre) {
    const t = e.party.filter(u => u.hp > 0).sort(() => Math.random() - 0.5).slice(0, 2);
    t.forEach(u => { const d = Math.max(1, Math.round(stats(u).hp * rnd(0.08, 0.15))); u.hp = Math.max(1, u.hp - d); if (Math.random() < 0.35) u.poison = true; });
    elog(e, `⚠️ ${pre || ''}함정 발동! ${t.map(u => u.name).join(', ')} 피해${t.some(u => u.poison) ? ' (독)' : ''}`, 'bad'); ban(e, '⚠️', '함정 발동!', t.map(u => u.name).join(', ') + ' 피해', 'bad');
  }
  function finish(e, result) {
    const s = e.save; e.done = true; e.result = result; e.phase = 'done'; e.pending = null;
    if (e.cq) { elog(e, `📜 ${e.cq.comp.name}의 의뢰에 실패했다 (원정 종료)`, 'warn'); e.cq = null; }
    if (result === 'wipe') { s.gold += Math.floor(e.loot.gold * 0.5); e.lost = true; }
    else {
      s.gold += e.loot.gold; e.loot.items.forEach(i => s.gear.push(i));
      for (const k in (e.loot.mats || {})) addMats(s.mats, k, e.loot.mats[k]);
      (e.loot.bps || []).forEach(id => { s.bps[id] = true; }); s.promo = (s.promo || 0) + (e.loot.promo || 0);
    }
    s.day++;
    // 피로 회복 (2-A): 휴식 +25 / 출전 +5. 승려 동행 시 ×1.5(최대 2명, 상한 ×2.0), 요리사 동행 시 식사 +2(최대 2명)
    { const F = TUNE.fatigue, healers = Math.min(2, e.party.filter(u => baseCls(u) === 'priest').length), cooks = Math.min(2, e.party.filter(u => baseCls(u) === 'cook').length);
      const mul = 1 + 0.5 * healers, bonus = F.cook * cooks, went = new Set(e.party.concat(e.squadMembers || []).map(u => u.id));
      e.fatLog = { mul, bonus };
      for (const u of s.units) { if (!u.hired) continue; u.fatigue = Math.min(100, Math.round(fatOf(u) + (went.has(u.id) ? F.work : F.rest) * mul + bonus)); if (!canSortie(u)) delete s.formation[u.id]; } }
    s.units.forEach(u => { u.hp = stats(u).hp; u.poison = false; resetCharges(u); });
    if (result === 'clear') s.cleared = true;
    e.autoLog = (result !== 'wipe' && s.opts && s.opts.autoEquip) ? autoEquip(s, { idle: !!s.opts.autoIdle }) : [];
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
      event: (x, y) => (m.events || []).some(v => !v.used && v.x === x && v.y === y && m.seen[y][x]),
    };
    const T_ = { chest: '보물상자로 이동', front: '미탐색 구역 탐색', lock: '잠긴 문을 열러 이동', mon: '적을 찾아 이동', stairs: '계단으로 이동', spring: '치유의 샘으로 이동', event: '이벤트 장소로 이동' };
    const get = k => { const p = bfsPath(e, F[k]); return p ? { path: p, why: T_[k] } : null; };
    if (pcts < 0.7) { const s = get('spring'); if (s) return s; }
    if (pcts >= 0.4) { const v = get('event'); if (v) return v; } // 행상인·뽑기방·의뢰인 우선 방문
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
  /* ---------- 이벤트: 행상인 · 뽑기방 · 특수 동료 의뢰 · 기습 (+ 모든 이벤트는 중앙 배너로 알림) ---------- */
  const ban = (e, icon, name, sub, kind) => { e.events.push({ k: 'banner', icon, name, sub: sub || '', c: kind || '' }); };
  const COMPANIONS = [
    { name: '리벨', cls: 'warrior', rar: 'H', q: 'kills', need: 20, intro: '떠돌이 검사 리벨이 길동무를 찾고 있다.' },
    { name: '아이린', cls: 'priest', rar: 'H', q: 'chests', need: 3, intro: '순례 중인 사제 아이린이 호위를 부탁한다.' },
    { name: '엘다', cls: 'mage', rar: 'H', q: 'flawless', need: 3, intro: '실험에 지친 마술사 엘다가 파티를 시험한다.' },
    { name: '진', cls: 'monk', rar: 'H', q: 'kills', need: 28, intro: '수행 중인 무투가 진이 대련 상대를 찾는다.' },
    { name: '하루', cls: 'cook', rar: 'H', q: 'chests', need: 4, intro: '길 잃은 요리사 하루가 식재료를 구한다.' },
    { name: '카를', cls: 'knight', rar: 'L', q: 'flawless', need: 5, intro: '몰락한 왕국의 기사 카를이 자격을 묻는다.' },
    { name: '유리', cls: 'thief', rar: 'L', q: 'kills', need: 36, intro: '전설적인 도적 유리가 솜씨를 확인하려 한다.' },
    { name: '로제', cls: 'elf', rar: 'L', q: 'chests', need: 6, intro: '숲의 궁수 로제가 보물을 찾아 달라고 한다.' },
  ];
  const QDESC = { kills: n => `이 원정 중 몬스터 ${n}마리 처치`, chests: n => `이 원정 중 보물상자 ${n}개 열기`, flawless: n => `전투불능 없이 ${n}회 승리` };
  function randRoomTile(e) {
    const m = e.map, cand = m.rooms.filter(r => r.id !== 0 && !m.vaults.includes(r.id));
    const busy = (x, y) => m.chests.some(c => c.x === x && c.y === y) || m.traps.some(c => c.x === x && c.y === y) || m.springs.some(c => c.x === x && c.y === y) || m.groups.some(c => c.x === x && c.y === y) || (m.events || []).some(c => c.x === x && c.y === y) || (m.stairs.x === x && m.stairs.y === y);
    for (let k = 0; k < 80 && cand.length; k++) { const r = pick(cand), x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1); if (!busy(x, y)) return { x, y }; }
    return null;
  }
  function placeEvents(e) { // 층마다 확률적으로 이벤트 장소 배치 (행상인 / 뽑기방 / 특수 동료 의뢰인)
    const f = e.floor, s = e.save, list = (e.map.events = []);
    const add = type => { const p = randRoomTile(e); if (p) list.push({ type, x: p.x, y: p.y, used: false }); };
    if (f >= 2 && Math.random() < 0.5) add('merchant');
    if (f >= 3 && Math.random() < 0.4) add('gacha');
    if (f >= 3 && Object.keys(s.comp || {}).length < COMPANIONS.length && !e.cq && Math.random() < 0.25) add('companion');
  }
  const EVT = { merchant: { icon: '🧳', name: '행상인' }, gacha: { icon: '🎰', name: '뽑기방' }, companion: { icon: '📜', name: '의뢰인' } };
  function genStock(e) {
    const f = e.floor, luck = partyLuck(e.party), st = [];
    st.push({ k: 'cons', id: 'potion', n: 3, price: Math.round(CONS.potion.price * 3 * 0.9) });
    st.push({ k: 'cons', id: 'elixir', n: 1, price: Math.round(CONS.elixir.price * 0.9) });
    st.push({ k: 'food', n: 10, price: Math.round(TUNE.food.price * 10 * 0.8) });
    const gid = dropItem(f, { luck, party: e.party, kind: 'elite' }); if (ITEMS[gid].legend || ITEMS[gid].gen) registerLegend(e.save, gid);
    st.push({ k: 'gear', id: gid, price: Math.round(ITEMS[gid].price * 1.5) });
    const fams = [...new Set(poolOf(f).map(x => x.fam))].filter(x => FAM_MAT[x]), fm = FAM_MAT[pick(fams)];
    st.push({ k: 'mat', id: fm[1], n: 2, price: 150 + f * 12 });
    st.push({ k: 'cons', id: 'revive', n: 1, price: CONS.revive.price });
    st.forEach(x => { x.sold = false; });
    return st;
  }
  function startEvent(e, v) {
    const E = EVT[v.type];
    if (v.type === 'merchant') { e.pending = { type: 'merchant', stock: genStock(e) }; ban(e, E.icon, '행상인 발견', '떠돌이 행상인이 물건을 펼쳤다', 'good'); elog(e, '🧳 행상인을 만났다 — 물건을 구경한다', 'good'); }
    else if (v.type === 'gacha') { e.pending = { type: 'gacha', price: 120 + e.floor * 20, log: [] }; ban(e, E.icon, '뽑기방 발견', '수상한 뽑기 기계가 놓여 있다', 'good'); elog(e, '🎰 뽑기방을 발견했다', 'good'); }
    else if (v.type === 'companion') {
      const s = e.save, left = COMPANIONS.filter(c => !(s.comp && s.comp[c.name])); if (!left.length) return;
      const c = pick(left); e.pending = { type: 'companion', comp: c, quest: QDESC[c.q](c.need) };
      ban(e, E.icon, '특수 동료 의뢰', `${c.name} — ${c.intro}`, 'warn'); elog(e, `📜 ${c.name}의 의뢰: ${e.pending.quest}`, 'warn');
    }
  }
  function buyMerchant(e, idx) {
    const s = e.save, it = e.pending && e.pending.stock && e.pending.stock[idx]; if (!it || it.sold) return '이미 팔렸습니다';
    if (s.gold < it.price) return '골드가 부족합니다';
    s.gold -= it.price; it.sold = true;
    if (it.k === 'cons') s.cons[it.id] = (s.cons[it.id] || 0) + it.n;
    else if (it.k === 'food') s.food = Math.round((s.food + it.n) * 100) / 100;
    else if (it.k === 'gear') s.gear.push(it.id);
    else if (it.k === 'mat') addMats(s.mats, it.id, it.n);
    elog(e, `🧳 ${itemLabel(it)} 구입 (−${it.price}G)`, 'good'); return null;
  }
  function itemLabel(it) { return it.k === 'cons' ? `${CONS[it.id].name} ×${it.n}` : it.k === 'food' ? `식량 ×${it.n}` : it.k === 'gear' ? ITEMS[it.id].name : `${MATS[it.id]} ×${it.n}`; }
  // 뽑기: 결과는 즉시 저장에 반영(전멸해도 유지). 10연차는 9회 가격 + 정예급 장비 1개 보장.
  function gachaOnce(e, forceGear) {
    const s = e.save, f = e.floor, luck = partyLuck(e.party), b = Math.min(0.15, luck * 0.004), r = Math.random() - b * 0.3, fams = [...new Set(poolOf(f).map(x => x.fam))].filter(x => FAM_MAT[x]);
    if (forceGear || (r >= 0.62 && r < 0.80)) { const id = dropItem(f, { luck, party: e.party, kind: forceGear ? 'elite' : null }); if (ITEMS[id].legend || ITEMS[id].gen) registerLegend(s, id); s.gear.push(id); return { t: ITEMS[id].name, rar: ITEMS[id].rarity || 'N' }; }
    if (r < 0.40) { const m = FAM_MAT[pick(fams)][0], n = ri(1, 3); addMats(s.mats, m, n); return { t: `${MATS[m]} ×${n}` }; }
    if (r < 0.62) { const k = pick(['potion', 'potion', 'antidote', 'elixir', 'ether']); s.cons[k] = (s.cons[k] || 0) + 1; return { t: `${CONS[k].name} ×1` }; }
    if (r < 0.88) { const n = ri(3, 8); s.food = Math.round((s.food + n) * 100) / 100; return { t: `식량 ×${n}` }; }
    if (r < 0.95) { const m = FAM_MAT[pick(fams)][1]; addMats(s.mats, m, 1); return { t: `${MATS[m]} ×1 (정예 재료)`, rar: 'U' }; }
    if (r < 0.985) { const id = rollBlueprint(s, f, 'boss'); if (id) { s.bps[id] = true; return { t: `📐 ${ITEMS[id].name} 도면`, rar: 'H' }; } }
    if (r >= 0.985 && Math.random() < 0.5) { s.promo = (s.promo || 0) + 1; return { t: '📜 전직서', rar: 'L' }; }
    const g = 150 + f * 40; s.gold += g; return { t: `${g}G` };
  }
  function gachaPull(e, n) {
    const p = e.pending, s = e.save; if (!p || p.type !== 'gacha') return null;
    const cost = n === 10 ? p.price * 9 : p.price; if (s.gold < cost) return { err: '골드가 부족합니다' };
    s.gold -= cost; const res = []; for (let i = 0; i < n; i++) res.push(gachaOnce(e, n === 10 && i === 9));
    p.log = res.concat(p.log).slice(0, 10); elog(e, `🎰 뽑기 ${n}회 (−${cost}G): ${res.map(x => x.t).join(', ')}`, 'good'); return { res, cost };
  }
  function acceptCompanion(e) {
    const p = e.pending; if (!p || p.type !== 'companion') return;
    e.cq = { comp: p.comp, type: p.comp.q, need: p.comp.need, base: { kills: e.kills, chests: e.chests, flawless: e.flaw || 0 } };
    elog(e, `📜 의뢰 수락: ${p.quest} → 달성 시 ${p.comp.name} 합류`, 'warn'); ban(e, '📜', '의뢰 수락', `${p.comp.name}: ${p.quest}`, 'warn'); e.pending = null;
  }
  const cqProgress = e => e.cq ? Math.min(e.cq.need, (e.cq.type === 'kills' ? e.kills : e.cq.type === 'chests' ? e.chests : (e.flaw || 0)) - e.cq.base[e.cq.type]) : 0;
  function cqCheck(e) {
    if (!e.cq || cqProgress(e) < e.cq.need) return;
    const s = e.save, c = e.cq.comp, id = Math.max(...s.units.map(u => u.id)) + 1, u = mkUnit(id - 1, [c.name, c.cls, 1, c.rar], false);
    u.id = id; u.special = true; u.hired = true;
    if (c.rar === 'L') { const R = RARITY.L.luck; u.growMul = Math.round(rnd(1.3, 1.45) * 100) / 100; u.luck = ri(R[0] + 4, R[1]); u.rolled = true; }
    u.hp = stats(u).hp; resetCharges(u); s.units.push(u); s.comp = s.comp || {}; s.comp[c.name] = true;
    ban(e, '🤝', '특수 동료 합류!', `${c.name}(${CLASSES[c.cls].name}, ${RARITY[c.rar].name})이(가) 합류했다`, 'good'); elog(e, `🤝 ${c.name}이(가) 동료가 되었다! (용병 탭에서 편성)`, 'good'); e.cq = null; e.joined = (e.joined || []).concat(c.name);
  }
  function closeEvent(e) { e.pending = null; }
  function resolveAuto(e) { // 봇/자동 처리: 행상인=회복약 보충, 뽑기=여유 있으면 1회, 의뢰=수락
    const p = e.pending, s = e.save; if (!p) return;
    if (p.type === 'merchant') { p.stock.forEach((it, i) => { if (it.k === 'cons' && it.id === 'potion' && (s.cons.potion || 0) < 5 && s.gold > it.price * 20) buyMerchant(e, i); }); closeEvent(e); }
    else if (p.type === 'gacha') { if (s.gold > p.price * 30) gachaPull(e, 1); closeEvent(e); }
    else if (p.type === 'companion') acceptCompanion(e);
  }
  // 기습: 은신한 적이 덮쳐 무작위 대원의 남은 HP를 10% 깎고 전투가 강제로 시작된다. 도적이 있으면 50% 확률로 간파.
  function ambush(e) {
    const m = e.map, live = e.party.filter(u => u.hp > 0); if (!live.length) return false;
    const g = genGroup(e.floor, false); g.ambush = true; g.name = '기습'; g.announced = true;
    const nb = D8.map(([dx, dy]) => [e.pos.x + dx, e.pos.y + dy]).filter(([x, y]) => inb(x, y) && m.grid[y][x] !== T.WALL && m.grid[y][x] !== T.LOCK && !m.groups.some(o => o.alive && o.x === x && o.y === y));
    const q = nb.length ? pick(nb) : [e.pos.x, e.pos.y]; g.x = q[0]; g.y = q[1]; m.groups.push(g);
    if (hasThief(e) && Math.random() < 0.5) { ban(e, '🗡️', '기습 간파!', '도적이 은신한 적을 먼저 알아챘다', 'good'); elog(e, '🗡️ 도적이 매복을 간파했다! 피해 없이 전투 개시', 'good'); }
    else {
      const hit = live.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(2, live.length));
      hit.forEach(u => { u.hp = Math.max(1, u.hp - Math.max(1, Math.round(u.hp * 0.1))); });
      ban(e, '💥', '기습!', `은신한 적의 습격 — ${hit.map(u => u.name).join(', ')} 남은 HP −10%`, 'bad'); elog(e, `💥 기습! ${hit.map(u => u.name).join(', ')}의 남은 HP가 10% 줄었다`, 'bad');
    }
    startBattle(e, g); return true;
  }
  function arrive(e) {
    const m = e.map, { x, y } = e.pos, t = m.grid[y][x];
    reveal(e);
    for (const g of m.groups) if (g.golden && g.alive && !g.announced && m.seen[g.y][g.x]) { g.announced = true; elog(e, `✨ ${g.name} 발견! 제한 시간 안에 잡으면 큰 보상!`, 'good'); ban(e, '✨', '황금 몹 출현!', `${g.name} — 제한 시간 안에 잡아라`, 'good'); }
    if (t === T.DOOR) m.grid[y][x] = T.OPEN;
    if (t === T.LOCK) { m.grid[y][x] = T.OPEN; elog(e, '🔓 도적이 잠긴 문을 열었다!', 'good'); ban(e, '🔓', '금고방 개방', '도적이 잠긴 문을 열었다', 'good'); }
    for (const g of m.groups) if (g.elite && g.alive && !g.announced && m.seen[g.y][g.x]) { g.announced = true; elog(e, '☠️ 정예 몹이 배회하고 있다! 강하지만 전리품이 좋다', 'warn'); ban(e, '☠️', '정예 몹 발견', '강하지만 전리품이 좋다', 'warn'); }
    const c = m.chests.find(c => !c.open && c.x === x && c.y === y);
    if (c) {
      if (c.mimic) {
        c.mimic = false; const g = { tpls: ['mimic'], boss: false, alive: true, special: true, icon: '📦', name: '미믹', x, y, chest: c, announced: true }; m.groups.push(g);
        elog(e, hasThief(e) ? '🔎 도적이 눈치챘지만 이미 늦었다! 상자는 미믹이었다!' : '📦 상자가 이빨을 드러냈다! 미믹이다!', 'warn'); ban(e, '📦', '미믹 출현!', '상자가 이빨을 드러냈다', 'bad'); startBattle(e, g); return;
      }
      c.open = true; openChest(e, c.big);
    }
    const tr = m.traps.find(t2 => !t2.gone && t2.x === x && t2.y === y); if (tr) { tr.gone = true; triggerTrap(e, ''); }
    const sp = m.springs.find(s => !s.used && s.x === x && s.y === y);
    if (sp && e.party.some(u => u.hp > 0 && u.hp < stats(u).hp * 0.85)) { sp.used = true; e.party.forEach(u => { if (u.hp > 0) u.hp = Math.min(stats(u).hp, u.hp + Math.round(stats(u).hp * 0.4)); }); elog(e, '⛲ 치유의 샘! 파티의 HP가 회복되었다', 'good'); ban(e, '⛲', '치유의 샘', '파티의 HP가 회복되었다', 'good'); }
    const evt = m.events && m.events.find(v => !v.used && v.x === x && v.y === y); if (evt) { evt.used = true; startEvent(e, evt); }
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
      if (spawnNear(e, g, 4, 7)) { e.spawned['s' + e.floor] = 1; elog(e, '👻 쓰러진 동료의 원혼이 나타났다!', 'warn'); ban(e, '👻', '원혼 출현', '쓰러진 동료의 원혼이 추격한다', 'bad'); }
    }
    if (e.floor >= 6 && e.loot.gold >= 260 * e.floor && !e.spawned['b' + e.floor] && Math.random() < 0.015) {
      const g = { tpls: ['bandit', 'bandit', 'bandit'], boss: false, alive: true, special: true, wander: true, chase: true, icon: '🗡️', name: '도적단', announced: true, x: 0, y: 0 };
      if (spawnNear(e, g, 5, 8)) { e.spawned['b' + e.floor] = 1; elog(e, '🗡️ 노획물을 노리는 도적단이 나타났다!', 'warn'); ban(e, '🗡️', '도적단 습격', '노획물을 노리는 도적단이 나타났다', 'bad'); }
    }
  }
  // 이동 1칸마다 식량 소모(2-B). 식량이 0이면 피로 가속 하락 → 피로 0 이면 HP 서서히 감소
  function consumeFood(e) {
    const s = e.save, live = e.party.filter(u => u.hp > 0);
    const need = (live.length + (e.squadMembers ? e.squadMembers.length : 0)) * TUNE.food.perStep * (e.foodMul || 1) * (e.comboFood || 1);
    if (s.food >= need) { s.food = Math.round((s.food - need) * 10000) / 10000; return; }
    s.food = 0;
    if (!e.starved) { e.starved = true; elog(e, '🍖 식량이 바닥났다! 피로가 쌓인다 — 귀환을 권한다', 'bad'); }
    for (const u of live) {
      u.fatigue = Math.max(0, fatOf(u) - TUNE.fatigue.starve);
      if (u.fatigue <= 0) u.hp = Math.max(1, u.hp - Math.max(1, Math.round(stats(u).hp * 0.015)));
    }
  }
  // 미로 위험 구역 효과(2-E): 늪=이동 지연 / 사막=식량 ×2 / 강변=피로 증감 / 화산=10칸마다 화상 / 마력공진=전투 전용
  function terrainStep(e) {
    const th = e.map.tz && e.map.tz[e.pos.y] ? e.map.tz[e.pos.y][e.pos.x] : null, live = e.party.filter(u => u.hp > 0);
    e.foodMul = th === 'desert' ? 2 : 1;
    if (th === 'swamp') e.moveT -= STEP; // 이동 속도 절반
    else if (th === 'river' && Math.random() < 0.06) {
      const up = Math.random() < 0.5, d = ri(2, 4); live.forEach(u => { u.fatigue = clamp(Math.round(fatOf(u) + (up ? d : -d)), 0, 100); });
      elog(e, up ? '🌊 맑은 물에 몸을 씻었다 (피로 회복)' : '🌊 거센 물살에 지쳤다 (피로 증가)', up ? 'good' : 'bad');
    } else if (th === 'volcano') {
      e.volcSteps = (e.volcSteps || 0) + 1;
      if (e.volcSteps % 10 === 0 && Math.random() < 0.4) { live.forEach(u => { u.hp = Math.max(1, u.hp - Math.max(1, Math.round(stats(u).hp * rnd(0.03, 0.06)))); }); elog(e, '🌋 뜨거운 열기에 화상을 입었다!', 'bad'); }
    }
  }
  function stepMove(e) {
    const m = e.map, pol = e.save.policy, thief = hasThief(e);
    consumeFood(e);
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
    if (e.floor >= 2 && Math.random() < 0.0009 && ambush(e)) return; // 기습 이벤트(걸음마다 낮은 확률)
    const tg = pickTarget(e);
    if (!tg) { m.seen.forEach(r => r.fill(true)); e.text = '길을 찾는 중…'; return; }
    e.path = tg.path; e.text = `${e.floor}층 · ${tg.why}`;
    // 안전장치: 같은 두세 칸만 오가며 진전이 없으면 귀환
    e.hist = e.hist || []; e.hist.push(e.pos.x * 100 + e.pos.y); if (e.hist.length > 60) e.hist.shift();
    if (e.hist.length >= 60 && new Set(e.hist).size <= 3) { elog(e, '길이 막혀 더 나아가지 못한다. 귀환한다', 'warn'); finish(e, 'retreat'); return; }
    const nx = tg.path[0]; e.trail.unshift({ x: e.pos.x, y: e.pos.y }); if (e.trail.length > 8) e.trail.pop();
    e.pos = { x: nx[0], y: nx[1] }; terrainStep(e); arrive(e);
    if (e.party.every(u => u.hp <= 0)) finish(e, 'wipe');
  }
  function setDirective(e, x, y) {
    const m = e.map; if (!inb(x, y) || !m.seen[y][x] || m.grid[y][x] === 0) return '갈 수 없는 위치입니다';
    if (m.grid[y][x] === T.LOCK && !hasThief(e)) return '🔒 도적이 없어 열 수 없습니다';
    e.directive = { x, y }; return null;
  }
  function stepExpedition(e, dt) {
    if (e.done) return;
    if (e.pending) { if (e.autoResolve) resolveAuto(e); else return; } // 이벤트 창이 열려 있는 동안 진행 정지
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
        if (b.foodGain) elog(e, `🍳 요리사가 몹을 손질했다 (식량 +${Math.round(b.foodGain * 10) / 10})`, 'good');
        if (b.group.chest) { b.group.chest.open = true; openChest(e, true); }
        if (b.fallen === 0) { questEvent(e.save, 'flawless', null, (m, c) => elog(e, m, c)); e.flaw = (e.flaw || 0) + 1; }
        cqCheck(e);
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
  // 새로 장착할 때만 직업 제한을 검사(이미 착용 중인 기존 장비는 유지). 실패 시 false
  function equip(s, u, slot, itemId) {
    if (itemId && !canUse(u, ITEMS[itemId])) return false;
    const old = u.equip[slot]; if (itemId && s.gear.indexOf(itemId) < 0) return false;
    if (old) s.gear.push(old);
    if (itemId) s.gear.splice(s.gear.indexOf(itemId), 1);
    u.equip[slot] = itemId || null;
    u.hp = Math.min(u.hp, stats(u).hp); ensureCharges(u);
    return true;
  }
  // 직업별 점수 가중치 (DEVNOTE 1-C)
  const AUTO_W = {
    warrior: { atk: 1.4, def: 0.8, hp: 0.12, spd: 5, eva: 20, sk: 12 },
    monk:    { atk: 1.4, def: 0.7, hp: 0.12, spd: 6, eva: 25, sk: 12 },
    thief:   { atk: 1.3, def: 0.5, hp: 0.10, spd: 6, eva: 30, sk: 10 },
    knight:  { atk: 0.8, def: 1.4, hp: 0.25, spd: 2, eva: 10, sk: 14 },
    elf:     { atk: 1.2, def: 0.6, hp: 0.10, spd: 6, eva: 40, sk: 12 },
    mage:    { atk: 1.6, def: 0.5, hp: 0.10, spd: 3, eva: 10, sk: 20 },
    priest:  { atk: 0.6, def: 1.0, hp: 0.22, spd: 2, eva: 10, sk: 14 },
    cook:    { atk: 0.9, def: 0.9, hp: 0.18, spd: 3, eva: 15, sk: 12 },
  };
  const HEAL_SK = ['heal', 'bless', 'cure', 'antidote'];
  function autoScore(u, i) {
    const w = AUTO_W[baseCls(u)] || AUTO_W.warrior;
    let sc = (i.atk || 0) * w.atk + (i.def || 0) * w.def + (i.hp || 0) * w.hp + (i.spd || 0) * w.spd + (i.eva || 0) * w.eva * 10 + (i.range || 0) * 12;
    if (i.skill) sc += w.sk * i.tier + (baseCls(u) === 'priest' && HEAL_SK.includes(i.skill) ? 25 * i.tier : 0);
    return sc;
  }
  // 귀환 시 자동 장비. o.idle=true 면 대기 중 용병도 포함. noAuto 장비는 배분·교체 모두 제외. 변경 내역 배열 반환
  function autoEquip(s, o) {
    o = o || {}; const log = [];
    for (const u of s.units) {
      if (!u.hired || (!o.idle && !s.formation[u.id])) continue;
      for (const slot in SLOTS) {
        const cur = ITEMS[u.equip[slot]]; if (cur && cur.noAuto) continue;
        const cands = s.gear.map(id => ITEMS[id]).filter(i => i.slot === slot && !i.noAuto && canUse(u, i));
        if (!cands.length) continue;
        cands.sort((a, b) => autoScore(u, b) - autoScore(u, a));
        if (!cur || autoScore(u, cands[0]) > autoScore(u, cur)) { if (equip(s, u, slot, cands[0].id)) log.push(`${u.name}: ${SLOTS[slot]} ${cur ? cur.name : '없음'} → ${cands[0].name}`); }
      }
    }
    return log;
  }
  function describe(i) {
    const p = [];
    if (i.atk) p.push('공+' + i.atk); if (i.def) p.push('방+' + i.def); if (i.hp) p.push('HP+' + i.hp);
    if (i.range) p.push('사거리+' + i.range); if (i.spd) p.push('속+' + i.spd); if (i.eva) p.push('회피+' + Math.round(i.eva * 100) + '%');
    if (i.skill) p.push('[' + SKILLS[i.skill].name + ']');
    return p.join(' ');
  }

  return { COMPANIONS, QDESC, EVT, cqProgress, buyMerchant, itemLabel, gachaPull, acceptCompanion, closeEvent, supplyPlan, SQUADS, squadSlots, squadCap, squadUsed, squadErr, activeSquads, squadUnits, inSquad, setSquad, assignSquad, sortieWage, PROMO_PRICE, buyPromo, MATS, matKind, FAM_MAT, craftBases, recipeOf, canCraft, craft, terrainHave, PROMO, PROMO_LV, canPromote, promote, comboOf, baseCls, THEMES, floorThemes, fatOf, fatMul, canSortie, buyFood, RARITY, RAR_ORDER, CRAFT_ENABLED, canUse, canLead, costOf, hireCost, hireUnit, migrateSave, partyLuck, rarOf, GRID, FRONT_Y, BACK_Y, MAXF, MAXLV, CLASSES, ROW_TXT, SKILLS, SLOTS, ITEMS, CONS, ENEMIES, BOSSES, famsOf, needExp, TUNE, EXP_CUM, GOLDEN, SPECIALS, skillsOf, maxCharges, resetCharges, ensureCharges, stats, newSave, setDirective, genFloor, MW, MH, T, restoreLegends, costCap, usedCost, zoneOk, unitAt, place, autoFormation, genQuests, questEvent, createExpedition, stepExpedition, manualRetreat, useConsumable, equip, autoEquip, describe, wageOf, dropItem, registerLegend };
})();
if (typeof module !== 'undefined') module.exports = Core; else window.Core = Core;
