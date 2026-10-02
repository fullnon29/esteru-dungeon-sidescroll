const C=require('./core.js');
const s=C.newSave();
let runs=0;
function buyCons(){ for(const k of ['potion','antidote']){ while((s.cons[k]||0)<3 && s.gold>200){s.gold-=C.CONS[k].price;s.cons[k]=(s.cons[k]||0)+1;} } }
function hireAll(){ for(const u of s.units){ if(!u.hired && s.gold>C.hireCost(u)+300) C.hireUnit(s,u); } }
function shop(){ const tmax=Math.min(3,1+Math.floor(s.maxFloor/10)); for(const i of Object.values(C.ITEMS)){ if(i.legend||i.gen||i.tier>tmax||!s.units.some(u=>u.hired&&C.canUse(u,i))) continue; if(s.gold>i.price+400 && !s.gear.includes(i.id) && Math.random()<0.3){ s.gold-=i.price; s.gear.push(i.id);} } }
const start=Date.now();
while(!s.cleared && runs<400){
  runs++; hireAll(); shop(); C.autoEquip(s); C.autoFormation(s); buyCons();
  const e=C.createExpedition(s,Math.max(1,s.maxFloor- (runs%3)));
  let t=0; while(!e.done && t<20000){C.stepExpedition(e,0.1);e.events=[];t++;}
  if(runs%10==0||s.cleared) console.log('run',runs,'result',e.result,'floor',e.reached,'max',s.maxFloor,'gold',s.gold,'lvs',s.units.filter(u=>u.hired).map(u=>u.lv).join(','));
}
console.log('cleared',s.cleared,'runs',runs,'ms',Date.now()-start);
