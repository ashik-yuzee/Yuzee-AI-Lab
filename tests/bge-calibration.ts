/** Fit only on the existing development corpus. Never reads the held-out skill/suggestion cases. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel} from '../src/routing/models';
import {bgeMatchingIndex,rankBge,bgeGateResult,BGE_MODEL_ID,BGE_CONTENT_VERSION} from '../src/routing/bgeMatching';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
import {routingSkipReason} from '../src/routing/policy';
import {suggestions,boundaries} from './fixtures/router-model-extra';
import {calibrationNegatives} from './fixtures/bge-calibration-extra';
env.allowRemoteModels=false;env.allowLocalModels=true;
const model=routerModel(BGE_MODEL_ID);
const embed=await loadEmbeddingModel(model,{sourceDirectory:`./data/minilm-cache/${model.id}/${model.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
async function encode(text:string){if(!checkEmbeddingInput(embed.tokenizer as any,text,512).fits)throw Error('Token budget exceeded');return (await embed(text,{pooling:'cls',normalize:true})).data as Float32Array;}
const vectors=[];for(const t of bgeMatchingIndex)vectors.push(await encode(t.text));
const corpus=await fs.readFile('tests/fixtures/router-model-coverage.txt','utf8');
const cases=corpus.trim().split('\n').map(l=>{const[expected,text]=l.split('|');return {text,allowed:[expected]};});
const negatives=[...boundaries,...calibrationNegatives];
async function score(cases:{text:string;allowed:string[]}[],guard:boolean){const rows=[];for(const c of cases)rows.push({...c,skip:guard?routingSkipReason(c.text):null,rank:rankBge(await encode(c.text),vectors)});return rows;}
const routes=await score([...cases,...negatives.map(text=>({text,allowed:[]}))],true);
const offers=await score([...suggestions,...negatives.map(text=>({text,allowed:[]}))],false);
function fit(rows:typeof routes,minimumPrecision:number){
 const trials=[];
 for(const score of [.40,.425,.45,.475,.50,.525,.55,.575,.60,.625,.65])for(const margin of [.01,.015,.02,.025,.03,.04,.05,.06,.08])for(const domainMargin of [.02,.04,.06,.08,.10,.12]){
  const gate={score,margin,domainMargin};let correct=0,wrong=0,negativeAccepted=0;
  for(const row of rows){const d=row.skip?{selected:false,toolId:undefined}:bgeGateResult(row.rank,gate);if(!d.selected)continue;if(row.allowed.includes(d.toolId!))correct++;else{wrong++;if(!row.allowed.length)negativeAccepted++;}}
  const precision=correct/(correct+wrong||1);if(negativeAccepted===0&&precision>=minimumPrecision)trials.push({gate,correct,wrong,negativeAccepted,precision});
 }
 // Most correct coverage subject to precision/background constraints, then fewer mistakes and wider separation.
 trials.sort((a,b)=>b.correct-a.correct||a.wrong-b.wrong||b.gate.domainMargin-a.gate.domainMargin||b.gate.margin-a.gate.margin||b.gate.score-a.gate.score);
 if(!trials.length)throw Error('No acceptable calibration profile');return {selected:trials[0],alternatives:trials.slice(0,10)};
}
const route=fit(routes,.95),suggestion=fit(offers,.95);
const profile={version:'bge-calibrated-v1',modelId:BGE_MODEL_ID,contentVersion:BGE_CONTENT_VERSION,route:route.selected.gate,topic:route.selected.gate,suggestion:suggestion.selected.gate};
await fs.writeFile('src/routing/bgeCalibration.json',JSON.stringify(profile,null,2)+'\n');
await fs.writeFile('output/bge-calibration/calibration.json',JSON.stringify({date:new Date().toISOString(),method:'CPU q8. Existing 103-case corpus is development data, never a new held-out claim. Grid fit maximises correct selections with >=95% accepted precision and zero accepted negative cases. Optional suggestions calibrated separately on 16 excerpts plus negatives. Topic uses conservative route gate. No evaluation-set tuning.',corpusSha256:crypto.createHash('sha256').update(corpus).digest('hex'),profile,route,suggestion,routes,offers},null,2));
console.log(JSON.stringify({profile,route:route.selected,suggestion:suggestion.selected}));await embed.dispose();
