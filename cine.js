'use strict';
/* 오의(필살기) 연출 엔진 — 게임(render.js)과 편집기(tools/cine_tool.html)가 함께 쓴다. DOM 비의존.
 * 연출 정의(def) = { dur: 전체 길이(초), hit: 일격 순간(초, 피해·피격 표시가 이 시점에 나온다), steps: [ { t: 시작(초), type, ... } ] }
 * 스텝 종류(type):
 *   dim       { to: 0~1, dur }                  배경(타일)을 어둡게. 유닛은 밝게 남는다
 *   zoom      { to: 1~2.5, dur, focus: target|caster|mid }   화면 확대(초점 기준)
 *   timescale { to: 0.05~1, dur }               슬로모션(화면 연출 속도)
 *   flash     { alpha, dur, color }             화면 전체 번쩍임(점점 사라짐)
 *   shake     { amp, dur }                      화면 흔들림(점점 줄어듦)
 *   fx        { name, at: target|caster, ox?, oy?, scale? }   이펙트 시트 재생(FX_MANIFEST 의 이름, 길이는 시트 길이)
 *   anim      { act, dur }                      시전자 동작 재생(게임: 시트 동작, 편집기: 앞으로 찌르는 흉내)
 *   freeze    { dur }                           히트스톱(화면 연출 잠깐 정지)
 *   banner    { text, dur, pos: top|bottom }    스킬 이름 띠(기본 화면 위쪽, 시전 장면을 가리지 않게 얇게). {skill} 은 스킬 이름으로 바뀐다
 * 시각 t 의 상태는 sample(def, t, fxInfo) 로 구한다(상태 없음 → 스크럽·재생 어디서나 같은 결과). 한 번만 일어나는 일(anim·freeze)은 events(def, t0, t1) 로 받는다. */
const Cine = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const EASE = { lin: p => p, in: p => p * p, out: p => 1 - (1 - p) * (1 - p), io: p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2 };
  const sorted = (def, type) => def.steps.filter(s => s.type === type).sort((a, b) => a.t - b.t);
  // 값이 시간에 따라 이어지는 트랙(dim·zoom·timescale): 스텝마다 이전 값에서 to 로 dur 동안 부드럽게
  function track(def, type, init, t) { let v = init, last = null; for (const s of sorted(def, type)) { if (t <= s.t) break; const p = clamp((t - s.t) / Math.max(0.001, s.dur || 0.2), 0, 1); v = p >= 1 ? s.to : lerp(v, s.to, EASE.io(p)); last = s; if (p < 1) break; } return { v, last }; }
  function sample(def, t, fxInfo) {
    const out = { dim: 0, zoom: 1, focus: 'target', ts: 1, flash: [], shake: 0, banner: null, fx: [], lunge: 0 };
    out.dim = track(def, 'dim', 0, t).v; const z = track(def, 'zoom', 1, t); out.zoom = z.v; out.focus = (z.last && z.last.focus) || 'target'; out.ts = track(def, 'timescale', 1, t).v;
    for (const s of def.steps) {
      const p = (t - s.t) / Math.max(0.001, s.dur || 0.2), on = t >= s.t && p < 1;
      if (s.type === 'flash' && on) out.flash.push({ color: s.color || '#ffffff', a: (s.alpha === undefined ? 0.8 : s.alpha) * (1 - p) });
      else if (s.type === 'shake' && on) out.shake = Math.max(out.shake, (s.amp || 8) * (1 - p));
      else if (s.type === 'banner' && on) out.banner = { text: s.text || '{skill}', p, dur: s.dur || 1, pos: s.pos || 'top' };
      else if (s.type === 'anim' && on) out.lunge = Math.max(out.lunge, Math.sin(Math.PI * p));
      else if (s.type === 'fx' && t >= s.t) { const info = fxInfo && fxInfo(s.name); if (!info) continue; const fr = Math.floor((t - s.t) * info.fps); if (fr < info.n) out.fx.push({ name: s.name, at: s.at || 'target', ox: s.ox, oy: s.oy, scale: s.scale, fr }); }
    }
    return out;
  }
  const events = (def, t0, t1) => def.steps.filter(s => (s.type === 'anim' || s.type === 'freeze') && s.t > t0 && s.t <= t1);
  return { sample, events, EASE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Cine;
