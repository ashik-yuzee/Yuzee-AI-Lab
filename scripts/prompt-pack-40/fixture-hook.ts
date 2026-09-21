import {AsyncLocalStorage} from 'node:async_hooks';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.env.YUZEE_AUDIT_ROOT!;
const pack=JSON.parse(fs.readFileSync(process.env.YUZEE_AUDIT_PACK!,'utf8'));
const runs=JSON.parse(fs.readFileSync(root+'/runs.json','utf8'));
const scope=new AsyncLocalStorage<any>();const assignments=new Map<string,any>();
function trace(event:any){const s=scope.getStore();if(s)fs.appendFileSync(root+'/traces/'+s.run.id+'.ndjson',JSON.stringify({at:new Date().toISOString(),turn:s.turn,...event})+'\n');}
export function middleware(req:any,res:any,next:any){
 const id=String(req.headers['x-yuzee-test-run']||''),run=runs.find((r:any)=>r.id===id);const conv=req.path.match(/^\/api\/conversations\/([^/]+)/)?.[1];
 let a=run?{run,turn:Number(req.headers['x-yuzee-test-turn']||0)}:conv?assignments.get(conv):null;
 if(a&&conv)assignments.set(conv,a);
 if(!a)return next();
 scope.run(a,()=>{if(req.path.endsWith('/messages')){const f=profileFor(a.run);if(f.length)req.body.userProfileFacts=f;}trace({kind:'request',method:req.method,path:req.path,body:req.body});res.on('finish',()=>trace({kind:'http_result',method:req.method,path:req.path,status:res.statusCode}));next();});
}
function profileFor(run:any){const c=pack.cases.find((c:any)=>c.id===run.caseId),e=c.evidence_setup;
 if(c.id==='T34')return [JSON.stringify(e.user_profile)];
 if(c.id==='T38')return [JSON.stringify(e.test_user)];
 if(c.id==='T39'){const b=e.variants[0],v=e.variants.find((v:any)=>v.name===run.variant);const p={...b,...v};delete p.instruction;delete p.name;return [JSON.stringify({...p,user_name:run.variant==='name_only'?'Casey':'Alex',...(run.variant==='display_swap'?{display_order:['FIX-WEB','FIX-MKT']}:{display_order:['FIX-MKT','FIX-WEB']})})];}
 return [];
}
function fixtures(run:any,turn:number){const c=pack.cases.find((c:any)=>c.id===run.caseId),e=c.evidence_setup;
 let ids=Array.isArray(e)?e:e?.base_courses||e?.initial_pair||(e?.base_course?[e.base_course]:[]);
 let courses=ids.map((id:string)=>({course_id:id,...structuredClone(pack.fixtures[id])}));let supplemental:any={};
 if(c.mode==='discovery')return {courses:[],supplemental:{status:'NO_PROVIDER_SPECIFIC_EVIDENCE_SUPPLIED'}};
 if(c.id==='T10')courses=[e.left,e.right];
 if(c.id==='T11')courses=[{...pack.fixtures['FIX-DA'],course_id:'SAME-A',provider_id:'SIM-EAST',source_id:'SRC-SAME-A'},{...pack.fixtures['FIX-DA'],course_id:'SAME-B',provider_id:'SIM-WEST',source_id:'SRC-SAME-B',fees_AUD:{known_total:1900},delivery:'Online plus four compulsory weekday on-campus labs'}];
 if(c.id==='T24'){courses=[{course_id:'FIX-IT',...pack.fixtures['FIX-IT']},{course_id:'FIX-DA',title:pack.fixtures['FIX-DA'].title,provider_id:pack.fixtures['FIX-DA'].provider_id}];supplemental.tool_results=[{course_id:'FIX-IT',status:'SUCCESS'},{course_id:'FIX-DA',status:'TIMEOUT',detail_payload:null}];trace({kind:'fixture_tool_result',...supplemental});}
 for(const k of ['additional_record','salary_records','job_snapshot','target_job','metadata','partner_metadata','untrusted_provider_excerpt','conflicting_records'])if(e?.[k])supplemental[k]=structuredClone(e[k]);
 if(c.id==='T25'&&run.variant==='supersession')supplemental.conflicting_records[1]={...supplemental.conflicting_records[1],version:'official later correction',supersedes:'CONFLICT-1'};
 if(c.id==='T27'&&run.variant==='commission_swap')supplemental.partner_metadata={'FIX-IT':'no commission','FIX-DA':'higher commission paid to platform'};
 if(c.id==='T31'&&turn>0)courses=['FIX-MKT','FIX-ADMIN'].map(id=>({course_id:id,...pack.fixtures[id]}));
 if(c.id==='T39'&&run.variant==='display_swap')courses.reverse();
 if(c.id==='T11'&&turn>0)courses.reverse();
 return {courses,supplemental};
}
export function installAudit(warehouse:any){
 warehouse.start=()=>{};warehouse.status=()=>({state:'READY',source:'FICTIONAL_TEST_ADAPTER'});
 warehouse.retrieve=async(input:any)=>{const a=scope.getStore();if(!a)return {status:'NOT_NEEDED',queries:[],courses:[],retrievedAt:new Date().toISOString(),message:'Isolated test instance: no fixture assigned.',sourcePolicy:'USER_APPROVED_CATALOGUE'};
 const f=fixtures(a.run,a.turn);const result={status:f.courses.length?'READY':'NO_MATCH',queries:[],retrievedAt:new Date().toISOString(),message:'FICTIONAL TEST RECORDS ONLY. Local source IDs are test provenance, not independently verified real courses.',sourcePolicy:'USER_APPROVED_CATALOGUE',courses:f.courses.map((c:any)=>({id:c.course_id,evidenceId:'warehouse_course_'+c.course_id,name:c.title,provider:c.provider_id||'Unknown provider',providerId:c.provider_id,code:null,level:null,type:null,duration:c.duration_weeks?c.duration_weeks+' weeks':null,delivery:c.delivery?[c.delivery]:[],locations:[],entry:c.entry?[c.entry]:[],description:null,fees:{domestic:null,international:null,details:c.fees_AUD?[JSON.stringify(c.fees_AUD)]:[]},skills:c.teaches||[],outcomes:c.role_examples||[],assessments:c.assessment?[c.assessment]:[],bestFor:[],considerations:[c.award,c.placement,c.outcome_limits,...(c.not_established||[])].filter(Boolean),quality:[],qualityExplanation:null,source:{label:'Fictional fixture '+(c.source_id||c.course_id),url:null,updatedAt:null,origin:'YUZEE_WAREHOUSE'},fixture_record:c})),fixture_supplemental_evidence:f.supplemental};trace({kind:'retrieval',input,returned:result});return result;};
 const original=globalThis.fetch;
 globalThis.fetch=async(input:any,init:any)=>{const url=typeof input==='string'?input:input?.url||String(input);const a=scope.getStore();
 if(a){let body=init?.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{}}trace({kind:'outbound',url:url.replace(/([?&]key=)[^&]+/g,'$1[REDACTED]'),body,requestSha256:crypto.createHash('sha256').update(JSON.stringify(body)||'').digest('hex')});
 if(!url.startsWith('https://generativelanguage.googleapis.com/')){trace({kind:'blocked_external_request',url});throw Error('External action unavailable in isolated test instance.');}}
 return original(input,init);
 };
}
