"""AI 시트 흉내: 4x4 고블린 시트(행=정면/왼쪽/오른쪽/뒷모습, 열=걷기 4프레임). 순수 파이썬으로 래스터라이즈."""
import math, random, struct, zlib, sys

random.seed(7)
W = H = 1024
CELL = 256
BG = (255, 0, 255)

# 배경: 마젠타 + 약한 얼룩(AI 이미지처럼 완전 균일하지 않음)
px = bytearray(W * H * 3)
for y in range(H):
    for x in range(W):
        n = int(6 * math.sin(x * 0.011) * math.cos(y * 0.013)) + random.randint(-3, 3)
        i = (y * W + x) * 3
        px[i] = max(0, min(255, BG[0] - abs(n))); px[i + 1] = max(0, min(255, BG[1] + max(0, n))); px[i + 2] = max(0, min(255, BG[2] - abs(n)))

def blend(i, col, a):
    if a <= 0: return
    for k in range(3):
        px[i + k] = int(px[i + k] * (1 - a) + col[k] * a)

def fill(shape_fn, bbox, col, ox, oy, alpha=1.0):
    x0, y0, x1, y1 = [int(v) for v in bbox]
    x0 = max(ox, x0 + ox); y0 = max(oy, y0 + oy); x1 = min(ox + CELL - 1, x1 + ox); y1 = min(oy + CELL - 1, y1 + oy)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = 0
            for sy in (0.25, 0.75):
                for sx in (0.25, 0.75):
                    if shape_fn(x + sx - ox, y + sy - oy): c += 1
            if c: blend((y * W + x) * 3, col, alpha * c / 4)

def ellipse(cx, cy, rx, ry, col, ox, oy, rot=0.0, alpha=1.0):
    cr, sr = math.cos(rot), math.sin(rot); r = max(rx, ry) + 2
    def f(x, y):
        dx, dy = x - cx, y - cy; u = dx * cr + dy * sr; v = -dx * sr + dy * cr
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1
    fill(f, (cx - r, cy - r, cx + r, cy + r), col, ox, oy, alpha)

def poly(pts, col, ox, oy):
    def f(x, y):
        inside = False; j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]; xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi: inside = not inside
            j = i
        return inside
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    fill(f, (min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1), col, ox, oy)

def limb(x0, y0, x1, y1, w, col, ox, oy):
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L * w / 2, dx / L * w / 2
    poly([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], col, ox, oy)

SKIN = (96, 160, 72); SKIN_D = (70, 124, 54); CLOTH = (126, 84, 46); CLUB = (120, 86, 52); EYE = (250, 220, 60); DARK = (30, 40, 28)

def goblin(view, f, ox, oy, sc):
    # 걷기 4프레임: 몸 위아래 흔들림 + 다리 번갈아 + 팔 흔들림
    ph = f / 4 * 2 * math.pi
    bob = -abs(math.sin(ph)) * 7 * sc; sw = math.sin(ph)
    cx = 128; foot = 226; hip = foot - 62 * sc; chest = hip - 40 * sc; headc = chest - 40 * sc
    def S(v): return v * sc
    if view in ('S', 'N'):
        back = view == 'N'
        # 다리
        for side, lg in ((-1, sw), (1, -sw)):
            lx = cx + side * S(14); ky = hip + bob + S(24)
            limb(lx, hip + bob, lx + side * S(2), ky + lg * S(6) - S(4) , S(15), SKIN_D, ox, oy)
            ellipse(lx + side * S(2), foot - max(0, lg) * S(6) * 0, S(13), S(6), (60, 44, 30), ox, oy)
        # 몸통
        ellipse(cx, chest + bob + S(8), S(30), S(34), SKIN, ox, oy)
        poly([(cx - S(30), hip + bob - S(4)), (cx + S(30), hip + bob - S(4)), (cx + S(24), hip + bob + S(26)), (cx - S(24), hip + bob + S(26))], CLOTH, ox, oy)
        # 팔 + 몽둥이
        for side, sg in ((-1, -sw), (1, sw)):
            sx = cx + side * S(34); sy = chest + bob - S(6)
            ex = sx + side * S(10); ey = sy + S(40) + sg * S(5)
            limb(sx, sy, ex, ey, S(13), SKIN, ox, oy)
            ellipse(ex, ey + S(4), S(8), S(8), SKIN_D, ox, oy)
        limb(cx + S(46), chest + bob + S(30), cx + S(60), chest + bob - S(34), S(11), CLUB, ox, oy)
        ellipse(cx + S(61), chest + bob - S(40), S(15), S(20), CLUB, ox, oy, rot=0.2)
        # 머리 + 귀
        poly([(cx - S(28), headc + bob), (cx - S(72), headc + bob - S(18)), (cx - S(30), headc + bob - S(26))], SKIN, ox, oy)
        poly([(cx + S(28), headc + bob), (cx + S(72), headc + bob - S(18)), (cx + S(30), headc + bob - S(26))], SKIN, ox, oy)
        ellipse(cx, headc + bob, S(34), S(32), SKIN, ox, oy)
        if not back:
            ellipse(cx - S(13), headc + bob - S(4), S(6), S(7), EYE, ox, oy); ellipse(cx + S(13), headc + bob - S(4), S(6), S(7), EYE, ox, oy)
            ellipse(cx - S(12), headc + bob - S(3), S(2.5), S(3.5), DARK, ox, oy); ellipse(cx + S(12), headc + bob - S(3), S(2.5), S(3.5), DARK, ox, oy)
            poly([(cx, headc + bob + S(2)), (cx - S(5), headc + bob + S(14)), (cx + S(5), headc + bob + S(14))], SKIN_D, ox, oy)
            limb(cx - S(11), headc + bob + S(22), cx + S(11), headc + bob + S(22), S(3), DARK, ox, oy)
    else:
        d = -1 if view == 'W' else 1   # 보는 쪽
        # 뒤쪽 다리/팔 먼저
        for lg, col in ((-sw, SKIN_D), (sw, SKIN)):
            lx = cx + S(4) * d; limb(lx, hip + bob, lx + lg * S(18) * d, foot - S(12), S(15), col, ox, oy)
            ellipse(lx + lg * S(18) * d + d * S(8), foot - S(4), S(15), S(6), (60, 44, 30), ox, oy)
        ellipse(cx - S(2) * d, chest + bob + S(8), S(27), S(34), SKIN, ox, oy)
        poly([(cx - S(26), hip + bob - S(4)), (cx + S(26), hip + bob - S(4)), (cx + S(20), hip + bob + S(24)), (cx - S(20), hip + bob + S(24))], CLOTH, ox, oy)
        ax = cx + S(6) * d; ay = chest + bob - S(4)
        limb(ax, ay, ax + sw * S(14) * d + d * S(8), ay + S(40), S(13), SKIN, ox, oy)
        limb(ax + d * S(8), ay + S(36), ax + d * S(34), ay - S(30), S(11), CLUB, ox, oy)
        ellipse(ax + d * S(36), ay - S(40), S(15), S(20), CLUB, ox, oy, rot=0.3 * d)
        ellipse(cx + S(4) * d, headc + bob, S(32), S(31), SKIN, ox, oy)
        poly([(cx - S(6) * d, headc + bob - S(6)), (cx - S(54) * d, headc + bob - S(26)), (cx - S(10) * d, headc + bob - S(24))], SKIN, ox, oy)  # 귀
        poly([(cx + S(34) * d, headc + bob - S(2)), (cx + S(52) * d, headc + bob + S(10)), (cx + S(34) * d, headc + bob + S(14))], SKIN_D, ox, oy)  # 코
        ellipse(cx + S(18) * d, headc + bob - S(4), S(6), S(7), EYE, ox, oy); ellipse(cx + S(19) * d, headc + bob - S(3), S(2.5), S(3.5), DARK, ox, oy)

views = ['S', 'W', 'E', 'N']
for r, v in enumerate(views):
    for c in range(4):
        sc = random.uniform(0.92, 1.06)                         # 칸마다 크기가 조금씩 다름
        ox = c * CELL + random.randint(-6, 6) * 0; oy = r * CELL
        jx, jy = random.randint(-9, 9), random.randint(-6, 6)   # 칸마다 위치가 조금씩 어긋남 (그림을 칸 안에서 옮김)
        if (r, c) in ((0, 1), (2, 3)):                          # 바닥 그림자가 번진 칸 (AI 가 자주 하는 실수)
            ellipse(128 + jx, 232 + jy, 52 * sc, 11 * sc, (30, 10, 40), ox, oy, alpha=0.45)
        goblin(v, c, ox + jx, oy + jy, sc)

# 경계 침범: 한 칸의 몽둥이가 옆 칸 쪽으로 살짝 넘어감
ellipse(CELL - 2, 128 + 4, 18, 8, CLUB, 0, 0)

def png(path):
    raw = bytearray()
    for y in range(H):
        raw.append(0); raw += px[y * W * 3:(y + 1) * W * 3]
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 6)) + chunk(b'IEND', b''))

png(sys.argv[1])
print('saved', sys.argv[1])
