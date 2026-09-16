import { CounselAnswer, Progress, SSEDecoder, StreamGate, isAnswer } from '../shared/stream';
export type ChatContext = { title:string;summary:string };
export type PriorMessage = {role:'user'|'assistant';text:string};
export type StreamScenario = 'normal'|'no_summary'|'slow'|'interrupted'|'invalid';
export const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal.aborted)return reject(new DOMException('Stopped','AbortError'));
  const cancel=()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
  signal.addEventListener('abort',cancel,{once:true});
});
export function sampleCounsel(message:string,history:PriorMessage[]):CounselAnswer {
  const text=message.toLowerCase();const earlier=history.map(m=>m.text.toLowerCase()).join(' ');
  if(/hour|time|busy|work|family|child|caring|manage|flexib|schedule/.test(text))return {
    acknowledgement:'Let’s look at study around the time you actually have.',
    answer:'A smaller starting load may be worth exploring. Before deciding, compare the course’s weekly workload, scheduled classes and busiest assessment weeks with your available time.',
    uncertainty:'The sample course has no verified timetable or workload. I cannot tell whether it would fit yet.',
    question:/\d+\s*hours?|no spare time|under five|about five/i.test(message)?'What would you most like to check first?':'Roughly how much time could you set aside in a usual week?',
    options:/\d+\s*hours?|no spare time|under five|about five/i.test(message)?['Scheduled classes','Busy assessment weeks','A smaller starting load']:['Under five hours','About five to ten hours','I’m not sure yet'],
  };
  if(/not sure|unsure|don.t know|overwhelm/.test(text))return {acknowledgement:'You do not have to decide everything now.',answer:'We can narrow this down one question at a time. A useful starting point is what matters most to you about your next step.',uncertainty:'This is a sample conversation; it is not a personalised recommendation.',question:'What would help most right now?',options:['Understanding the work','Finding something flexible','Comparing learning paths']};
  if(/fee|fund|cost|price|afford/.test(text))return {acknowledgement:'Let’s separate the course price from any support you might qualify for.',answer:'We would need the published fee, the course intake and the relevant funding rules before estimating your cost. The course card cannot establish any of these.',uncertainty:'No fee or funding service is connected. Eligibility is unknown.',question:'Which location would you like to study in?',options:[]};
  if(/skill|learn|practis|practice|experience/.test(text))return {acknowledgement:'Let’s make the skills easier to picture.',answer:'In the sample, learners practise organising a small dataset and explaining a result. A useful next step is a small task that lets you try the work and see what support you need.',uncertainty:'The example curriculum is not verified. It does not establish workplace readiness.',question:'Have you tried a task like that before?',options:['Yes, through study','Yes, through work','Not yet']};
  if(/scheduled classes|busy assessment|smaller starting/.test(text)&&/time|hours|workload/.test(earlier))return {acknowledgement:'That gives us a specific thing to check.',answer:'Ask the provider for the relevant unit timetable and assessment schedule. Those details will help you compare the commitment with the time you have available.',uncertainty:'I cannot fetch the provider timetable in this concept.',question:'Would you like to explore another part of the course while that is still unknown?',options:['Look at the skills','Compare learning paths','I have enough for now']};
  if(/enough|stop|thank/.test(text))return {acknowledgement:'You can leave it here for now.',answer:'Your questions and answers will remain in this tab while it is open. You can return to the course or another question when you are ready.',uncertainty:'',question:'',options:[]};
  return {acknowledgement:'Let’s keep the next step focused.',answer:'This sample conversation can help you explore study time, skills and costs. For a broader response, choose Gemini mode; it will still only have the sample card and what you tell it.',uncertainty:'No live provider or job data is connected.',question:'Which part would you like to explore?',options:['Time for study','Skills I could learn','Fees and support']};
}
export async function sampleChat(message:string,history:PriorMessage[],scenario:StreamScenario,signal:AbortSignal,onProgress:(p:Progress)=>void):Promise<CounselAnswer> {
  onProgress({phase:'waiting',source:'fixture'});await pause(450,signal);
  if(scenario!=='no_summary')onProgress({phase:'thinking',source:'fixture'});
  await pause(scenario==='slow'?13500:1600,signal);
  onProgress({phase:'receiving',source:'fixture'});await pause(550,signal);
  if(scenario==='interrupted')throw new Error('The sample connection ended early. Your question is kept below.');
  onProgress({phase:'checking',source:'fixture'});await pause(200,signal);
  if(scenario==='invalid')throw new Error('The sample answer could not be checked. No incomplete answer has been displayed.');
  const answer=sampleCounsel(message,history);if(!isAnswer(answer))throw new Error('Invalid sample answer.');return answer;
}
export async function geminiChat(requestId:string,message:string,card:ChatContext,history:PriorMessage[],signal:AbortSignal,onProgress:(p:Progress)=>void):Promise<CounselAnswer> {
  onProgress({phase:'waiting',source:'app'});
  const response=await fetch('/api/concept/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,message,card,history:history.slice(-6)}),signal});
  if(!response.ok||!response.body)throw new Error(response.status===429?'Please wait a moment before another request.':response.status===503?'Gemini is not connected. You can use the sample conversation.':'Gemini could not be reached. Your question is kept below.');
  const reader=response.body.getReader(),decoder=new TextDecoder(),frames=new SSEDecoder(),gate=new StreamGate(requestId);
  try {
    for(;;){const {value,done}=await reader.read();if(done)break;if(signal.aborted)throw new DOMException('Stopped','AbortError');
      for(const raw of frames.push(decoder.decode(value,{stream:true}))){const event=gate.accept(raw);if(!event)continue;
        if(event.type==='progress')onProgress({phase:event.phase,source:event.source});
        if(event.type==='error')throw new Error(event.message);
      }
    }
    for(const raw of frames.push(decoder.decode()))gate.accept(raw);
    return gate.finish();
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
