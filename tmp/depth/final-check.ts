import dotenv from 'dotenv';dotenv.config({quiet:true});
import fs from 'node:fs';
import {validateProtocol} from '../../src/protocol/validator';
import {responseToReadableText} from '../../src/ux/responsePresentation';
import {learningProfiles} from '../../src/routing/learningDepth';
const cases=[
 ['records','SKILL_001','skill','@Oala What does maintaining accurate customer records mean? I have only typed lists before.'],
 ['communication','SKILL_009','skill','@Oala Help me understand active listening and how to learn it for customer service. I know little about it.'],
 ['course','COURSE_005','course','@Oala Help me understand these units for office work. Fictional excerpt for this exercise: Unit A, Data Accuracy, compulsory: clean duplicates, standardise dates, check totals. Assessment: cleaned dataset and explanation of checks. Unit B, Reporting, elective: pivot table summaries and explanation of trends and limitations. No workload or prerequisites supplied.'],
 ['comparison','COURSE_002','comparison','@Oala Compare these fictional courses for learning customer service. A: role-play with tutor feedback and assessed complaint-handling exercise. B: lectures and multiple-choice quiz on service terms. I am new to customer service. Only use those facts, and help me understand the difference.'],
 ['requirements','COURSE_010','requirements','@Oala Explain this fictional entry requirement and whether I meet it: applicants need a portfolio with two examples of basic spreadsheet work and an explanation of checks. I have one shopping list and no explanation yet.'],
 ['cost','COURSE_011','cost','@Oala Help me understand this fictional course quote for planning: four units at 1000 Australian dollars each, plus 200 dollars total materials. No other fee or funding information is available. I am unfamiliar with course fees.'],
 ['role','JOB_003','role','@Oala What would handling a customer support inbox involve? I have never worked in customer support. Explain the tasks so I can picture the work.'],
 ['skills-map','SKILL_004','skill_map','@Oala Help me understand which skills from my stated tasks might relate to office reception. I have checked stock counts, explained returns to customers and written shift handover notes. I have not used booking software.'],
 ['plan','CAREER_005','plan','@Oala I want to explore changing from retail into office reception. My actual tasks are checking stock counts and writing shift notes. I can spend two hours per week exploring. Help me understand a practical learning plan before choosing a course.'],
 ['market','TREND_001','market','@Oala Explain how to read job advertisement trends before choosing training. I do not understand why more ads might not mean a guaranteed job. We have no current market dataset.'],
 ['organisation','COMP_002','organisation','@Oala Explain how roles connect in this fictional small business: online orders go to an order clerk; warehouse staff pack them; customer service handles delivery questions. I want to understand the tasks and skills before considering work like this.'],
 ['opportunity','APP_001','opportunity','@Oala Help me understand an apprenticeship as a way to learn, compared with only attending classes. I do not know how work and training connect. There is no specific employer or offer yet.'],
 ['evidence','RPL_001','evidence','@Oala Help me understand how evidence of prior learning works. I have customer complaint emails I drafted at work, but no qualification. Explain what they might demonstrate and what they cannot establish on their own.'],
 ['navigation','CORE_003','navigation','@Oala I am exploring customer service and administration as two possible learning directions. Help me understand what sits underneath each area so I can choose what to explore next.'],
 ['ordinary-chat','','skill','Explain prioritising tasks to someone who has never worked in an office. I want to understand how to do it, not just what the word means.'],
 ['brief','','brief','In exactly one sentence, explain what an elective is. No follow-up question.'],
 ['closure','','closure','Thanks, that is all for now.'],
 ['unknown','','unknown','Can you explain that thing?'],
] as const;
const login=await(await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.ADMIN_USERNAME||'yuzeeadmin',password:process.env.ADMIN_PASSWORD||'yuzeeadmin@2026'})})).json();
if(!login.token)throw Error('Local login failed');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.token};
const results:any[]=[];
function save(){fs.writeFileSync('../outputs/Structured-Teaching-Final-Checks.json',JSON.stringify(results,null,2));}
async function run(c:readonly string[]){
 const [id,toolId,profile,message]=c;
 try{
 const conv=await(await fetch('http://127.0.0.1:3000/api/conversations',{method:'POST',headers,body:JSON.stringify({title:'Teaching depth - '+id+' (synthetic)',model:'gemini-3.7-flash',mode:'AUTO',responseMode:'standard',thinkingLevel:'adaptive'})})).json();
 const response=await fetch(`http://127.0.0.1:3000/api/conversations/${conv.id}/messages`,{method:'POST',headers,body:JSON.stringify({message,model:'gemini-3.7-flash',mode:'AUTO',useMultiTurn:true,useStructuredOutput:true,thinkingLevel:'adaptive',maxOutputTokens:12000,...(toolId?{microToolSelection:{status:'selected',toolId,score:.7,margin:.2,reason:'clear-semantic-match',version:'minilm-guarded-v1'}}:{})}),signal:AbortSignal.timeout(60000)});
 const raw=await response.text();const events=raw.split('\n\n').flatMap(c=>{const kind=c.match(/^event: (.+)$/m)?.[1],data=c.match(/^data: (.+)$/m)?.[1];try{return kind&&data?[{kind,data:JSON.parse(data)}]:[];}catch{return [];}});
 const output=events.find(e=>e.kind==='structured')?.data;
 const text=output?responseToReadableText(output):'';
 const titles=(output?.content_blocks||[]).map((b:any)=>b.title).filter(Boolean);
 const expected=learningProfiles[profile as keyof typeof learningProfiles]||[];
 const missingSections=expected.filter(([title])=>!titles.some((actual:string)=>actual.toLowerCase().includes(title.toLowerCase()))).map(([title])=>title);
 const result={id,toolId,profile,message,conversationId:conv.id,accepted:validateProtocol(output).protocolAccepted,routing:events.find(e=>e.kind==='start')?.data.routing,words:text.split(/\s+/).length,titles,missingSections,interaction:output?.interaction?.kind,text,output,progress:events.filter(e=>e.kind==='status').map(e=>e.data.phase),usage:events.find(e=>e.kind==='usage')?.data,errors:events.filter(e=>['error','protocol_validation_error'].includes(e.kind))};
 results.push(result);save();console.log(JSON.stringify({...result,message:undefined,text:undefined,output:undefined}));
 }catch(error){results.push({id,error:String(error)});save();console.log(id+' failed: '+String(error));}
}
// Two independent synthetic conversations at a time; no personal user data.
for(let i=0;i<cases.length;i+=2)await Promise.all(cases.slice(i,i+2).map(run));
if(results.some(r=>!r.accepted||r.errors?.length))process.exitCode=1;
