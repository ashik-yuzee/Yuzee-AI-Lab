import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {ROUTER_MODELS} from '../src/routing/models';
import {eligibleTools,indexText,chooseRoute,routingSkipReason,abstain,acceptClientRoute} from '../src/routing/policy';
import {suggestionIndex,rankSuggestions} from '../src/routing/suggestionIndex';
import {selectSkillOffers,acceptTopicRoute} from '../src/routing/skillSuggestions';
import {BGE_MODEL_ID,bgeMatchingIndex,rankBge} from '../src/routing/bgeMatching';
import profile from '../src/routing/bgeCalibration.json';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
import {heldoutNegatives,heldoutSuggestions} from './fixtures/bge-calibration-extra';
env.allowRemoteModels=false;env.allowLocalModels=true;
const corpus=await fs.readFile('tests/fixtures/bge-heldout-skills.txt','utf8');
const cases=corpus.trim().split('\n').map(l=>{const[expected,text]=l.split('|');return {expected,text};});
if(cases.length!==103||new Set(cases.map(x=>x.expected)).size!==103)throw Error('Missing skills');
const files=['src/routing/bgeCalibration.json','src/routing/bgeSkillContent.json','src/routing/bgeDomain.ts','tests/fixtures/bge-heldout-skills.txt','tests/fixtures/bge-calibration-extra.ts'];
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const frozen={date:new Date().toISOString(),profile,hashes,method:'Freeze prior to first evaluation. Same-author synthetic held-out examples, no independent human validation. No tuning on held-out results. Baseline indexes and .48/.06 policy compared on the same new cases. Strict exact-ID route scoring; suggestion alternatives explicitly labelled before evaluation.'};
try{await fs.writeFile('output/bge-calibration/evaluation-lock.json',JSON.stringify(frozen,null,2),{flag:'wx'});}catch(e:any){if(e.code!=='EEXIST')throw e;const previous=JSON.parse(await fs.readFile('output/bge-calibration/evaluation-lock.json','utf8'));if(JSON.stringify(previous.hashes)!==JSON.stringify(hashes))throw Error('Frozen evaluation inputs changed; create a new evaluation set.');}
const results:any[]=[];
for(const model of ROUTER_MODELS){
 console.log('Held-out evaluation: '+model.label);
 const embed=await loadEmbeddingModel(model,{sourceDirectory:`./data/minilm-cache/${model.id}/${model.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
 const times:number[]=[];
 async function encode(text:string){if(!checkEmbeddingInput(embed.tokenizer as any,text,model.tokenBudget).fits)throw Error('Input too long');const t=performance.now();const out=await embed(text,{pooling:model.pooling,normalize:true});times.push(performance.now()-t);return out.data as Float32Array;}
 const oldTools=[];for(const t of eligibleTools)oldTools.push(await encode(indexText(t)));
 const oldOffers=[];for(const t of suggestionIndex)oldOffers.push(await encode(t.text));
 const current=[];if(model.id===BGE_MODEL_ID)for(const t of bgeMatchingIndex)current.push(await encode(t.text));
 const queryCache=new Map<string,Float32Array>();
 const query=async(t:string)=>{if(!queryCache.has(t))queryCache.set(t,await encode(t));return queryCache.get(t)!;};
 for(const calibrated of model.id===BGE_MODEL_ID?[false,true]:[false]){
  const skills=[],negatives=[],suggestions=[];const id=calibrated?BGE_MODEL_ID:ROUTER_MODELS[0].id;
  const rank=(q:Float32Array)=>calibrated?rankBge(q,current):oldTools.map((v,i)=>({toolId:eligibleTools[i].id,score:v.reduce((n,x,j)=>n+x*q[j],0)})).sort((a,b)=>b.score-a.score);
  for(const c of cases){const q=await query(c.text);const ranks=rank(q);const skip=routingSkipReason(c.text);const decision=skip?abstain(skip):chooseRoute(ranks,id);const topic=chooseRoute(calibrated?ranks:rankSuggestions(q,oldOffers),id,'topic');const server=acceptClientRoute(decision,'AUTO','@Oala '+c.text);const menu={kind:'question',input_type:'single_select',question:'What would you like to explore next?',options:[{id:'a',label:c.text}]};const topicServer=acceptTopicRoute(topic,menu,{interaction:{selected_option_ids:['a']}});skills.push({...c,ranks:ranks.slice(0,5),decision,topic,server,topicServer,top1:ranks[0].toolId===c.expected});}
  for(const text of heldoutNegatives){const q=await query(text),ranks=rank(q),skip=routingSkipReason(text);const decision=skip?abstain(skip):chooseRoute(ranks,id);const offer=selectSkillOffers([calibrated?ranks:rankSuggestions(q,oldOffers)],id);negatives.push({text,decision,offer});}
  for(const c of heldoutSuggestions){const q=await query(c.text),ranks=calibrated?rank(q):rankSuggestions(q,oldOffers);const review=selectSkillOffers([ranks],id);suggestions.push({...c,ranks,review,relevant:review.offers.filter(x=>c.allowed.includes(x.toolId)).length,irrelevant:review.offers.filter(x=>!c.allowed.includes(x.toolId)).length});}
  const correct=skills.filter(s=>s.decision.toolId===s.expected).length,wrong=skills.filter(s=>s.decision.status==='selected'&&s.decision.toolId!==s.expected).length;
  const summary={label:model.label+(calibrated?' calibrated':' baseline'),top1:skills.filter(s=>s.top1).length,correct,wrong,abstained:103-correct-wrong,precision:correct/(correct+wrong||1),topicCorrect:skills.filter(s=>s.topic.toolId===s.expected).length,topicWrong:skills.filter(s=>s.topic.status==='selected'&&s.topic.toolId!==s.expected).length,negativeRoutes:negatives.filter(s=>s.decision.status==='selected').length,negativeSuggestions:negatives.filter(s=>s.offer.offers.length).length,suggestionsWithRelevant:suggestions.filter(s=>s.relevant).length,irrelevantOffers:suggestions.reduce((n,s)=>n+s.irrelevant,0),offerCount:suggestions.reduce((n,s)=>n+s.review.offers.length,0),serverAccepted:skills.filter(s=>s.server.status==='selected').length,serverMismatch:skills.filter(s=>(s.decision.status==='selected')!==(s.server.status==='selected')||(s.topic.status==='selected')!==(s.topicServer.status==='selected')).length};
  console.log(JSON.stringify(summary));results.push({model,calibrated,summary,skills,negatives,suggestions});
 }
 await embed.dispose();
}
await fs.writeFile('output/bge-calibration/heldout-results.json',JSON.stringify({...frozen,runtime:`Node CPU q8, one thread; ${os.cpus()[0].model}`,totals:{skills:103,negatives:heldoutNegatives.length,suggestions:heldoutSuggestions.length},results},null,2));
