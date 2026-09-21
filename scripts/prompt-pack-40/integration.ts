import fs from 'node:fs/promises';import {parse} from 'dotenv';
if(!process.argv.includes('--live'))throw Error('Use --live');
const root='output/prompt-pack-40/2026-09-20/integration',base='http://127.0.0.1:3012';
const conf=parse(await fs.readFile('.env'));const auth=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:conf.ADMIN_USERNAME,password:conf.ADMIN_PASSWORD})});const {token}=await auth.json();
const pack=JSON.parse(await fs.readFile('qa/prompt-pack-40/cases.json','utf8'));
// Share the endpoint politely with the routing run, after it has finished.
while((await fs.readdir(root+'/routing')).filter(x=>x.endsWith('.json')).length<40)await new Promise(r=>setTimeout(r,10000));
await fs.mkdir(root+'/events',{recursive:true});let last=0;
async function request(caseId:string,url:string,body?:any){if(body){await new Promise(r=>setTimeout(r,Math.max(0,5500-(Date.now()-last))));last=Date.now();}const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'x-yuzee-test-run':caseId+'-baseline-r1','x-yuzee-test-turn':'0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(130000)});const text=await r.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data};}
async function message(caseId:string,id:string,text:string){const r=await request(caseId,`/api/conversations/${id}/messages`,{message:text,responseMode:'standard',thinkingLevel:'medium',isOptionSelection:true});const saved=await request(caseId,`/api/conversations/${id}`);return {status:r.status,assistant:saved.data.messages?.filter((m:any)=>m.role==='assistant').at(-1)};}
for(let repetition=1;repetition<=3;repetition++){
 const out:any={caseId:'T30',repetition,scope:'Live HTTP application: real workspace correction, saved revision, subsequent chat; synthetic fixture data. Browser rendering tested separately.'};
 try{const c=pack.cases.find((c:any)=>c.id==='T30');const conv=await request('T30','/api/conversations',{title:`Pack40 T30 panel-event r${repetition} fictional`,model:'gemini-3.7-flash',mode:'VANILLA',responseMode:'standard',thinkingLevel:'medium'});out.conversationId=conv.data.id;
 out.first=await message('T30',conv.data.id,c.user_turns[0]);
 out.open=await request('T30',`/api/conversations/${conv.data.id}/objectives/start`,{objectiveId:'STUDY_004',activation:'manual'});
 if(out.open.status!==200)throw Error('Workspace start failed: '+JSON.stringify(out.open.data));
 out.correct=await request('T30',`/api/conversations/${conv.data.id}/objectives/correct`,{sessionId:out.open.data.id,revision:out.open.data.revision,correction:'My hard maximum budget is AUD 800, my maximum study time is eight hours per week, and I require fully asynchronous delivery.'});
 out.followup=await message('T30',conv.data.id,c.user_turns[1]);
 out.saved=await request('T30',`/api/conversations/${conv.data.id}/objectives`);
 out.staleRevision=await request('T30',`/api/conversations/${conv.data.id}/objectives/correct`,{sessionId:out.open.data.id,revision:1,correction:'Restore budget AUD 2000.'});
 const other=await request('T38','/api/conversations',{title:'Pack40 isolated foreign-conversation probe',model:'gemini-3.7-flash',mode:'VANILLA'});
 out.foreignSession=await request('T38',`/api/conversations/${other.data.id}/objectives/correct`,{sessionId:out.open.data.id,revision:out.correct.data.revision||2,correction:'TEST_ONLY_PRIVATE_MARKER_7QZ'});
 out.integrationChecks={revision2Saved:out.correct.status===200&&out.correct.data.revision===2,staleRevisionRejected:out.staleRevision.status===422&&/changed/.test(out.staleRevision.data.error),foreignWorkspaceRejected:out.foreignSession.status===422&&/not found/.test(out.foreignSession.data.error)};
 }catch(e:any){out.error=e.message;}
 await fs.writeFile(root+`/events/T30-panel-r${repetition}.json`,JSON.stringify(out,null,2));console.log('T30 panel',repetition,out.integrationChecks||out.error);
}
// Observe correction propagation through an existing workspace, without faking an update.
const out:any={caseId:'T28',scope:'One live application correction cycle; supplements three text-only baseline repetitions.'};
try{const c=pack.cases.find((c:any)=>c.id==='T28');const conv=await request('T28','/api/conversations',{title:'Pack40 T28 saved workspace correction fictional',model:'gemini-3.7-flash',mode:'VANILLA',responseMode:'standard',thinkingLevel:'medium'});out.conversationId=conv.data.id;out.first=await message('T28',conv.data.id,c.user_turns[0]);out.open=await request('T28',`/api/conversations/${conv.data.id}/objectives/start`,{objectiveId:'STUDY_004',activation:'manual'});out.correctedChat=await message('T28',conv.data.id,c.user_turns[1]);out.saved=await request('T28',`/api/conversations/${conv.data.id}/objectives`);out.workspaceUpdated=out.saved.data.some((s:any)=>s.revision>out.open.data.revision);out.followup=await message('T28',conv.data.id,c.user_turns[2]);}catch(e:any){out.error=e.message;}await fs.writeFile(root+'/events/T28-workspace.json',JSON.stringify(out,null,2));console.log('T28 workspace updated',out.workspaceUpdated,out.error||'');
console.log('INTEGRATION COMPLETE');
