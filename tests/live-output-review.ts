import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import {outputReviewScenarios} from '../src/ux/outputReview';
import { responseToReadableText } from '../src/ux/responsePresentation';
const env=parse(await fs.readFile('.env'));
const base='http://localhost:3000';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});
if(!login.ok)throw Error('Local login failed');
const {token}=await login.json();
const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
const records:any[]=[];
const output=path.resolve(process.argv[3] || '../outputs/Live-Output-Review.json');
async function turn(id:string,message:string,userEvent?:any){
 const res=await fetch(base+'/api/conversations/'+id+'/messages',{method:'POST',headers,body:JSON.stringify({message,userEvent,responseMode:'standard',thinkingLevel:'low',isOptionSelection:true}),signal:AbortSignal.timeout(90000)});
 const raw=(await res.text()).replaceAll(env.GEMINI_API_KEY,'[REDACTED]');
 const events=raw.split('\n\n').flatMap(p=>{const m=p.match(/^event: (\w+)\ndata: (.*)$/s);if(!m)return[];try{return[{event:m[1],data:JSON.parse(m[2])}]}catch{return[]}});
 const response=events.find(e=>e.event==='structured')?.data;
 const validation=events.find(e=>e.event==='validation')?.data;
 const usage=events.find(e=>e.event==='usage')?.data?.usage;
 return {httpStatus:res.status,response,validation,visibleText:response?responseToReadableText(response):'',visibleWords:response?responseToReadableText(response).split(/\s+/).length:0,errors:events.filter(e=>/error/.test(e.event)),isMock:usage?.isMock,latencyMs:usage?.latencyMs,...(!res.ok?{errorBody:raw}:{})};
}

for(const id of (process.argv[2]?.split(',') || ['no-more-questions','missing-data','access','parent-child'])){
 const s=outputReviewScenarios.find(s=>s.id===id)!;
 const message=id==='missing-data'?'I can study 12 hours a week. Does the Deakin Bachelor of Computer Science online fit? I have no unit guide or attendance information. Please do not assume my evenings are free.':s.request;
 try{
  const created=await fetch(base+'/api/conversations',{method:'POST',headers,body:JSON.stringify({title:'Output review — '+s.label+' (synthetic)',model:'gemini-3.7-flash',responseMode:'standard',mode:'AUTO'})});
  if(!created.ok)throw Error('Could not create test conversation');
  const conv=await created.json();
  const result={id,request:message,expected:s.expected,conversationId:conv.id,...await turn(conv.id,message)};
  records.push(result);
  console.log(JSON.stringify({id,accepted:result.validation?.protocolAccepted,words:result.visibleWords,errors:result.errors}));
 }catch(error:any){records.push({id,error:error.message});console.log(id+': '+error.message);}
 await fs.writeFile(output,JSON.stringify({testedAt:new Date().toISOString(),synthetic:true,records},null,2));
}
