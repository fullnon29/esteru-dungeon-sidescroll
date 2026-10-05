'use strict';
/* 자동 리깅 엔진 — 그림 한 장(투명 배경, 오른쪽을 보는 옆모습 사람형)을 뼈대에 붙은 메시로 만들어 템플릿 동작으로 움직인다. 브라우저용.
 * 사람이 하는 일은 관절 위치를 끌어서 맞추는 것뿐(자동 추정값에서 시작). 부위를 오리는 작업이 없다:
 *  - 메시: 격자(STEP px) 위에서 그림이 있는 칸만 삼각형으로 만든다. 텍스처 좌표 = 쉬는 자세의 위치.
 *  - 스키닝: 정점마다 뼈대까지의 거리로 가중치를 정한다(뼈마다 두께 반경 안에서만 영향 → 몸통이 팔을 따라가지 않는다).
 *  - 그리기: 삼각형마다 어파인 변환으로 그림을 옮겨 그린다. 먼 쪽 팔다리 → 몸통·머리 → 가까운 쪽 다리 → 가까운 쪽 팔 순서로 겹친다. */
const Rig = (function () {
  const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  /* 관절(점)과 뼈(점 → 점). 머리 쪽이 부모. z = 그리는 순서(작을수록 먼저=뒤) */
  const JOINTS = ['pelvis', 'chest', 'neck', 'headTop', 'shF', 'elF', 'wrF', 'hdF', 'shB', 'elB', 'wrB', 'hdB', 'hipF', 'knF', 'anF', 'toF', 'hipB', 'knB', 'anB', 'toB'];
  const LABEL = { pelvis: '골반', chest: '가슴', neck: '목', headTop: '머리끝', shF: '앞 어깨', elF: '앞 팔꿈치', wrF: '앞 손목', hdF: '앞 손끝', shB: '뒤 어깨', elB: '뒤 팔꿈치', wrB: '뒤 손목', hdB: '뒤 손끝', hipF: '앞 고관절', knF: '앞 무릎', anF: '앞 발목', toF: '앞 발끝', hipB: '뒤 고관절', knB: '뒤 무릎', anB: '뒤 발목', toB: '뒤 발끝' };
  /* [이름, 머리 관절, 꼬리 관절, 부모 뼈, z] */
  const BONES = [
    ['torso', 'pelvis', 'chest', null, 4], ['chestB', 'chest', 'neck', 'torso', 4], ['head', 'neck', 'headTop', 'chestB', 5],
    ['uaF', 'shF', 'elF', 'chestB', 9], ['faF', 'elF', 'wrF', 'uaF', 9], ['haF', 'wrF', 'hdF', 'faF', 9],
    ['uaB', 'shB', 'elB', 'chestB', 1], ['faB', 'elB', 'wrB', 'uaB', 1], ['haB', 'wrB', 'hdB', 'faB', 1],
    ['thF', 'hipF', 'knF', 'torso', 7], ['shinF', 'knF', 'anF', 'thF', 7], ['ftF', 'anF', 'toF', 'shinF', 7],
    ['thB', 'hipB', 'knB', 'torso', 2], ['shinB', 'knB', 'anB', 'thB', 2], ['ftB', 'anB', 'toB', 'shinB', 2],
  ];
  const BI = {}; BONES.forEach((b, i) => BI[b[0]] = i);

  /* 그림의 알파로부터 관절 위치를 사람형 비율로 추정(오른쪽을 보는 옆모습). 반환: {관절: [x,y]} */
  function autoJoints(canvas) {
    const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    /* 몸 중심 x: 가운데 높이 띠(가슴~골반)의 알파 무게중심 */
    const H = y1 - y0 + 1; let sx = 0, sn = 0; for (let y = Math.round(y0 + H * 0.3); y < y0 + H * 0.6; y++) for (let x = x0; x <= x1; x++) if (d[(y * w + x) * 4 + 3] > 40) { sx += x; sn++; }
    const cx = sn ? sx / sn : (x0 + x1) / 2, Y = f => y0 + H * f, X = f => cx + H * f;
    return {
      pelvis: [X(0), Y(0.52)], chest: [X(0.01), Y(0.34)], neck: [X(0.02), Y(0.21)], headTop: [X(0.03), Y(0.0)],
      shF: [X(0.04), Y(0.26)], elF: [X(0.07), Y(0.40)], wrF: [X(0.12), Y(0.52)], hdF: [X(0.16), Y(0.58)],
      shB: [X(-0.01), Y(0.26)], elB: [X(-0.04), Y(0.40)], wrB: [X(-0.06), Y(0.52)], hdB: [X(-0.07), Y(0.58)],
      hipF: [X(0.02), Y(0.53)], knF: [X(0.05), Y(0.74)], anF: [X(0.03), Y(0.94)], toF: [X(0.10), Y(0.99)],
      hipB: [X(-0.02), Y(0.53)], knB: [X(-0.05), Y(0.74)], anB: [X(-0.06), Y(0.94)], toB: [X(0.01), Y(0.99)],
      _bbox: [x0, y0, x1, y1],
    };
  }

  /* 뼈 두께 반경을 그림에서 자동 추정: 뼈 가운데에서 수직 방향으로 알파가 끝나는 곳까지(너무 크면 제한) */
  function estimateRadii(canvas, J) {
    const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[((y | 0) * w + (x | 0)) * 4 + 3];
    return BONES.map(([, j0, j1]) => { const [ax, ay] = J[j0], [bx, by] = J[j1], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L; let best = 0; for (const t of [0.3, 0.5, 0.7]) { const mx = lerp(ax, bx, t), my = lerp(ay, by, t); let r1 = 0, r2 = 0; while (r1 < L * 0.9 && a(mx + nx * r1, my + ny * r1) > 40) r1++; while (r2 < L * 0.9 && a(mx - nx * r2, my - ny * r2) > 40) r2++; best = Math.max(best, Math.max(r1, r2)); } return clamp(best * 1.15 + 3, 6, L * 0.9 + 8); });
  }

  /* 메시·가중치 구성 */
  function build(canvas, J, opts) {
    opts = Object.assign({ step: 5, power: 3, radii: null }, opts);
    const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, S = opts.step;
    const gw = Math.ceil(w / S) + 1, gh = Math.ceil(h / S) + 1, cov = (x, y) => { for (let yy = y; yy < Math.min(h, y + S); yy += 2) for (let xx = x; xx < Math.min(w, x + S); xx += 2) if (d[(yy * w + xx) * 4 + 3] > 12) return true; return false; };
    const cell = new Uint8Array(gw * gh); for (let gy = 0; gy < gh - 1; gy++) for (let gx = 0; gx < gw - 1; gx++) cell[gy * gw + gx] = cov(gx * S, gy * S) ? 1 : 0;
    const idx = new Int32Array(gw * gh).fill(-1), verts = []; const vid = (gx, gy) => { const k = gy * gw + gx; if (idx[k] < 0) { idx[k] = verts.length; verts.push([gx * S, gy * S]); } return idx[k]; };
    const tris = []; for (let gy = 0; gy < gh - 1; gy++) for (let gx = 0; gx < gw - 1; gx++) if (cell[gy * gw + gx]) { const a = vid(gx, gy), b = vid(gx + 1, gy), c = vid(gx + 1, gy + 1), e = vid(gx, gy + 1); tris.push([a, b, c], [a, c, e]); }
    const radii = opts.radii || estimateRadii(canvas, J), nb = BONES.length;
    /* 정점 가중치: 뼈 선분까지 거리 d, 반경 r → w = (1 - d/(r*1.6))^power (바깥은 0). 아무 뼈에도 안 걸리면 가장 가까운 뼈 */
    const weights = verts.map(([px, py]) => { const ws = new Float32Array(nb); let sum = 0, bestB = 0, bestD = 1e9;
      BONES.forEach(([, j0, j1], bi) => { const [ax, ay] = J[j0], [bx, by] = J[j1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1), dist = Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); if (dist < bestD) { bestD = dist; bestB = bi; } const rr = radii[bi] * 1.6, v = Math.max(0, 1 - dist / rr); ws[bi] = Math.pow(v, opts.power); sum += ws[bi]; });
      if (sum < 1e-6) { ws[bestB] = 1; sum = 1; } for (let i = 0; i < nb; i++) ws[i] /= sum; return ws; });
    /* 삼각형 z: 정점 가중치로 지배적인 뼈의 z 의 평균 */
    const zOf = tri => { let z = 0; for (const v of tri) { let bi = 0, bw = -1; for (let i = 0; i < nb; i++) if (weights[v][i] > bw) { bw = weights[v][i]; bi = i; } z += BONES[bi][4]; } return z / 3; };
    tris.forEach(t => t.z = zOf(t)); tris.sort((p, q) => p.z - q.z);
    return { canvas, J, verts, tris, weights, radii, w, h, rest: JSON.parse(JSON.stringify(J)) };
  }

  /* 포즈: angles = {뼈이름: 각도(도, 부모 기준, +=시계방향)}, root = {x,y,rot} → 뼈 행렬들(어파인 [a,b,c,d,e,f]) */
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const rotAbout = (deg, cx, cy) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; };
  function pose(rig, angles, root) {
    root = root || {}; const mats = new Array(BONES.length), rest = rig.rest;
    const rootM = mul([1, 0, 0, 1, root.x || 0, root.y || 0], rotAbout(root.rot || 0, rest.pelvis[0], rest.pelvis[1]));
    BONES.forEach(([name, j0, , parent], i) => { const Mp = parent ? mats[BI[parent]] : rootM, [hx, hy] = rest[j0]; mats[i] = mul(Mp, rotAbout(angles[name] || 0, hx, hy)); });
    return mats;
  }
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function deform(rig, mats) { return rig.verts.map(([px, py], vi) => { const w = rig.weights[vi]; let x = 0, y = 0; for (let b = 0; b < w.length; b++) if (w[b] > 1e-4) { const p = apply(mats[b], px, py); x += p[0] * w[b]; y += p[1] * w[b]; } return [x, y]; }); }

  /* 그리기: cv 의 컨텍스트에 포즈된 메시를 그린다. tf = 포즈 좌표 → 화면 좌표 어파인 */
  function draw(ctx, rig, mats, tf) {
    const dv = deform(rig, mats), src = rig.canvas, grow = 0.7;
    for (const t of rig.tris) {
      const p = t.map(v => dv[v]), s = t.map(v => rig.verts[v]);
      /* 원본 삼각형(s) → 변형 삼각형(p) 어파인 */
      const [s0, s1, s2] = s, [d0, d1, d2] = p, det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]); if (Math.abs(det) < 1e-6) continue;
      const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det, c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det,
        b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det, d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det,
        e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
      const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
      ctx.save(); ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
      ctx.beginPath(); p.forEach((q, i) => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1, x = q[0] + dx / l * grow, y = q[1] + dy / l * grow; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip();
      ctx.transform(a, b, c, d, e, f); ctx.drawImage(src, 0, 0); ctx.restore();
    }
  }
  return { JOINTS, LABEL, BONES, BI, autoJoints, estimateRadii, build, pose, deform, draw, rotAbout };
})();
if (typeof window !== 'undefined') window.Rig = Rig;
