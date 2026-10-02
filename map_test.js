const C=require('./core.js'); let bad=0, vaults=0, locks=0, mv=0;
for(let i=0;i<500;i++){ const f=1+i%50, m=C.genFloor(f);
 // 잠긴문 없이 계단 도달?
 const q=[[m.start.x,m.start.y]],seen=new Set([m.start.y*39+m.start.x]);
 for(let k=0;k<q.length;k++){const [x,y]=q[k];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=39||ny>=23)continue;const t=m.grid[ny][nx];if(t===0||t===4||seen.has(ny*39+nx))continue;seen.add(ny*39+nx);q.push([nx,ny]);}}
 if(!seen.has(m.stairs.y*39+m.stairs.x)) bad++;
 vaults+=m.vaults.length; if(f%10===0 && !m.groups.some(g=>g.boss)) bad++;
}
console.log('bad',bad,'vaults',vaults);
// 평균 탐사 이동 수
const s=C.newSave(); let steps=0;
for(let f=1;f<=20;f++){ s.maxFloor=f; const e=C.createExpedition(s,f); s.units.forEach(u=>u.lv=40); s.units.forEach(u=>u.hp=C.stats(u).hp); const f0=e.floor; let n=0; while(!e.done&&e.floor===f0&&n<20000){C.stepExpedition(e,0.14);e.events=[];n++;} steps+=n; }
console.log('avg ticks/floor',steps/20);
