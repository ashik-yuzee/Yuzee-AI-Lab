import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import {pipeline,env} from '@huggingface/transformers';
import {ROUTER_MODELS} from '../src/routing/models';
import {eligibleTools,indexText,chooseRoute,routingSkipReason,abstain} from '../src/routing/policy';
import {suggestionIndex,rankSuggestions} from '../src/routing/suggestionIndex';
import {selectSkillOffers,embeddingSections} from '../src/routing/skillSuggestions';
import {needScenarios,chooseNeed,assessTurnNeeds} from '../src/routing/turnNeeds';
import {pathwayScenarios,choosePathwayHint,pathwayQuery} from '../src/miniPathway/policy';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
import {boundaries,needs,pathways,suggestions} from './fixtures/router-model-extra';
env.cacheDir='./data/minilm-cache';env.allowRemoteModels=false;env.allowLocalModels=true;
const corpus=await fs.readFile('tests/fixtures/router-model-coverage.txt','utf8');
const coverage=corpus.trim().split('\n').map(l=>{const [expected,text]=l.split('|');return {expected,text};});
if(coverage.length!==103||new Set(coverage.map(c=>c.expected)).size!==103)throw Error('Incomplete skill corpus');
const outDir='output/model-comparison';await fs.mkdir(outDir,{recursive:true});
const results:any[]=[];
for(const model of ROUTER_MODELS){
 console.log('Benchmark '+model.label);
 const start=performance.now();
 const embed=await loadEmbeddingModel(model,{sourceDirectory:`./data/minilm-cache/${model.id}/${model.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
 const loadMs=performance.now()-start;
 const latencies:number[]=[];
 const fits=(s:string)=>checkEmbeddingInput(embed.tokenizer as any,s,model.tokenBudget).fits;
 async function encode(texts:string[],timed=false){
  const vec:Float32Array[]=[];
  for(let i=0;i<texts.length;i+=12){const batch=texts.slice(i,i+12);if(batch.some(t=>!fits(t)))throw Error(model.id+' unsafe truncation');const t=performance.now();const o=await embed(batch,{pooling:model.pooling,normalize:true});if(timed)latencies.push(performance.now()-t);const d=o.dims.at(-1)!;batch.forEach((_,j)=>vec.push((o.data as Float32Array).slice(j*d,(j+1)*d)));}return vec;
 }
 const indexStart=performance.now();
 const tools=await encode(eligibleTools.map(indexText));
 const offers=await encode(suggestionIndex.map(s=>s.text));
 const needsIndex=await encode(needScenarios.map(s=>s.text));
 const pathIndex=await encode(pathwayScenarios.map(s=>s.text));
 const indexMs=performance.now()-indexStart;
 const dot=(a:Float32Array,b:Float32Array)=>a.reduce((n,x,i)=>n+x*b[i],0);
 const skillResults=[];
 for(const c of coverage){const [q]=await encode([c.text],true);const rank=tools.map((v,i)=>({toolId:eligibleTools[i].id,score:dot(q,v)})).sort((a,b)=>b.score-a.score);const skip=routingSkipReason(c.text);const decision=skip?abstain(skip):chooseRoute(rank);const topic=chooseRoute(rankSuggestions(q,offers));skillResults.push({...c,rank:rank.slice(0,3),decision,topic,top1:rank[0].toolId===c.expected,top3:rank.slice(0,3).some(x=>x.toolId===c.expected)});}
 const boundaryResults=[];
 for(const text of boundaries){const skip=routingSkipReason(text);let decision:any=abstain(skip||'');if(!skip){const[q]=await encode([text],true);decision=chooseRoute(tools.map((v,i)=>({toolId:eligibleTools[i].id,score:dot(q,v)})));}boundaryResults.push({text,decision,pass:decision.status==='abstained'});}
 const needResults=[];
 for(const [text,expected] of needs){const[q]=await encode([text],true);const hint=chooseNeed(needsIndex.map((v,i)=>({id:needScenarios[i].id,score:dot(q,v)})));const actual=assessTurnNeeds({text,hint});needResults.push({text,expected,hint,action:actual.action,pass:hint.kind===expected,integratedPass:actual.action===expected});}
 const pathwayResults=[];
 for(const [text,expected]of pathways){const[q]=await encode([pathwayQuery({},text)],true);const hint=choosePathwayHint(pathIndex.map((v,i)=>({id:pathwayScenarios[i].id,score:dot(q,v)})));pathwayResults.push({text,expected,hint,pass:(hint.status==='selected')===expected});}
 const suggestionResults=[];
 for(const c of suggestions){const parts=c.text.split(/\n\s*\n/).flatMap(t=>embeddingSections(t,fits));const qs=await encode(parts,true);const review=selectSkillOffers(qs.map(q=>rankSuggestions(q,offers)));suggestionResults.push({...c,review,relevant:review.offers.filter(o=>c.allowed.includes(o.toolId)).length,irrelevant:review.offers.filter(o=>!c.allowed.includes(o.toolId)).length});}
 const long='An adult learner is exploring work and study options. '.repeat(80)+'The important final question is about course tuition, scholarships, grants and out-of-pocket study costs.';
 const chunks=embeddingSections(long,fits);const longQs=await encode(chunks);const lastRank=rankSuggestions(longQs.at(-1)!,offers);
 const longInput={tokens:checkEmbeddingInput(embed.tokenizer as any,long,model.tokenBudget).tokens,budget:model.tokenBudget,rejectedAsSingle:!fits(long),chunks:chunks.length,preserved:chunks.join('')===long,lastChunk:chunks.at(-1),tailTop3:lastRank.slice(0,3),tailFeesInTop3:lastRank.slice(0,3).some(x=>x.toolId==='COURSE_011')};
 const medium='a '.repeat(320);const mediumInput=checkEmbeddingInput(embed.tokenizer as any,medium,model.tokenBudget);
 const bytes=(await fs.stat(`data/minilm-cache/${model.id}/${model.revision}/onnx/model_quantized.onnx`)).size;
 const sorted=[...latencies].sort((a,b)=>a-b);const good=skillResults.filter(r=>r.decision.status==='selected'&&r.decision.toolId===r.expected).length;const wrong=skillResults.filter(r=>r.decision.status==='selected'&&r.decision.toolId!==r.expected).length;
 const result={model,loadMs,indexMs,weightsBytes:bytes,runtime:'Node CPU, q8, one intra/inter-op thread, warm disk cache; no query instruction for semantic classification',summary:{skills:103,top1:skillResults.filter(r=>r.top1).length,top3:skillResults.filter(r=>r.top3).length,correctSelected:good,wrongSelected:wrong,abstained:103-good-wrong,topicCorrect:skillResults.filter(r=>r.topic.status==='selected'&&r.topic.toolId===r.expected).length,boundaryPass:boundaryResults.filter(r=>r.pass).length,boundaryTotal:boundaries.length,needsCorrect:needResults.filter(r=>r.pass).length,needsIntegrated:needResults.filter(r=>r.integratedPass).length,needsTotal:needs.length,pathwayCorrect:pathwayResults.filter(r=>r.pass).length,pathwayTotal:pathways.length,suggestionsWithRelevant:suggestionResults.filter(r=>r.relevant).length,suggestionsTotal:suggestions.length,irrelevantOffers:suggestionResults.reduce((n,r)=>n+r.irrelevant,0),offerCount:suggestionResults.reduce((n,r)=>n+r.review.offers.length,0),medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)]},skillResults,boundaryResults,needResults,pathwayResults,suggestionResults,longInput,mediumInput};
 results.push(result);await fs.writeFile(`${outDir}/${model.label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({model:model.label,...result.summary}));await embed.dispose();
}
await fs.writeFile(`${outDir}/results.json`,JSON.stringify({date:new Date().toISOString(),platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,corpusSha256:crypto.createHash('sha256').update(corpus).digest('hex'),method:'Synthetic task-labelled evaluation, one independently phrased question per skill. Shared unchanged thresholds .48/.06; strict exact skill IDs, overlapping skills may be reasonable alternatives. No tuning on these cases. Not a test of Gemini factual accuracy.',results},null,2));
