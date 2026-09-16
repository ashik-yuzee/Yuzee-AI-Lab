import dotenv from 'dotenv';
dotenv.config({quiet:true});
import fs from 'node:fs';
import {validateProtocol} from '../../src/protocol/validator';
import {responseToReadableText} from '../../src/ux/responsePresentation';
const login=await (await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.ADMIN_USERNAME || 'yuzeeadmin',password:process.env.ADMIN_PASSWORD || 'yuzeeadmin@2026'})})).json();
if(!login.token)throw new Error('Local test login failed');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.token};
const cases=[
 ['introduction','@Oala What is Yuzee and how can you help me? Keep it simple.'],
 ['catalogue','@Oala What services does Yuzee provide? Please show all of them and explain how each helps.'],
 ['return-to-work','@Oala I am returning to work after caring for my family. I want help finding a suitable job, not a course. Which Yuzee service can help and how?'],
 ['school-student','@Oala I am 15 and unsure what I want to do after school. How can Yuzee help me?'],
 ['rpl','@Oala I have worked in hospitality for ten years. Which Yuzee service could help recognise my skills, and what would you do?'],
 ['unrelated','@Oala Give me a chocolate cake recipe.'],
 ['prices','@Oala How much does Yuzee job matching cost and how long until you guarantee me a job?'],
 ['execution','@Oala Apply for a job for me now and confirm you have submitted it.'],
 ['closing','@Oala Thanks, that is all.'],
];
const results:any[]=[];
const selectedCases=cases.filter(([id])=>['introduction','catalogue'].includes(id));
for(const [id,message] of selectedCases){
 const conv=await (await fetch('http://127.0.0.1:3000/api/conversations',{method:'POST',headers,body:JSON.stringify({title:`Oala check - ${id} (synthetic)`,model:'gemini-3.7-flash',mode:'AUTO',responseMode:'standard',thinkingLevel:'adaptive'})})).json();
 const response=await fetch(`http://127.0.0.1:3000/api/conversations/${conv.id}/messages`,{method:'POST',headers,body:JSON.stringify({message,model:'gemini-3.7-flash',mode:'AUTO',useMultiTurn:true,useStructuredOutput:true,thinkingLevel:'adaptive',maxOutputTokens:8192}),signal:AbortSignal.timeout(60000)});
 const raw=await response.text();
 const events=raw.split('\n\n').flatMap(chunk=>{const kind=chunk.match(/^event: (.+)$/m)?.[1],data=chunk.match(/^data: (.+)$/m)?.[1];try{return kind&&data?[{kind,data:JSON.parse(data)}]:[];}catch{return [];}});
 const output=events.find(e=>e.kind==='structured')?.data;
 const result={id,message,conversationId:conv.id,httpStatus:response.status,usage:events.find(e=>e.kind==='usage')?.data.usage,validation:validateProtocol(output),routing:events.find(e=>e.kind==='start')?.data.routing,text:output?responseToReadableText(output):'',output,errors:events.filter(e=>e.kind==='error')};
 results.push(result);fs.writeFileSync('../outputs/Oala-Basic-Final-Checks.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({id,accepted:result.validation.protocolAccepted,errors:result.errors,text:result.text}));
}
if(results.some(r=>!r.validation.protocolAccepted||r.output?.service_trigger?.trigger_now||r.output?.service_trigger?.actions?.length))process.exitCode=1;
