/** Read-only model/policy audit. Does not tune gates, rewrite frozen cases or call Gemini. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {env} from '@huggingface/transformers';
import {ROUTER_MODELS} from '../src/routing/models';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routingSkipReason} from '../src/routing/policy';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
import {embeddingSections} from '../src/routing/skillSuggestions';
import {bgeMatchingIndex} from '../src/routing/bgeMatching';

const destination='output/bge-readiness';
await fs.mkdir(destination,{recursive:true});
const recorded=JSON.parse(await fs.readFile('output/bge-calibration/heldout-results.json','utf8'));
const browser=JSON.parse(await fs.readFile('output/bge-calibration/browser-summary.json','utf8'));
const profile=JSON.parse(await fs.readFile('src/routing/bgeCalibration.json','utf8'));
const lock=JSON.parse(await fs.readFile('output/bge-calibration/evaluation-lock.json','utf8'));
const sha=(data:Uint8Array|string)=>crypto.createHash('sha256').update(data).digest('hex');
for(const [path,hash] of Object.entries(lock.hashes))assert.equal(sha(await fs.readFile(path)),hash,`Frozen file changed: ${path}`);
const cpu=recorded.results.find((r:any)=>r.calibrated);
const count=(values:string[])=>Object.fromEntries([...new Set(values)].map(k=>[k,values.filter(v=>v===k).length]));
const caseAudit=cpu.skills.map((s:any)=>{
 const skills=s.ranks.filter((c:any)=>c.toolId!=='__OUT_OF_SCOPE__');
 const background=s.ranks.find((c:any)=>c.toolId==='__OUT_OF_SCOPE__');
 const [first,second]=skills;
 const failures=[
  ...(routingSkipReason(s.text)?['guard:'+routingSkipReason(s.text)]:[]),
  ...(first.score<profile.route.score?['minimum-similarity']:[]),
  ...(first.score-second.score<profile.route.margin?['skill-margin']:[]),
  ...(!background?['missing-background']:first.score-background.score<profile.route.domainMargin?['background-margin']:[]),
 ];
 return {expected:s.expected,text:s.text,top1:first.toolId,top1Correct:s.top1,top3Correct:skills.slice(0,3).some((c:any)=>c.toolId===s.expected),decision:s.decision,allFailedGates:failures,topCandidates:skills.slice(0,3),background};
});
const abstained=caseAudit.filter((s:any)=>s.decision.status==='abstained');
env.allowRemoteModels=false;env.allowLocalModels=true;
const config=ROUTER_MODELS.find(m=>m.label==='BGE-small')!;
const directory=`data/minilm-cache/${config.id}/${config.revision}`;
const artifacts=Object.fromEntries(await Promise.all(['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'].map(async file=>[file,sha(await fs.readFile(`${directory}/${file}`))])));
const encoder=await loadEmbeddingModel(config,{sourceDirectory:`./${directory}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const checks:any[]=[];
try{
 const text='Compare the Diploma of IT and Bachelor of IT for a learner returning to study.';
 const raw=await encoder(text,{pooling:'none',normalize:false});
 const cls=await encoder(text,{pooling:'cls',normalize:true});
 const vector=Array.from(cls.data as Float32Array);
 const firstToken=Array.from((raw.data as Float32Array).slice(0,384));
 const length=Math.hypot(...firstToken);
 const maxError=Math.max(...vector.map((v,i)=>Math.abs(v-firstToken[i]/length)));
 const norm=Math.hypot(...vector);
 assert.equal(vector.length,384);assert.ok(vector.every(Number.isFinite));assert.ok(Math.abs(norm-1)<1e-5);assert.ok(maxError<1e-5);
 checks.push({check:'Actual q8 CPU CLS vector equals normalised first-token representation',passed:true,dimensions:vector.length,norm,maxAbsoluteError:maxError});
 const limits=[1,30,127,255,509,510,511,600].map(n=>({repeatedWords:n,...checkEmbeddingInput(encoder.tokenizer as any,'hello '.repeat(n),config.tokenBudget)}));
 assert.equal(limits.find(x=>x.repeatedWords===510)!.tokens,512);
 assert.equal(limits.find(x=>x.repeatedWords===510)!.fits,true);
 assert.equal(limits.find(x=>x.repeatedWords===511)!.tokens,513);
 assert.equal(limits.find(x=>x.repeatedWords===511)!.fits,false);
 checks.push({check:'Real BGE tokenizer includes special tokens at 512/513 boundary',passed:true,probes:limits});
 const dense=checkEmbeddingInput(encoder.tokenizer as any,'?'.repeat(600),512);
 assert.ok(!dense.fits);checks.push({check:'Dense 600-character input rejected when over token limit',passed:true,...dense});
 const indexCounts=bgeMatchingIndex.map(s=>({id:s.toolId,...checkEmbeddingInput(encoder.tokenizer as any,s.text,512)}));
 assert.ok(indexCounts.every(s=>s.fits));checks.push({check:'Every current BGE prototype fits measured budget',passed:true,prototypes:indexCounts.length,maxTokens:Math.max(...indexCounts.map(s=>s.tokens))});
 const filler='This sample discusses study choices, learning preferences and possible future plans. '.repeat(70);
 const intent='What costs beyond tuition should I check before enrolling?';
 const longProbes=[intent+' '+filler,filler.slice(0,3000)+intent+filler.slice(3000),filler+intent].map((text,index)=>{
  const chunks=embeddingSections(text,s=>checkEmbeddingInput(encoder.tokenizer as any,s,512).fits);
  assert.equal(chunks.join(''),text);assert.ok(chunks.every(c=>checkEmbeddingInput(encoder.tokenizer as any,c,512).fits));
  return {intentPosition:['start','middle','end'][index],characters:text.length,totalTokens:checkEmbeddingInput(encoder.tokenizer as any,text,512).tokens,chunks:chunks.length,allTextPreserved:true,directRouteGuard:routingSkipReason(text),note:'Tests chunk retention only, not semantic recognition or final suggestion correctness.'};
 });
 checks.push({check:'Long-response chunks retain every character with intent at start/middle/end',passed:true,probes:longProbes});
 const shorter=['quality','compare them','why?','show jobs','what about cost?','go deeper','Actually I mean an Advanced Diploma, not a Diploma.','How can I stop feeling overwhelmed by course choices?'].map(text=>({text,currentDirectRouteGuard:routingSkipReason(text)}));
 checks.push({check:'Current short/correction guards observed without changing them',passed:true,probes:shorter});
}finally{await encoder.dispose();}
const b=browser.results.find((r:any)=>r.label.startsWith('BGE'));
const result={date:new Date().toISOString(),purpose:'Readiness audit; unchanged profile and model. Historical routing metrics plus fresh native model/token/chunk checks.',model:config,artifactSha256:artifacts,profile,frozenFilesUnchanged:true,checks,recordedBrowser:{...b,acceptedPrecision:b.correct/(b.correct+b.wrong),activationCoverage:(b.correct+b.wrong)/103,correctCoverage:b.correct/103,top1Accuracy:b.top1/103,wrongPerAllRequests:b.wrong/103,rejectionBreakdownAvailable:false,note:'Only browser aggregate metrics were persisted; rerun browser with per-case export to explain the 62 abstentions.'},recordedCpu:{...cpu.summary,abstentionReasons:count(abstained.map((s:any)=>s.decision.reason)),correctTop1ButAbstained:abstained.filter((s:any)=>s.top1Correct).length,correctTop1AbstentionReasons:count(abstained.filter((s:any)=>s.top1Correct).map((s:any)=>s.decision.reason)),top3Correct:caseAudit.filter((s:any)=>s.top3Correct).length,caseAudit},notRun:['New routing calibration','Fresh complete browser benchmark','New independent labelled evaluation','Live Gemini quality evaluation','Mobile or low-memory tests']};
await fs.writeFile(`${destination}/audit.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({profile:profile.version,freshChecks:checks.map(c=>({check:c.check,passed:c.passed})),recordedBrowser:result.recordedBrowser,recordedCpuReasons:result.recordedCpu.abstentionReasons,correctCpuTop1ButAbstained:result.recordedCpu.correctTop1ButAbstained},null,2));
