/** Offline development fitting. Evaluation fixtures are intentionally not imported. */
import fs from 'node:fs/promises';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel} from '../src/routing/models';
import {bgeMatchingIndex,rankBge,bgeGateResult,BGE_MODEL_ID} from '../src/routing/bgeMatching';
import {bgeNeedScenarios,bgePathwayScenarios} from '../src/routing/bgeTaskContent';
import {needDevelopment,pathwayDevelopment} from '../tests/fixtures/bge-task-development';
import {suggestions,boundaries} from '../tests/fixtures/router-model-extra';
import {calibrationNegatives} from '../tests/fixtures/bge-calibration-extra';
import {routingSkipReason} from '../src/routing/policy';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
env.allowRemoteModels=false;env.allowLocalModels=true;
const m=routerModel(BGE_MODEL_ID),prefix='Represent this sentence for searching relevant passages: ';
const embed=await loadEmbeddingModel(m,{sourceDirectory:`./data/minilm-cache/${m.id}/${m.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const cache:Record<string,number[]>=JSON.parse(await fs.readFile('output/bge-v2/embedding-cache.json','utf8').catch(()=>'{}'));
async function encode(text:string){
 if(!cache[text]){if(!checkEmbeddingInput(embed.tokenizer as any,text,512).fits)throw Error('Over budget');cache[text]=Array.from((await embed(text,{pooling:'cls',normalize:true})).data as Float32Array);}
 return new Float32Array(cache[text]);
}
const vectors=[];for(const p of bgeMatchingIndex)vectors.push(await encode(p.text));
async function taskRows(data:[string,string][],index:readonly {id:string;text:string}[],instruction:boolean){
 const vecs=[];for(const p of index)vecs.push(await encode(p.text));
 const rows=[];for(const [text,expected]of data){const q=await encode((instruction?prefix:'')+text);const scores=new Map<string,number>();
 vecs.forEach((v,i)=>{const score=v.reduce((s,n,j)=>s+n*q[j],0),id=index[i].id;scores.set(id,Math.max(scores.get(id)??-1,score));});
 rows.push({text,expected,rank:[...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score)});}
 return rows;
}
const dev=(await fs.readFile('tests/fixtures/router-model-coverage.txt','utf8')).trim().split('\n').map(l=>{const[id,text]=l.split('|');return {text,allowed:[id]};});
const negative=[...boundaries,...calibrationNegatives].map(text=>({text,allowed:[] as string[]}));
const report:any={createdAt:new Date().toISOString(),method:'Development-only fitting, raw vs instruction query, unchanged q8 model weights, CLS+L2; zero accepted wrong development routes required. Old regression fixtures are not fitted.'};
for(const instruction of [false,true]){
 console.log('Development experiment: query instruction '+instruction);
 const routes=[],offers=[];
 for(const c of [...dev,...negative])routes.push({...c,skip:routingSkipReason(c.text),rank:rankBge(await encode((instruction?prefix:'')+c.text),vectors)});
 for(const c of [...suggestions,...negative])offers.push({...c,skip:null,rank:rankBge(await encode((instruction?prefix:'')+c.text),vectors)});
 function fitSkills(rows:typeof routes){const trials=[];
 for(const score of [.55,.6,.65,.675,.7,.725,.75,.775,.8])for(const margin of [.02,.03,.04,.05,.06,.07,.08,.10])for(const domainMargin of [.06,.08,.10,.12,.14,.16,.18,.20]){
 const gate={score,margin,domainMargin};let correct=0,wrong=0,negativeAccepted=0;
 for(const row of rows){const d=row.skip?{selected:false,toolId:undefined}:bgeGateResult(row.rank,gate);if(d.selected){if(row.allowed.includes(d.toolId!))correct++;else{wrong++;if(!row.allowed.length)negativeAccepted++;}}}
 if(wrong===0&&negativeAccepted===0)trials.push({gate,correct,wrong});}
 trials.sort((a,b)=>b.correct-a.correct||b.gate.domainMargin-a.gate.domainMargin||b.gate.margin-a.gate.margin||b.gate.score-a.gate.score);return trials.slice(0,5);
 }
 const needs=await taskRows(needDevelopment,bgeNeedScenarios,instruction),pathway=await taskRows(pathwayDevelopment,bgePathwayScenarios,instruction);
 function fitTask(rows:typeof needs,positiveOnly:boolean){const trials=[];
 for(const score of [.45,.5,.55,.575,.6,.625,.65,.675,.7,.725,.75])for(const margin of [.01,.02,.03,.04,.05,.06,.08,.10,.12,.15]){
 let correct=0,wrong=0,negativeAccepted=0;
 for(const r of rows){const[a,b]=r.rank,accept=a.score>=score&&a.score-b.score>=margin&&a.id!=='other';if(accept){if(a.id===r.expected)correct++;else{wrong++;if(r.expected==='other')negativeAccepted++;}}else if(r.expected==='other')correct++;}
 if(wrong===0)trials.push({gate:{score,margin},correct,wrong,negativeAccepted});}
 trials.sort((a,b)=>b.correct-a.correct||b.gate.margin-a.gate.margin||b.gate.score-a.gate.score);return trials.slice(0,5);
 }
 report[instruction?'prefixed':'raw']={route:fitSkills(routes),topic:fitSkills(routes.map(r=>({...r,skip:null}))),suggestion:fitSkills(offers),needs:fitTask(needs,false),pathway:fitTask(pathway,true),routes,offers,needsRows:needs,pathwayRows:pathway};
 console.log(JSON.stringify({instruction,...Object.fromEntries(['route','topic','suggestion','needs','pathway'].map(k=>[k,report[instruction?'prefixed':'raw'][k][0]]))}));
}
await fs.writeFile('output/bge-v2/development.json',JSON.stringify(report,null,2));await fs.writeFile('output/bge-v2/embedding-cache.json',JSON.stringify(cache));await embed.dispose();
