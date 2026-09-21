import 'dotenv/config';import fs from 'node:fs/promises';import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';import {routerModel,DEFAULT_ROUTER_MODEL} from '../src/routing/models';
import {objectiveIndex,objectiveShortlist,objectiveSelectionBoundary} from '../src/objectives/routing';import {ObjectiveService} from '../src/objectives/service';
import {embeddingSections} from '../src/routing/skillSuggestions';import {checkEmbeddingInput} from '../src/routing/tokenBudget';
const cases=[
 {id:'transfer',text:'After years at a shop counter I handle complaints and explain products. Can we map other types of work where that experience is useful?',expected:['JOB_DISCOVER_002','SKILL_SIDE_005','CHANGE_002']},
 {id:'local',text:'I am in Ringwood in Victoria. Can you show me nearby adverts for IT support roles and the skills mentioned?',expected:['JOB_DISCOVER_010','EMP_SKILL_001']},
 {id:'learn',text:'I want to move into IT support. Help me prioritise what to learn next based on the skills employers ask for and my starting point.',expected:['LEARN_002','SKILL_SIDE_001','JOB_SKILL_001']},
 {id:'typo',text:'wot jobz can i do wiv customer servce skilz? show me some options',expected:['JOB_DISCOVER_002','JOB_DISCOVER_001','SKILL_SIDE_005']},
 {id:'changed-goal',text:'Forget plumbing. I want to understand the practical skills used in IT support before deciding.',expected:['JOB_SKILL_001','JOB_EXPLORE_001']},
 {id:'no-tool',text:'Do not open a workspace or suggest tools. Just explain what transferable skills means.',expected:[]},
 {id:'thanks',text:'Thanks',expected:[]}
];
env.allowRemoteModels=false;env.allowLocalModels=true;const m=routerModel(DEFAULT_ROUTER_MODEL),embed=await loadEmbeddingModel(m,{sourceDirectory:`./data/minilm-cache/${m.id}/${m.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const cache:Record<string,number[]>=JSON.parse(await fs.readFile('qa/objectives/routing-v3/embedding-cache.json','utf8'));const vectors=[];
async function encode(t:string){if(!cache[t])cache[t]=Array.from((await embed(t,{pooling:'cls',normalize:true})).data as Float32Array);return cache[t];}
try{
 for(const r of objectiveIndex)vectors.push(await encode(r.text));
 const results=[];const service=new ObjectiveService('output/skills-exploration/routing-workspaces');
 for(const c of cases){const scores=new Map<string,number>();for(const t of embeddingSections(c.text,s=>checkEmbeddingInput(embed.tokenizer,s,512).fits)){const q=await encode(t);vectors.forEach((v,i)=>{const id=objectiveIndex[i].id,score=v.reduce((n,x,j)=>n+x*q[j],0);scores.set(id,Math.max(scores.get(id)||-1,score));});}
  const candidates=objectiveShortlist([...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score));const boundary=objectiveSelectionBoundary(c.text);const row:any={...c,boundary,candidates,covered:c.expected.length?candidates.some(x=>c.expected.includes(x.id)):null};
  if(process.argv.includes('--live')){try{row.selection=await service.select({id:'skills-routing-'+c.id+'-'+Date.now(),messages:[{id:'u',role:'user',content:c.text},{id:'a',role:'assistant',content:'We can explore this using the information you have shared.'}]},{sourceMessageId:'a',candidates},new AbortController().signal,()=>true);row.selectedExpected=c.expected.length?c.expected.includes(row.selection.objective_id):row.selection.disposition==='NONE';}catch(e:any){row.error=e.message;}}
  results.push(row);console.log(c.id,row.covered,row.selection?.objective_id||row.selection?.disposition||boundary,row.error||'');
 }
 await fs.writeFile('output/skills-exploration/routing.json',JSON.stringify({model:m.id,scope:'Seven fictional development checks. No real-user accuracy claim; no weight fine-tuning. BGE shortlist and Gemini selection are measured separately.',results},null,2));
}finally{await embed.dispose();}
