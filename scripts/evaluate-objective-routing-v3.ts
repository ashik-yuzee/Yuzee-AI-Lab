import fs from 'node:fs/promises';
import {activitySearchContext} from '../src/objectives/activityContext';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel,DEFAULT_ROUTER_MODEL} from '../src/routing/models';
import {legacyObjectiveIndex,objectiveIndex,fuseObjectiveMatches,objectiveSelectionBoundary} from '../src/objectives/routing';
import {embeddingSections} from '../src/routing/skillSuggestions';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
const root='qa/objectives/routing-v3';
let cases=JSON.parse(await fs.readFile(root+'/cases.json','utf8'));
const live=process.argv.includes('--live-context');
if(live){const generated=JSON.parse(await fs.readFile(root+'/live-context.json','utf8'));cases=cases.filter(c=>generated.some(g=>g.id===c.id&&g.valid)).map(c=>{const raw=generated.find(g=>g.id===c.id).raw;return {...c,context:activitySearchContext(raw,[c.prior||'',c.text]),response:raw};});}
env.allowRemoteModels=false;env.allowLocalModels=true;
const m=routerModel(DEFAULT_ROUTER_MODEL);
const embed=await loadEmbeddingModel(m,{sourceDirectory:`./data/minilm-cache/${m.id}/${m.revision}`,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const cache:Record<string,number[]>=JSON.parse(await fs.readFile(root+'/embedding-cache.json','utf8').catch(()=>'{}'));
async function encode(s:string){if(!cache[s]){if(!checkEmbeddingInput(embed.tokenizer,s,512).fits)throw Error('Index text exceeds token budget');cache[s]=Array.from((await embed(s,{pooling:'cls',normalize:true})).data as Float32Array);}return cache[s];}
async function index(rows:{id:string;text:string}[]){const vs=[];for(const p of rows)vs.push(await encode(p.text));return vs;}
console.log('Indexing pinned BGE locally');const oldV=await index(legacyObjectiveIndex),newV=await index(objectiveIndex);
async function rank(text:string,rows:{id:string;text:string}[],vectors:number[][]){
 if(!text.trim())return [];
 const chunks=embeddingSections(text,s=>checkEmbeddingInput(embed.tokenizer,s,512).fits);
 if(text.length>1200){const tail=(text.match(/[^.!?]+[.!?]*/g)||[]).slice(-2).join(' ').trim();if(tail&&checkEmbeddingInput(embed.tokenizer,tail,512).fits)chunks.push(tail);}
 const scores=new Map<string,number>();
 for(const part of chunks){const q=await encode(part);vectors.forEach((v,i)=>{const score=v.reduce((n,x,j)=>n+x*q[j],0);scores.set(rows[i].id,Math.max(scores.get(rows[i].id)||-1,score));});}
 return [...scores].map(([id,score])=>({id,score})).filter(c=>c.score>=.5).sort((a,b)=>b.score-a.score);
}
const results=[];
for(const c of cases){const started=performance.now(),text=c.text.repeat(c.repeat||1)+(c.tail||'');const mixed=`User request: ${text}\n\nRecent discussion: ${c.prior||''}\n${c.context}`;
 const [base,newMixed,oldUser,oldContext,newUser,newContext]=await Promise.all([rank(mixed,legacyObjectiveIndex,oldV),rank(mixed,objectiveIndex,newV),rank(text,legacyObjectiveIndex,oldV),rank(c.context,legacyObjectiveIndex,oldV),rank(text,objectiveIndex,newV),rank(c.context,objectiveIndex,newV)]);
 const variants={baseline:base.slice(0,8),split:fuseObjectiveMatches(oldUser.slice(0,20),oldContext.slice(0,20),8),metadata:newMixed.slice(0,8),wider:base.slice(0,20),combined:fuseObjectiveMatches(newUser.slice(0,20),newContext.slice(0,20),20,text)};
 results.push({...c,text,boundary:objectiveSelectionBoundary(text),queryRanks:{user:newUser,context:newContext},variants,ms:Math.round(performance.now()-started)});
 console.log(c.id,JSON.stringify(Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,c.expected.length?v.findIndex(x=>c.expected.includes(x.id))+1:null]))));
}
const summary=Object.fromEntries(['baseline','split','metadata','wider','combined'].map(k=>[k,{positive:results.filter(c=>c.expected.length).length,top1:results.filter(c=>c.expected.includes(c.variants[k][0]?.id)).length,covered:results.filter(c=>c.expected.length&&c.variants[k].some(x=>c.expected.includes(x.id))).length}]));
await fs.writeFile(root+(live?'/retrieval-live.json':'/retrieval.json'),JSON.stringify({scope:'New synthetic development evaluation, not independent real-user accuracy. Context source is recorded by liveContext flag. Labels allow alternatives. No weight training. No fitting on these outputs.',liveContext:live,model:m,summary,results},null,2));
await fs.writeFile(root+'/embedding-cache.json',JSON.stringify(cache));console.log(JSON.stringify(summary));await embed.dispose();
