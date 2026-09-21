import dotenv from 'dotenv';
import {ObjectiveService} from '../src/objectives/service';
dotenv.config({quiet:true});
const service=new ObjectiveService();
const conversationId='conv-1789663380852-4zureu';
const current=(await service.list(conversationId)).find(s=>s.id==='d0e09aa2-5568-48e6-9436-3268f9a9e4b4');
if(!current||current.state!=='ACTIVE'||!current.context.user_message.startsWith('Switch to another synthetic scenario.'))throw Error('Synthetic test session not active');
const question=current.plan.ui.find((c:any)=>c.required&&c.component!=='action_handoff');
const value='These are fictional offers for testing. Offer A: customer support at Sample A, AUD 65,000 base salary, 38 hours a week, five days on site, 45-minute commute each way, informal training only. Offer B: trainee software support at Sample B, AUD 58,000 base salary, 38 hours a week, hybrid with two days on site, 20-minute commute, and two paid training hours weekly with a named mentor stated in the sample offer. Both are permanent in this scenario. My minimum base pay is AUD 56,000 and I want to build technical skills over the next two years. I value training most, then manageable travel, then extra pay. Progression is unknown. Do not verify the invented employers or infer guarantees.';
try{const next=await service.advance(conversationId,current.id,{revision:current.revision,answer:{component_id:question.id,value}},new AbortController().signal);console.log(JSON.stringify({id:next.id,status:next.plan.status,revision:next.revision,summary:next.plan.result.summary}));}catch(e:any){console.log(JSON.stringify({error:e.message,status:e.httpStatus,providerMessage:e.providerMessage}));process.exitCode=1;}
