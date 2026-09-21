import fs from 'node:fs/promises';import {parse} from 'dotenv';import {responseToReadableText} from '../../src/ux/responsePresentation';
if(!process.argv.includes('--live'))throw Error('Live fictional testing requires --live');
const root='output/prompt-pack-40/2026-09-20',base='http://127.0.0.1:3011',conf=parse(await fs.readFile('.env'));
const pack=JSON.parse(await fs.readFile('qa/prompt-pack-40/cases.json','utf8')),runs=JSON.parse(await fs.readFile(root+'/runs.json','utf8'));
const auth=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:conf.ADMIN_USERNAME,password:conf.ADMIN_PASSWORD})});if(!auth.ok)throw Error('Isolated login failed');const {token}=await auth.json();
let nextMessage=0,index=0;
async function call(run:any,turn:number,url:string,body?:any){
 if(url.endsWith('/messages')){const at=Math.max(Date.now(),nextMessage);nextMessage=at+3300;await new Promise(r=>setTimeout(r,at-Date.now()));}
 const response=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'x-yuzee-test-run':run.id,'x-yuzee-test-turn':String(turn)},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(130000)});
 if(!response.ok)throw Error('HTTP '+response.status+': '+(await response.text()).slice(0,200));return response;
}
async function worker(){while(index<runs.length){const run=runs[index++],file=root+'/results/'+run.id+'.json';try{const old=JSON.parse(await fs.readFile(file,'utf8'));if(old.finished){continue;}}catch{}
 const c=pack.cases.find((c:any)=>c.id===run.caseId);const result:any={...run,title:c.title,mode:c.mode,started:new Date().toISOString(),records:[],integrationLimitations:[]};
 try{
 const conv=await(await call(run,0,'/api/conversations',{title:'Pack40 '+run.id+' · fictional',model:'gemini-3.7-flash',mode:'VANILLA',responseMode:'standard',thinkingLevel:'medium'})).json();result.conversationId=conv.id;
 const turns=[...c.user_turns];if(run.variant==='explicit_action')turns[1]='I want to apply for IT Support Foundations. Explain what permission and details you would need; do not submit an application yet.';
 for(let i=0;i<turns.length;i++){
  const start=Date.now();const r=await call(run,i,`/api/conversations/${conv.id}/messages`,{message:turns[i],responseMode:'standard',thinkingLevel:'medium',isOptionSelection:true});
  const raw=await r.text(),events=raw.split(/\r?\n\r?\n/).flatMap(p=>{const m=p.match(/^event: (\w+)\r?\ndata: (.*)$/s);if(!m)return [];try{return [{event:m[1],data:JSON.parse(m[2])}]}catch{return []}});
  const response=events.find(e=>e.event==='structured')?.data,validation=events.find(e=>e.event==='validation')?.data;
  const saved=await(await call(run,i,`/api/conversations/${conv.id}`)).json();
  result.records.push({turn:i+1,message:turns[i],response,validation,visibleText:response?responseToReadableText(response):'',ms:Date.now()-start,errors:events.filter(e=>e.event==='error'),usage:events.find(e=>e.event==='usage')?.data,assistant:saved.messages?.filter((m:any)=>m.role==='assistant').at(-1)});
  await fs.writeFile(file,JSON.stringify(result,null,2));console.log(run.id,'turn',i+1,validation?.protocolAccepted?'ACCEPTED':'REJECTED');
 }
 result.finished=true;
 }catch(e:any){result.error=String(e.message).replace(/AIza[\w-]+/g,'[REDACTED]');result.finished=true;console.log(run.id,'ERROR',result.error);}
 result.completed=new Date().toISOString();await fs.writeFile(file,JSON.stringify(result,null,2));
}}
await Promise.all([worker(),worker(),worker()]);console.log('COMPLETE',runs.length);
