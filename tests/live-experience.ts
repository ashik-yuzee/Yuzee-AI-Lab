import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { uxScenarios } from '../src/ux/scenarios';
import { responseToReadableText } from '../src/ux/responsePresentation';
const env=parse(await fs.readFile('.env'));
const base='http://localhost:3000';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});
if(!login.ok)throw Error('Local login failed');
const {token}=await login.json();
const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
const records:any[]=[];
const output=path.resolve(process.argv[3] || (process.argv[2] ? '../outputs/Live-UX-Focused-Retest.json' : '../outputs/Live-UX-Test-Results.json'));
async function turn(id:string,message:string,userEvent?:any){
 const res=await fetch(base+'/api/conversations/'+id+'/messages',{method:'POST',headers,body:JSON.stringify({message,userEvent,responseMode:'standard',thinkingLevel:'low',isOptionSelection:true}),signal:AbortSignal.timeout(90000)});
 const raw=(await res.text()).replaceAll(env.GEMINI_API_KEY,'[REDACTED]');
 const events=raw.split('\n\n').flatMap(p=>{const m=p.match(/^event: (\w+)\ndata: (.*)$/s);if(!m)return[];try{return[{event:m[1],data:JSON.parse(m[2])}]}catch{return[]}});
 const response=events.find(e=>e.event==='structured')?.data;
 const validation=events.find(e=>e.event==='validation')?.data;
 const usage=events.find(e=>e.event==='usage')?.data?.usage;
 return {httpStatus:res.status,response,validation,visibleText:response?responseToReadableText(response):'',visibleWords:response?responseToReadableText(response).split(/\s+/).length:0,errors:events.filter(e=>/error/.test(e.event)),isMock:usage?.isMock,latencyMs:usage?.latencyMs,...(!res.ok?{errorBody:raw}:{})};
}
const filter=process.argv[2];
for(const [id,situation,goal,message,expected] of uxScenarios.filter(c=>!filter||filter.split(',').includes(c[0]))){
 try {
  const conv=await(await fetch(base+'/api/conversations',{method:'POST',headers,body:JSON.stringify({title:'UX acceptance — '+situation+' (synthetic)',model:'gemini-3.7-flash',responseMode:'standard',mode:'AUTO'})})).json();
  const record:any={id,situation,goal,message,expected,conversationId:conv.id,...await turn(conv.id,message),followups:[]};
  records.push(record);
  console.log(JSON.stringify({id,status:record.httpStatus,accepted:record.validation?.protocolAccepted,mode:record.response?.current_mode,input:record.response?.interaction.input_type,words:record.visibleWords,errors:record.errors}));
  if(record.validation?.protocolAccepted){
    let followMessage='';let event:any;
    if(id==='school-undecided') { followMessage='I still do not know. Please give me one tiny activity I can try today.'; }
    if(id==='return-to-work'){followMessage='Actually, I can now work evenings, but not school hours. Please update the plan and keep it simple.';}
    if(id==='handoff') {
      const q=record.response.interaction;
      if(q.input_type==='fields'){
        const fields=Object.fromEntries(q.fields.map((f:any)=>[f.id,f.id==='location'?'Geelong, VIC 3220':f.id==='residency'?f.options[0].value:'Cybersecurity training']));
        const empty=await turn(conv.id,'',{userEvent:{interaction:{question_id:q.question_id,fields:{}}}});
        record.emptyFieldsRejection={httpStatus:empty.httpStatus,errorBody:empty.errorBody};
        followMessage='Location: Geelong, VIC 3220. Residency: Domestic. Please keep this as a draft.';
        event={type:'fields_submission',value:followMessage,userEvent:{interaction:{question_id:q.question_id,fields}}};
      }
    }
    if(id==='plan') {
      const a=record.response.interaction.recommended_actions?.[0];
      if(a)followMessage=a.message;
    }
    if(followMessage){const reply=await turn(conv.id,followMessage,event);record.followups.push({message:followMessage,...reply});console.log(JSON.stringify({id:id+'-followup',status:reply.httpStatus,accepted:reply.validation?.protocolAccepted,words:reply.visibleWords,errors:reply.errors}));}
    if(id==='handoff'){const reply=await turn(conv.id,'Stop this request. I only want to explore other careers for now.');record.followups.push({message:'Pause the request and explore',...reply});console.log(JSON.stringify({id:id+'-pause',accepted:reply.validation?.protocolAccepted,input:reply.response?.interaction.input_type}));}
  }
 }catch(e:any){records.push({id,error:e.message});console.log(JSON.stringify({id,error:e.message}));}
 await fs.writeFile(output,JSON.stringify({testedAt:new Date().toISOString(),model:'gemini-3.7-flash',synthetic:true,records},null,2));
}
