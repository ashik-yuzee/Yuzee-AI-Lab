/** Synthetic prompt regressions only. No saved personal conversations are read. */
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {validateProtocol} from '../src/protocol/validator';
import {normaliseSecurityFields,applyServerSecurityState} from '../src/protocol/securityOverride';
import {applyPresentationDefaults} from '../src/protocol/presentationDefaults';
dotenv.config({quiet:true});
const output=process.argv.includes('--revised')?'output/phase1/live-revised':'output/phase1/live';
await fs.mkdir(output,{recursive:true});
const assembler=YuzeeRequestAssembler.getInstance(),ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const cases=[
 {id:'route-exploration',message:'I want to go to university but I do not know which course would suit me.',expected:['PATHWAY_RMO']},
 {id:'graduate-job',message:'I have just graduated and want an ordinary entry-level customer support job. I am not looking for a structured graduate program.',expected:['JOB_MATCH_RMO']},
 {id:'graduate-program',message:'Help me understand and look for structured graduate rotation programs. I am specifically interested in a formal graduate program, not ordinary entry-level vacancies.',expected:['GRAD_PROGRAM_RMO']},
 {id:'explicit-compare-low-confidence',message:'I am not confident about my career yet. Please compare engineering and marketing now: what are the tasks, skills and day-to-day differences? I do not want to choose a winner or answer a questionnaire first.',expected:['PATHWAY_RMO'],noQuestion:true},
 {id:'workspace-question-owner',message:'[workspace_coordination: {"question_owner":"WORKSPACE","session_id":"fictional-1","objective":"Compare these jobs","question_id":"priorities","question":"Which trade-off matters most to you?"}]\nExplain what you mean by trade-offs.',noQuestion:true},
 {id:'saved-answer-correction',message:'[SHARED_CONVERSATION_CONTEXT: {"version":"1.0","context_limited":false,"contributions":[{"kind":"WORKSPACE_ANSWER","question":"When can you study?","value":"Full time","at":1,"evidence_status":"USER_REPORTED"},{"kind":"USER_CORRECTION","value":"I can only study part-time while working","at":2,"evidence_status":"USER_REPORTED"}]}]\nHow should I compare study schedules now?',mustMention:/part.time/i},
 {id:'no-connected-fee-data',message:'Can you fetch the exact current fee for the fictional Greenleaf College Diploma of Design in 2027 from the warehouse?',noInventedSearch:true},
 {id:'social-no-activity',message:'Thanks, that was helpful. I am done for now.',noQuestion:true,noActivity:true},
];
let index=0;
async function worker(){while(index<cases.length){const c=cases[index++],file=`${output}/${c.id}.json`;
 try{await fs.access(file);console.log('EXISTS',c.id);continue;}catch{}
 const started=Date.now();const result:any={id:c.id,input:c.message,promptHash:assembler.getPromptHash(),promptVersion:assembler.getProtocolInfo().promptVersion,scope:'Synthetic main prompt regression; no BGE execution, warehouse lookup or production end-to-end claim.'};
 try{
  const req=assembler.assembleRequest({model:'gemini-3.7-flash',messageText:c.message,thinkingLevel:'medium',useStructuredOutput:false});
  const response=await ai.models.generateContent({model:req.model,contents:req.contents,config:{...req.geminiConfig,httpOptions:{timeout:90000,retryOptions:{attempts:1}},abortSignal:AbortSignal.timeout(90000)}});
  result.raw=response.text;result.usage=response.usageMetadata;
  const parsed=JSON.parse((response.text||'').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  result.original=structuredClone(parsed);applyPresentationDefaults(parsed,c.id);normaliseSecurityFields(parsed);applyServerSecurityState(parsed,0,'');
  result.response=parsed;result.validation=validateProtocol(parsed);
  const visible=JSON.stringify(parsed.content_blocks);
  result.checks={protocol:result.validation.protocolAccepted,route:!c.expected||c.expected.includes(parsed.service_trigger.primary_requested_service),noUnrequestedQuestion:!c.noQuestion||parsed.interaction.kind==='none',latestCorrection:!c.mustMention||c.mustMention.test(visible),noActivity:!c.noActivity||!parsed.state.activity_context?.possible_need,noUnavailableActions:!parsed.service_trigger.actions.length,noInventedSearch:!c.noInventedSearch||!/I (?:have )?(?:searched|checked the warehouse|retrieved|looked up)/i.test(visible)};
 }catch(e:any){result.error={name:e.name,message:String(e.message).replace(/AIza[\w-]+/g,'REDACTED').slice(0,600)};}
 result.ms=Date.now()-started;await fs.writeFile(file,JSON.stringify(result,null,2));console.log(c.id,result.error?'ERROR':JSON.stringify(result.checks),result.ms+'ms');
}}
await Promise.all([worker(),worker()]);
