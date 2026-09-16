import fs from 'node:fs/promises';
import {pipeline,env} from '@huggingface/transformers';
import {microTools,eligibleTools,indexText,chooseRoute,routingSkipReason,abstain,MODEL_ID} from '../src/routing/policy';
env.allowLocalModels=false;env.cacheDir='./data/minilm-cache';
const cases:[string,string,string[]][]=[
 ['course-comparison','Please contrast the nursing diploma and nursing bachelor for part-time study.',['COURSE_002','CORE_006']],
 ['course-units','Which subjects would I take during the first year of this degree?',['COURSE_004','COURSE_005']],
 ['course-entry','What prerequisites must I meet before applying for this course?',['COURSE_010']],
 ['course-fees','How much are tuition fees and what financial support might cover them?',['COURSE_011']],
 ['career-growth','Is cybersecurity worth entering as a career over the next few years?',['JOB_006','CAREER_001','TREND_001']],
 ['job-tasks','What would a dental assistant actually do during a normal working day?',['JOB_003','CAREER_001']],
 ['transferable','Which abilities from managing a warehouse could transfer into office administration?',['SKILL_004','CAREER_005']],
 ['skill-gap','I want an analyst job; how can I work out which skills I still need?',['SKILL_003','CAND_003']],
 ['learn-skill','How can I start learning spreadsheet formulas for my admin work?',['SKILL_009']],
 ['rpl','Can my work experience count toward a qualification through recognition of prior learning?',['RPL_001']],
 ['apprenticeship','Help me explore an electrical apprenticeship where I earn while training.',['APP_001']],
 ['technology','Can you explain what Kubernetes does and where it is used?',['TECH_001','CORE_007']],
 ['company-training','Should my cafe train existing staff or recruit someone with the skills we need?',['COMP_010']],
 ['evidence','What sources support that claim and how recent is the evidence?',['CORE_010']],
 ['automation','Which everyday tasks in bookkeeping might be affected by AI automation?',['JOB_008','IND_010']],
 ['skill-proof','How can I demonstrate my spreadsheet ability to an employer?',['PROVE_001']],
 ['salary','What are the recent salary trends for nurses in Melbourne?',['TREND_007']],
 ['greeting','Hello',[]],
 ['weather','Will it rain in Melbourne tomorrow morning?',[]],
 ['recipe','Give me a recipe for chocolate cake.',[]],
 ['politics','Who won the national election last week?',[]],
 ['growing-garden','Is this a growing field of corn?',[]],
 ['negation','Do not compare courses. I just want to pause.',[]],
 ['short-followup','Tell me more',[]],
 ['structured-choice','Focus on a one-unit-per-trimester pathway',[]],
 ['correction','Actually I have six hours available, not twelve.',[]],
 ['parent-choice','My daughter likes design but I prefer nursing. Help us discuss her choice.',[]],
 ['uncertain','I am 15 and have no idea what career I want.',[]],
 ['multi-intent','What are the course fees? Can you also compare jobs and check my eligibility?',[]],
 ['non-english','Quiero cambiar de carrera y estudiar enfermería.',[]]
];
const started=performance.now();
const embed=await pipeline('feature-extraction',MODEL_ID,{dtype:'q8',device:'cpu'});
console.log('MiniLM loaded');
async function encode(texts:string[]){
 const result:Float32Array[]=[];
 for(let i=0;i<texts.length;i+=12){
  const out=await embed(texts.slice(i,i+12),{pooling:'mean',normalize:true});
  const dim=out.dims.at(-1)!;
  for(let j=0;j<Math.min(12,texts.length-i);j++)result.push((out.data as Float32Array).slice(j*dim,(j+1)*dim));
 }
 return result;
}
const oldVec=await encode(microTools.map(t=>`${t.name}. ${t.use_when} ${t.purpose}`));
const newVec=await encode(eligibleTools.map(indexText));
const coldMs=Math.round(performance.now()-started);
const records:any[]=[];
const cosine=(a:Float32Array,b:Float32Array)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const kw=[/growing field/i,/worth getting into/i,/is\s+\w+\s+(a\s+)?(growing|good|worth(while)?)\s+(field|career|industry|profession)/i,/(career|field|profession|industry)\s+(in\s+demand|outlook|prospects|growing|worth)/i,/should\s+I\s+(get into|enter|pursue|go into)\s+\w/i,/job\s+(market|outlook|prospects|demand)\s+for/i];
for(const [id,text,expected] of cases){
 const t=performance.now(),[q]=await encode([text]);
 const latencyMs=Math.round(performance.now()-t);
 const oldRank=microTools.map((t,i)=>({toolId:t.id,score:cosine(q,oldVec[i])})).sort((a,b)=>b.score-a.score);
 const old=kw.some(p=>p.test(text))?{toolId:'JOB_006',score:0.85}:oldRank[0];
 const upstream=old.score>=0.28?old.toolId:null;
 const rank=eligibleTools.map((t,i)=>({toolId:t.id,score:cosine(q,newVec[i])})).sort((a,b)=>b.score-a.score);
 const skip=routingSkipReason(text,id==='structured-choice');
 const guarded=skip?abstain(skip):chooseRoute(rank);
 const selected=guarded.status==='selected'?guarded.toolId:null;
 records.push({id,text,expected,latencyMs,upstream,upstreamScore:old.score,guarded,candidates:rank.slice(0,3),upstreamWrong:!!upstream&&!expected.includes(upstream),guardedWrong:!!selected&&!expected.includes(selected),guardedCorrect:!!selected&&expected.includes(selected)});
 console.log(JSON.stringify({id,upstream,guarded:selected||guarded.reason,top:rank[0],margin:rank[0].score-rank[1].score}));
}
const summarize=(name:'upstream'|'guarded')=>{
 const selected=records.filter(r=>name==='upstream'?r.upstream:r.guarded.status==='selected');
 const wrong=records.filter(r=>r[name+'Wrong']);
 return {selected:selected.length,wrong:wrong.length,correct:selected.length-wrong.length,abstained:records.length-selected.length};
};
await fs.mkdir('../outputs',{recursive:true});
await fs.writeFile('../outputs/MiniLM-Routing-Evaluation.json',JSON.stringify({model:MODEL_ID,dtype:'q8',runtime:'Node CPU',synthetic:true,upstreamCommit:'5720c5c',coldModelAndTwoIndexesMs:coldMs,upstream:summarize('upstream'),guarded:summarize('guarded'),records},null,2));
console.log(JSON.stringify({coldMs,upstream:summarize('upstream'),guarded:summarize('guarded')}));
