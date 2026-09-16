import dotenv from 'dotenv';
dotenv.config({quiet:true});
import fs from 'node:fs';
import {validateProtocol} from '../../src/protocol/validator';
import {responseToReadableText} from '../../src/ux/responsePresentation';
const login=await (await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.ADMIN_USERNAME || 'yuzeeadmin',password:process.env.ADMIN_PASSWORD || 'yuzeeadmin@2026'})})).json();
if(!login.token)throw new Error('Local test login failed');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.token};
const cases=[
 ['missing-syllabus', '@Oala Explain the units in a course called Business Foundations. I am new to studying and do not know what units or electives mean. I want to return to office work. I do not have a course guide.'],
 ['learning-value', '@Oala I want to return to office work but I have only used spreadsheets to type lists. Help me understand these units. This is a made-up course excerpt for this exercise, not a real provider: Unit A, Data Accuracy, compulsory: learners clean duplicate customer records, standardise dates and check totals; assessment is a cleaned sample dataset plus an explanation of checks. Unit B, Reporting, elective: learners summarise a sample sales dataset with a pivot table and write a short explanation of a trend; assessment is a report and stated limitations. There is no prerequisite or workload information.'],
 ['brief', '@Oala In exactly one sentence, explain what an elective unit is; no follow-up question.'],
 ['output-limit', '@Oala Explain how someone new to studying can understand course units, skills, practical assessments and compare their options, with examples.'],
];
const results:any[]=[];
for(const [id,message] of cases){
 const conv=await (await fetch('http://127.0.0.1:3000/api/conversations',{method:'POST',headers,body:JSON.stringify({title:`Learning quality - ${id} (synthetic)`,model:'gemini-3.7-flash',mode:'AUTO',responseMode:'standard',thinkingLevel:'adaptive'})})).json();
 const response=await fetch(`http://127.0.0.1:3000/api/conversations/${conv.id}/messages`,{method:'POST',headers,body:JSON.stringify({message,model:'gemini-3.7-flash',mode:'AUTO',useMultiTurn:true,useStructuredOutput:true,thinkingLevel:'adaptive',maxOutputTokens:id==='output-limit'?128:8192,microToolSelection:{status:'selected',toolId:'COURSE_005',score:.7,margin:.2,reason:'clear-semantic-match',version:'minilm-guarded-v1'}}),signal:AbortSignal.timeout(60000)});
 const raw=await response.text();
 const events=raw.split('\n\n').flatMap(chunk=>{const kind=chunk.match(/^event: (.+)$/m)?.[1],data=chunk.match(/^data: (.+)$/m)?.[1];try{return kind&&data?[{kind,data:JSON.parse(data)}]:[];}catch{return [];}});
 const output=events.find(e=>e.kind==='structured')?.data;
 const result={id,message,conversationId:conv.id,httpStatus:response.status,usage:events.find(e=>e.kind==='usage')?.data.usage,validation:validateProtocol(output),routing:events.find(e=>e.kind==='start')?.data.routing,text:output?responseToReadableText(output):'',output,errors:events.filter(e=>e.kind==='error'),protocolErrors:events.filter(e=>e.kind==='protocol_validation_error'),eventKinds:events.map(e=>e.kind)};
 results.push(result);fs.writeFileSync('../outputs/Learning-Quality-Live-Checks.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({id,accepted:result.validation.protocolAccepted,errors:result.errors,text:result.text,protocolErrors:result.protocolErrors}));
}
if(results.some(r=>r.id==='output-limit' ? !!r.output || !r.protocolErrors.some((e:any)=>e.data.finishReason==='MAX_TOKENS') : !r.validation.protocolAccepted || r.errors.length))process.exitCode=1;
