const C=require('./core.js'); const W=C.MW, H=C.MH; let bad=0, vaults=0, locks=0, mv=0;
for(let i=0;i<500;i++){ const f=1+i%50, m=C.genFloor(f);
 // 잠긴문 없이 계단 도달?
 const q=[[m.start.x,m.start.y]],seen=new Set([m.start.y*W+m.start.x]);
 for(let k=0;k<q.length;k++){const [x,y]=q[k];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const t=m.grid[ny][nx];if(t===0||t===4||seen.has(ny*W+nx))continue;seen.add(ny*W+nx);q.push([nx,ny]);}}
 if(!seen.has(m.stairs.y*W+m.stairs.x)) bad++;
 vaults+=m.vaults.length; if(f%10===0 && !m.groups.some(g=>g.boss)) bad++;
}
console.log('bad',bad,'vaults',vaults);
// 평균 탐사 이동 수
const s=C.newSave(); let steps=0;
for(let f=1;f<=20;f++){ s.maxFloor=f; const e=C.createExpedition(s,f);  const f0=e.floor; let n=0; while(!e.done&&e.floor===f0&&n<20000){C.stepExpedition(e,0.14);e.events=[];n++;} steps+=n; }
console.log('avg ticks/floor',steps/20);
