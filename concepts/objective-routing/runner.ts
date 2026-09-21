import {onRouterStatus,startWarmup,retrieveObjectives} from '../../src/services/MicroToolRouter';
import {objectiveSelectionBoundary} from '../../src/objectives/routing';
const cases=[
{id:'interests',text:'I have never really thought about which activities I enjoy. Could we work that out first?',expected:['DISCOVER_001']},
{id:'career-change',text:'I have been in retail for ten years and want to move into IT without throwing away all my experience.',expected:['CHANGE_001','CHANGE_002','CHANGE_005']},
{id:'course-learning',text:'The diploma brochure has unit names but I cannot picture what I would actually learn or practise.',expected:['STUDY_005']},
{id:'subject-entry',text:'Will I need chemistry and maths to be allowed into my target university course?',expected:['SCHOOL_003']},
{id:'skill-gap',text:'I can use Excel but I want to work as a data analyst. What abilities have I not developed yet?',expected:['SKILL_SIDE_001']},
{id:'scam',text:'A recruiter wants an upfront payment for equipment and my bank password before an interview. Can you check this offer?',expected:['EMP_SAFE_001','EMP_SAFE_002']},
{id:'offers',text:'I have two written employment offers. One pays more but the other has better training. Help me weigh them up.',expected:['JOB_DECIDE_004']},
{id:'caring',text:'I am still at school and look after my mum after class. How can I make study choices around caring for her?',expected:['SCHOOL_028']},
{id:'trade-routes',text:'Help me compare university, TAFE and being employed as an apprentice, including what I would give up in each.',expected:['PATH_012','SCHOOL_023']},
{id:'typos',text:'i dont no wht to study coz i dont no what im intrested in',expected:['DISCOVER_001','SCHOOL_004','GOAL_001']},
{id:'short',text:'interests',expected:['DISCOVER_001','PROFILE_001']},
{id:'long-tail',text:('I am writing down my history because I am trying to organise my thoughts. I have worked in shops, helped relatives, and considered many routes. ').repeat(25)+'My actual question is about a recruiter asking for a payment before I can get the job. I want to check if that opportunity is a scam.',expected:['EMP_SAFE_001','EMP_SAFE_002']},
{id:'thanks',text:'Thanks!',expected:[]},
{id:'stop',text:'Stop suggesting tools',expected:[]},
{id:'recipe',text:'How do I bake sourdough bread at home?',expected:[]},
{id:'ambiguous',text:'that one please',expected:[]},
];
const status=document.querySelector('#status')!,out=document.querySelector('#results')!;
document.querySelector<HTMLButtonElement>('#run')!.onclick=async function(this:HTMLButtonElement){
 this.disabled=true;const rows:any[]=[];status.textContent='Preparing BGE…';
 try{
 await new Promise<void>((resolve,reject)=>{let off=()=>{};const timer=setTimeout(()=>{off();reject(Error('BGE preparation timed out'));},125000);off=onRouterStatus(s=>{if(s==='ready'){clearTimeout(timer);queueMicrotask(()=>{off();resolve();});}if(s==='unavailable'){clearTimeout(timer);queueMicrotask(()=>{off();reject(Error('BGE unavailable'));});}});startWarmup();});
 for(const t of cases){status.textContent='Checking '+t.id;const start=performance.now();const boundary=objectiveSelectionBoundary(t.text);const candidates=boundary?[]:await retrieveObjectives(t.text);rows.push({...t,candidates,ms:Math.round(performance.now()-start),boundary,top1:t.expected.includes(candidates[0]?.id),top5:t.expected.some(id=>candidates.slice(0,5).some(c=>c.id===id)),top20:t.expected.some(id=>candidates.some(c=>c.id===id)),note:t.expected.length?'Retrieval only':'No objective should run; Gemini must reject irrelevant/ambiguous shortlists.'});out.textContent=JSON.stringify(rows,null,2);}
 status.textContent=`Complete: ${rows.filter(x=>x.expected.length&&x.top1).length}/${rows.filter(x=>x.expected.length).length} relevant top-1; ${rows.filter(x=>x.expected.length&&x.top5).length}/${rows.filter(x=>x.expected.length).length} relevant top-5; ${rows.filter(x=>x.expected.length&&x.top20).length}/${rows.filter(x=>x.expected.length).length} relevant top-20. No-action requires selector validation.`;
 }catch(e){status.textContent=String(e);}finally{this.disabled=false;}
};
