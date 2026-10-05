'use strict';
/* 개발 서버: 정적 파일 + 에셋 도구의 "게임에 바로 적용" 저장 API. 사용: node tools/devserver.js [포트=8125]
 * - POST /api/save?file=assets/side/anim/{키}/{동작}_{0|1}.png  (본문 = PNG). 저장 전에 기존 파일을 assets/side/anim/_backup/ 에 시각을 붙여 보관한다.
 * - POST /api/meta  (JSON {key, act:'atk', n, hit})  → assets/side/anim/meta.js 의 SIDE_META 항목을 갱신한다.
 * 저장 위치는 assets/side/anim/ 아래 PNG 와 meta.js 로만 제한한다. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = +(process.argv[2] || process.env.PORT || 8125);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.css': 'text/css; charset=utf-8', '.webm': 'video/webm', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
const SAVE_RE = /^assets\/side\/anim\/[a-z][a-z0-9_-]*\/[a-z]+_[01]\.png$/;
function readBody(req, limit) { return new Promise((res, rej) => { const chunks = []; let n = 0; req.on('data', c => { n += c.length; if (n > limit) { rej(new Error('too large')); req.destroy(); } else chunks.push(c); }); req.on('end', () => res(Buffer.concat(chunks))); req.on('error', rej); }); }
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
function updateMeta(key, act, n, hit) {
  const f = path.join(ROOT, 'assets/side/anim/meta.js'); let t = fs.readFileSync(f, 'utf8');
  const line = `  ${key}: { ${act}: { n: ${n}, hit: ${hit} } },`, re = new RegExp(`^\\s*${key}:\\s*\\{[^\\n]*\\},?\\s*$`, 'm');
  if (re.test(t)) t = t.replace(re, line); else t = t.replace(/(window\.SIDE_META = Object\.assign\(window\.SIDE_META \|\| \{\}, \{\n)/, `$1${line}\n`);
  fs.writeFileSync(f, t);
}
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/api/save') {
      const rel = (u.searchParams.get('file') || '').replace(/\\/g, '/'); if (!SAVE_RE.test(rel)) return send(res, 400, { error: '저장할 수 없는 경로: ' + rel });
      const body = await readBody(req, 30 * 1024 * 1024); if (body.length < 100 || body.readUInt32BE(0) !== 0x89504e47) return send(res, 400, { error: 'PNG 가 아닙니다' });
      const dst = path.join(ROOT, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); let backup = null;
      if (fs.existsSync(dst)) { const d = new Date(), pad = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`, bdir = path.join(ROOT, 'assets/side/anim/_backup', rel.split('/')[3]); fs.mkdirSync(bdir, { recursive: true }); backup = path.join(bdir, path.basename(rel, '.png') + '.' + stamp + '.png'); fs.copyFileSync(dst, backup); }
      fs.writeFileSync(dst, body); return send(res, 200, { ok: true, saved: rel, bytes: body.length, backup: backup && path.relative(ROOT, backup).replace(/\\/g, '/') });
    }
    if (req.method === 'POST' && u.pathname === '/api/meta') {
      const j = JSON.parse((await readBody(req, 10000)).toString('utf8')); if (!/^[a-z][a-z0-9_-]*$/.test(j.key) || j.act !== 'atk' || !(j.n > 0) || !(j.hit >= 0)) return send(res, 400, { error: '잘못된 메타' });
      updateMeta(j.key, j.act, j.n | 0, j.hit | 0); return send(res, 200, { ok: true });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('File not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': st.size }); if (req.method === 'HEAD') return res.end(); fs.createReadStream(f).pipe(res); });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log('dev server http://localhost:' + PORT));
