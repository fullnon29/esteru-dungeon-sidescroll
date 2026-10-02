const C=require('./core.js'); const {evalTune}=require('./tune.js');
const base=Object.assign({},C.TUNE);
for(const expScale of [0.5,0.7,1]) for(const eAtk of [0.12,0.16,0.2]){ Object.assign(C.TUNE,base); const r=evalTune({expScale,eAtk},6); console.log(JSON.stringify(r.over),'med',r.medRuns,'max',r.maxRuns,'clr',r.clearRate,'wipes',r.wipes,'early',r.earlyWipes+'/'+r.earlyRuns,'lv',r.topLv); }
