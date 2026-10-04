/**
 * Collect answers + metrics for VANILLA vs EXP_RAG vs MULTI_AGENT (medium/low composer thinking). No judging.
 *   EVAL_BASE=http://localhost:3011 EVAL_USER=... EVAL_PASS=... npx tsx scripts/collect-modes.ts [--only=t1-lookup]
 * Writes tmp/eval-multi-agent/{answers,blind,key}.json and metrics.md. Run against an isolated server only.
 * Copies render()/SSE parsing from compare-modes.ts (that script runs on import).
 */
import 'dotenv/config';
import fs from 'node:fs';
import {calcTurnCost} from '../src/data/models';

const BASE=process.env.EVAL_BASE||'http://localhost:3011';
const MODEL='gemini-3.7-flash';
const OUT=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'tmp/eval-multi-agent';
const arg=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const humanizeId=(id:string)=>{const t=id.replace(/[_-]+/g,' ').trim();return t.charAt(0).toUpperCase()+t.slice(1);};

const VARIANTS={
  VANILLA:{mode:'VANILLA',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'vanilla',contextBudget:270000,recentTurnsToKeep:100},
  EXP_RAG:{mode:'EXP_RAG',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'standard'},
  // The app default: Multi-Agent with the Composer thinking control left at medium.
  MULTI_AGENT:{mode:'MULTI_AGENT',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'standard'},
  MA_MEDIUM:{mode:'MULTI_AGENT',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'standard'},
  MA_LOW:{mode:'MULTI_AGENT',strategy:'BASELINE',thinkingLevel:'low',responseMode:'standard'},
  // Team turns (level ≥ 2) step the composer down one level: 'high' here means a medium-thinking composer.
  MA_COMPOSER_MEDIUM:{mode:'MULTI_AGENT',strategy:'BASELINE',thinkingLevel:'high',responseMode:'standard'},
} as const;
type Variant=keyof typeof VARIANTS;
const MA_LOW_ONLY=new Set(['t2-fit','t3-pathway','t4-company','t5-discovery','s4-change','m1-multi']);

const SCENARIOS:Array<{id:string;turns:string[]}>=[
  {id:'l0-concept',turns:['What does RPL mean?']},
  {id:'t1-lookup',turns:['How many UX designer jobs are in Perth?']},
  {id:'t2-fit',turns:["Am I suitable for UX designer jobs? I've been a cafe supervisor for 4 years and I taught myself Figma."]},
  {id:'t3-pathway',turns:['I want to move from hospitality into UX design. Give me the fastest realistic path.']},
  {id:'t4-company',turns:['What do I need to improve to get a product role at Canva?']},
  {id:'t5-discovery',turns:['Find teaching assistant jobs for me in Melbourne.']},
  {id:'t7-missing',turns:['What jobs suit me?']},
  {id:'s4-change',turns:["I'm 45, I've managed retail stores for 20 years and want to move into HR. What are my options?"]},
  {id:'s10-local',turns:['What TAFE courses in Geelong could help me become a disability support worker?']},
  {id:'m1-multi',turns:["I'm a registered nurse in Brisbane and I'm burnt out from shift work.",'What could I move into with regular business hours, and what would I need to study?']},
];

/** Plain-text view of a protocol response (copied from compare-modes.ts). */
const visible=(t:string)=>!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(t.trim());
function render(r:any):string{
  if(!r)return '(no answer)';
  const parts:string[]=[];
  const walk=(b:any)=>{if(!b||typeof b!=='object')return;
    if(Array.isArray(b.columns)&&b.columns.length&&Array.isArray(b.rows)){
      if(b.title)parts.push(b.title);
      for(const row of b.rows){const label=row.criteria||(row.id&&!/^(row|r|item)?[-_ ]?\d+$/i.test(row.id)?humanizeId(row.id):'');
        parts.push(`${label?label+' — ':''}${b.columns.map((c:any)=>`${c.label}: ${row.cells?.find((x:any)=>x.key===c.key)?.value??''}`).join(' | ')}`);}
      return;}
    for(const k of ['title','heading','text','body','label','value','description','summary']) if(typeof b[k]==='string'&&visible(b[k])&&!(k==='value'&&(b.title||b.text)))parts.push(b[k]);
    for(const k of ['items','rows','columns','blocks','children','steps','options','cells']) if(Array.isArray(b[k]))b[k].forEach((x:any)=>typeof x==='string'?parts.push(x):Array.isArray(x)?parts.push(x.join(' | ')):walk(x));};
  (r.content_blocks||[]).forEach(walk);
  const q=r.interaction;if(q?.question)parts.push(`[Question] ${q.question}${q.options?.length?' Options: '+q.options.map((o:any)=>o.label).join('; '):''}`);
  return parts.join('\n').replace(/\n{3,}/g,'\n\n');
}

let TOKEN='';
async function login(){
  const r=await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.EVAL_USER,password:process.env.EVAL_PASS})});
  if(!r.ok)throw new Error(`login ${r.status}`);TOKEN=(await r.json()).token;
}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function post(conversationId:string,v:Variant,message:string){
  const t0=Date.now();
  const res=await fetch(`${BASE}/api/conversations/${conversationId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({message,model:MODEL,...VARIANTS[v],userContext:{date:new Date().toISOString().slice(0,10),timezone:'Australia/Melbourne'},features:{graph:true,forecasts:true}}),signal:AbortSignal.timeout(240_000)});
  // Read the SSE stream incrementally so event arrival times are measured client-side.
  const events:Array<{ev:string;data:any;t:number}>=[];let buf='',ev='';
  const reader=res.body!.getReader();const dec=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});
    let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).replace(/\r$/,'');buf=buf.slice(i+1);
      if(line.startsWith('event:'))ev=line.slice(6).trim();
      else if(line.startsWith('data:')){let d:any;try{d=JSON.parse(line.slice(5));}catch{d=line.slice(5);}events.push({ev,data:d,t:Date.now()-t0});}}}
  return {status:res.status,t0,events,endMs:Date.now()-t0};
}

async function turn(conversationId:string,v:Variant,message:string){
  let r=await post(conversationId,v,message).catch(e=>({status:0,t0:Date.now(),events:[{ev:'error',data:{error:String(e)},t:0}],endMs:0}));
  // 429: wait out the rate limit (not a re-run, the request was rejected). Transport/5xx: one retry.
  for(let k=0;r.status===429&&k<5;k++){await sleep(20_000);r=await post(conversationId,v,message);}
  let retried=false;
  if(r.status===0||r.status>=500){retried=true;await sleep(5000);r=await post(conversationId,v,message).catch(e=>({status:0,t0:Date.now(),events:[{ev:'error',data:{error:String(e)},t:0}],endMs:0}));}
  let structured:any=null,usage:any=null,timeline:any=null,error:any=null,accepted:boolean|null=null,doneMs:number|null=null;
  const orch:any[]=[];
  for(const {ev,data:d,t} of r.events){
    if(ev==='structured'||ev==='protocol_response')structured=d;
    else if(ev==='usage'){usage=d.usage;timeline=d.timeline;}
    else if(ev==='validation')accepted=d.protocolAccepted??accepted;
    else if(ev==='error'||ev==='protocol_validation_error')error=d.error||d.message||d.errorCode||ev;
    else if(ev==='done')doneMs=t;
    else if(ev==='orchestration')orch.push({...d,clientMs:t});
  }
  const u=usage||{};
  const mainCost=calcTurnCost(MODEL,{inputTokens:u.inputTokens,outputTokens:u.outputTokens,cachedTokens:u.cachedTokens,uncachedInputTokens:u.uncachedInputTokens??((u.inputTokens||0)-(u.cachedTokens||0)),thinkingTokens:u.thinkingTokens})||0;
  const auxCost=Number(u.auxiliaryCostUsd)||0;
  const tl=timeline||{};
  let orchestration:any=null;
  if(orch.length){
    const plan=orch.find(e=>e.type==='PLAN_CREATED')?.plan;
    const started=new Map(orch.filter(e=>e.type==='AGENT_STARTED').map(e=>[e.agentId,e]));
    const agents=orch.filter(e=>e.type==='AGENT_COMPLETED'||e.type==='AGENT_FAILED').map(e=>{const s=started.get(e.agentId);return {
      id:e.agentId,agent:e.agent,status:e.result?.status,execution:e.result?.execution,summary:e.result?.summary,error:e.result?.error||null,
      startMs:s?s.at-r.t0:null,endMs:e.at-r.t0,durationMs:e.result?.metrics?.durationMs??null,costUsd:e.result?.metrics?.costUsd??0,
      tokens:{input:e.result?.metrics?.inputTokens||0,cached:e.result?.metrics?.cachedTokens||0,output:e.result?.metrics?.outputTokens||0,thinking:e.result?.metrics?.thinkingTokens||0},
      confidence:e.result?.confidence,missingData:e.result?.missingData,warnings:e.result?.warnings};});
    const merge=orch.find(e=>e.type==='MERGE_COMPLETED');const done=orch.find(e=>e.type==='RESPONSE_COMPLETED');
    const rss=orch.find(e=>e.type==='RESPONSE_STREAM_STARTED');
    orchestration={level:plan?.complexityLevel??null,domains:plan?.domains,understood:plan?.understood,visible:plan?.visible,classifier:plan?.classifier,
      planned:plan?.agents?.map((a:any)=>({id:a.id,type:a.type,dependsOn:a.dependsOn,execution:a.execution})),agents,
      merge:merge?.merge??null,nextActions:merge?.nextActions??done?.record?.nextActions??[],state:done?.record?.state??null,recordMetrics:done?.record?.metrics??null,
      planMs:orch.find(e=>e.type==='PLAN_CREATED')?(orch.find(e=>e.type==='PLAN_CREATED').at-r.t0):null,
      responseStreamStartedMs:rss?rss.at-r.t0:null,responseStreamStartedClientMs:rss?.clientMs??null,
      events:orch.map(e=>({type:e.type,agent:e.agent,ms:e.at-r.t0}))};
  }
  return {answer:render(structured),raw:structured,status:r.status,retried,accepted:error?false:accepted??!!structured,error,
    wallMs:doneMs??r.endMs,firstDeltaMs:r.events.find(e=>e.ev==='delta')?.t??null,
    timeline:{pre:tl.preProviderLatencyMs??null,ttft:tl.providerTtftMs??null,gen:tl.providerGenerationDurationMs??null},
    usage:{input:u.inputTokens||0,cached:u.cachedTokens||0,output:u.outputTokens||0,thinking:u.thinkingTokens||0},
    mainCost,auxCost,totalCost:mainCost+auxCost,orchestration};
}

const only=arg('only')?.split(',');
const scenarios=SCENARIOS.filter(s=>!only||only.includes(s.id));
// --variants=MA_MEDIUM re-runs only those variants (e.g. after a MULTI_AGENT change); default is the full comparison.
const variantsFor=(id:string):Variant[]=>arg('variants')?arg('variants')!.split(',') as Variant[]:['VANILLA','EXP_RAG','MA_MEDIUM',...(MA_LOW_ONLY.has(id)?['MA_LOW' as Variant]:[])];
await login();
fs.mkdirSync(OUT,{recursive:true});
const rows:any[]=[];
async function runScenario(s:typeof SCENARIOS[number]){
  await Promise.all(variantsFor(s.id).map(async v=>{
    const cid=`eval-ma-${v.toLowerCase()}-${s.id}-${Date.now().toString(36)}`;
    for(let t=0;t<s.turns.length;t++){
      const r=await turn(cid,v,s.turns[t]);
      rows.push({scenario:s.id,turn:t+1,variant:v,conversationId:cid,priorUserTurns:s.turns.slice(0,t),user:s.turns[t],...r});
      console.log(`${s.id}#${t+1} ${v.padEnd(9)} status ${r.status} ok ${r.accepted} ${r.wallMs}ms $${r.totalCost.toFixed(5)}${r.orchestration?` L${r.orchestration.level} ${r.orchestration.agents.map((a:any)=>a.agent.replace('_SPECIALIST','')+':'+a.status).join(',')}`:''}${r.error?' ERR '+r.error:''}`);
      fs.writeFileSync(`${OUT}/answers.json`,JSON.stringify({generatedAt:new Date().toISOString(),model:MODEL,rows},null,1));
    }
  }));
}
for(let i=0;i<scenarios.length;i+=2)await Promise.all(scenarios.slice(i,i+2).map(runScenario)); // ≤8 parallel requests vs 20/min limit

rows.sort((a,b)=>SCENARIOS.findIndex(s=>s.id===a.scenario)-SCENARIOS.findIndex(s=>s.id===b.scenario)||a.turn-b.turn||a.variant.localeCompare(b.variant));
fs.writeFileSync(`${OUT}/answers.json`,JSON.stringify({generatedAt:new Date().toISOString(),model:MODEL,rows},null,1));

// Blind file: seeded shuffle per turn (mulberry32 seeded by turn id).
const seedOf=(s:string)=>[...s].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const rng=(a:number)=>()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
const blind:any[]=[],key:any={};
const turnIds=[...new Set(rows.map(r=>`${r.scenario}#${r.turn}`))];
for(const id of turnIds){
  const rs=rows.filter(r=>`${r.scenario}#${r.turn}`===id);const rand=rng(seedOf(id+'|ma-eval-2026'));
  const order=[...rs];for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const labels=['X','Y','Z','W'];key[id]={};const answers:any={};
  order.forEach((r,i)=>{key[id][labels[i]]=r.variant;answers[labels[i]]=r.answer.length>5000?r.answer.slice(0,5000)+' …[truncated]':r.answer;});
  blind.push({id,scenario:rs[0].scenario,priorUserTurns:rs[0].priorUserTurns,user:rs[0].user,answers});
}
fs.writeFileSync(`${OUT}/blind.json`,JSON.stringify(blind,null,1));
fs.writeFileSync(`${OUT}/key.json`,JSON.stringify(key,null,1));

// metrics.md
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const med=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);if(!s.length)return 0;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const L:string[]=[`# MULTI_AGENT eval — metrics`,``,`Generated ${new Date().toISOString()} · model ${MODEL} · isolated server ${BASE}. Wall = request start → \`done\` (client-side). Answer start = first \`delta\` (VANILLA/EXP_RAG) or RESPONSE_STREAM_STARTED (MA, server clock).`,``,
  `| Variant | Turns | Accepted | Wall median ms | Wall mean ms | First delta median ms | MA answer-start median ms | Mean main $ | Mean aux $ | Mean total $/turn | Mean in/cached/out/think tok |`,`|---|---|---|---|---|---|---|---|---|---|---|`];
for(const v of Object.keys(VARIANTS) as Variant[]){const rs=rows.filter(r=>r.variant===v);if(!rs.length)continue;
  const rss=rs.map(r=>r.orchestration?.responseStreamStartedMs).filter((x:any)=>x!=null);
  L.push(`| ${v} | ${rs.length} | ${rs.filter(r=>r.accepted).length}/${rs.length} | ${Math.round(med(rs.map(r=>r.wallMs)))} | ${Math.round(avg(rs.map(r=>r.wallMs)))} | ${Math.round(med(rs.map(r=>r.firstDeltaMs).filter((x:any)=>x!=null)))} | ${rss.length?Math.round(med(rss)):'—'} | ${avg(rs.map(r=>r.mainCost)).toFixed(5)} | ${avg(rs.map(r=>r.auxCost)).toFixed(5)} | ${avg(rs.map(r=>r.totalCost)).toFixed(5)} | ${['input','cached','output','thinking'].map(k=>Math.round(avg(rs.map(r=>r.usage[k])))).join('/')} |`);}
// Same-scenario subset for the MA_LOW comparison.
const sub=rows.filter(r=>MA_LOW_ONLY.has(r.scenario));
if(sub.some(r=>r.variant==='MA_LOW')){L.push('',`### MA_LOW subset (${[...MA_LOW_ONLY].join(', ')})`,'','| Variant | Turns | Wall median ms | Mean total $/turn |','|---|---|---|---|');
  for(const v of Object.keys(VARIANTS) as Variant[]){const rs=sub.filter(r=>r.variant===v);if(rs.length)L.push(`| ${v} | ${rs.length} | ${Math.round(med(rs.map(r=>r.wallMs)))} | ${avg(rs.map(r=>r.totalCost)).toFixed(5)} |`);}}
const failed=rows.filter(r=>!r.accepted||r.error||r.retried);
L.push('','## Failed / withheld / retried turns','',failed.length?failed.map(r=>`- ${r.scenario}#${r.turn} ${r.variant}: status ${r.status}, accepted ${r.accepted}, retried ${r.retried}, error ${r.error??'—'}`).join('\n'):'None.');
L.push('','## Per-turn wall ms','','| Turn | '+(Object.keys(VARIANTS)).join(' | ')+' |','|---|---|---|---|---|');
for(const id of turnIds)L.push(`| ${id} | ${(Object.keys(VARIANTS) as Variant[]).map(v=>{const r=rows.find(x=>`${x.scenario}#${x.turn}`===id&&x.variant===v);return r?`${r.wallMs} ($${r.totalCost.toFixed(4)})`:'—';}).join(' | ')} |`);
L.push('','## MULTI_AGENT agent timelines','','Times are ms from request start (server clock). Agents whose [start,end] intervals overlap ran in parallel.','');
for(const r of rows.filter(r=>r.orchestration)){const o=r.orchestration;
  const ag=o.agents as any[];const par=ag.filter(a=>ag.some(b=>b!==a&&a.startMs!=null&&b.startMs!=null&&a.startMs<b.endMs&&b.startMs<a.endMs)).map(a=>a.agent.replace('_SPECIALIST',''));
  L.push(`### ${r.scenario}#${r.turn} ${r.variant} — level ${o.level}, state ${o.state}, wall ${r.wallMs} ms, answer-start ${o.responseStreamStartedMs??'—'} ms, aux $${r.auxCost.toFixed(5)}`);
  L.push(`Understood: ${o.understood??'—'} · classifier ${o.classifier?.method??'—'} · parallel: ${par.length?[...new Set(par)].join(', '):'none'}`);
  if(ag.length){L.push('','| Agent | Exec | Status | Start | End | Duration | $ | Summary |','|---|---|---|---|---|---|---|---|');
    for(const a of ag)L.push(`| ${a.agent.replace('_SPECIALIST','')} | ${a.execution??''} | ${a.status}${a.error?` (${a.error.reason})`:''} | ${a.startMs??''} | ${a.endMs} | ${a.durationMs??''} | ${(a.costUsd||0).toFixed(5)} | ${String(a.summary??'').replace(/\|/g,'/').slice(0,140)} |`);}
  else L.push('','No specialists ran.');
  const m=o.merge;L.push('',`Merge: ${m?`confidence ${m.confidence}, conflicts ${m.conflicts?.length??0}, failed ${m.failedAgents?.join(',')||'none'}, facts ${m.counts?.facts}, findings ${m.counts?.findings}, dupes removed ${m.counts?.duplicatesRemoved}, missing ${m.missingData?.length??0}`:'—'} · next actions: ${(o.nextActions||[]).map((n:any)=>n.label||n.type).join('; ')||'none'}`,'');}
const spent=rows.reduce((n,r)=>n+r.totalCost,0);
L.push(`**Total Gemini cost for this collection: $${spent.toFixed(4)}** (${rows.length} turns; main + auxiliary).`);
fs.writeFileSync(`${OUT}/metrics.md`,L.join('\n'));
console.log(`\nrows ${rows.length}  total $${spent.toFixed(4)}  → ${OUT}/`);
