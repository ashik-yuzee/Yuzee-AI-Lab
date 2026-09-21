/** Real local chat pipeline; synthetic user messages only. No saved personal chat read. */
import fs from 'node:fs/promises';
import {parse} from 'dotenv';
import {responseToReadableText} from '../src/ux/responsePresentation';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
const env=parse(await fs.readFile('.env'));
if(!process.argv.includes('--live'))throw Error('Use --live for authorised fictional API testing.');
const root=process.env.UX_AUDIT_ROOT||`output/experience-flow/${new Date().toISOString().replace(/[:.]/g,'-')}`;
await fs.mkdir(root,{recursive:true});
const inventory=JSON.parse(await fs.readFile('qa/experience/scenarios.json','utf8'));
if(process.env.UX_SCENARIOS)inventory.journeys=inventory.journeys.filter((j:any)=>process.env.UX_SCENARIOS!.split(',').includes(j.id));
await fs.writeFile(root+'/scenarios.json',JSON.stringify(inventory,null,2));
const base='http://localhost:3000';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});
if(!login.ok)throw Error('Local login failed');
const {token}=await login.json(),headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
const redact=(s:string)=>Object.entries(env).filter(([k,v])=>/KEY|TOKEN|PASSWORD/.test(k)&&v).reduce((t,[,v])=>t.replaceAll(v,'[REDACTED]'),s);
const request=async(url:string,body?:any)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Local request ${r.status}: ${redact(await r.text()).slice(0,400)}`);return r;};
await fs.writeFile(root+'/config.json',JSON.stringify({at:new Date().toISOString(),promptHash:YuzeeRequestAssembler.getInstance().getPromptHash(),model:'gemini-3.7-flash',mode:'VANILLA',thinking:'medium',scope:'Real Node chat API, warehouse and response validation. BGE and workspace checks run in a separate phase. Synthetic evidence only; no population accuracy or satisfaction claim.'},null,2));
let index=0;
async function worker(){while(index<inventory.journeys.length){
 const j=inventory.journeys[index++],file=root+'/'+j.id+'.json';
 try{await fs.access(file);console.log('EXISTS',j.id);continue;}catch{}
 const result:any={...j,records:[]};
 try{
  const conv=await(await request('/api/conversations',{title:'UX review · '+j.id+' · fictional',model:'gemini-3.7-flash',mode:'VANILLA',responseMode:'standard',thinkingLevel:'medium'})).json();result.conversationId=conv.id;
  for(let i=0;i<j.turns.length;i++){
   const t=j.turns[i],start=Date.now(),r=await request(`/api/conversations/${conv.id}/messages`,{message:t.message,responseMode:'standard',thinkingLevel:'medium',isOptionSelection:true});
   const raw=redact(await r.text()),events=raw.split(/\r?\n\r?\n/).flatMap(p=>{const m=p.match(/^event: (\w+)\r?\ndata: (.*)$/s);if(!m)return [];try{return [{event:m[1],data:JSON.parse(m[2])}];}catch{return [];}});
   const response=events.find(e=>e.event==='structured')?.data,validation=events.find(e=>e.event==='validation')?.data;
   const saved=await(await request(`/api/conversations/${conv.id}`)).json();
   const assistant=saved.messages?.filter((m:any)=>m.role==='assistant').at(-1);
   const record={id:j.id+'-'+(i+1),...t,response,validation,visibleText:response?responseToReadableText(response):'',ms:Date.now()-start,errors:events.filter(e=>/error/.test(e.event)),usage:events.find(e=>e.event==='usage')?.data,assistant,history:saved.messages};
   result.records.push(record);await fs.writeFile(file,JSON.stringify(result,null,2));
   console.log(record.id,validation?.protocolAccepted?'ACCEPTED':'FAILED',record.ms+'ms',assistant?.warehouseData?.status||'NO_PACK');
   if(!validation?.protocolAccepted)break;
  }
 }catch(e:any){result.error=redact(String(e.message));console.log(j.id,'ERROR',result.error);}
 await fs.writeFile(file,JSON.stringify(result,null,2));
}}
await Promise.all([worker(),worker()]);console.log('Saved',root);
