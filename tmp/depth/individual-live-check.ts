import dotenv from 'dotenv';dotenv.config({quiet:true});
import fs from 'node:fs';
import {validateProtocol} from '../../src/protocol/validator';
import {responseToReadableText} from '../../src/ux/responsePresentation';
const cases=[
 ['course-units','COURSE_005','@Oala Explain this fictional course unit to a beginner choosing office training: Data Checking is compulsory. The supplied outcome is identifying duplicate rows and inconsistent dates. Assessment details, software and prerequisites are unavailable. Help me understand the work and what I can conclude from this excerpt.'],
 ['entry-unknown','COURSE_010','@Oala Check these fictional course entry rules against my information: a completed application and two work samples are required. I have completed the application and have one sample. My other evidence is unspecified. Explain my position clearly.'],
 ['conditional-cost','COURSE_011','@Oala Explain this fictional course quote: three units cost AUD 800 each and materials cost AUD 120 in total. My funding eligibility, other fees and payment schedule are unknown. Help me understand the supported subtotal and what remains to check.'],
 ['repeated-ads','COMP_006','@Oala Determine whether this fictional company has hard-to-fill roles: we have three identical copies of one advertisement from the same day and no other history or company statement. Explain what this evidence means and what would settle the question.'],
 ['curriculum-evidence','INST_004','@Oala Map this fictional curriculum excerpt to skills: Unit A is required and states interpret customer feedback. Unit B is an elective and states present findings visually. Practice and assessment information is missing. Explain the map and its limits for someone new to curriculum analysis.'],
 ['readiness-unknown','CAND_002','@Oala Assess my readiness for a fictional assistant role. Its published requirements are checking records and a completed safety induction. I say I have entered lists, but I have supplied no work sample or induction record. Explain what can be concluded and a practical next step.'],
 ['beginner-skill','SKILL_001','@Oala Explain prioritising tasks for someone with little office experience. Help me understand the decisions, show a small worked example, explain a common mistake and suggest a practice task I can try.'],
 ['pay-comparability','TREND_007','@Oala Explain whether this fictional pay dataset shows an increase: one advertisement from an earlier year says AUD 60000 annual base salary, and one later advertisement says AUD 40 per hour including unspecified additions. Hours, role levels and sample coverage are missing. Help me interpret it.'],
 ['learning-depth','SKILL_009','@Oala Teach me how to clarify a customer request. I have never worked in customer service. Help me understand the skill with examples and practice before considering any course.'],
 ['placement-unknown','INST_009','@Oala Review a possible placement match using only these fictional facts: my course includes preparing simple reports, and a local company produces reports. We have no information about supervision, capacity, safety arrangements or available places. Explain whether this establishes a suitable placement and what to check.'],
] as const;
const login=await(await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.ADMIN_USERNAME||'yuzeeadmin',password:process.env.ADMIN_PASSWORD||'yuzeeadmin@2026'})})).json();
if(!login.token)throw Error('Local login failed');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.token};
const results:any[]=[];
const retest=process.argv.includes('--retest');
const activeCases=retest?cases.filter(c=>['course-units','repeated-ads','pay-comparability','beginner-skill','learning-depth','placement-unknown'].includes(c[0])):cases;
async function run(c:readonly string[]){
 const [id,toolId,message]=c;
 try{
 const conv=await(await fetch('http://127.0.0.1:3000/api/conversations',{method:'POST',headers,body:JSON.stringify({title:'Individual tool review - '+id+' (synthetic)',model:'gemini-3.7-flash',mode:'AUTO',responseMode:'standard',thinkingLevel:'adaptive'})})).json();
 const response=await fetch(`http://127.0.0.1:3000/api/conversations/${conv.id}/messages`,{method:'POST',headers,body:JSON.stringify({message,model:'gemini-3.7-flash',mode:'AUTO',useMultiTurn:true,useStructuredOutput:true,thinkingLevel:'adaptive',maxOutputTokens:12000,microToolSelection:{status:'selected',toolId,score:.7,margin:.2,reason:'clear-semantic-match',version:'minilm-guarded-v1'}}),signal:AbortSignal.timeout(90000)});
 const raw=await response.text();const events=raw.split('\n\n').flatMap(c=>{const kind=c.match(/^event: (.+)$/m)?.[1],data=c.match(/^data: (.+)$/m)?.[1];try{return kind&&data?[{kind,data:JSON.parse(data)}]:[];}catch{return [];}});
 const output=events.find(e=>e.kind==='structured')?.data;
 const readable=output?responseToReadableText(output):'';
 const result={id,toolId,message,conversationId:conv.id,accepted:validateProtocol(output).protocolAccepted,routing:events.find(e=>e.kind==='start')?.data.routing,words:readable?readable.split(/\s+/).length:0,text:readable,output,progress:events.filter(e=>e.kind==='status').map(e=>e.data.phase),errors:events.filter(e=>['error','protocol_validation_error'].includes(e.kind))};
 results.push(result);console.log(JSON.stringify({id,toolId,accepted:result.accepted,routing:result.routing,words:result.words,errors:result.errors}));
 }catch(error){results.push({id,toolId,error:String(error)});console.log(id+' failed: '+String(error));}
 fs.writeFileSync(retest?'../outputs/Individual-Tool-Review-Retest.json':'../outputs/Individual-Tool-Review-Live-Checks.json',JSON.stringify(results,null,2));
}
for(let i=0;i<activeCases.length;i+=2)await Promise.all(activeCases.slice(i,i+2).map(run));
if(results.some(r=>!r.accepted||r.errors?.length||r.routing?.toolId!==r.toolId))process.exitCode=1;
