import dotenv from 'dotenv';dotenv.config({quiet:true});
import fs from 'node:fs';
import {validateProtocol} from '../../src/protocol/validator';
import {responseToReadableText} from '../../src/ux/responsePresentation';
import {learningProfiles} from '../../src/routing/learningDepth';
const cases=[['followup','','followup',"I still don't understand paraphrasing. Explain just that part using a different example, without repeating the whole lesson."]] as const;
const prior=JSON.parse(fs.readFileSync('../outputs/Structured-Teaching-Final-Checks.json','utf8')).find((r:any)=>r.id==='communication');
const login=await(await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.ADMIN_USERNAME||'yuzeeadmin',password:process.env.ADMIN_PASSWORD||'yuzeeadmin@2026'})})).json();
if(!login.token)throw Error('Local login failed');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.token};
const results:any[]=[];
function save(){fs.writeFileSync('../outputs/Structured-Teaching-Followup-Final.json',JSON.stringify(results,null,2));}
async function run(c:readonly string[]){
 const [id,toolId,profile,message]=c;
 try{
 const conv={id:prior.conversationId};
 const response=await fetch(`http://127.0.0.1:3000/api/conversations/${conv.id}/messages`,{method:'POST',headers,body:JSON.stringify({message,model:'gemini-3.7-flash',mode:'AUTO',useMultiTurn:true,useStructuredOutput:true,thinkingLevel:'adaptive',maxOutputTokens:12000,...(toolId?{microToolSelection:{status:'selected',toolId,score:.7,margin:.2,reason:'clear-semantic-match',version:'minilm-guarded-v1'}}:{})}),signal:AbortSignal.timeout(60000)});
 const raw=await response.text();const events=raw.split('\n\n').flatMap(c=>{const kind=c.match(/^event: (.+)$/m)?.[1],data=c.match(/^data: (.+)$/m)?.[1];try{return kind&&data?[{kind,data:JSON.parse(data)}]:[];}catch{return [];}});
 const output=events.find(e=>e.kind==='structured')?.data;
 const text=output?responseToReadableText(output):'';
 const titles=(output?.content_blocks||[]).map((b:any)=>b.title).filter(Boolean);
 const expected=learningProfiles[profile as keyof typeof learningProfiles]||[];
 const missingSections=expected.filter(([title])=>!titles.some((actual:string)=>actual.toLowerCase().includes(title.toLowerCase()))).map(([title])=>title);
 const result={id,toolId,profile,message,conversationId:conv.id,accepted:validateProtocol(output).protocolAccepted,routing:events.find(e=>e.kind==='start')?.data.routing,words:text.split(/\s+/).length,titles,missingSections,interaction:output?.interaction?.kind,text,output,progress:events.filter(e=>e.kind==='status').map(e=>e.data.phase),usage:events.find(e=>e.kind==='usage')?.data,errors:events.filter(e=>['error','protocol_validation_error'].includes(e.kind))};
 results.push(result);save();console.log(JSON.stringify({...result,message:undefined,output:undefined,usage:undefined}));
 }catch(error){results.push({id,error:String(error)});save();console.log(id+' failed: '+String(error));}
}
// Two independent synthetic conversations at a time; no personal user data.
for(let i=0;i<cases.length;i+=2)await Promise.all(cases.slice(i,i+2).map(run));
if(results.some(r=>!r.accepted||r.errors?.length))process.exitCode=1;
