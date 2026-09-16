export type Phase = 'waiting' | 'thinking' | 'receiving' | 'checking';
export type Progress = { phase: Phase; source: 'fixture' | 'gemini' | 'app' };
export type CounselAnswer = { acknowledgement: string; answer: string; uncertainty: string; question: string; options: string[] };
export type WireEvent = { requestId: string; seq: number } & (
  { type: 'progress'; phase: Phase; source: Progress['source'] } |
  { type: 'answer'; answer: CounselAnswer } | { type:'done' } | { type:'error'; message:string }
);
export const counselSchema = {
  type:'object', additionalProperties:false, required:['acknowledgement','answer','uncertainty','question','options'],
  properties:{
    acknowledgement:{type:'string',maxLength:240}, answer:{type:'string',minLength:1,maxLength:1000},
    uncertainty:{type:'string',maxLength:400}, question:{type:'string',maxLength:240},
    options:{type:'array',maxItems:3,uniqueItems:true,items:{type:'string',minLength:1,maxLength:90}},
  },
} as const;
export function isAnswer(x: unknown): x is CounselAnswer {
  if(!x||typeof x!=='object'||Array.isArray(x))return false;
  const a=x as Record<string,unknown>;
  if(Object.keys(a).sort().join(',')!=='acknowledgement,answer,options,question,uncertainty')return false;
  for(const [key,max] of [['acknowledgement',240],['answer',1000],['uncertainty',400],['question',240]] as const)if(typeof a[key]!=='string'||(a[key] as string).length>max)return false;
  return !!(a.answer as string).trim()&&Array.isArray(a.options)&&a.options.length<=3&&new Set(a.options).size===a.options.length&&a.options.every(s=>typeof s==='string'&&!!s.trim()&&s.length<=90)&&(!(a.options as string[]).length||!!(a.question as string).trim());
}
// Thought text/signatures never leave this adapter. Only the presence of an optional
// provider thought summary selects a reviewed progress title; JSON answer text stays separate.
export function inspectGeminiChunk(chunk: unknown): { hasSummary: boolean; answerText: string; finishReason?: string } {
  const candidate=(chunk as any)?.candidates?.[0];const parts=candidate?.content?.parts;
  return {hasSummary:Array.isArray(parts)&&parts.some(p=>p?.thought===true&&typeof p.text==='string'&&p.text.length>0),
    answerText:Array.isArray(parts)?parts.filter(p=>p?.thought!==true&&typeof p?.text==='string').map(p=>p.text).join(''):'',
    finishReason:typeof candidate?.finishReason==='string'?candidate.finishReason:undefined};
}
export const phaseCopy:Record<Phase,{titles:string[];subtext:string}> = {
  waiting:{titles:['Getting your answer ready','Waiting for a response'],subtext:'You can stop at any time. Your question will stay here.'},
  thinking:{titles:['Considering your question','Working on a useful answer'],subtext:'A brief answer first, then a useful next question.'},
  receiving:{titles:['Your answer is coming through','Receiving your answer'],subtext:'We will show it once the complete response has been checked.'},
  checking:{titles:['Checking the response'],subtext:'Making sure the answer can be displayed clearly.'},
};
export function progressCopy(progress:Progress,tick:number,elapsedMs:number) {
  const copy=phaseCopy[progress.phase];
  return {title:copy.titles[Math.floor(Math.max(0,tick))%copy.titles.length],subtext:elapsedMs>=12000?'This is taking longer than usual. You can keep waiting or stop.':copy.subtext};
}
// A connection ending is not success: require exactly one validated answer and a done event.
export class StreamGate {
  lastSeq=0; answer:CounselAnswer|null=null; done=false; failed=false;
  constructor(readonly requestId:string){}
  accept(x:unknown):WireEvent|null {
    if(this.done||this.failed)return null;
    const e=x as WireEvent;
    if(!e||e.requestId!==this.requestId)return null;
    if(!Number.isInteger(e.seq)||e.seq<=this.lastSeq)return null;
    if(e.type==='progress'&&(!Object.hasOwn(phaseCopy,e.phase)||!['app','gemini','fixture'].includes(e.source)))throw new Error('Invalid progress event.');
    if(e.type==='answer') {if(this.answer||!isAnswer(e.answer))throw new Error('The answer could not be checked.');this.answer=e.answer;}
    else if(e.type==='done') {if(!this.answer)throw new Error('The answer did not finish.');this.done=true;}
    else if(e.type==='error') {if(typeof e.message!=='string')throw new Error('The request did not finish.');this.failed=true;}
    else if(e.type!=='progress')throw new Error('Unknown stream event.');
    this.lastSeq=e.seq;return e;
  }
  finish(){if(!this.done||this.failed)throw new Error('The connection ended before the answer was complete.');return this.answer!;}
}
export class SSEDecoder {
  private buffer='';
  push(text:string):unknown[]{
    this.buffer+=text;if(this.buffer.length>100000)throw new Error('Stream limit exceeded.');
    const result:unknown[]=[];
    for(;;){const match=/\r?\n\r?\n/.exec(this.buffer);if(!match)break;const frame=this.buffer.slice(0,match.index);this.buffer=this.buffer.slice(match.index+match[0].length);const data=frame.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).replace(/^ /,'')).join('\n');if(data)result.push(JSON.parse(data));}
    return result;
  }
}
