/**
 * EXP-RAG vs Vanilla (AI Studio) comparison on the live server: same model and thinking level, same
 * scenarios, blind pairwise judging. Prints a compact summary; full transcripts go to the report file.
 *   EVAL_BASE=http://localhost:3011 EVAL_TOKEN=... npm run eval:modes [-- --variants=bge,gemini] [--only=s1,s5] [--reuse-vanilla=old.json] [--report=path]
 * Uses an isolated server (no DATABASE_URL) so evaluation chats never reach shared storage.
 */
import 'dotenv/config';
import fs from 'node:fs';
import {GoogleGenAI} from '@google/genai';
import {calcTurnCost} from '../src/data/models';
const humanizeId=(id:string)=>{const t=id.replace(/[_-]+/g,' ').trim();return t.charAt(0).toUpperCase()+t.slice(1);};

const BASE=process.env.EVAL_BASE||'http://localhost:3011',TOKEN=process.env.EVAL_TOKEN||'';
const MODEL='gemini-3.7-flash',JUDGE='gemini-3.7-flash';
const arg=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const REPORT=arg('report')||'tmp/mode-comparison.json';
const MODES={
  VANILLA:{mode:'VANILLA',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'vanilla',contextBudget:270000,recentTurnsToKeep:100},
  EXP_RAG:{mode:'EXP_RAG',strategy:'BASELINE',thinkingLevel:'medium',responseMode:'standard'},
} as const;
type Mode=keyof typeof MODES;

const SCENARIOS:Array<{id:string;focus:string;turns:string[]}>=[
  {id:'s1-explore',focus:'first turn, undecided school leaver',turns:["I'm 17 and finishing year 12 in Melbourne. I like drawing and computers but I'm not sure what to study."]},
  {id:'s2-compare',focus:'qualification comparison',turns:['What is the difference between a Certificate IV in Cyber Security and a Bachelor of Cyber Security?']},
  {id:'s3-cost',focus:'fees and funding; must not invent prices',turns:['How much does a Diploma of Nursing cost in Victoria and can I get funding?']},
  {id:'s4-change',focus:'mid-career change using experience',turns:["I'm 45, I've managed retail stores for 20 years and want to move into HR. What are my options?"]},
  {id:'s5-outlook',focus:'job outlook; forecast honesty',turns:['Will there be more jobs for electricians in Victoria in the next few years?']},
  {id:'s6-support',focus:'anxiety and disability, supportive accuracy',turns:["I have dyslexia and I'm worried I can't handle uni. Is TAFE easier?"]},
  {id:'s7-offtopic',focus:'off-topic request',turns:['Can you write me a poem about cats?']},
  {id:'s8-action',focus:'service request beyond capability',turns:['Find me a carpentry apprenticeship near Geelong and apply for it for me.']},
  {id:'m1-memory',focus:'multi-turn continuity and constraint recall',turns:[
    "I'm Priya, a registered nurse in Brisbane, and I'm burnt out from shift work.",
    "I'd like regular business hours, ideally still in healthcare. I have a Bachelor of Nursing.",
    'What about health informatics or clinical education?',
    'Which of those needs less extra study? I can only study part-time and my budget is about $5000.',
    'Remind me what constraints I gave you, and which option fits me best?']},
  {id:'s9-rpl',focus:'recognition of experience without a degree',turns:["I've worked as a self-taught web developer for 6 years but have no qualifications. Can my experience be recognised?"]},
  {id:'s10-local',focus:'local course lookup from warehouse data',turns:['What TAFE courses in Geelong could help me become a disability support worker?']},
  {id:'s11-postgrad',focus:'degree vs postgraduate decision with prior degree',turns:['I already have an engineering degree. Is a Bachelor of Data Science worth it, or should I do a Graduate Certificate instead?']},
  {id:'m2-short',focus:'short reply to a pending question',turns:['I want to become a vet nurse but I have no experience with animals.','yes']},
];

/** Plain-text view of a protocol response (what the user reads). Machine ids (snake_case values) are not shown to users. */
const visible=(t:string)=>!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(t.trim());
export const cleanAnswer=(text:string)=>text.split('\n').filter(visible).join('\n');
function render(r:any):string{
  if(!r)return '(no answer)';
  const parts:string[]=[];
  const walk=(b:any)=>{if(!b||typeof b!=='object')return;
    // Tables/comparisons as the UI shows them: one line per row, labelled by humanised row id, cells by column label.
    if(Array.isArray(b.columns)&&b.columns.length&&Array.isArray(b.rows)){
      if(b.title)parts.push(b.title);
      for(const row of b.rows){const label=row.criteria||(row.id&&!/^(row|r|item)?[-_ ]?\d+$/i.test(row.id)?humanizeId(row.id):'');
        parts.push(`${label?label+' — ':''}${b.columns.map((c:any)=>`${c.label}: ${row.cells?.find((x:any)=>x.key===c.key)?.value??''}`).join(' | ')}`);}
      return;}
    // `value` is a machine value on list items/options; it is visible only on key-value rows (no title/text).
    for(const k of ['title','heading','text','body','label','value','description','summary']) if(typeof b[k]==='string'&&visible(b[k])&&!(k==='value'&&(b.title||b.text)))parts.push(b[k]);
    for(const k of ['items','rows','columns','blocks','children','steps','options','cells']) if(Array.isArray(b[k]))b[k].forEach((x:any)=>typeof x==='string'?parts.push(x):Array.isArray(x)?parts.push(x.join(' | ')):walk(x));};
  (r.content_blocks||[]).forEach(walk);
  const q=r.interaction;if(q?.question)parts.push(`[Question] ${q.question}${q.options?.length?' Options: '+q.options.map((o:any)=>o.label).join('; '):''}`);
  return parts.join('\n').replace(/\n{3,}/g,'\n\n');
}


type Run=Awaited<ReturnType<typeof turn>>;
async function turn(conversationId:string,mode:Mode,message:string,embedder?:string){
  // The server rate-limits chat to 20 requests/min/IP; a 429 is waited out, never scored as an empty answer.
  let res:Response,t0=Date.now();
  for(let attempt=0;;attempt++){
    t0=Date.now();
    res=await fetch(`${BASE}/api/conversations/${conversationId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},
      body:JSON.stringify({message,model:MODEL,...MODES[mode],userContext:{date:new Date().toISOString().slice(0,10),timezone:'Australia/Melbourne'},features:{graph:true,forecasts:true,...(embedder?{ragEmbedder:embedder}:{})}}),signal:AbortSignal.timeout(180_000)});
    if(res.status!==429||attempt>=5)break;
    await res.text();await new Promise(r=>setTimeout(r,20_000));
  }
  const text=await res.text();let ev='',structured:any=null,usage:any=null,error:any=null,accepted:boolean|null=null,timeline:any=null;
  for(const line of text.split('\n')){
    if(line.startsWith('event:'))ev=line.slice(6).trim();
    else if(line.startsWith('data:')){let d:any;try{d=JSON.parse(line.slice(5));}catch{continue;}
      if(ev==='structured'||ev==='protocol_response')structured=d;
      else if(ev==='usage'){usage=d.usage;timeline=d.timeline;}
      else if(ev==='validation')accepted=d.protocolAccepted??accepted;
      else if(ev==='error'||ev==='protocol_validation_error')error=d.error||d.message||ev;}
  }
  // EXP-RAG trace: retrieved guidance modules, embedder actually used, retrieval latencies.
  const gi=text.indexOf('"guidance":{"tokens":');let modules:string[]|undefined;
  if(gi>=0){const m=text.slice(gi,gi+3000).match(/"modules":\[(.*?)\],"dropped"/);if(m)modules=[...m[1].matchAll(/"id":"([^"]+)"/g)].map(x=>x[1]);}
  const usedEmbedder=text.match(/"embedder":\{"provider":"(\w+)"/)?.[1];
  const rag=text.match(/"latencyMs":(\{"embed":[^}]*\})/)?.[1];
  const u=usage||{};const cost=calcTurnCost(MODEL,{inputTokens:u.inputTokens,outputTokens:u.outputTokens,cachedTokens:u.cachedTokens,uncachedInputTokens:(u.inputTokens||0)-(u.cachedTokens||0),thinkingTokens:u.thinkingTokens})||0;
  const tl=timeline||{};
  return {answer:render(structured),raw:structured,ms:Date.now()-t0,input:u.inputTokens||0,cached:u.cachedTokens||0,output:u.outputTokens||0,thinking:u.thinkingTokens||0,cost,
    accepted:error?false:accepted??!!structured,error,status:res.status,modules,embedder:usedEmbedder,
    pre:tl.preProviderLatencyMs??null,ttft:tl.providerTtftMs??null,gen:tl.providerGenerationDurationMs??null,ragMs:rag?JSON.parse(rag):null};
}
async function runScenario(s:typeof SCENARIOS[number],mode:Mode,embedder?:string){
  const id=`eval-${mode.toLowerCase()}-${embedder||'x'}-${s.id}-${Date.now().toString(36)}`;
  const turns:Array<Run&{user:string}>=[];
  for(const m of s.turns)turns.push({user:m,...await turn(id,mode,m,embedder)});
  return turns;
}

const judgeAi=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const RUBRIC=`You are a strict, impartial evaluator of an Australian career-guidance assistant (Oala). Today's date is ${new Date().toISOString().slice(0,10)}; dates before it are past, not invented. Compare two answers (A and B) to the same user turn.
Score each 1-5 on: relevance (answers what was actually asked), grounding (no invented prices, dates, statistics, providers or guarantees; states limits honestly), counselling (personalised, practical next step, at most one focused question, respectful tone), clarity (plain English, well organised, no padding), continuity (uses earlier conversation facts correctly; 5 if not applicable).
Oala's scope is education, training, careers, skills and work. For an unrelated request (poems, jokes, trivia, general tasks) the correct answer declines briefly and redirects without producing the unrelated content; producing it, even briefly, is a relevance and counselling failure. Length is not quality: penalise padding and repetition. Ignore formatting markup differences. Tables and comparisons are shown flattened, one line per row as 'Row — Column: value | Column: value'; judge their content, not that layout. A line starting [Question] is the interactive question shown below the answer.
Return JSON only: {"A":{"relevance":n,"grounding":n,"counselling":n,"clarity":n,"continuity":n},"B":{...},"winner":"A"|"B"|"tie","reason":"<=30 words naming the decisive difference"}`;
async function judge(history:string,user:string,a:string,b:string){
  const prompt=`${RUBRIC}\n\nEarlier conversation (user turns only):\n${history||'(none)'}\n\nUser turn:\n${user}\n\n=== Answer A ===\n${a.slice(0,3500)}\n\n=== Answer B ===\n${b.slice(0,3500)}`;
  for(let i=0;;i++){try{
    const r=await judgeAi.models.generateContent({model:JUDGE,contents:prompt,config:{responseMimeType:'application/json',temperature:0,thinkingConfig:{thinkingLevel:'low' as any}}});
    return {verdict:JSON.parse(r.text||'{}'),tokens:(r.usageMetadata?.promptTokenCount||0)+(r.usageMetadata?.candidatesTokenCount||0)+(r.usageMetadata?.thoughtsTokenCount||0)};
  }catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,2000));}}
}

// --variants=bge,gemini (default both) are each judged against the same Vanilla answers.
// --reuse-vanilla=report reuses saved Vanilla answers for scenarios whose turns match (EXP tuning does not change Vanilla).
const variants=(arg('variants')||'bge,gemini').split(',');
const only=arg('only')?.split(',');
const reuse:any=arg('reuse-vanilla')?JSON.parse(fs.readFileSync(arg('reuse-vanilla')!,'utf8')):null;
const reuseRows:any[]=reuse?(Array.isArray(reuse)?reuse:reuse.rows):[];
const scenarios=SCENARIOS.filter(s=>!only||only.includes(s.id));
const savedVanilla=(s:typeof SCENARIOS[number])=>{
  const rows=reuseRows.filter(r=>r.id.split('#')[0]===s.id).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  if(rows.length!==s.turns.length)return null;
  return rows.map((r:any)=>{const run=r.vanilla?.run||r.vanillaRun;return {...run,accepted:run.ok,answer:cleanAnswer(r.vanilla?.answer||r.answers.vanilla),raw:r.vanilla?.raw||r.raw?.vanilla,user:''};});
};
// --rejudge=report: re-render saved raw answers with the current renderer and judge again (no chat calls).
const rejudge:any=arg('rejudge')?JSON.parse(fs.readFileSync(arg('rejudge')!,'utf8')):null;
const results:any[]=[];
if(rejudge){
  const byScenario=new Map<string,any[]>();for(const r of rejudge.rows)byScenario.set(r.id.split('#')[0],[...(byScenario.get(r.id.split('#')[0])||[]),r]);
  for(const s of scenarios){const rs=(byScenario.get(s.id)||[]).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));if(rs.length!==s.turns.length)continue;
    const asRun=(x:any)=>({...x.run,accepted:x.run.ok,answer:render(x.raw),raw:x.raw});
    results.push({s,v:rs.map(r=>asRun(r.vanilla)),es:variants.map(v=>rs.map(r=>asRun(r.variants[v]))),vanillaReused:true});}
}
for(let i=0;!rejudge&&i<scenarios.length;i+=2){ // two scenarios at a time (server rate limit 20/min/IP)
  results.push(...await Promise.all(scenarios.slice(i,i+2).map(async s=>{
    const saved=savedVanilla(s);
    const [v,...es]=await Promise.all([saved?Promise.resolve(saved):runScenario(s,'VANILLA'),...variants.map(e=>runScenario(s,'EXP_RAG',e))]);
    return {s,v,es,vanillaReused:!!saved};
  })));
}
const KEYS=['relevance','grounding','counselling','clarity','continuity'];
const total=(x:any)=>x?KEYS.reduce((n,k)=>n+(Number(x[k])||0),0):0;
const pick=(r:any)=>({status:r.status,ms:r.ms,pre:r.pre,ttft:r.ttft,gen:r.gen,input:r.input,cached:r.cached,output:r.output,thinking:r.thinking,cost:r.cost,ok:r.accepted,error:r.error,modules:r.modules,embedder:r.embedder,ragMs:r.ragMs});
const rows:any[]=[];let judgeTokens=0;
await Promise.all(results.flatMap(({s,v,es,vanillaReused})=>s.turns.map(async(user:string,t:number)=>{
  const row:any={id:`${s.id}#${t+1}`,focus:s.focus,user,vanilla:{answer:v[t].answer,raw:v[t].raw,run:pick(v[t]),reused:vanillaReused},variants:{}};
  await Promise.all(variants.map(async(name,k)=>{
    // Judged twice with the answer order swapped: a win needs both orders to agree (else tie); scores are averaged.
    const e=es[k][t];const history=s.turns.slice(0,t).join('\n');
    const [first,second]=await Promise.all([judge(history,user,v[t].answer,e.answer),judge(history,user,e.answer,v[t].answer)]);
    judgeTokens+=first.tokens+second.tokens;
    const w1=first.verdict.winner==='tie'?'tie':first.verdict.winner==='A'?'VANILLA':'EXP';
    const w2=second.verdict.winner==='tie'?'tie':second.verdict.winner==='A'?'EXP':'VANILLA';
    const mean=(x:any,y:any)=>Object.fromEntries(KEYS.map(key=>[key,((Number(x?.[key])||0)+(Number(y?.[key])||0))/2]));
    const vS=mean(first.verdict.A,second.verdict.B),eS=mean(first.verdict.B,second.verdict.A);
    const winner=w1===w2?w1:'tie';
    row.variants[name]={answer:e.answer,raw:e.raw,run:pick(e),winner,orderVerdicts:[w1,w2],reason:winner===w1?first.verdict.reason:winner===w2?second.verdict.reason:`Split verdict (${w1} / ${w2}): ${first.verdict.reason}`,
      scores:{vanilla:{...vS,total:total(vS)},exp:{...eS,total:total(eS)}}};
  }));
  rows.push(row);
})));
rows.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync(REPORT,JSON.stringify({generatedAt:new Date().toISOString(),model:MODEL,judge:JUDGE,variants,rows,judgeTokens},null,1));

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const med=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:0;};
console.log(`turns ${rows.length}  vanilla reused for ${results.filter(r=>r.vanillaReused).length}/${results.length} scenarios`);
for(const name of variants){
  const vs=rows.map(r=>r.variants[name]);const n=(w:string)=>vs.filter((x:any)=>x.winner===w).length;
  console.log(`\n== EXP_RAG [${name}] vs VANILLA ==  embedder used: ${[...new Set(vs.map((x:any)=>x.run.embedder||'none'))].join(',')}`);
  for(const r of rows){const x=r.variants[name];if(x.winner!=='EXP')console.log(`  ${r.id.padEnd(14)} ${x.winner.padEnd(7)} ${x.scores.vanilla.total}/${x.scores.exp.total} ${String(x.reason).slice(0,120)}`);}
  console.log(`  wins EXP ${n('EXP')}  VANILLA ${n('VANILLA')}  tie ${n('tie')}`);
  console.log(`  score  ${KEYS.concat('total').map(k=>`${k} ${avg(vs.map((x:any)=>Number(x.scores.vanilla[k])||0)).toFixed(2)}→${avg(vs.map((x:any)=>Number(x.scores.exp[k])||0)).toFixed(2)}`).join('  ')}`);
  const V=rows.map(r=>r.vanilla.run),E=vs.map((x:any)=>x.run);
  console.log(`  cost $${avg(V.map(x=>x.cost)).toFixed(5)}→$${avg(E.map((x:any)=>x.cost)).toFixed(5)}/turn  latency median ${med(V.map(x=>x.ms))}→${med(E.map((x:any)=>x.ms))} ms  mean ${Math.round(avg(V.map(x=>x.ms)))}→${Math.round(avg(E.map((x:any)=>x.ms)))}`);
  console.log(`  pre-provider ${Math.round(avg(V.map(x=>x.pre||0)))}→${Math.round(avg(E.map((x:any)=>x.pre||0)))} ms  ttft ${Math.round(avg(V.map(x=>x.ttft||0)))}→${Math.round(avg(E.map((x:any)=>x.ttft||0)))}  gen ${Math.round(avg(V.map(x=>x.gen||0)))}→${Math.round(avg(E.map((x:any)=>x.gen||0)))}  out ${Math.round(avg(V.map(x=>x.output)))}→${Math.round(avg(E.map((x:any)=>x.output)))}  think ${Math.round(avg(V.map(x=>x.thinking)))}→${Math.round(avg(E.map((x:any)=>x.thinking)))}`);
}
console.log(`\njudge tokens ${judgeTokens}  report ${REPORT}`);
