import {load,config,decisionRecord,tokens} from './diagnostics';
import confusion from './confusion-suite.json';
import {resolveCandidate} from './context-candidate';
self.onmessage=async()=>{try{
 const started=performance.now();
 const manifest=await(await fetch('/output/bge-audit/browser-prototypes-manifest.json')).json();
 const bytes=await(await fetch('/output/bge-audit/browser-prototypes.json')).arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==manifest.sha256)throw Error('Index integrity mismatch');
 const index=JSON.parse(new TextDecoder().decode(bytes));
 if(index.model.revision!==config.revision||index.vectors.length!==manifest.prototypeCount||index.runtime.userAgent!==navigator.userAgent)throw Error('Index compatibility mismatch');
 for(const v of index.vectors)if(v.length!==384||v.some((x:number)=>!Number.isFinite(x))||Math.abs(Math.hypot(...v)-1)>.002)throw Error('Invalid vector');
 const indexLoadMs=performance.now()-started;
 const {extractor,marks}=await load('wasm');const readyMs=performance.now()-started;
 const rows=[];
 for(const c of confusion){const vector=Array.from((await extractor(c.text,{pooling:'cls',normalize:true})).data) as number[];const r=decisionRecord(c.text,c.allowed.join('|'),vector,index.vectors);rows.push({...c,...r,pass:c.mustAbstain?r.decision.status==='abstained':c.allowed.includes(r.decision.toolId||''),wrongAccepted:r.decision.status==='selected'&&!c.allowed.includes(r.decision.toolId||'')});}
 const fixtures=await(await fetch('/output/bge-audit/context-candidate-tests.json')).json();const context=[];
 for(const c of fixtures.positive){const resolved=resolveCandidate(c.request,[{role:'user',content:c.content}]);if(resolved.status!=='resolved')throw Error('Unexpected unresolved');
  const vector=Array.from((await extractor(resolved.query,{pooling:'cls',normalize:true})).data) as number[];
  const r=decisionRecord(resolved.query,c.expectedSkill||'',vector,index.vectors);context.push({...c,...r,resolved,input:tokens(extractor.tokenizer,resolved.query)});
 }
 const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(index.vectors)));
 await extractor.dispose();
 self.postMessage({type:'result',result:{model:config,experimentOnly:true,cacheExperiment:{source:'Exact browser batch12 prototype snapshot, loaded from localhost and hash-checked; not a production persistent-cache implementation',indexLoadMs,encoder:marks,readyMs,vectorSha256:Array.from(new Uint8Array(fingerprint),v=>v.toString(16).padStart(2,'0')).join('')},confusion:rows,context,summary:{confusionCases:rows.length,correctDecisions:rows.filter(x=>x.pass).length,wrongAccepted:rows.filter(x=>x.wrongAccepted).length,abstained:rows.filter(x=>x.decision.status==='abstained').length,contextCases:context.length,correctSelected:context.filter(x=>x.expectedSkill&&x.decision.toolId===x.expectedSkill).length,wrongContextSelected:context.filter(x=>x.expectedSkill&&x.decision.status==='selected'&&x.decision.toolId!==x.expectedSkill).length}}});
}catch(e){self.postMessage({type:'error',message:String(e)});}};
