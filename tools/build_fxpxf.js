'use strict';
/* assets/fxpxf/*.pxf.json 을 한 파일(assets/fxpxf/manifest.js)로 묶는다. 사용: node tools/build_fxpxf.js
 * 게임(side.js)은 window.PXF_FX = { 이름: 그래프 } 를 읽어 로딩 때 렌더해 이펙트로 등록한다(같은 이름의 assets/fx 시트보다 우선). */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'fxpxf'), out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.pxf.json')).sort()) {
  const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), name = f.replace(/\.pxf\.json$/, '');
  if (g.format !== 'pxf.graph@1') { console.warn('건너뜀(형식 불일치):', f); continue; }
  out[name] = g;
}
fs.writeFileSync(path.join(dir, 'manifest.js'), '// 자동 생성: node tools/build_fxpxf.js — 직접 고치지 말고 *.pxf.json 을 고친 뒤 다시 실행\nwindow.PXF_FX = ' + JSON.stringify(out) + ';\n');
console.log('묶음:', Object.keys(out).join(', ') || '(없음)');
