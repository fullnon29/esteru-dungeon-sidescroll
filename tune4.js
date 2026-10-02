const C=require('./core.js'); const {evalTune}=require('./tune.js'); const base=Object.assign({},C.TUNE);
for(const [eAtk,eHp] of [[0.12,0.30],[0.10,0.28],[0.12,0.26]]){ Object.assign(C.TUNE,base); const r=evalTune({eAtk,eHp},6); console.log(JSON.stringify(r.over),'med',r.medRuns,'max',r.maxRuns,'clr',r.clearRate,'wipes',r.wipes,'early',r.earlyWipes+'/'+r.earlyRuns,'lv',r.topLv); }
