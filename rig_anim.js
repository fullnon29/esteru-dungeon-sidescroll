'use strict';
/* 템플릿 동작: 사람이 키프레임을 찍지 않아도 되도록 걷기·대기·공격·피격·쓰러짐을 수식으로 만든다. rig.js 와 함께 쓴다.
 * 각도는 도(°), 부모 뼈 기준, +는 시계방향(화면). 아래로 늘어진 뼈(팔·다리)는 앞(오른쪽)으로 휘두르는 것이 음수, 뒤로가 양수. */
const RigAnim = (function () {
  const D = Math.PI / 180, ease = { lin: t => t, io: t => t * t * (3 - 2 * t), out: t => 1 - (1 - t) * (1 - t), in: t => t * t };
  /* 키프레임 보간: keys = [[t, 값], ...], 구간 보간 io */
  function key(keys, t) { if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b[0]) return a[1] + (b[1] - a[1]) * ease.io((t - a[0]) / (b[0] - a[0] || 1)); } return keys[keys.length - 1][1]; }
  const K = (arr) => arr.map((v, i, a) => [i / (a.length - 1), v]);
  /* 동작 정의: n = 프레임 수, loop, ground = 매 프레임 가장 낮은 곳을 바닥에 붙임, hit = 타격 프레임, fn(t, amp) → {angles, root} */
  const ANIMS = {
    walk: { n: 8, loop: true, ground: true, label: '걷기', fn(t, A) { const p = t * 2 * Math.PI, s = Math.sin(p), c = Math.cos(p), sB = Math.sin(p + Math.PI), cB = Math.cos(p + Math.PI), sw = 28 * A, kn = 40 * A;
      return { root: { x: 0, y: 2 * Math.abs(s) * A, rot: 0 }, angles: {
        thF: -sw * s, shinF: kn * Math.max(0, c) + 4, ftF: 8 * s * A, thB: -sw * sB, shinB: kn * Math.max(0, cB) + 4, ftB: 8 * sB * A,
        uaF: 18 * A * s, faF: -(16 + 12 * Math.max(0, -s)) * A, uaB: 18 * A * sB, faB: -(16 + 12 * Math.max(0, -sB)) * A,
        chestB: -3, head: 1.5 * Math.sin(p * 2) * A } }; } },
    idle: { n: 6, loop: true, ground: true, label: '대기', fn(t, A) { const p = t * 2 * Math.PI, s = Math.sin(p); return { root: { x: 0, y: 1.4 * s * A, rot: 0 }, angles: {
        thF: -3, shinF: 8, thB: 4, shinB: 8, chestB: -1.2 + 1.4 * s * A, head: -1 * Math.sin(p + 0.7) * A,
        uaF: 6 + 2 * Math.sin(p + 0.4) * A, faF: -22, uaB: -2, faB: -14 } }; } },
    atk: { n: 7, loop: false, ground: true, hit: 4, label: '공격(찌르기)', fn(t, A) { const k = (a) => key(K(a), t);
      return { root: { x: key([[0, 0], [0.33, -5], [0.67, 12], [0.83, 10], [1, 0]], t) * A, y: 0, rot: 0 }, angles: {
        uaF: key([[0, 4], [0.33, 55], [0.67, -88], [0.83, -84], [1, 4]], t), faF: key([[0, -22], [0.33, -70], [0.67, -4], [0.83, -6], [1, -22]], t),
        uaB: key([[0, -2], [0.33, -30], [0.67, 20], [0.83, 16], [1, -2]], t), faB: key([[0, -14], [0.33, -40], [0.67, -30], [0.83, -26], [1, -14]], t),
        chestB: key([[0, -1], [0.33, 8], [0.67, -16], [0.83, -11], [1, -1]], t), head: key([[0, 0], [0.33, 4], [0.67, -7], [0.83, -4], [1, 0]], t),
        thF: key([[0, -3], [0.33, 6], [0.67, -34], [0.83, -28], [1, -3]], t), shinF: key([[0, 8], [0.33, 14], [0.67, 30], [0.83, 22], [1, 8]], t),
        thB: key([[0, 4], [0.33, 12], [0.67, 24], [0.83, 18], [1, 4]], t), shinB: key([[0, 8], [0.33, 8], [0.67, 10], [0.83, 10], [1, 8]], t) } }; } },
    hurt: { n: 3, loop: false, ground: true, label: '피격', fn(t, A) { return { root: { x: key([[0, 0], [0.5, -7], [1, -3]], t), y: 0, rot: 0 }, angles: {
        chestB: key([[0, -1], [0.5, 14], [1, 6]], t), head: key([[0, 0], [0.5, 16], [1, 6]], t), uaF: key([[0, 6], [0.5, 36], [1, 16]], t), faF: key([[0, -22], [0.5, -50], [1, -30]], t),
        uaB: key([[0, -2], [0.5, 30], [1, 10]], t), thF: key([[0, -3], [0.5, 8], [1, 3]], t), shinF: key([[0, 8], [0.5, 22], [1, 14]], t), thB: key([[0, 4], [0.5, 14], [1, 8]], t), shinB: key([[0, 8], [0.5, 20], [1, 12]], t) } }; } },
    die: { n: 6, loop: false, ground: true, label: '쓰러짐', fn(t, A) { return { root: { x: key([[0, 0], [0.4, -4], [1, -26]], t), y: 0, rot: key([[0, 0], [0.35, 4], [0.7, 40], [1, 86]], t) }, angles: {
        thF: key([[0, -3], [0.35, -50], [0.7, -30], [1, 10]], t), shinF: key([[0, 8], [0.35, 90], [0.7, 60], [1, 10]], t), thB: key([[0, 4], [0.35, -20], [0.7, 10], [1, 20]], t), shinB: key([[0, 8], [0.35, 70], [0.7, 40], [1, 10]], t),
        chestB: key([[0, -1], [0.35, -22], [0.7, 4], [1, 10]], t), head: key([[0, 0], [0.35, -16], [0.7, 14], [1, 24]], t),
        uaF: key([[0, 6], [0.35, 40], [0.7, 70], [1, 40]], t), faF: key([[0, -22], [0.35, -30], [0.7, -20], [1, -6]], t), uaB: key([[0, -2], [0.35, 20], [0.7, 50], [1, 30]], t) } }; } },
  };
  return { ANIMS, key };
})();
if (typeof window !== 'undefined') window.RigAnim = RigAnim;
