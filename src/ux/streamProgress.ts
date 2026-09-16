export type ChatProgressPhase = 'routing' | 'waiting' | 'thinking' | 'receiving' | 'checking' | 'reviewing';
export type ChatStreamProgress = { phase: ChatProgressPhase };
const phases: Record<ChatProgressPhase,{titles:string[];subtext:string}> = {
  routing:{titles:['Choosing useful guidance'],subtext:'Finding a focus for your question. You can stop at any time.'},
  waiting:{titles:['Getting your answer ready','Waiting for a response'],subtext:'You can stop at any time. Your question will stay here.'},
  thinking:{titles:['Considering your question','Working on a useful answer'],subtext:'A clear answer first, then the next useful step.'},
  receiving:{titles:['Your answer is coming through','Receiving your answer'],subtext:'We will show it once the complete response has been checked.'},
  reviewing:{titles:['Reviewing the explanation','Checking claims against the context'],subtext:'Checking the detail against the information provided.'},
  checking:{titles:['Checking the display format'],subtext:'Making sure the answer is ready to display.'},
};
export function parseChatProgress(value:unknown):ChatStreamProgress|null {
  const v=value as any;const phase=v?.phase??(v?.state==='generating'?'receiving':undefined);
  return typeof phase==='string'&&Object.hasOwn(phases,phase)?{phase:phase as ChatProgressPhase}:null;
}
export function chatProgressCopy(phase:ChatProgressPhase,tick:number,elapsed:number) {
  const copy=phases[phase];return {title:copy.titles[Math.max(0,Math.floor(tick))%copy.titles.length],subtext:elapsed>=12000?'This is taking longer than usual. You can keep waiting or stop.':copy.subtext};
}
/** Provider summary text and opaque signatures never enter the client stream. */
export function splitGeminiStreamChunk(chunk:any) {
  const candidate=chunk?.candidates?.[0],parts=candidate?.content?.parts;
  return {hasThoughtSummary:Array.isArray(parts)&&parts.some(p=>p?.thought===true&&typeof p.text==='string'&&p.text.length>0),
    text:Array.isArray(parts)?parts.filter(p=>p?.thought!==true&&typeof p?.text==='string').map(p=>p.text).join(''):'',
    finishReason:candidate?.finishReason};
}
