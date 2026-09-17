import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel} from '../src/routing/models';
import {BGE_MODEL_ID,bgeMatchingIndex,rankBge} from '../src/routing/bgeMatching';
import {chooseRoute,routingSkipReason,abstain} from '../src/routing/policy';
import {selectSkillOffers} from '../src/routing/skillSuggestions';
import {heldoutNegatives,heldoutSuggestions} from '../tests/fixtures/bge-calibration-extra';
const sha=(data:Uint8Array)=>crypto.createHash('sha256').update(data).digest('hex');
const oldLock=JSON.parse(await fs.readFile('output/bge-calibration/evaluation-lock.json','utf8'));
for(const [p,h]of Object.entries(oldLock.hashes))if(sha(await fs.readFile(p))!==h)throw Error('Frozen baseline altered: '+p);
env.allowRemoteModels=false;env.allowLocalModels=true;
const m=routerModel(BGE_MODEL_ID),e=await loadEmbeddingModel(m,{sourceDirectory:`./data/minilm-cache/${m.id}/${m.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const encode=async(text:string)=>(await e(text,{pooling:'cls',normalize:true})).data as Float32Array;
const vectors=[];for(const p of bgeMatchingIndex)vectors.push(await encode(p.text));
const skills=[],negatives=[],suggestions=[];
for(const line of (await fs.readFile('tests/fixtures/bge-heldout-skills.txt','utf8')).trim().split('\n')){
 const [expected,text]=line.split('|'),rank=rankBge(await encode(text),vectors),skip=routingSkipReason(text);skills.push({text,expected,rank,decision:skip?abstain(skip):chooseRoute(rank,BGE_MODEL_ID),topic:chooseRoute(rank,BGE_MODEL_ID,'topic')});
}
for(const text of heldoutNegatives){const rank=rankBge(await encode(text),vectors),skip=routingSkipReason(text);negatives.push({text,decision:skip?abstain(skip):chooseRoute(rank,BGE_MODEL_ID),review:selectSkillOffers([rank],BGE_MODEL_ID)});}
for(const c of heldoutSuggestions){const rank=rankBge(await encode(c.text),vectors),review=selectSkillOffers([rank],BGE_MODEL_ID);suggestions.push({...c,rank,review,relevant:review.offers.filter(o=>c.allowed.includes(o.toolId)).length,irrelevant:review.offers.filter(o=>!c.allowed.includes(o.toolId)).length});}
const summary={correct:skills.filter(x=>x.decision.toolId===x.expected).length,wrong:skills.filter(x=>x.decision.status==='selected'&&x.decision.toolId!==x.expected).length,abstained:skills.filter(x=>x.decision.status==='abstained').length,top1:skills.filter(x=>x.rank[0].toolId===x.expected).length,negativeRoutes:negatives.filter(x=>x.decision.status==='selected').length,negativeSuggestions:negatives.filter(x=>x.review.offers.length).length,usefulSuggestions:suggestions.filter(x=>x.relevant).length,wrongSuggestions:suggestions.reduce((s,x)=>s+x.irrelevant,0)};
await fs.writeFile('output/bge-v2/native-results.json',JSON.stringify({summary,skills,negatives,suggestions},null,2));console.log(summary);await e.dispose();
