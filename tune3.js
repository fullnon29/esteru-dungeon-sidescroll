const C=require('./core.js'); const {evalTune}=require('./tune.js');
const base=Object.assign({},C.TUNE);
for(const eDef of [0.15,0.22,0.30]){ Object.assign(C.TUNE,base); const r=evalTune({eDef},8); console.log(JSON.stringify(r.over),'med',r.medRuns,'max',r.maxRuns,'clr',r.clearRate,'wipes',r.wipes,'early',r.earlyWipes+'/'+r.earlyRuns,'lv',r.topLv); }
