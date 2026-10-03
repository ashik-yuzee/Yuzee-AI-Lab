/**
 * Offline evaluation of EXP-RAG guidance retrieval against tests/fixtures/exp-rag-guidance-eval.json.
 * Reports per-case recall of required modules, guidance tokens and module counts.
 *   npm run eval:exp-rag            current tuning
 *   npm run eval:exp-rag -- --grid  sweep dense thresholds
 *   add --provider gemini           evaluate Gemini embeddings (needs GEMINI_API_KEY)
 */
import fs from 'node:fs';
import 'dotenv/config';
import {detectTriggers,selectGuidance,warmGuidance,guidanceTuning} from '../src/rag/guidance';
import {guidanceQuery} from '../src/rag/pipeline';
import {embed,embedderAvailable,type EmbedProvider} from '../src/rag/embedder';
const provider:EmbedProvider=process.argv.includes('--provider')&&process.argv[process.argv.indexOf('--provider')+1]==='gemini'?'gemini':'bge';
const GUIDANCE_TUNING=guidanceTuning(provider);

const {cases}=JSON.parse(fs.readFileSync('tests/fixtures/exp-rag-guidance-eval.json','utf8'));
const chat=[{role:'user',content:'I am thinking about a career in construction',createdAt:Date.now()-60_000},{role:'assistant',content:JSON.stringify({schema_version:'1.3',current_mode:'A_CONVERSATION',response_intent:'EXPLORE_OPTIONS',content_blocks:[{type:'text',text:'Construction covers hands-on trades, site supervision and design roles.'}],interaction:{kind:'question',question:'What kind of work do you enjoy most?'}}),createdAt:Date.now()-30_000}];
const greeting=[{role:'user',content:'hi',createdAt:Date.now()-60_000},{role:'assistant',content:'{}',createdAt:Date.now()-59_000,telemetry:{usage:{isMock:true}}}];
await warmGuidance(provider);
const prepared=await Promise.all(cases.map(async(c:any)=>{
  const history=c.history==='chat'?chat:c.history==='greeting'?greeting:[];
  const query=guidanceQuery(c.message,history);
  const vectors=embedderAvailable(provider)?await embed(query===c.message?[query]:[c.message,query],'query',{provider}):[];
  const triggers=detectTriggers({message:c.message,history,activeInteraction:c.activeInteraction?{kind:c.activeInteraction}:null,warehouse:c.warehouse,workspace:c.workspace});
  return {c,query,vectors,triggers};
}));
async function run(tuning=GUIDANCE_TUNING,verbose=true){
  let hit=0,total=0,tokens=0,mods=0;const misses:string[]=[];
  for(const {c,query,vectors,triggers} of prepared){
    const sel=await selectGuidance(query,triggers,vectors,tuning,provider);
    const ids=new Set(sel.modules.map(m=>m.id));
    const missing=c.expect.filter((id:string)=>!ids.has(id));
    hit+=c.expect.length-missing.length;total+=c.expect.length;tokens+=sel.tokens;mods+=sel.modules.length;
    if(missing.length)misses.push(`${c.id}: missing ${missing.join(', ')}`);
    if(verbose)console.log(`${missing.length?'MISS':' ok '} ${c.id.padEnd(22)} ${String(sel.tokens).padStart(5)}t ${sel.trace.map(t=>t.reason==='trigger'?t.id+'*':`${t.id}(${t.lift})`).join(' ')}${missing.length?'  <- missing '+missing.join(','):''}`);
  }
  return {recall:hit/total,avgTokens:Math.round(tokens/prepared.length),avgModules:Math.round(mods/prepared.length*10)/10,misses};
}
if(process.argv.includes('--grid')){
  for(const minLift of (process.env.GRID_LIFT||"0.06,0.08,0.1,0.12,0.14,0.16,0.18,0.2").split(",").map(Number))for(const minLiftWithLexical of (process.env.GRID_LEX||"0.02,0.04,0.06,0.08,0.1,0.12").split(",").map(Number))for(const semanticMax of [3,4])for(const strongLift of [GUIDANCE_TUNING.strongLift]){
    const r=await run({...GUIDANCE_TUNING,minLift,minLiftWithLexical,semanticMax,strongLift},false);
    console.log(JSON.stringify({minLift,minLiftWithLexical,semanticMax,recall:Math.round(r.recall*1000)/1000,avgTokens:r.avgTokens,avgModules:r.avgModules}));
  }
}else{
  const r=await run();
  console.log(`\nrecall=${(r.recall*100).toFixed(1)}% avgGuidanceTokens=${r.avgTokens} avgModules=${r.avgModules} dense=${embedderAvailable(provider)} provider=${provider}`);
}
