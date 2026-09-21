/** Diagnostic baseline only. Never reads or transmits saved user conversations. */
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {TEACHING_REVIEW_INSTRUCTION,shouldReviewTeaching,applyReviewedBlocks} from '../src/services/TeachingAnswerReview';
import {runReview} from '../src/services/ReviewRetry';
import {validateProtocol} from '../src/protocol/validator';
import {normaliseSecurityFields,applyServerSecurityState} from '../src/protocol/securityOverride';
import {applyPresentationDefaults} from '../src/protocol/presentationDefaults';
dotenv.config({quiet:true});
const root='output/ux-audit';const assembler=YuzeeRequestAssembler.getInstance();
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const followups=process.argv.includes('--followups');
const inventory=JSON.parse(await fs.readFile(root+'/persona-inventory.json','utf8'));
const starters=inventory.filter((p:any)=>p.opening).map((p:any)=>({id:p.id+'-A',persona:p.id,label:p.label,message:p.opening,history:[]}));
const cases=followups?JSON.parse(await fs.readFile(root+'/followup-queue.json','utf8')):[...starters,...starters.filter((p:any)=>['HS-01','UE-02','UE-03','RE-01','AX-01','AX-04'].includes(p.persona)).map((p:any)=>({...p,id:p.persona+'-B'}))];
const config={model:'gemini-3.7-flash',thinking:'medium',structured:false,promptHash:assembler.getPromptHash(),promptBytes:assembler.getPromptBytes(),date:new Date().toISOString(),scope:'Prompt + generic explanation review diagnostic. No browser, BGE selector, external actions, memory compaction, production request preflight or task-specific review overlays executed. Synthetic inputs only; no hidden persona facts sent. Two concurrent independent sessions. Not a complete end-to-end persona run.'};
await fs.writeFile(root+'/run-config.json',JSON.stringify(config,null,2));await fs.mkdir(root+'/live',{recursive:true});let idx=0;
async function worker(){while(idx<cases.length){const c=cases[idx++];const file=root+'/live/'+c.id+'.json';try{await fs.access(file);console.log('EXISTS',c.id);continue;}catch{}
 const start=Date.now();let r:any={...c,config,started:new Date(start).toISOString()};
 try{
 const history=(c.history||[]).map((m:any)=>`${m.role==='user'?'User':'Assistant'}: ${typeof m.content==='string'?m.content:JSON.stringify(m.content)}`).join('\n');
 const a=assembler.assembleRequest({model:config.model,messageText:c.message,recentHistoryText:history,responseMode:'standard',thinkingLevel:config.thinking,useStructuredOutput:config.structured});
 const generated=await ai.models.generateContent({model:a.model,contents:a.contents,config:{...a.geminiConfig,httpOptions:{timeout:90000,retryOptions:{attempts:1}},abortSignal:AbortSignal.timeout(90000)}});
 r.generationMs=Date.now()-start;r.usage=generated.usageMetadata;r.raw=generated.text;
 let p=JSON.parse((generated.text||'').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));r.original=p;
 if(shouldReviewTeaching(p)){
 const rs=Date.now();const review=await runReview(async()=>{const x=await ai.models.generateContent({model:a.model,contents:JSON.stringify({user_message:c.message,conversation:c.history||[],candidate_answer:p}),config:{systemInstruction:TEACHING_REVIEW_INSTRUCTION,responseMimeType:'application/json',responseSchema:{type:'object',properties:{content_blocks:assembler.getGeminiResponseSchema().properties.content_blocks},required:['content_blocks']},thinkingConfig:{thinkingLevel:'low'} as any,maxOutputTokens:a.maxOutputTokens,httpOptions:{timeout:60000,retryOptions:{attempts:1}},abortSignal:AbortSignal.timeout(60000)}});r.reviewUsage=x.usageMetadata;return applyReviewedBlocks(p,x.text||'');},new AbortController().signal);p=review.value;r.reviewMs=Date.now()-rs;r.reviewAudit=review.audit;
 }
 applyPresentationDefaults(p,c.id);normaliseSecurityFields(p);applyServerSecurityState(p,0,'');r.response=p;r.validation=validateProtocol(p);
 }catch(e:any){r.error={name:e.name,status:e.status||null,message:String(e.message).replace(/AIza[\w-]+/g,'REDACTED').slice(0,700)};}
 r.totalMs=Date.now()-start;await fs.writeFile(file,JSON.stringify(r,null,2));console.log(c.id,r.error?'ERROR':r.validation?.protocolAccepted?'ACCEPTED':'REJECTED',r.totalMs+'ms');
}}
await Promise.all([worker(),worker()]);
