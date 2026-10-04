'use strict';
(function () {
  const C = Core;
  const SAVE_KEY = 'esteru_dungeon_save_v2', PREF_KEY = 'esteru_prefs_v1';
  const $ = id => document.getElementById(id);
  const cv = $('cv');
  // 배속: 출시 빌드는 최대 ×4. 개발용(주소에 ?dev, 한 번 켜면 저장)은 ×8까지. 처음 가는 층(이번 원정 이전 최고 층보다 깊은 층)은 ×2 제한.
  // 개발 모드는 저장하지 않는다(이전 빌드가 남긴 설정도 지운다): 주소에 ?dev 가 있는 그 로딩에서만 켜진다.
  let DEV = false; try { localStorage.removeItem('esteru_dev'); DEV = /[?&]dev\b/.test(location.search); } catch (e) { DEV = /[?&]dev\b/.test(location.search); }
  const SPEEDS = DEV ? [1, 2, 4, 8] : [1, 2, 4], NEW_FLOOR_CAP = 2;
  const newFloor = e => !!e && e.floor > e.prevMax;
  const effSpeed = () => newFloor(S.exp) ? Math.min(S.speed, NEW_FLOOR_CAP) : S.speed;
  const S = { save: null, exp: null, tab: 'form', sideTab: 'log', sel: null, dragId: null, detail: null, paused: false, speed: 1, floaters: [], hover: null, startFloor: 1, acc: 0, itemSel: null, itemOpen: false, autoPaused: false, time: 0, resultShown: false, lastFloor: 0, logShown: 0, prefs: { reduce: false, speed: 1, shake: 1, fullscreen: true, tutDone: false } };
  Render.init(S, cv);

  /* ---------- 저장 ---------- */
  function load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return fixSave(JSON.parse(raw)); } catch (e) { /* 무시 */ }
    return C.newSave();
  }
  function fixSave(s) {
    s = C.migrateSave(s); if (!s) return C.newSave();
    C.restoreLegends(s);
    if (!['full', 'treasure', 'stairs'].includes(s.policy.explore)) s.policy.explore = 'full';
    return s;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.save)); } catch (e) { /* 무시 */ } }
  function loadPrefs() { try { Object.assign(S.prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* 무시 */ } document.body.classList.toggle('reduce', !!S.prefs.reduce); S.speed = Math.min(S.prefs.speed || 1, SPEEDS[SPEEDS.length - 1]); if ([1, 2, 4, 6, 7, 9].includes(S.prefs.pace)) C.TUNE.pace = S.prefs.pace; }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch (e) { /* 무시 */ } }
  loadPrefs(); S.save = load(); S.startFloor = C.defaultStart(S.save);

  /* ---------- 유틸 ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const itemName = id => { const i = C.ITEMS[id]; if (!i) return '-'; const r = i.rarity && i.rarity !== 'N' ? C.RARITY[i.rarity] : null; return `<span class="${i.legend ? 'legend' : ''}" ${r && !i.legend ? `style="color:${r.color}"` : ''} title="${esc(C.describeFull(i))}">${esc(i.name)}</span>`; };
  const itemNameText = id => (C.ITEMS[id] || { name: id }).name;
  const rarTag = u => { const k = C.rarOf(u); return k !== 'N' ? `<span style="color:${C.RARITY[k].color}" title="${C.RARITY[k].name} 등급">[${C.RARITY[k].name}]</span>` : ''; };
  const luckHint = u => { const l = u.luck || 0; return l >= 18 ? '행운이 넘쳐 보인다' : l >= 10 ? '운이 좋아 보인다' : l >= 4 ? '평범한 운' : '운이 별로 없어 보인다'; };
  const leadCands = list => { const e = list.filter(C.canLead); return e.length ? e : list; };
  const pct = (a, b) => Math.max(0, Math.min(100, a / b * 100));
  const hpCls = p => p < 25 ? 'lo' : p < 55 ? 'mid' : '';
  const party = () => S.save.units.filter(u => u.hired && S.save.formation[u.id]);
  const setHTML = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  function portrait(u) { const im = Assets.unit('portraits', u); return im ? `<img src="${im.src}" alt="">` : C.CLASSES[u.cls].icon; }
  function toast(msg, kind) {
    const box = $('toasts'), d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = msg; box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 4200);
  }
  let hintTimer = 0;
  function setHint(html, ms) { const h = $('campHint'); h.innerHTML = html || ''; clearTimeout(hintTimer); if (html && ms !== 0) hintTimer = setTimeout(() => { h.innerHTML = ''; }, ms || 5000); }
  const diffTxt = (n, o) => { const d = []; for (const [k, l] of [['atk', '공'], ['def', '방'], ['hp', 'HP'], ['spd', '속']]) { const v = (n[k] || 0) - ((o && o[k]) || 0); if (v) d.push(`<span class="${v > 0 ? 'good' : 'bad'}">${l}${v > 0 ? '+' : ''}${v}</span>`); } return d.join(' '); };

  /* ---------- 모달 ---------- */
  const modalEl = $('modal');
  function openModal(html, o) { o = o || {}; modalEl.dataset.lock = o.lock ? '1' : ''; modalEl.innerHTML = `<div class="box ${o.wide ? 'wide' : ''}">${html}</div>`; modalEl.classList.remove('hidden'); const f = modalEl.querySelector('[data-autofocus]'); if (f) f.focus(); }
  function closeModal() { modalEl.classList.add('hidden'); modalEl.innerHTML = ''; modalEl.dataset.lock = ''; }
  let confirmCb = null;
  function confirmDlg(title, body, yes, cb) { confirmCb = cb; openModal(`<h2>${title}</h2><p class="dim">${body}</p><div class="foot"><button class="btn" data-m="close">취소</button><button class="btn dng" data-m="confirm" data-autofocus>${yes}</button></div>`); }

  /* ---------- 상단 ---------- */
  function renderStats() {
    const s = S.save, used = C.usedCost(s), cap = C.costCap(s);
    $('stats').innerHTML = `<span class="chip-stat gold" title="보유 골드">💰 <b>${s.gold.toLocaleString()}</b>G</span><span class="chip-stat" title="경과 일수">📅 <b>${s.day}</b>일차</span><span class="chip-stat ${s.food < 5 ? 'warnc' : ''}" title="식량 (이동할수록 소모 — 상점에서 구매, 요리사가 식용 몹으로 보충)">🍖 <b>${Math.floor(s.food)}</b></span>${s.tickets ? `<span class="chip-stat" title="주점 후보를 다시 뽑는 출현변경권">🎫 <b>${s.tickets}</b></span>` : ''}${s.enh ? `<span class="chip-stat" title="장비 강화권 — 용병 장비창에서 장비 한 칸을 +1 강화">🔨 <b>${s.enh}</b></span>` : ''}<span class="chip-stat" title="도달한 최고 층">🏰 최고 <b>${s.maxFloor}</b>/50층</span><span class="chip-stat ${used > cap ? 'over' : used === cap ? 'warnc' : ''}" title="편성 코스트 / 상한 (최고 층이 오르면 상한 증가)">⚖ 코스트 <b>${used}</b>/${cap}</span>${s.cleared ? '<span class="chip-stat gold">👑 클리어</span>' : ''}`;
    const logo = Assets.get('ui', 'logo'); if (logo && !$('logo').querySelector('img')) $('logo').innerHTML = `<img src="${logo.src}" alt="로고">`;
    const btn = $('sortieBtn'); btn.classList.toggle('hidden', !!S.exp); btn.disabled = !party().length;
    btn.title = party().length ? '출발 전 점검 후 던전으로 향합니다' : '먼저 용병을 전장에 배치하세요';
  }

  /* ---------- 정책 UI ---------- */
  function polHTML(inExp) {
    const p = S.save.policy, cands = leadCands(inExp && S.exp ? S.exp.party : party());
    const o = (v, cur, t) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`;
    return `<div class="pol">
      <label title="리더가 살아 있으면 공·방 +8%, 쓰러지면 −10% (고급 이상만 지정 가능 — 해당자가 없으면 누구나)">리더</label><select data-pol="leader">${cands.map(u => o(u.id, p.leader, `${u.name} (${C.CLASSES[u.cls].name})`)).join('') || '<option>-</option>'}</select>
      <label title="파티 평균 HP가 이 값 아래로 떨어지면 후퇴를 시도합니다">후퇴 기준 <b id="retv">${p.retreat}%</b></label><input type="range" min="0" max="70" step="5" value="${p.retreat}" data-pol="retreat" aria-label="후퇴 기준">
      <label title="스킬을 쓸 확률(치유 계열은 필요하면 항상 사용)">스킬 빈도</label><select data-pol="skill">${o('low', p.skill, '낮음')}${o('mid', p.skill, '보통')}${o('high', p.skill, '높음')}</select>
      <label title="전진 공격: 적에게 다가감 / 진형 유지: 사거리에 들어온 적만 공격">전투 방침</label><select data-pol="stance">${o('attack', p.stance, '전진 공격')}${o('hold', p.stance, '진형 유지')}</select>
      <label>목표 선택</label><select data-pol="target">${o('nearest', p.target, '가까운 적')}${o('weakest', p.target, '약한 적 우선')}</select>
      <label title="완전 탐색: 전부 둘러봄 / 보물 우선 / 계단 직행: 빠르게 내려감">탐사 방침</label><select data-pol="explore">${o('full', p.explore, '완전 탐색')}${o('treasure', p.explore, '보물 우선')}${o('stairs', p.explore, '계단 직행')}</select>
      <label>전투불능 시</label><select data-pol="downRetreat">${o('false', p.downRetreat, '계속 진행')}${o('true', p.downRetreat, '즉시 귀환')}</select>
    </div>`;
  }
  function polChange(t) {
    const k = t.dataset.pol, p = S.save.policy;
    if (k === 'startFloor') { S.startFloor = +t.value; return; }
    if (k === 'leader') p.leader = +t.value; else if (k === 'retreat') { p.retreat = +t.value; const r = document.getElementById('retv'); if (r) r.textContent = t.value + '%'; }
    else if (k === 'downRetreat') p.downRetreat = t.value === 'true'; else p[k] = t.value;
    save();
  }

  /* ---------- 사이드 패널 (캠프) ---------- */
  const CAMP_TABS = [['form', '⚔', '편성'], ['tavern', '🍺', '주점'], ['roster', '👥', '용병'], ['tactics', '🧭', '전술'], ['squad', '🪖', '분대'], ['forge', '🔨', '대장간'], ['shop', '🛒', '상점'], ['quest', '📜', '의뢰']];
  const EXP_TABS = [['log', '📜', '기록'], ['tactics', '🧭', '전술'], ['info', '🗺', '정보']];
  function renderTabs() {
    const tabs = S.exp ? EXP_TABS : CAMP_TABS, cur = S.exp ? S.sideTab : S.tab;
    $('sideTabs').innerHTML = tabs.map(([k, ic, n]) => `<button role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="tab" data-id="${k}"><span class="ic">${ic}</span>${n}${k === 'quest' && S.save.quests.active.length ? `<span class="badge">${S.save.quests.active.length}</span>` : ''}</button>`).join('');
  }
  function ucard(u, o) {
    const st = C.stats(u), c = C.CLASSES[u.cls], pos = S.save.formation[u.id];
    return `<div class="card click ${S.sel === u.id ? 'sel' : ''} ${pos && o.mark ? 'placed' : ''}" ${o.drag ? `data-unit="${u.id}"` : ''} data-act="${o.act}" data-id="${u.id}">
      <div class="ucard"><div class="pt" style="border-color:${c.color}">${portrait(u)}</div>
      <div title="${luckHint(u)}"><div class="nm">${esc(u.name)} ${rarTag(u)} <span class="dim">${c.name} Lv${u.lv}</span></div><div class="st">HP ${st.hp} · 공 ${st.atk} · 방 ${st.def} · 속 ${st.spd.toFixed(1)} · 사거리 ${st.range}</div><div class="st">${C.ROW_TXT[c.row]} · <span title="적의 시선을 끄는 정도. 방어직군이 높고, 큰 피해를 주는 누커는 위협이 쌓이면 어그로를 빼앗는다">도발 ${st.taunt.toFixed(1)}</span>${pos ? ' · <span class="good">배치됨</span>' : ''}${C.inSquad(S.save, u) ? ' · <span class="good">🪖 분대</span>' : ''} · <span class="${C.fatOf(u) < 25 ? 'bad' : C.fatOf(u) < 50 ? 'warn' : 'dim'}" title="100=정상 · 50 미만 공·방 −10% · 25 미만 −25% · 0 출격 불가">피로 ${Math.round(C.fatOf(u))}</span></div></div>
      <div class="cost-badge" title="코스트 ${C.costOf(u)}">${C.costOf(u)}</div></div>${o.more || ''}</div>`;
  }
  function comboHTML(pt) {
    const cb = C.comboOf(pt);
    if (cb.dup) return '<div class="dim" style="font-size:12.5px;margin:4px 0">⚠ 같은 직업이 3명 이상이라 조합 보너스가 없습니다.</div>';
    return cb.list.length ? `<div class="chips" style="margin:6px 0">${cb.list.map(x => `<span class="chip m" title="${x.desc}">✨ ${x.name}: ${x.desc}</span>`).join('')}</div>` : '<div class="dim" style="font-size:12.5px;margin:4px 0">조합 보너스 없음 — 전사+승려+도적 / 전열 3명 / 마술사+승려 / 엘프 / 요리사 편성 시 발동</div>';
  }
  /* ---------- 주점 UI / 장비창(용병 상세) ---------- */
  function tavernHTML(s) {
    const cands = C.tavCands(s), T = C.TAV, left = s.units.filter(u => u.left);
    let h = `<div class="row"><b>🍺 주점</b><span class="dim">후보 ${cands.length}명 · 귀환할 때마다 5~7명이 새로 나타남</span></div>
      <div class="dim" style="margin:6px 0 10px;font-size:12.5px">가운데 화면의 손님을 <b>클릭</b>하거나 아래 목록에서 골라 고용합니다. <b style="color:${C.RARITY.L.color}">전설</b> 용병은 고용 자체가 확률이며, 실패하면 고용비의 ${Math.round(T.legendLoss * 100)}%를 잃고 ${T.legendFailMax}번 실패하면 떠납니다.</div>
      <div class="row" style="margin-bottom:8px"><button class="btn pri" data-act="useticket" ${(s.tickets || 0) > 0 ? '' : 'disabled title="출현변경권이 없습니다 (보물상자·정예·보스·뽑기방·행상인)"'}>🎫 출현변경권 사용</button><span class="dim">보유 ${s.tickets || 0}장 · 후보 전체를 다시 뽑음(떠난 전설이 가끔 재등장)</span></div>`;
    h += cands.map(u => {
      const c = C.CLASSES[u.cls], st = C.stats(u), rk = C.rarOf(u);
      return `<div class="card click" data-act="tavcand" data-id="${u.id}"><div class="ucard"><div class="pt" style="border-color:${C.RARITY[rk].color}">${portrait(u)}</div><div title="${luckHint(u)}"><div class="nm">${esc(u.name)} ${rarTag(u)} <span class="dim">${c.name}</span></div><div class="st">HP ${st.hp} · 공 ${st.atk} · 방 ${st.def} · 도발 ${st.taunt.toFixed(1)} · 코스트 ${C.costOf(u)}</div><div class="st">💰 ${C.hireCost(u)}G${rk === 'L' ? ` · 성공률 약 ${Math.round(C.legendChance(s) * 100)}%${u.fails ? ` · 실패 ${u.fails}/${T.legendFailMax}` : ''}` : ''}</div></div></div></div>`;
    }).join('') || '<div class="empty">지금은 손님이 없습니다. 원정에서 돌아오면 새 손님이 나타납니다.</div>';
    if (left.length) h += `<div class="dim" style="margin-top:8px;font-size:12px">떠난 전설 용병: ${left.map(u => esc(u.name)).join(', ')} — 출현변경권으로 다시 부를 수 있습니다.</div>`;
    return h;
  }
  function tavernModal(uid) {
    const s = S.save, u = s.units.find(x => x.id === uid); if (!u || u.hired || u.left) return;
    const c = C.CLASSES[u.cls], st = C.stats(u), rk = C.rarOf(u), R = C.RARITY[rk], T = C.TAV, innate = (c.innate || []).map(k => `[${C.SKILLS[k].name}] ${C.describeSkill(k)}`);
    openModal(`<h2>${portrait(u)} ${esc(u.name)} ${rarTag(u)} <span class="dim">${c.name}</span></h2>
      <div class="stat-grid"><div class="stat-box"><b>${st.hp}</b><span>HP</span></div><div class="stat-box"><b>${st.atk}</b><span>공격</span></div><div class="stat-box"><b>${st.def}</b><span>방어</span></div><div class="stat-box"><b>${st.spd.toFixed(0)}</b><span>속도</span></div></div>
      <div class="dim" style="margin:6px 0">사거리 ${st.range} · 도발 ${st.taunt.toFixed(1)} · 코스트 ${C.costOf(u)} · ${C.ROW_TXT[c.row]} · 성장 ×${C.RARITY[rk].grow}${rk === 'L' ? '' : ''}</div>
      ${innate.length ? `<div class="dim" style="font-size:12.5px">고유 스킬: ${innate.map(esc).join('<br>')}</div>` : ''}
      <div class="dim" style="margin-top:6px;font-size:12.5px">행운은 직접 보이지 않지만 <b style="color:${R.color}">${R.name}</b> 등급일수록 드롭 운이 좋습니다. ${luckHint(u)}.</div>
      ${rk === 'L' ? `<div class="warn" style="margin-top:8px">⚠ 전설 용병 — 고용 성공률 약 <b>${Math.round(C.legendChance(s) * 100)}%</b> (파티 행운이 높을수록 ↑). 실패하면 고용비의 ${Math.round(T.legendLoss * 100)}%를 잃고, ${T.legendFailMax}번 실패하면 떠납니다. 현재 실패 ${u.fails || 0}/${T.legendFailMax}.</div>` : ''}
      <div class="foot"><button class="btn" data-m="close">닫기</button><button class="btn pri" data-m="thire" data-id="${u.id}" ${s.gold < C.hireCost(u) ? 'disabled' : ''} data-autofocus>고용 ${C.hireCost(u)}G${rk === 'L' ? ' (도전)' : ''}</button></div>`);
  }
  function sheetModal(uid) { // 장비창: 능력치(기본+장비), 슬롯별 장비 상세 스펙, 장비로 오른 스펙 합계, 장비 스킬
    const s = S.save, u = s.units.find(x => x.id === uid); if (!u) return;
    const c = C.CLASSES[u.cls], st = C.stats(u), base = C.stats(u, true), G = C.gearTotals(u), P = { hp: 'HP', atk: '공격', def: '방어', spd: '속도', eva: '회피', range: '사거리', taunt: '도발' };
    const fmt = (k, v) => k === 'eva' ? Math.round(v * 100) + '%' : k === 'taunt' ? v.toFixed(1) : k === 'spd' ? v.toFixed(0) : v;
    const rows = ['hp', 'atk', 'def', 'spd', 'eva', 'range', 'taunt'].map(k => { const d = st[k] - base[k]; return `<tr><td>${P[k]}</td><td>${fmt(k, base[k])}</td><td class="${d > 0 ? 'good' : d < 0 ? 'bad' : 'dim'}">${d ? (d > 0 ? '+' : '') + fmt(k, d) : '—'}</td><td><b>${fmt(k, st[k])}</b></td></tr>`; }).join('');
    const slots = Object.keys(C.SLOTS).map(sl => { const id = u.equip[sl], i = C.ITEMS[id];
      return `<div class="itm"><span><span class="dim">${C.SLOTS[sl]}</span> ${id ? itemName(id) : '<span class="dim">비어있음</span>'}${i ? `<div class="d" style="white-space:pre-line">${esc(C.describeFull(i))}</div>` : ''}</span><span><button class="btn sm" data-m="sheetslot" data-u="${u.id}" data-slot="${sl}">변경</button>${i ? ` <button class="btn sm" data-m="enhance" data-u="${u.id}" data-slot="${sl}" ${(s.enh || 0) > 0 && (i.plus || 0) < C.ENH_MAX ? '' : `disabled title="${(i.plus || 0) >= C.ENH_MAX ? '최대 강화' : '장비 강화권 필요 (의뢰 보상)'}"`}>🔨 강화${i.plus ? ' +' + i.plus : ''}</button>` : ''}</span></div>`; }).join('');
    const sum = Object.entries(G.t).filter(([, v]) => v).map(([k, v]) => `${P[k]} ${v > 0 ? '+' : ''}${fmt(k, v)}`).join(' · ') || '장비 없음';
    openModal(`<h2>🧾 ${esc(u.name)} ${rarTag(u)} <span class="dim">${c.name} Lv${u.lv}</span></h2>
      <h3>능력치 <span class="dim" style="font-size:12px">기본(성장 포함) + 장비 = 현재</span></h3>
      <table class="sheet-t"><tr><th></th><th>기본</th><th>장비</th><th>현재</th></tr>${rows}</table>
      <h3>장비</h3>${slots}
      <h3>장비로 오른 스펙</h3><div class="card" style="line-height:1.7">${sum}${G.sk.length ? `<br>${G.sk.map(x => `<span class="chip m" title="${esc(C.describeSkill(x.sid))}">${esc(C.SKILLS[x.sid].name)}</span> <span class="d">${esc(x.item)} — ${esc(C.describeSkill(x.sid))}</span>`).join('<br>')}` : ''}</div>
      <div class="foot"><button class="btn pri" data-m="close" data-autofocus>닫기</button></div>`, { wide: true });
  }
  function squadHTML(s) {
    const slots = C.squadSlots(s), cap = C.squadCap(s), used = C.squadUsed(s), SQ = C.SQUADS;
    if (!slots) return '<div class="empty">🔒 분대는 <b>5층을 클리어</b>(6층 도달)하면 해금됩니다.<br><span class="dim">분대는 화면 밖에서 본대 전투를 돕습니다 — 버프·디버프·즉사 방지·전범위 마법·저격.</span></div>';
    let h = `<div class="row"><b>분대 코스트 ${used} / ${cap}</b><span class="dim">슬롯 ${slots}/4 · 최고 층↑ → 상한↑</span></div><div class="bar cost ${used > cap ? 'over' : ''}"><i style="width:${pct(used, cap)}%"></i></div>
      <div class="dim" style="margin:6px 0 10px;font-size:12.5px">분대는 요구 직업을 모두 채워야 발동합니다. 분대원은 본대와 겸임할 수 없고, 출격 시 급료·식량·피로 규칙을 본대와 같이 적용받습니다. 해금: 5·15·30·45층 클리어.</div>`;
    const unitOpts = (q, pos) => {
      const need = SQ[q.type].req[pos];
      const c = s.units.filter(u => u.hired && C.baseCls(u) === need && (q.members[pos] === u.id || !C.inSquad(s, u)));
      return `<option value="">— ${C.CLASSES[need].name} 선택 —</option>` + c.map(u => `<option value="${u.id}" ${q.members[pos] === u.id ? 'selected' : ''} ${C.canSortie(u) ? '' : 'disabled'}>${esc(u.name)} Lv${u.lv} (피로 ${Math.round(C.fatOf(u))})${s.formation[u.id] && q.members[pos] !== u.id ? ' · 본대→이동' : ''}</option>`).join('');
    };
    for (let i = 0; i < slots; i++) {
      const q = (s.squads && s.squads[i]) || { type: null, members: [] }, err = q.type ? C.squadErr(s, q) : '종류 미선택';
      const act = q.type && !err && C.activeSquads(s).includes(s.squads[i]);
      h += `<div class="card"><div class="row"><b>슬롯 ${i + 1}</b><span class="${act ? 'good' : 'dim'}">${act ? '● 발동 대기' : q.type && !err ? (s.squads.slice(0, i).some(o => o.type === q.type && !C.squadErr(s, o)) ? '○ 중복 종류(효과 안 겹침)' : '○ 코스트 초과') : '○ 비활성'}</span></div>
        <div class="pol"><label>분대</label><select data-sqtype="${i}"><option value="">— 없음 —</option>${Object.entries(SQ).map(([k, d]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${d.icon} ${d.name} (코스트 ${d.cost})</option>`).join('')}</select>
        ${q.type ? SQ[q.type].req.map((r, p) => `<label>${C.CLASSES[r].name}</label><select data-sqm="${i}" data-pos="${p}">${unitOpts(q, p)}</select>`).join('') : ''}</div>
        ${q.type ? `<div class="d dim" style="font-size:12px;margin-top:4px">${SQ[q.type].icon} ${SQ[q.type].desc}${err ? ` · <span class="warn">${esc(err)}</span>` : ''}</div>` : ''}</div>`;
    }
    return h;
  }
  function forgeHTML(s) {
    const mats = Object.entries(s.mats).filter(([, n]) => n >= 1), GN = { N: '일반', H: '고급', L: '전설' }, GC = { N: '#9aa0a6', H: '#4a90e2', L: '#e0b030' };
    let h = `<div class="sec-t">보유 재료</div><div class="chips">${mats.length ? mats.map(([k, n]) => `<span class="chip" title="${{ common: '일반', elite: '정예', boss: '보스', terrain: '지형' }[C.matKind(k)]} 재료">${esc(C.MATS[k])} ×${Math.floor(n)}</span>`).join('') : '<span class="dim">없음 — 몹을 잡으면 일반 재료, 정예·보스·지형 구역에서 희귀 재료를 얻습니다</span>'}</div>`;
    h += `<div class="dim" style="margin:6px 0;font-size:12.5px">📜 전직서 ${s.promo || 0}장 (용병 탭에서 사용 · 보스 드롭 / 상점 ${C.PROMO_PRICE}G)</div>`;
    const known = C.craftBases().filter(id => s.bps[id]), total = C.craftBases().length;
    h += `<div class="sec-t">도면 (${known.length}/${total})</div><div class="dim" style="font-size:12px;margin-bottom:6px">도면은 정예(낮은 확률)·보스(높은 확률)가 드롭합니다. 직업 전용 장비와 고급·전설 장비만 제작합니다.</div>`;
    h += known.map(id => {
      const i = C.ITEMS[id], grades = i.craft ? ['N', 'H', 'L'] : ['H', 'L'];
      return `<div class="card"><div class="row"><b>${itemName(id)}</b><span class="chip">T${i.tier}</span></div><div class="d dim" style="font-size:12px">${C.SLOTS[i.slot]} · ${C.describe(i)}${i.classes ? ' · ' + i.classes.map(k => C.CLASSES[k].name).join('/') : ''}</div>` + grades.map(g => {
        const r = C.recipeOf(id, g), why = C.canCraft(s, id, g);
        return `<div class="itm"><span><b style="color:${GC[g]}">${GN[g]}</b> <span class="d">${r.need.map(([m, n]) => `<span class="${(s.mats[m] || 0) >= n ? '' : 'bad'}">${esc(C.MATS[m])} ${Math.floor(s.mats[m] || 0)}/${n}</span>`).join(' · ')}${r.terrain ? ` · <span class="${C.terrainHave(s) >= r.terrain ? '' : 'bad'}">지형 재료 ${C.terrainHave(s)}/${r.terrain}</span>` : ''} · ${r.gold}G</span></span><button class="btn sm pri" data-act="craft" data-id="${id}" data-grade="${g}" ${why ? `disabled title="${why}"` : ''}>제작</button></div>`;
      }).join('') + '</div>';
    }).join('') || '<div class="empty">아는 도면이 없습니다</div>';
    return h;
  }
  function advice() {
    const s = S.save, pt = party(), used = C.usedCost(s), cap = C.costCap(s), unplaced = s.units.filter(u => u.hired && !s.formation[u.id]);
    if (!pt.length) return { t: '용병 카드를 전장의 <b>파란 칸</b>으로 끌어다 놓아 편성하세요.' };
    const fit = unplaced.filter(u => C.costOf(u) <= cap - used).sort((a, b) => b.lv - a.lv)[0];
    if (fit) return { t: `코스트 여유 <b>${cap - used}</b> — ${esc(fit.name)}(${C.CLASSES[fit.cls].name})도 편성할 수 있어요.` };
    if (!pt.some(u => C.baseCls(u) === 'thief')) return { t: '<b>도적</b>이 없으면 함정을 그대로 밟고 잠긴 문을 열 수 없습니다.', tab: 'tavern', l: '주점 가기' };
    if (!pt.some(u => C.skillsOf(u).includes('heal') || C.baseCls(u) === 'priest')) return { t: '치유 수단이 없습니다. <b>회복약</b>을 넉넉히 준비하세요.', tab: 'shop', l: '상점 가기' };
    if ((s.cons.potion || 0) < 2) return { t: '회복약이 부족합니다.', tab: 'shop', l: '상점 가기' };
    const cheap = C.tavCands(s).map(u => C.hireCost(u)).sort((a, b) => a - b)[0];
    if (cheap && s.gold >= cheap + C.sortieWage(s) + 100) return { t: '주점에 고용할 수 있는 용병이 있습니다.', tab: 'tavern', l: '주점 가기' };
    return { t: '준비 완료! 우측 상단 <b>출격 준비</b>를 눌러 던전으로 향하세요.' };
  }
  function renderCampBody() {
    const s = S.save; let h = ''; const chEl = $('campHint'); if (chEl) chEl.style.display = S.tab === 'tavern' ? 'none' : ''; // 주점 화면에서는 편성 안내 문구를 숨긴다
    if (S.tab === 'form') {
      const used = C.usedCost(s), cap = C.costCap(s);
      h += `<div class="row"><b>편성 코스트 ${used} / ${cap}</b><span class="dim">최고 층↑ → 상한↑</span></div><div class="bar cost ${used > cap ? 'over' : ''}"><i style="width:${pct(used, cap)}%"></i></div>
        ${comboHTML(party())}
        <div class="dim" style="margin:6px 0 10px;font-size:12.5px">카드를 <b>전장으로 끌어다 놓기</b>(또는 선택 후 칸 클릭). 배치된 용병을 끌어 자리를 바꾸고, 우클릭/<span class="kbd">Del</span>로 해제합니다.</div>`;
      const hired = s.units.filter(u => u.hired);
      h += hired.map(u => ucard(u, { act: 'selunit', drag: true, mark: true })).join('') || '<div class="empty">고용한 용병이 없습니다</div>';
      h += `<div class="empty"><button class="btn" data-act="tab" data-id="tavern">🍺 주점에서 용병 고용하기 (${C.tavCands(s).length}명 대기)</button></div>`;
    } else if (S.tab === 'tavern') {
      h += tavernHTML(s);
    } else if (S.tab === 'roster') {
      h += `<div class="row" style="margin-bottom:8px"><button class="btn" data-act="autoeq" title="보관함 장비 중 가장 좋은 것을 자동 장착">🛡 전원 자동 장비</button><button class="btn" data-act="tab" data-id="tavern">🍺 주점</button><span class="dim">보관 장비 ${s.gear.length}개</span></div>`;
      h += s.units.map(u => {
        const c = C.CLASSES[u.cls];
        if (!u.hired) return ''; // 미고용 용병은 주점에서 고용한다(Phase 6)
        let det = '';
        if (S.detail === u.id) {
          det = `<div class="row" style="margin-top:8px"><button class="btn sm pri" data-act="sheet" data-id="${u.id}">🧾 장비창 · 상세 스펙</button></div><div style="margin-top:8px">` + Object.keys(C.SLOTS).map(sl => {
            const id = u.equip[sl], i = C.ITEMS[id];
            return `<div class="itm"><span><span class="dim">${C.SLOTS[sl]}</span> ${id ? itemName(id) : '<span class="dim">비어있음</span>'} ${i ? `<span class="d">${C.describe(i)}</span>` : ''}</span><button class="btn sm" data-act="slot" data-id="${u.id}" data-slot="${sl}">변경</button></div>`;
          }).join('');
          const sk = C.skillsOf(u);
          det += `<div class="dim" style="margin:8px 0 2px;font-size:12px">스킬 — 장비 착용 시 사용, 숙련도가 차면 영구 습득</div><div class="chips">${sk.length ? sk.map(k => { const L = (u.learned || []).includes(k); return `<span class="chip ${L ? 'm' : ''}" title="${esc(C.describeSkill(k))}">${C.SKILLS[k].name} ${L ? '습득' : (u.mastery[k] || 0) + '/' + C.SKILLS[k].master} · ${u.charges[k] ?? C.maxCharges(u, k)}회</span>`; }).join('') : '<span class="dim">없음</span>'}</div>
            <div class="dim" style="margin-top:6px;font-size:12px">경험치 ${u.exp}/${C.needExp(u.lv)}</div><div class="bar"><i style="width:${pct(u.exp, C.needExp(u.lv))}%;background:var(--blue)"></i></div>
            ${C.CLASSES[u.cls].promo ? `<div class="dim" style="margin-top:6px;font-size:12px">⭐ 전직 완료 — 전용 스킬 [${C.SKILLS[C.CLASSES[u.cls].skill].name}]</div>` : C.PROMO[u.cls] ? `<div class="row" style="margin-top:8px"><span class="dim" style="font-size:12px">전직: ${C.CLASSES[C.PROMO[u.cls][0]].name} (능력치 ×1.3 · 코스트 +1 · 전용 스킬 [${C.SKILLS[C.PROMO[u.cls][3]].name}] · Lv${C.PROMO_LV}+ · 전직서 필요)</span><button class="btn sm pri" data-act="promo" data-id="${u.id}" ${C.canPromote(u) && s.promo > 0 ? '' : `disabled title="${u.lv < C.PROMO_LV ? `Lv${C.PROMO_LV} 필요` : '전직서가 없습니다'}"`}>전직</button></div>` : ''}</div>`;
        }
        return ucard(u, { act: 'detail', more: det });
      }).join('');
    } else if (S.tab === 'squad') {
      h += squadHTML(s);
    } else if (S.tab === 'forge') {
      h += forgeHTML(s);
    } else if (S.tab === 'tactics') {
      h += `<div class="sec-t">전술 설정</div>${polHTML(false)}<div class="dim" style="margin-top:10px;font-size:12px">각 항목에 마우스를 올리면 설명이 나옵니다. 탐사 중에도 실시간으로 바꿀 수 있습니다.</div>`;
    } else if (S.tab === 'shop') {
      const tmax = Math.min(3, 1 + Math.floor(s.maxFloor / 10));
      const FD = C.TUNE.food, perFloor = Math.max(1, party().length) * FD.perStep * 200;
      h += `<div class="sec-t">식량</div><div class="itm"><span><b>🍖 식량</b><div class="d">보유 ${Math.floor(s.food)} · 3인 파티 기준 한 층에 약 ${perFloor.toFixed(1)} 소모 (요리사가 식용 몹을 손질하면 보충)</div></span><span><button class="btn sm" data-act="buyfood" data-id="10" ${s.gold < FD.price * 10 ? 'disabled title="골드가 부족합니다"' : ''}>×10 ${FD.price * 10}G</button> <button class="btn sm" data-act="buyfood" data-id="30" ${s.gold < FD.price * 30 ? 'disabled title="골드가 부족합니다"' : ''}>×30 ${FD.price * 30}G</button></span></div>`;
      h += `<div class="itm"><span><b>📜 전직서</b><div class="d">Lv${C.PROMO_LV} 이상 기본 직업 1명을 전직시킵니다 · 보유 ${s.promo || 0}장 · 보스도 드롭</div></span><button class="btn sm" data-act="buypromo" ${s.gold < C.PROMO_PRICE ? 'disabled title="골드가 부족합니다"' : ''}>${C.PROMO_PRICE}G</button></div>`;
      h += `<div class="sec-t">소모품</div>` + Object.entries(C.CONS).map(([k, v]) => `<div class="itm"><span><b>${v.name}</b><div class="d">${v.desc} · 보유 ${s.cons[k] || 0}</div></span><button class="btn sm" data-act="buycons" data-id="${k}" ${s.gold < v.price ? 'disabled title="골드가 부족합니다"' : ''}>${v.price}G</button></div>`).join('');
      h += `<div class="sec-t">장비 (최고 층에 따라 등급 확대 · 현재 T${tmax}까지)</div>` + Object.values(C.ITEMS).filter(i => !i.legend && !i.gen && i.tier <= tmax && (!i.craft || !C.CRAFT_ENABLED)).map(i => `<div class="itm"><span><b>${itemName(i.id)}</b> <span class="chip">T${i.tier}</span><div class="d">${C.SLOTS[i.slot]} · ${C.describe(i)}${i.classes ? ' · ' + i.classes.map(k => C.CLASSES[k].name).join('/') : ''}</div></span><button class="btn sm" data-act="buygear" data-id="${i.id}" ${s.gold < i.price ? 'disabled title="골드가 부족합니다"' : ''}>${i.price}G</button></div>`).join('');
      const SR = C.SELL_RATE.shop, gearSum = s.gear.reduce((a, id) => a + C.gearSellPrice(id, SR), 0);
      h += `<div class="sec-t">전리품 판매 — 보관함 장비 (상점 시세 ${Math.round(SR * 100)}% · 행상인은 ${Math.round(C.SELL_RATE.merchant * 100)}%)</div>` + (s.gear.length ? `<div class="row" style="margin-bottom:6px"><button class="btn sm" data-act="sellallgear">장비 전부 판매 (${s.gear.length}개 · +${gearSum}G)</button><span class="dim" style="font-size:12px">장착 중인 장비는 팔리지 않음</span></div>` + s.gear.map((id, idx) => { const i = C.ITEMS[id]; return `<div class="itm"><span>${itemName(id)}<div class="d">${C.SLOTS[i.slot]} · ${C.describe(i)}</div></span><button class="btn sm" data-act="sell" data-id="${idx}">${C.gearSellPrice(id, SR)}G 판매</button></div>`; }).join('') : '<div class="empty">비어있음</div>');
      const matList = Object.entries(s.mats).filter(([, n]) => n >= 1);
      h += `<div class="sec-t">전리품 판매 — 재료</div>` + (matList.length ? matList.map(([k, n]) => `<div class="itm"><span><b>${esc(C.MATS[k])}</b> ×${Math.floor(n)}<div class="d">${{ common: '일반', elite: '정예', boss: '보스', terrain: '지형' }[C.matKind(k)]} 재료 · 개당 ${Math.floor(C.matPrice(k) * SR)}G (대장간 제작에도 쓰임)</div></span><span><button class="btn sm" data-act="sellmat" data-id="${k}" data-n="1">1개</button> <button class="btn sm" data-act="sellmat" data-id="${k}" data-n="all">전부 +${Math.floor(C.matPrice(k) * Math.floor(n) * SR)}G</button></span></div>`).join('') : '<div class="empty">재료가 없습니다</div>');
    } else if (S.tab === 'quest') {
      h += `<div class="sec-t">수주한 의뢰 (${s.quests.active.length}/3)</div>` + (s.quests.active.length ? s.quests.active.map(q => `<div class="card"><div class="row"><b>${q.title}</b><span class="gold">${q.reward}G</span></div><div class="bar"><i style="width:${pct(q.progress, q.need)}%"></i></div><div class="row dim" style="margin-top:4px"><span>${q.progress}/${q.need}</span><button class="btn sm" data-act="abandon" data-id="${q.id}">포기</button></div></div>`).join('') : '<div class="empty">수주한 의뢰가 없습니다</div>');
      h += `<div class="sec-t">의뢰 게시판</div>` + s.quests.board.map(q => `<div class="card"><div class="row"><b>${q.title}</b><span class="gold">${q.reward}G</span></div><div class="row" style="margin-top:4px"><span class="dim">완료한 의뢰 ${s.quests.done}건</span><button class="btn sm pri" data-act="accept" data-id="${q.id}" ${s.quests.active.length >= 3 ? 'disabled title="동시에 3개까지"' : ''}>수주</button></div></div>`).join('');
      h += `<div class="dim" style="font-size:12px;margin-top:6px">의뢰는 탐사 중 자동으로 진행되며 완료 즉시 보수가 지급됩니다. 출격할 때마다 게시판이 갱신됩니다.</div>`;
    }
    $('sideBody').innerHTML = h;
  }
  function renderStageBar() {
    const bar = $('stageBar');
    if (S.exp) { bar.innerHTML = `<div class="advice">💡 지도의 <b>문·적·빈 칸</b>을 클릭하면 파티가 그곳으로 향합니다 · <span class="kbd">Space</span> 일시정지 · <span class="kbd">1~4</span> 배속 · <span class="kbd">I</span> 아이템</div>`; return; }
    const a = advice();
    bar.innerHTML = `<div class="left"><button class="btn" data-act="auto">✨ 자동 편성</button><button class="btn" data-act="clearform">전체 해제</button></div><div class="advice">💡 ${a.t}${a.tab ? ` <button class="link" data-act="tab" data-id="${a.tab}">${a.l}</button>` : ''}</div>`;
  }
  function renderCamp() { renderStats(); renderTabs(); renderCampBody(); renderStageBar(); setMode(); }

  /* ---------- 모드 전환 (캠프 ↔ 원정) ---------- */
  function setMode() {
    const ex = !!S.exp;
    for (const id of ['hudTop', 'toolbar', 'partyStrip']) $(id).classList.toggle('hidden', !ex);
    $('campHint').classList.toggle('hidden', ex); $('itemPop').classList.toggle('hidden', !ex || !S.itemOpen);
  }

  /* ---------- 원정 HUD ---------- */
  function renderToolbar() {
    setHTML($('toolbar'), `<button data-act="pause" class="${S.paused ? 'on' : ''}" title="일시정지 / 재개 (Space)">${S.paused ? '▶ 재개' : '⏸ 정지'}</button><span class="sep"></span>${SPEEDS.map((n, i) => `<button data-act="speed" data-id="${n}" class="${S.speed === n ? 'on' : ''}" title="${n}배속 (${i + 1})">×${n}</button>`).join('')}${newFloor(S.exp) && S.speed > NEW_FLOOR_CAP ? `<span class="cap" title="처음 가는 층은 ×${NEW_FLOOR_CAP}배속까지">🔒 신규 층 ×${NEW_FLOOR_CAP}</span>` : ''}${DEV ? '<span class="cap" title="개발 모드(?dev) — 출시 빌드는 ×4까지">DEV</span>' : ''}<span class="cap" title="지금 실제로 적용되는 배속과 기본 진행 속도(설정 ⚙ → 진행 속도에서 바꿀 수 있음)">적용 ×${effSpeed()}${(C.TUNE.pace || 1) > 1 ? ` · 기본 1/${C.TUNE.pace}` : ''}</span><span class="sep"></span><button data-act="items" class="${S.itemOpen ? 'on' : ''}" title="아이템 (I) — 사용 시 자동 일시정지">🎒 아이템</button><button class="danger" data-act="retreat" title="지금 귀환">🏳 귀환</button>`);
  }
  function renderItemPop() {
    const el = $('itemPop'); el.classList.toggle('hidden', !S.itemOpen || !S.exp); if (!S.itemOpen) return;
    const cons = S.save.cons;
    setHTML(el, `<h4>⏸ 정지 중 — 아이템 사용</h4>${Object.entries(C.CONS).map(([k, v]) => `<button class="item-btn ${S.itemSel === k ? 'on' : ''}" data-act="selitem" data-id="${k}" ${(cons[k] || 0) <= 0 ? 'disabled' : ''}><span><b>${v.name}</b><small>${v.desc}</small></span><b>×${cons[k] || 0}</b></button>`).join('')}<div class="dim" style="font-size:12px;margin-top:4px">${S.itemSel ? (S.itemSel === 'escape' ? '아이템을 한 번 더 누르면 귀환합니다' : '아래 <b>파티원 카드</b>를 클릭해 사용하세요') : '아이템을 선택하세요 · Esc로 닫기'}</div>`);
  }
  function updateHud() {
    const e = S.exp; if (!e) return;
    const mp = e.map; let seenF = 0, totF = 0;
    for (let y = 0; y < mp.h; y++) for (let x = 0; x < mp.w; x++) if (mp.grid[y][x] !== 0) { totF++; if (mp.seen[y][x]) seenF++; }
    const nCh = mp.chests.length, oCh = mp.chests.filter(c => c.open).length, nG = mp.groups.filter(g => g.alive).length;
    const mission = e.battle ? (e.battle.guardian ? '⚔ 수호자 전투' : '⚔ 전투 중') : (e.text || '').replace(/^\d+층 · /, '') || '탐사 중';
    setHTML($('hudTop'), `<div class="floor-plate">B${e.floor}F</div><div class="mission"><b>${esc(mission)}${S.paused ? ' · ⏸' : ''}</b><span class="sub">탐사 ${Math.round(seenF / totF * 100)}% · 상자 ${oCh}/${nCh} · 적 ${nG} · <span class="${S.save.food < 1 ? 'bad' : ''}" title="남은 식량">🍖 ${Math.floor(S.save.food)}</span>${(e.quests || []).filter(q => !q.done).map(q => ` · 📋 ${q.type === 'deliver' ? `전달→${q.tf}층` : q.type === 'hunt' ? `${q.fam} ${q.progress}/${q.need}` : `${C.MATS[q.mat]} ${Math.min(q.need, C.matHave(e, q.mat))}/${q.need}`}${C.questReady(e, q) ? ' ✔보고' : ''}`).join('')}${e.cq ? ` · 🤝 ${esc(e.cq.comp.name)} 의뢰 ${C.cqProgress(e)}/${e.cq.need}` : ''}${e.bless > 0 ? ` · ✨축복 ${Math.min(3, e.bless)}회` : ''}${mp.groups.some(g => g.alive && g.golden && mp.seen[g.y][g.x]) ? ' · ✨황금 몹!' : ''}</span></div>`);
    renderToolbar(); // 신규 층 진입/이탈에 따라 배속 제한 표시 갱신
    const lead = S.save.policy.leader;
    setHTML($('partyStrip'), e.party.map(u => {
      const st = C.stats(u), c = C.CLASSES[u.cls], p = pct(u.hp, st.hp), tgt = S.paused && S.itemSel && S.itemSel !== 'escape';
      const sk = C.skillsOf(u).map(k => `<span>${C.SKILLS[k].name} ${u.charges[k] ?? 0}</span>`).join('');
      return `<div class="pcard ${u.hp <= 0 ? 'down' : ''} ${tgt ? 'target' : ''} ${u.id === lead ? 'lead' : ''}" ${tgt ? `data-act="applyto" data-id="${u.id}"` : ''}><div class="pt" style="border-color:${c.color}">${portrait(u)}</div><div class="nm">${esc(u.name)}${u.id === lead ? ' ★' : ''}${u.poison ? ' ☠️' : ''}${C.fatOf(u) < 50 ? ` <span title="피로 ${Math.round(C.fatOf(u))}">😓</span>` : ''} <small>Lv${u.lv}</small></div><div><div class="hpn"><span>HP</span><span>${u.hp}/${st.hp}</span></div><div class="bar"><i class="${hpCls(p)}" style="width:${p}%"></i></div></div><div class="sk">${sk}</div></div>`;
    }).join(''));
    renderItemPop();
    // 사이드: 기록(증분)
    if (S.sideTab === 'log') {
      const lb = document.getElementById('logBox');
      if (lb && S.logShown < e.log.length) {
        const stick = lb.scrollTop + lb.clientHeight >= lb.scrollHeight - 40;
        lb.insertAdjacentHTML('beforeend', e.log.slice(S.logShown).map(l => `<div class="${l.c}">${esc(l.m)}</div>`).join('')); S.logShown = e.log.length;
        while (lb.children.length > 200) lb.firstChild.remove();
        if (stick) lb.scrollTop = lb.scrollHeight;
      }
    } else if (S.sideTab === 'info') {
      const el = document.getElementById('infoStats'); if (el) {
        const thief = e.party.some(u => C.baseCls(u) === 'thief' && u.hp > 0);
        setHTML(el, `<div class="card"><b>B${e.floor}F</b> · ${esc(mission)}<br><span class="dim">탐사율 ${Math.round(seenF / totF * 100)}% · 상자 ${oCh}/${nCh} · 남은 적 ${nG}</span>${thief ? '' : '<br><span class="warn">⚠ 도적이 없어 함정을 밟고 잠긴 문은 열 수 없습니다</span>'}</div>`);
      }
    }
    // 층 변경 배너
    if (S.lastFloor !== e.floor) { S.lastFloor = e.floor; showFloorBanner(e.floor); }
  }
  function showFloorBanner(f) {
    const b = $('floorBanner'); b.innerHTML = `B${f}F<small>${f % 5 === 0 ? (f === 50 ? '— 흑왕의 방 —' : '— 보스가 기다린다 —') : '미궁 탐사'}</small>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  function renderExpSide() {
    renderTabs();
    const body = $('sideBody');
    if (S.sideTab === 'log') { body.innerHTML = '<div class="log" id="logBox"></div>'; S.logShown = 0; const lb = $('logBox'); lb.innerHTML = S.exp.log.slice(-200).map(l => `<div class="${l.c}">${esc(l.m)}</div>`).join(''); S.logShown = S.exp.log.length; lb.scrollTop = lb.scrollHeight; }
    else if (S.sideTab === 'tactics') body.innerHTML = `<div class="sec-t">전술 (실시간 변경 가능)</div>${polHTML(true)}`;
    else body.innerHTML = `<div id="infoStats"></div><div class="sec-t">지도 기호</div><div class="card" style="line-height:1.9">⬇ 계단 &nbsp; ⬆ 입구 &nbsp; 📦 상자 &nbsp; 🎁 큰 상자(금고) &nbsp; ⚠ 함정(도적이 발견)<br>🚪 문 &nbsp; 🔒 잠긴 문(도적 필요) &nbsp; ⛲ 치유의 샘 &nbsp; ■ 검은 칸 = 적 무리<br>보라 테두리 ☠ = 배회하는 정예 · 파랑 ❗ = 조건부 특수 몹(원혼·도적단) · 📦 일부는 미믹<br>▲ = 전투 무대의 고지대(+6%/단) · 미로의 계단식 바닥 = 고저차<br>붉은 테두리 = 리더 · 노란 점선 = 이동 경로</div><div class="sec-t">몬스터 특수 능력 (이름 옆 아이콘)</div><div class="card" style="line-height:1.9">${Object.keys(C.ABIL_ICON).map(k => `${C.ABIL_ICON[k]} ${C.ABIL_DESC[k]}`).join(' &nbsp; ')}</div><div class="sec-t">도발(어그로)</div><div class="card" style="line-height:1.8">적은 <b>위협 수치가 가장 높은 대원</b>을 노립니다(붉은 점선). 기사·전사는 도발 배율이 높아 기본적으로 시선을 끌고, 큰 피해를 주는 마술사·궁수 같은 누커는 위협이 쌓이면 어그로를 빼앗습니다. 기사·전사는 <b>[도발]</b> 스킬로 어그로를 되찾습니다(🛡 표시).</div><div class="sec-t">조작</div><div class="card" style="line-height:1.9"><span class="kbd">Space</span> 일시정지 · <span class="kbd">1~4</span> 배속 · <span class="kbd">I</span> 아이템 · <span class="kbd">Esc</span> 닫기<br>지도 클릭: 그 위치로 이동 지시</div>`;
    S.exp && updateHud();
  }

  /* ---------- 흐름: 출격 / 종료 ---------- */
  function sortieModal() {
    const s = S.save, pt = party(), wage = C.sortieWage(s), used = C.usedCost(s), cap = C.costCap(s);
    const has = f => pt.some(f), ok = (b, t, w) => `<div class="check"><span class="ic">${b ? '✅' : '⚠️'}</span><span>${b ? t : `<span class="warn">${w}</span>`}</span></div>`;
    const heal = has(u => C.skillsOf(u).includes('heal') || C.baseCls(u) === 'priest');
    openModal(`<h2>🚪 출격 준비</h2><div class="dim">출발 전에 편성과 소모품을 점검하세요.</div>
      <h3>파티 (${pt.length}명 · 코스트 ${used}/${cap})</h3>
      <div class="chips" style="gap:6px">${pt.map(u => `<span class="chip" style="padding:3px 10px">${C.CLASSES[u.cls].icon} ${esc(u.name)} Lv${u.lv}</span>`).join('') || '<span class="dim">편성된 용병이 없습니다</span>'}</div>
      ${comboHTML(pt)}
      ${C.activeSquads(s).length ? `<div class="chips" style="margin:6px 0">${C.activeSquads(s).map(q => `<span class="chip m" title="${C.SQUADS[q.type].desc}">${C.SQUADS[q.type].icon} ${C.SQUADS[q.type].name}</span>`).join('')}</div>` : (C.squadSlots(s) ? '<div class="dim" style="font-size:12.5px;margin:4px 0">🪖 발동 가능한 분대가 없습니다 (분대 탭에서 편성)</div>' : '')}
      <h3>점검</h3>
      ${ok(pt.length >= 3, `편성 인원 ${pt.length}명`, `편성 인원이 ${pt.length}명입니다. 3명 이상을 권장합니다.`)}
      ${ok(has(u => C.baseCls(u) === 'thief'), '도적 동행 — 함정 해제·잠긴 문 개방 가능', '도적이 없습니다. 함정을 밟고 잠긴 문은 열 수 없습니다.')}
      ${ok(heal, '치유 수단 있음', '승려/치유 스킬이 없습니다. 회복약을 준비하세요.')}
      ${ok((s.cons.potion || 0) + (s.cons.elixir || 0) >= 2, `회복약 ${(s.cons.potion || 0) + (s.cons.elixir || 0)}개`, '회복약이 2개 미만입니다.')}
      ${(() => { const sp = C.supplyPlan(s); return sp ? ok(!sp.short, `🍳 요리사 자동 보급: 최소 5층 분량(식량 ${sp.target}) 유지${sp.buy ? ` — 출격 시 ${sp.buy}개 구매 (−${sp.cost}G)` : ' — 이미 충분'}`, `🍳 요리사 보급: 골드가 부족해 ${sp.buy}개만 구매합니다 (5층 분량에는 ${sp.need - sp.buy}개 부족)`) : ''; })()}
      ${ok(s.food >= pt.length * C.TUNE.food.perStep * 600, `식량 ${Math.floor(s.food)} — 약 ${Math.floor(s.food / Math.max(1, pt.length * C.TUNE.food.perStep * 200))}층 분량${has(u => C.baseCls(u) === 'cook') ? ' (요리사 동행: 식용 몹을 식량으로)' : ''}`, `식량이 부족합니다 (약 ${Math.floor(s.food / Math.max(1, pt.length * C.TUNE.food.perStep * 200))}층 분량). 바닥나면 피로가 쌓입니다.`)}
      ${ok(!pt.some(u => C.fatOf(u) < 50), '파티 피로 양호', `피로 50 미만인 용병이 있습니다 (${pt.filter(u => C.fatOf(u) < 50).map(u => esc(u.name) + ' ' + Math.round(C.fatOf(u))).join(', ')}) — 공·방이 떨어집니다.`)}
      ${ok(s.gold >= wage, `급료 ${wage}G 지불 가능 (출격 후 ${(s.gold - wage).toLocaleString()}G)`, `골드가 부족합니다 (급료 ${wage}G)`)}
      <h3>설정</h3><div class="pol"><label title="원정은 1층에서 시작합니다. 보스를 쓰러뜨려 지름길이 열리면 그 다음 층(6·11·16…층)에서도 시작할 수 있습니다">시작 층</label><select data-pol="startFloor">${C.startFloors(s).slice().reverse().map(f => `<option value="${f}" ${f === S.startFloor ? 'selected' : ''}>${f}층${f === 1 ? ' (입구)' : ' (지름길)'}</option>`).join('')}</select>
      <label>탐사 방침</label><select data-pol="explore">${[['full', '완전 탐색'], ['treasure', '보물 우선'], ['stairs', '계단 직행']].map(([v, t]) => `<option value="${v}" ${s.policy.explore === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label>후퇴 기준 <b id="retv">${s.policy.retreat}%</b></label><input type="range" min="0" max="70" step="5" value="${s.policy.retreat}" data-pol="retreat"></div>
      <div class="dim" style="font-size:12px;margin-top:6px">그 밖의 전술은 <button class="link" style="background:none;border:0;color:var(--blue);cursor:pointer;text-decoration:underline" data-m="gotab" data-id="tactics">전술 탭</button>에서 바꿀 수 있습니다.</div>
      <div class="foot"><button class="btn" data-m="close">취소</button><button class="cta" data-m="sortie-go" data-autofocus ${pt.length && s.gold >= wage ? '' : 'disabled'}>출격!</button></div>`);
  }
  function startSortie() {
    const s = S.save, pt = party(), wage = C.sortieWage(s); if (!pt.length || s.gold < wage) return;
    const lc = leadCands(pt); if (!lc.find(u => u.id === s.policy.leader)) s.policy.leader = lc[0].id;
    s.gold -= wage; closeModal();
    const sp = C.supplyPlan(s); // 요리사 자동 보급 (급료 지불 후 남은 골드로 5층 분량까지)
    if (sp && sp.buy > 0 && C.buyFood(s, sp.buy)) toast(`🍳 요리사가 식량 ${sp.buy}개를 보급했습니다 (−${sp.cost}G)${sp.short ? ' — 골드가 부족해 5층 분량에는 못 미칩니다' : ''}`, sp.short ? 'bad' : 'good');
    S.exp = C.createExpedition(s, C.startFloors(s).includes(S.startFloor) ? S.startFloor : C.defaultStart(s)); S.paused = false; S.itemSel = null; S.itemOpen = false; S.acc = 0; S.floaters = []; S.resultShown = false; S.lastFloor = 0; S.sideTab = 'log'; S.sel = null;
    S.exp.log.push({ m: `🚪 ${S.exp.floor}층에서 탐사 개시! (급료 ${wage}G)`, c: 'floor' });
    setHint(''); renderStats(); setMode(); renderToolbar(); renderExpSide(); renderStageBar(); updateHud();
  }
  function showResult() {
    const e = S.exp; S.resultShown = true; S.itemOpen = false; $('itemPop').classList.add('hidden');
    const t = { clear: ['👑 50층 완전 정복!', '흑왕을 쓰러뜨렸습니다. 계속 육성하며 플레이할 수 있습니다.'], retreat: ['🏃 무사히 귀환', '획득한 골드와 장비를 모두 가져왔습니다.'], wipe: ['💀 전멸', '전멸하여 골드의 절반만 회수했고 장비는 잃었습니다. 후퇴 기준을 높이거나 소모품을 더 챙겨보세요.'] }[e.result];
    const items = e.loot.items;
    openModal(`<h2>${t[0]}</h2><div class="${e.result === 'wipe' ? 'bad' : 'dim'}">${t[1]}</div>
      <div class="stat-grid"><div class="stat-box"><b>${e.reached}층</b><span>도달</span></div><div class="stat-box"><b>${e.kills}</b><span>처치</span></div><div class="stat-box"><b>${e.chests}</b><span>상자</span></div><div class="stat-box"><b>${e.result === 'wipe' ? Math.floor(e.loot.gold / 2) : e.loot.gold}G</b><span>획득 골드</span></div></div>
      ${e.result === 'wipe' ? '' : `<h3>획득 장비 (${items.length})</h3><div class="chips">${items.map(i => `<span class="chip">${itemName(i)}</span>`).join('') || '<span class="dim">없음</span>'}</div>`}
      ${e.result !== 'wipe' && (Object.keys(e.loot.mats || {}).length || (e.loot.bps || []).length || e.loot.promo || e.loot.tickets) ? `<h3>획득 재료·도면</h3><div class="chips">${Object.entries(e.loot.mats || {}).map(([k, n]) => `<span class="chip">${esc(C.MATS[k])} ×${Math.round(n * 10) / 10}</span>`).join('')}${(e.loot.bps || []).map(id => `<span class="chip m">📐 ${esc(itemNameText(id))} 도면</span>`).join('')}${e.loot.promo ? `<span class="chip m">📜 전직서 ×${e.loot.promo}</span>` : ''}${e.loot.tickets ? `<span class="chip m">🎫 출현변경권 ×${e.loot.tickets}</span>` : ''}</div>` : ''}
      ${e.joined && e.joined.length ? `<h3>🤝 새 특수 동료</h3><div class="chips">${e.joined.map(n => `<span class="chip m">${esc(n)}</span>`).join('')}</div>` : ''}
      <div class="dim" style="font-size:12.5px;margin-top:6px">😓 피로 회복: 쉰 용병 +25 · 출전 용병 +5${e.fatLog && e.fatLog.mul > 1 ? ` · 승려 동행 ×${e.fatLog.mul}` : ''}${e.fatLog && e.fatLog.bonus ? ` · 요리사 식사 +${e.fatLog.bonus}` : ''} · 남은 식량 🍖 ${Math.floor(S.save.food)}</div>
      ${e.autoLog && e.autoLog.length ? `<h3>자동 장착 내역 (${e.autoLog.length})</h3><div class="dim" style="font-size:12.5px;max-height:130px;overflow:auto">${e.autoLog.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
      <div class="foot"><button class="btn pri" data-m="result-camp" data-autofocus>캠프로</button></div>`, { lock: true });
  }
  function endExpedition() {
    S.exp = null; S.evOpen = false; bq.length = 0; S.paused = false; S.itemOpen = false; S.itemSel = null; S.tab = 'form'; S.startFloor = C.defaultStart(S.save); S._ents = {};
    closeModal(); save(); renderCamp(); setHint('캠프로 돌아왔습니다. 장비와 편성을 정비하세요.', 4000);
  }
  function togglePause(force) {
    if (!S.exp || S.exp.done) return; S.paused = force === undefined ? !S.paused : force;
    if (!S.paused) { S.itemOpen = false; S.itemSel = null; S.autoPaused = false; }
    renderToolbar(); renderItemPop(); updateHud();
  }
  function openItems(open) {
    if (!S.exp || S.exp.done) return; S.itemOpen = open; S.itemSel = null;
    if (open) { if (!S.paused) { S.paused = true; S.autoPaused = true; } } else if (S.autoPaused) { S.paused = false; S.autoPaused = false; }
    renderToolbar(); renderItemPop(); updateHud();
  }

  /* ---------- 편성 조작 ---------- */
  function placeUnit(id, x, y) {
    const s = S.save, u = s.units.find(z => z.id === id), occ = C.unitAt(s, x, y), old = s.formation[id] ? s.formation[id].slice() : null;
    if (occ && occ.id !== id) {
      if (!old) { toast('이미 다른 용병이 있습니다. 배치된 용병을 끌어다 놓으면 자리가 바뀝니다.', 'warn'); return false; }
      delete s.formation[id]; delete s.formation[occ.id];
      const e1 = C.place(s, u, x, y), e2 = e1 ? e1 : C.place(s, occ, old[0], old[1]);
      if (e1 || e2) { delete s.formation[id]; delete s.formation[occ.id]; s.formation[id] = old; s.formation[occ.id] = [x, y]; toast(e1 || e2, 'bad'); return false; }
      return true;
    }
    const err = C.place(s, u, x, y); if (err) { toast(err, 'bad'); return false; }
    return true;
  }
  function afterFormChange() { save(); renderStats(); renderCampBody(); renderStageBar(); }
  const P = { id: null, fromBoard: false, x0: 0, y0: 0, moved: false, type: 'mouse' };
  const ghost = $('dragGhost');
  function startPress(id, ev, fromBoard) { P.id = id; P.fromBoard = fromBoard; P.x0 = ev.clientX; P.y0 = ev.clientY; P.moved = false; P.type = ev.pointerType; }
  document.addEventListener('pointerdown', ev => {
    P.id = null; P.moved = false;
    if (S.exp || ev.button > 0) return;
    const card = ev.target.closest('[data-unit]');
    if (card && S.tab === 'form' && ev.pointerType !== 'touch') { startPress(+card.dataset.unit, ev, false); return; }
    if (ev.target === cv && S.tab !== 'tavern') { const c = Render.cellAt(ev); const u = c && C.unitAt(S.save, c[0], c[1]); if (u) startPress(u.id, ev, true); else P.id = null; }
  });
  document.addEventListener('pointermove', ev => {
    if (P.id === null) return;
    if (!P.moved && Math.hypot(ev.clientX - P.x0, ev.clientY - P.y0) > 6) {
      P.moved = true; S.dragId = P.id; const u = S.save.units.find(z => z.id === P.id);
      ghost.innerHTML = portrait(u); ghost.classList.remove('hidden'); document.body.style.userSelect = 'none';
      document.querySelectorAll('[data-unit]').forEach(el => el.classList.toggle('dragging', +el.dataset.unit === P.id));
    }
    if (P.moved) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; S.hover = ev.target === cv ? Render.cellAt(ev) : null; }
  });
  document.addEventListener('pointerup', ev => {
    if (P.id === null) return;
    const id = P.id, moved = P.moved, fromBoard = P.fromBoard; P.id = null;
    ghost.classList.add('hidden'); document.body.style.userSelect = ''; S.dragId = null; document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    const u = S.save.units.find(z => z.id === id);
    if (moved) {
      const over = document.elementFromPoint(ev.clientX, ev.clientY), c = over === cv ? Render.cellAt(ev) : null;
      if (c) { if (placeUnit(id, c[0], c[1])) { S.sel = null; setHint(`<b>${esc(u.name)}</b> 배치 완료`); } afterFormChange(); }
      else if (fromBoard) { delete S.save.formation[id]; setHint(`<b>${esc(u.name)}</b> 배치 해제`); afterFormChange(); }
      return;
    }
    if (fromBoard) { // 클릭: 선택/이동
      const c = Render.cellAt(ev);
      if (S.sel && S.sel !== id && c) { if (placeUnit(S.sel, c[0], c[1])) S.sel = null; afterFormChange(); return; }
      S.sel = S.sel === id ? null : id; setHint(S.sel ? `<b>${esc(u.name)}</b> 선택됨 — 옮길 칸을 클릭 · <span class="kbd">Del</span> 해제` : '', 4000); renderCampBody();
    }
  });
  cv.addEventListener('click', ev => {
    if (!S.exp && S.tab === 'tavern') { const id = Render.tavernAt(ev); if (id) tavernModal(id); return; } // 주점: 손님을 클릭해 데려온다
    if (S.exp) {
      if (S.exp.battle || S.exp.done) return;
      const t = Render.mazeTile(ev); if (!t) return;
      const err = C.setDirective(S.exp, t[0], t[1]); toast(err || '지시: 해당 위치로 이동합니다', err ? 'bad' : ''); return;
    }
    if (P.moved) return;
    const c = Render.cellAt(ev); if (!c) return;
    if (S.sel && !C.unitAt(S.save, c[0], c[1])) { const u = S.save.units.find(z => z.id === S.sel); if (placeUnit(S.sel, c[0], c[1])) { setHint(`<b>${esc(u.name)}</b> 배치 완료`); S.sel = null; } afterFormChange(); }
    else if (!C.unitAt(S.save, c[0], c[1])) setHint('왼쪽 목록의 카드를 끌어다 놓거나, 카드를 선택한 뒤 칸을 클릭하세요', 3500);
  });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); if (S.exp) return; const c = Render.cellAt(ev), u = c && C.unitAt(S.save, c[0], c[1]); if (u) { delete S.save.formation[u.id]; setHint(`<b>${esc(u.name)}</b> 배치 해제`); afterFormChange(); } });
  cv.addEventListener('mousemove', ev => { if (!S.exp && S.tab === 'tavern') { S.tavernHover = Render.tavernAt(ev); cv.style.cursor = S.tavernHover ? 'pointer' : ''; return; } if (P.moved) return; S.hover = S.exp ? (S.exp.battle ? null : Render.mazeTile(ev)) : Render.cellAt(ev); });
  cv.addEventListener('mouseleave', () => { if (!P.moved) S.hover = null; });

  /* ---------- 패널·툴바 클릭 ---------- */
  function onAct(b, ev) {
    const a = b.dataset.act, id = b.dataset.id, s = S.save;
    switch (a) {
      case 'tab': if (S.exp) { S.sideTab = id; renderExpSide(); } else { S.tab = id; S.sel = null; renderTabs(); renderCampBody(); } return;
      case 'selunit': S.sel = S.sel === +id ? null : +id; { const u = s.units.find(x => x.id === +id); setHint(S.sel ? `<b>${esc(u.name)}</b> 선택됨 — 전장의 <b>파란 칸</b>을 클릭하세요 (${C.ROW_TXT[C.CLASSES[u.cls].row]})` : '', 0); } renderCampBody(); return;
      case 'auto': C.autoFormation(s); save(); toast('자동 편성 완료', 'good'); afterFormChange(); return;
      case 'clearform': s.formation = {}; afterFormChange(); return;
      case 'detail': S.detail = S.detail === +id ? null : +id; renderCampBody(); return;
      case 'slot': slotModal(s.units.find(u => u.id === +id), b.dataset.slot); ev.stopPropagation(); return;
      case 'autoeq': { const lg = C.autoEquip(s, { idle: true }); save(); toast(lg.length ? `자동 장비 완료 (${lg.length}건 변경)` : '바꿀 장비가 없습니다', 'good'); renderCampBody(); return; }
      case 'buycons': { const v = C.CONS[id]; if (s.gold >= v.price) { s.gold -= v.price; s.cons[id] = (s.cons[id] || 0) + 1; save(); renderStats(); renderCampBody(); renderStageBar(); } return; }
      case 'buypromo': if (C.buyPromo(s)) { save(); renderStats(); renderCampBody(); } return;
      case 'promo': { const u = s.units.find(x => x.id === +id), nm = C.CLASSES[C.PROMO[u.cls][0]].name, r = C.promote(s, u); if (r) toast(r, 'bad'); else { save(); toast(`⭐ ${u.name}이(가) ${nm}(으)로 전직했습니다!`, 'good'); renderStats(); renderCampBody(); renderStageBar(); } ev.stopPropagation(); return; }
      case 'craft': { const r = C.craft(s, id, b.dataset.grade); if (r.err) toast(r.err, 'bad'); else { save(); toast(`🔨 ${itemNameText(r.id)} 제작 완료!${r.upgraded ? ' (행운으로 등급 상승!)' : ''}`, 'good'); renderStats(); renderCampBody(); } return; }
      case 'buyfood': if (C.buyFood(s, +id)) { save(); renderStats(); renderCampBody(); renderStageBar(); } return;
      case 'buygear': { const i = C.ITEMS[id]; if (s.gold >= i.price) { s.gold -= i.price; s.gear.push(id); save(); renderStats(); renderCampBody(); } return; }
      case 'sell': { C.sellGear(s, +id, C.SELL_RATE.shop); save(); renderStats(); renderCampBody(); return; }
      case 'sellallgear': { const g = C.sellAllGear(s, C.SELL_RATE.shop); save(); toast(`장비를 모두 팔았습니다 (+${g}G)`, 'good'); renderStats(); renderCampBody(); return; }
      case 'sellmat': { const g = C.sellMat(s, id, b.dataset.n === 'all' ? 'all' : +b.dataset.n, C.SELL_RATE.shop); if (g) { save(); renderStats(); renderCampBody(); } return; }
      case 'accept': { const q = s.quests.board.find(x => x.id === +id); if (q && s.quests.active.length < 3) { s.quests.board = s.quests.board.filter(x => x !== q); s.quests.active.push(q); save(); toast('의뢰를 수주했습니다', 'good'); renderTabs(); renderCampBody(); } return; }
      case 'abandon': s.quests.active = s.quests.active.filter(x => x.id !== +id); save(); renderTabs(); renderCampBody(); return;
      case 'sortie-open': sortieModal(); return;
      case 'fullscreen': toggleFullscreen(); return;
      case 'rec': toggleRec(); return;
      case 'sheet': sheetModal(+id); ev.stopPropagation(); return;
      case 'tavcand': tavernModal(+id); return;
      case 'useticket': { const r = C.useTicket(s); if (!r) { toast('출현변경권이 없습니다', 'bad'); return; } save(); toast(`🎫 주점 후보가 바뀌었습니다 (${C.tavCands(s).length}명)`, 'good'); renderStats(); renderCampBody(); return; }
      case 'help': tutorial(0); return;
      case 'settings': settingsModal(); return;
      case 'pause': togglePause(); return;
      case 'speed': if (!SPEEDS.includes(+id)) return; S.speed = +id; S.prefs.speed = S.speed; savePrefs(); renderToolbar(); return;
      case 'items': openItems(!S.itemOpen); return;
      case 'selitem': if (S.itemSel === id && id === 'escape') { applyItem(null); return; } S.itemSel = S.itemSel === id ? null : id; renderItemPop(); updateHud(); return;
      case 'retreat': confirmDlg('🏳 지금 귀환할까요?', '획득한 골드와 장비는 모두 가져갑니다. 탐사는 여기서 종료됩니다.', '귀환', () => { C.manualRetreat(S.exp); S.paused = false; closeModal(); }); return;
      case 'applyto': applyItem(+id); return;
    }
  }
  function applyItem(uid) {
    const e = S.exp, item = S.itemSel; if (!e || !item) return;
    const u = item === 'escape' ? e.party[0] : e.party.find(x => x.id === uid);
    const err = C.useConsumable(e, item, u);
    if (err) toast(err, 'bad'); else { toast(`${C.CONS[item].name} 사용`, 'good'); if ((S.save.cons[item] || 0) <= 0) S.itemSel = null; }
    if (e.done) { S.paused = false; S.itemOpen = false; }
    renderStats(); renderItemPop(); updateHud(); renderToolbar();
  }
  document.addEventListener('click', ev => {
    if (ev.target.closest('#modal')) return;
    const b = ev.target.closest('[data-act]'); if (b && !(b.closest('#modal'))) { if (b.tagName === 'BUTTON') b.blur(); onAct(b, ev); }
  });
  for (const el of [$('sideBody'), modalEl]) {
    el.addEventListener('input', ev => { if (ev.target.dataset.pol === 'retreat') polChange(ev.target); });
    el.addEventListener('change', ev => { const t = ev.target; if (t.dataset.pol) polChange(t); if (t.dataset.pref) prefChange(t); if (t.dataset.opt) { S.save.opts[t.dataset.opt] = t.checked; save(); }
      if (t.dataset.sqtype !== undefined) { C.setSquad(S.save, +t.dataset.sqtype, t.value); save(); renderCampBody(); renderStats(); renderStageBar(); }
      if (t.dataset.sqm !== undefined) { const r = C.assignSquad(S.save, +t.dataset.sqm, +t.dataset.pos, +t.value || 0); if (r) toast(r, 'bad'); save(); renderCampBody(); renderStats(); renderStageBar(); } });
  }

  /* ---------- 모달 동작 ---------- */
  function slotModal(u, slot) {
    const s = S.save, list = s.gear.filter(id => C.ITEMS[id].slot === slot && C.canUse(u, C.ITEMS[id])), uniq = [...new Set(list)], cur = C.ITEMS[u.equip[slot]];
    openModal(`<h2>${esc(u.name)} — ${C.SLOTS[slot]}</h2>
      ${u.equip[slot] ? `<div class="itm"><span>${itemName(u.equip[slot])} <span class="d">장착 중 · ${C.describe(cur)}</span></span><button class="btn sm" data-m="equip" data-u="${u.id}" data-slot="${slot}">해제</button></div>` : ''}
      ${uniq.length ? uniq.map(id => `<div class="itm"><span>${itemName(id)} <span class="chip">T${C.ITEMS[id].tier}</span> ×${list.filter(x => x === id).length}<div class="d">${C.describe(C.ITEMS[id])}${cur || true ? ' · 변화 ' + (diffTxt(C.ITEMS[id], cur) || '없음') : ''}</div></span><button class="btn sm pri" data-m="equip" data-u="${u.id}" data-slot="${slot}" data-item="${id}">장착</button></div>`).join('') : '<div class="empty">${C.CLASSES[u.cls].name}이(가) 쓸 수 있는 보관 장비가 없습니다.<br>상점에서 구입하거나 탐사에서 얻을 수 있습니다.</div>'}
      <div class="foot"><button class="btn" data-m="close">닫기</button></div>`);
  }
  const TUT = [
    ['🛡', '용병을 편성하세요', '왼쪽 목록의 카드를 전장의 <b>파란 칸</b>에 끌어다 놓습니다. 전사·기사는 전열, 마술사·승려·도적은 후열입니다. 용병마다 <b>코스트</b>가 달라 상한 안에서만 배치할 수 있습니다.'],
    ['🚪', '출격하면 자동으로 탐사합니다', '우측 상단 <b>출격 준비</b>를 누르면 파티가 미궁을 스스로 걸으며 상자를 열고 적과 싸웁니다. <b>도적</b>은 함정을 해제하고 잠긴 문(금고방)을 엽니다.'],
    ['🧭', '직접 하는 건 "방침"입니다', '후퇴 기준, 스킬 빈도, 리더, 탐사 방침을 정해 두세요. 지도의 문·적·빈 칸을 <b>클릭</b>하면 그곳으로 향합니다.'],
    ['🎒', '아이템은 일시정지 중에', '<span class="kbd">Space</span>로 멈추고 🎒 아이템을 골라 파티원 카드를 클릭하세요. <span class="kbd">1~4</span>로 배속을 바꿀 수 있습니다. 목표는 <b>50층 흑왕</b> 격파!'],
  ];
  function tutorial(i) {
    const t = TUT[i], last = i === TUT.length - 1;
    openModal(`<div class="tut-art">${t[0]}</div><h2 style="text-align:center">${t[1]}</h2><p style="text-align:center" class="dim">${t[2]}</p><div class="steps">${TUT.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="foot" style="justify-content:space-between"><button class="btn" data-m="tut-done">건너뛰기</button><span>${i > 0 ? `<button class="btn" data-m="tut" data-i="${i - 1}">이전</button> ` : ''}<button class="btn pri" data-m="${last ? 'tut-done' : 'tut'}" data-i="${i + 1}" data-autofocus>${last ? '시작하기' : '다음'}</button></span></div>`);
  }
  function settingsModal() {
    const r = Assets.report();
    openModal(`<h2>⚙ 설정</h2>
      <h3>화면</h3><label class="check"><input type="checkbox" data-pref="reduce" ${S.prefs.reduce ? 'checked' : ''}> 애니메이션 줄이기</label>
      <div class="pol" style="margin-top:6px"><label>기본 배속</label><select data-pref="speed">${SPEEDS.map(n => `<option value="${n}" ${S.prefs.speed === n ? 'selected' : ''}>×${n}</option>`).join('')}</select></div>
      <div class="pol" style="margin-top:6px"><label title="모든 배속에 곱해지는 기본 진행 속도. 6=총 플레이 약 45시간 기준(기본), 9=느림, 1=원래 속도(테스트용 가장 빠름)">진행 속도</label><select data-pref="pace">${[[9, '느림'], [7, '조금 느림'], [6, '기본 (약 45시간 기준)'], [4, '빠름'], [2, '더 빠름'], [1, '매우 빠름 (원래 속도)']].map(([v, t]) => `<option value="${v}" ${C.TUNE.pace === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="pol" style="margin-top:6px"><label title="전투 중 누가 누구를 노리는지 선으로 표시: 적→대원 주황(도발 시 빨강), 대원→적 파랑, 치유 초록">표적선</label><select data-pref="lines">${[['all', '모두 표시'], ['enemy', '적의 표적만'], ['off', '끄기']].map(([v, t]) => `<option value="${v}" ${(S.prefs.lines || 'all') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="pol" style="margin-top:6px"><label title="우상단 ⏺ 버튼으로 게임 캔버스를 녹화해 webm 으로 저장합니다(1분 약 4MB / 11MB)">녹화 화질</label><select data-pref="recq">${Object.entries(RECQ).map(([k, q]) => `<option value="${k}" ${(S.prefs.recq || 'low') === k ? 'selected' : ''}>${q.name} (${q.fps}fps · ${Math.round(q.bps / 1000)}kbps)</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" data-pref="fullscreen" ${S.prefs.fullscreen ? 'checked' : ''}> 시작 시 전체 화면 (첫 클릭/키 입력 때 적용 · 우상단 ⛶ 버튼, F11로도 전환)</label>
      <div class="pol" style="margin-top:6px"><label title="치명타 타일 흔들림·범위 마법 화면 흔들림의 세기">흔들림 강도</label><select data-pref="shake">${[[0, '끔'], [1, '보통'], [1.6, '강하게'], [2.4, '최대']].map(([v, t]) => `<option value="${v}" ${S.prefs.shake === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <label class="check" title="이미 가 본 층은 상자·적을 쫓지 않고 계단으로 곧장 이동합니다(새 층·의뢰 목표는 정상 탐사)"><input type="checkbox" data-opt="fastOld" ${S.save.opts.fastOld !== false ? 'checked' : ''}> 이미 가 본 층은 계단 직행 (빠른 통과)</label>
      <h3>자동 장비</h3><label class="check"><input type="checkbox" data-opt="autoEquip" ${S.save.opts.autoEquip ? 'checked' : ''}> 귀환 시 획득 장비를 직업에 맞게 자동 장착</label>
      <label class="check"><input type="checkbox" data-opt="autoIdle" ${S.save.opts.autoIdle ? 'checked' : ''}> 대기 중(미편성) 용병도 포함</label>
      <div class="dim" style="font-size:12px">고급·전설의 고유 특수 스킬 장비는 자동 배분에서 제외됩니다.</div>
      <h3>디자인 에셋</h3><div class="dim">${r.provided ? `매니페스트에 ${r.provided}개 지정 · ${r.loaded}개 로드됨` : '아직 지정된 에셋이 없습니다 (이모지/도형으로 표시 중)'}${r.missingFile.length ? `<br><span class="warn">파일 없음: ${r.missingFile.slice(0, 6).join(', ')}${r.missingFile.length > 6 ? ' 외' : ''}</span>` : ''}<br>에셋을 올린 뒤 <code>assets/manifest.js</code>에 경로를 적으세요 (규격: <code>assets/README.md</code>).</div>
      <h3>저장 데이터</h3><div class="row" style="justify-content:flex-start"><button class="btn" data-m="export">내보내기</button><button class="btn" data-m="import-ask">불러오기</button><button class="btn dng" data-m="reset-ask">초기화</button></div><div id="ioBox"></div>
      <div class="foot"><button class="btn" data-m="tut-open">튜토리얼 다시 보기</button><button class="btn pri" data-m="close">닫기</button></div>`);
  }
  // 전체 화면: 브라우저 정책상 사용자 동작(첫 클릭/키 입력)이 있어야 하므로 "시작 시 전체 화면"은 첫 입력 때 적용한다.
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { toast('브라우저가 전체 화면을 허용하지 않았습니다 (F11을 눌러 보세요)', 'bad'); });
    } catch (e) { /* 지원하지 않는 환경 */ }
  }
  // 화면 녹화: 게임 캔버스(전투판·지도)를 저용량 webm 으로 저장. 오른쪽 패널·중앙 배너·이벤트 창 같은 HTML 요소는 담기지 않는다.
  let rec = null;
  const RECQ = { low: { fps: 15, bps: 600000, name: '저용량' }, mid: { fps: 20, bps: 1500000, name: '보통' } };
  function updateRecBtn() {
    const b = document.querySelector('[data-act="rec"]'); if (!b) return;
    const sec = rec ? Math.floor((Date.now() - rec.t0) / 1000) : 0;
    b.textContent = rec ? `⏹ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '⏺'; b.classList.toggle('rec', !!rec);
  }
  function toggleRec() {
    if (rec) { rec.mr.stop(); return; }
    const cvs = $('cv'); if (!cvs.captureStream || !window.MediaRecorder) { toast('이 브라우저는 녹화를 지원하지 않습니다', 'bad'); return; }
    const Q = RECQ[S.prefs.recq] || RECQ.low, mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    try {
      const mr = new MediaRecorder(cvs.captureStream(Q.fps), { mimeType: mime, videoBitsPerSecond: Q.bps }), chunks = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `esteru_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 15000); clearInterval(rec.t); toast(`녹화 저장 (${(blob.size / 1048576).toFixed(1)}MB) — 다운로드 폴더를 확인하세요`, 'good'); rec = null; updateRecBtn();
      };
      mr.start(1000); rec = { mr, t0: Date.now(), t: setInterval(updateRecBtn, 500) }; updateRecBtn(); toast(`녹화 시작 (${Q.name}) — ⏹를 다시 누르면 저장됩니다`);
    } catch (err) { toast('녹화를 시작하지 못했습니다', 'bad'); }
  }
  let fsTried = false;
  function fsOnFirstInput() {
    if (fsTried || !S.prefs.fullscreen) return; fsTried = true;
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { /* 거부되면 무시 */ }); } catch (e) { /* 무시 */ }
  }
  document.addEventListener('pointerdown', fsOnFirstInput, { once: true }); document.addEventListener('keydown', fsOnFirstInput, { once: true });
  function prefChange(t) {
    const k = t.dataset.pref;
    if (k === 'lines') S.prefs.lines = t.value;
    else if (k === 'recq') S.prefs.recq = t.value;
    else if (k === 'pace') { S.prefs.pace = +t.value; C.TUNE.pace = S.prefs.pace; if (S.exp) renderToolbar(); }
    else if (k === 'fullscreen') S.prefs.fullscreen = t.checked;
    else if (k === 'shake') S.prefs.shake = +t.value;
    else if (k === 'reduce') { S.prefs.reduce = t.checked; document.body.classList.toggle('reduce', t.checked); } else if (k === 'speed') { S.prefs.speed = +t.value; S.speed = +t.value; if (S.exp) renderToolbar(); }
    savePrefs();
  }
  modalEl.addEventListener('click', ev => {
    if (ev.target === modalEl && modalEl.dataset.lock !== '1') { closeModal(); return; }
    const b = ev.target.closest('[data-m]'); if (!b) return;
    const m = b.dataset.m, s = S.save;
    if (m === 'close') closeModal();
    else if (m === 'confirm') { const cb = confirmCb; confirmCb = null; closeModal(); cb && cb(); }
    else if (m === 'sheetslot') { slotModal(s.units.find(x => x.id === +b.dataset.u), b.dataset.slot); }
    else if (m === 'thire') {
      const uid = +b.dataset.id, u = s.units.find(x => x.id === uid), r = C.tavernHire(s, uid);
      if (r.err) { toast(r.err, 'bad'); closeModal(); }
      else if (r.ok) { save(); closeModal(); toast(`🍺 ${u.name} 고용! 편성 탭에서 배치하세요`, 'good'); }
      else { save(); if (r.left) { closeModal(); toast(`💨 ${u.name}이(가) 실망해 떠났습니다… (실패 ${r.fails}회) — 출현변경권으로 다시 부를 수 있어요`, 'bad'); } else { toast(`고용 실패… ${u.name}이(가) 고개를 저었다 (−${r.loss}G · 실패 ${r.fails}/${C.TAV.legendFailMax})`, 'bad'); tavernModal(uid); } }
      renderStats(); renderCampBody(); renderStageBar();
    }
    else if (m === 'qaccept') { C.acceptQuest(S.exp); S.evOpen = false; closeModal(); save(); }
    else if (m === 'enhance') { const u = s.units.find(x => x.id === +b.dataset.u), r = C.enhanceItem(s, u, b.dataset.slot); if (r) toast(r, 'bad'); else { save(); toast(`🔨 ${u.name}의 ${C.SLOTS[b.dataset.slot]} 강화! (${C.ITEMS[u.equip[b.dataset.slot]].name})`, 'good'); renderStats(); renderCampBody(); } sheetModal(u.id); }
    else if (m === 'msellgear') { const g = C.sellGear(s, +b.dataset.i, C.SELL_RATE.merchant); if (g) { save(); renderStats(); toast(`행상인에게 팔았습니다 (+${g}G)`, 'good'); } openEventModal(S.exp); }
    else if (m === 'msellall') { const g = C.sellAllGear(s, C.SELL_RATE.merchant); if (g) { save(); renderStats(); toast(`장비를 모두 팔았습니다 (+${g}G)`, 'good'); } openEventModal(S.exp); }
    else if (m === 'msellmat') { const g = C.sellMat(s, b.dataset.id, b.dataset.n === 'all' ? 'all' : +b.dataset.n, C.SELL_RATE.merchant); if (g) { save(); renderStats(); } openEventModal(S.exp); }
    else if (m === 'mbuy') { const r = C.buyMerchant(S.exp, +b.dataset.i); if (r) toast(r, 'bad'); else { save(); renderStats(); } openEventModal(S.exp); }
    else if (m === 'gpull') { const r = C.gachaPull(S.exp, +b.dataset.n); if (r && r.err) toast(r.err, 'bad'); else save(); renderStats(); openEventModal(S.exp); }
    else if (m === 'cqyes') { C.acceptCompanion(S.exp); S.evOpen = false; closeModal(); save(); }
    else if (m === 'evclose') { C.closeEvent(S.exp); S.evOpen = false; closeModal(); }
    else if (m === 'equip') { C.equip(s, s.units.find(u => u.id === +b.dataset.u), b.dataset.slot, b.dataset.item || null); closeModal(); save(); renderCampBody(); }
    else if (m === 'sortie-go') startSortie();
    else if (m === 'gotab') { closeModal(); S.tab = b.dataset.id; renderTabs(); renderCampBody(); }
    else if (m === 'result-camp') endExpedition();
    else if (m === 'tut') tutorial(+b.dataset.i);
    else if (m === 'tut-open') tutorial(0);
    else if (m === 'tut-done') { S.prefs.tutDone = true; savePrefs(); closeModal(); }
    else if (m === 'export') { const box = $('ioBox'); box.innerHTML = `<textarea readonly id="ioTa">${esc(JSON.stringify(s))}</textarea>`; const ta = $('ioTa'); ta.select(); try { navigator.clipboard.writeText(ta.value); toast('클립보드에 복사했습니다', 'good'); } catch (e) { /* 수동 복사 */ } }
    else if (m === 'import-ask') $('ioBox').innerHTML = `<textarea id="ioTa" placeholder="내보낸 데이터를 붙여넣으세요"></textarea><button class="btn pri" data-m="import-do" style="margin-top:6px">적용</button>`;
    else if (m === 'import-do') { try { const d = JSON.parse($('ioTa').value); if (d.v !== 2 && d.v !== 3) throw 0; S.save = fixSave(d); S.startFloor = C.defaultStart(S.save); save(); closeModal(); renderCamp(); toast('저장 데이터를 불러왔습니다', 'good'); } catch (e) { toast('올바른 저장 데이터가 아닙니다', 'bad'); } }
    else if (m === 'reset-ask') confirmDlg('⚠ 데이터 초기화', '모든 진행 상황이 삭제되고 처음부터 시작합니다. 되돌릴 수 없습니다.', '초기화', () => { localStorage.removeItem(SAVE_KEY); S.save = C.newSave(); S.startFloor = 1; S._ents = {}; save(); renderCamp(); toast('초기화했습니다'); });
  });

  /* ---------- 키보드 ---------- */
  document.addEventListener('keydown', ev => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (ev.key === 'Escape') { if (!modalEl.classList.contains('hidden') && modalEl.dataset.lock !== '1') closeModal(); else if (S.itemOpen) openItems(false); else if (S.sel) { S.sel = null; setHint(''); renderCampBody(); } return; }
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || !modalEl.classList.contains('hidden')) return;
    if (S.exp) {
      if (ev.code === 'Space') { ev.preventDefault(); togglePause(); }
      else if (ev.key >= '1' && ev.key <= '4' && SPEEDS[+ev.key - 1]) { S.speed = SPEEDS[+ev.key - 1]; S.prefs.speed = S.speed; savePrefs(); renderToolbar(); }
      else if (ev.key === 'i' || ev.key === 'I') openItems(!S.itemOpen);
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && S.sel && S.save.formation[S.sel]) { const u = S.save.units.find(z => z.id === S.sel); delete S.save.formation[S.sel]; S.sel = null; setHint(`<b>${esc(u.name)}</b> 배치 해제`); afterFormChange(); }
  });

  /* ---------- 메인 루프 ---------- */
  let last = performance.now(), uiT = 0, evTone = 0;
  function consumeEvents(e) {
    Render.procEvents(e);
    const hasBanner = e.events.some(v => v.k === 'banner' && v.c === 'bad'); // 배너가 뜬 틱의 같은 내용 토스트는 생략(부정 이벤트만)
    for (const v of e.events) {
      if (v.k === 'banner') enqueueBanner(v);
      else if (v.k === 'log' && (v.c === 'good' || v.c === 'bad' || v.c === 'warn') && !hasBanner && !/🎁|📖|📐|🎫|획득|습득|승리|전투 시작/.test(v.m)) toast(v.m, v.c); // 획득·습득·승패 문구는 기록 탭과 중복되므로 토스트 생략(배너가 뜬 틱도 생략)
    }
    e.events = [];
  }
  /* ---------- 이벤트 배너(화면 중앙) · 이벤트 창(행상인/뽑기/의뢰) ---------- */
  const bq = []; let bBusy = false;
  // 중앙 배너는 부정 효과(c==='bad')만 띄운다. 좋은 일·중립 이벤트는 기록 탭과 토스트로만 알린다.
  // 표시 대상: 부정 효과(bad)와, 코어가 force 로 지정한 것(전투 시작·승리/패배·스킬 습득·전설 장비). prio 는 진행 중인 배너를 끊고 바로 보여 준다.
  let bTimer = 0;
  function enqueueBanner(v) {
    if (!(v.c === 'bad' || v.force)) return;
    if (v.prio) { clearTimeout(bTimer); bq.length = 0; bBusy = false; }
    if (bq.length >= 3) bq.shift(); bq.push(v); pumpBanner();
  }
  function pumpBanner() {
    if (bBusy || !bq.length) return; const v = bq.shift(), el = $('eventBanner'), dur = v.dur || (v.c === 'bad' ? 2300 : 1900); bBusy = true;
    el.className = 'event-banner hidden'; el.innerHTML = `<span class="ic">${v.icon}</span><b>${esc(v.name)}</b>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}`;
    void el.offsetWidth; el.style.animationDuration = dur + 'ms'; el.className = 'event-banner ' + (v.c || '');
    bTimer = setTimeout(() => { el.classList.add('hidden'); bBusy = false; pumpBanner(); }, dur);
  }
  function merchantSellHTML(s) { // 행상인에게 전리품 판매(시세 70%)
    const R = C.SELL_RATE.merchant, gear = s.gear.slice(0, 40), mats = Object.entries(s.mats).filter(([, n]) => n >= 1), sum = s.gear.reduce((a, id) => a + C.gearSellPrice(id, R), 0);
    let h = `<h3>전리품 팔기 <span class="dim" style="font-size:12px">행상인 시세 ${Math.round(R * 100)}% (상점 ${Math.round(C.SELL_RATE.shop * 100)}%)</span></h3>`;
    h += s.gear.length ? `<div class="row" style="margin-bottom:6px"><button class="btn sm" data-m="msellall">장비 전부 팔기 (${s.gear.length}개 · +${sum}G)</button></div>` + gear.map((id, idx) => `<div class="itm"><span>${itemName(id)}<div class="d">${C.SLOTS[C.ITEMS[id].slot]} · ${C.describe(C.ITEMS[id])}</div></span><button class="btn sm" data-m="msellgear" data-i="${idx}">${C.gearSellPrice(id, R)}G</button></div>`).join('') : '<div class="empty">팔 장비가 없습니다</div>';
    h += mats.length ? mats.map(([k, n]) => `<div class="itm"><span><b>${esc(C.MATS[k])}</b> ×${Math.floor(n)}<div class="d">개당 ${Math.floor(C.matPrice(k) * R)}G</div></span><span><button class="btn sm" data-m="msellmat" data-id="${k}" data-n="1">1개</button> <button class="btn sm" data-m="msellmat" data-id="${k}" data-n="all">전부 +${Math.floor(C.matPrice(k) * Math.floor(n) * R)}G</button></span></div>`).join('') : '';
    return h;
  }
  function openEventModal(e) {
    const p = e.pending; if (!p) return; S.evOpen = true; const s = S.save, gold = `<span class="gold">💰 ${s.gold.toLocaleString()}G</span>`;
    if (p.type === 'merchant') {
      openModal(`<h2>🧳 행상인</h2><div class="dim">${gold} · 떠돌이 행상인이 물건을 펼쳤습니다. 이 층에서 한 번만 만날 수 있습니다.</div>` + p.stock.map((it, i) => `<div class="itm"><span><b>${it.k === 'gear' ? itemName(it.id) : esc(C.itemLabel(it))}</b>${it.k === 'gear' ? `<div class="d">${C.SLOTS[C.ITEMS[it.id].slot]} · ${C.describe(C.ITEMS[it.id])}${C.ITEMS[it.id].classes ? ' · ' + C.ITEMS[it.id].classes.map(k => C.CLASSES[k].name).join('/') : ''}</div>` : ''}</span><button class="btn sm pri" data-m="mbuy" data-i="${i}" ${it.sold || s.gold < it.price ? 'disabled' : ''}>${it.sold ? '품절' : it.price + 'G'}</button></div>`).join('') + merchantSellHTML(s) + `<div class="foot"><button class="btn pri" data-m="evclose" data-autofocus>떠나기</button></div>`, { lock: true });
    } else if (p.type === 'gacha') {
      openModal(`<h2>🎰 뽑기방</h2><div class="dim">${gold} · 재료·소모품·장비·식량, 드물게 도면과 전직서가 나옵니다. 10회는 9회 가격에 정예급 장비 1개 보장.</div>
        <div class="row" style="margin:10px 0"><button class="btn pri" data-m="gpull" data-n="1" ${s.gold < p.price ? 'disabled' : ''}>1회 ${p.price}G</button><button class="btn pri" data-m="gpull" data-n="10" ${s.gold < p.price * 9 ? 'disabled' : ''}>10회 ${p.price * 9}G</button></div>
        <h3>최근 결과</h3><div class="chips">${p.log.length ? p.log.map(x => `<span class="chip" ${x.rar && x.rar !== 'N' ? `style="color:${C.RARITY[x.rar].color}"` : ''}>${esc(x.t)}</span>`).join('') : '<span class="dim">아직 뽑지 않았습니다</span>'}</div>
        <div class="foot"><button class="btn" data-m="evclose" data-autofocus>떠나기</button></div>`, { lock: true });
    } else if (p.type === 'quest') {
      const q = p.quest, R = q.reward, rw = [R.gold ? `${R.gold}G` : '', R.tickets ? '🎫 출현변경권' : '', R.enh ? '🔨 장비 강화권' : ''].filter(Boolean).join(' · ');
      openModal(`<h2>📋 의뢰인의 부탁</h2><p class="dim">${{ deliver: '짐을 다른 층의 수령인에게 전해 달라는 부탁이다.', hunt: '아래층의 몬스터를 처치하고 돌아와 보고해 달라는 부탁이다.', enhmat: '장비 강화에 쓸 재료를 모아 오면 대가를 주겠다고 한다.' }[q.type]}</p>
        <div class="itm"><span><b>내용</b><div class="d">${esc(q.text)}</div></span></div><div class="itm"><span><b>보상</b><div class="d">${rw || '—'}</div></span></div>
        <div class="dim" style="font-size:12.5px;margin-top:6px">수락하면 파티가 자동으로 해당 층까지 <b>올라가거나 내려가며</b> 처리합니다. 원정이 끝나면 미완료 의뢰는 사라집니다.</div>
        <div class="foot"><button class="btn" data-m="evclose">거절</button><button class="btn pri" data-m="qaccept" data-autofocus>수락</button></div>`, { lock: true });
    } else if (p.type === 'companion') {
      const c = p.comp;
      openModal(`<h2>📜 ${esc(c.name)}의 의뢰</h2><p class="dim">${esc(c.intro)}</p><div class="itm"><span><b>조건</b><div class="d">${esc(p.quest)} (이번 원정 안에 달성)</div></span></div><div class="itm"><span><b>보상</b><div class="d">${esc(c.name)} — <span style="color:${C.RARITY[c.rar].color}">${C.RARITY[c.rar].name}</span> ${C.CLASSES[c.cls].name} 특수 동료 합류</div></span></div>
        <div class="foot"><button class="btn" data-m="evclose">거절</button><button class="btn pri" data-m="cqyes" data-autofocus>수락</button></div>`, { lock: true });
    }
  }
  function frame(now) {
    const dt = Math.min(1, (now - last) / 1000); last = now; // 프레임이 느려도(앱 내 창·저사양) 실제 시간 기준으로 진행되도록 상한을 1초로(탭 복귀 시 폭주 방지)
    const e = S.exp;
    if (e && e.pending && !S.evOpen && !e.done) openEventModal(e);
    if (e && !S.paused && !e.done && !e.pending && !S.cine) { // 오의 연출(S.cine) 동안은 전투 진행을 멈춘다 — 유닛이 움직여 연출 초점이 튀는 것을 막는다
      S.acc += dt * effSpeed() / (C.TUNE.pace || 1); let n = 0;
      while (S.acc >= 0.1 && n++ < 80 && !e.done && !S.cine) { C.stepExpedition(e, 0.1); S.acc -= 0.1; consumeEvents(e); }
    }
    if (e) {
      uiT += dt; if (uiT > 0.25) { uiT = 0; updateHud(); renderStats(); }
      if (e.done && !S.resultShown) { save(); updateHud(); showResult(); }
    }
    Render.draw(dt);
    requestAnimationFrame(frame);
  }
  renderCamp(); setHint('용병 카드를 전장의 <b>파란 칸</b>으로 끌어다 놓아 편성하세요.', 0);
  if (!S.prefs.tutDone) tutorial(0);
  requestAnimationFrame(frame);
  window.__S = S;
})();
