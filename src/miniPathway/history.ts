import type {MiniPathwayRun} from './service';

export function completedPathways(runs:MiniPathwayRun[],conversationId:string):MiniPathwayRun[]{
 const unique=new Map<string,MiniPathwayRun>();
 for(const run of runs)if(run.conversationId===conversationId&&run.status==='complete'&&run.response)unique.set(run.id,run);
 return [...unique.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function selectSavedPathway(runs:MiniPathwayRun[],preferredId:string|null){
 return runs.find(r=>r.id===preferredId)||runs.at(-1)||null;
}
export function pathwayContext(run:MiniPathwayRun,messages:{id:string;serverMessageId?:string;role:string;content:string}[]):string{
 const index=messages.findIndex(m=>(m.serverMessageId||m.id)===run.sourceMessageId);
 if(index<0)return 'Saved from an earlier answer';
 const message=messages.slice(0,index).reverse().find(m=>m.role==='user');
 const text=message?.content.replace(/^\[QUESTION_ANSWERS:.*?\]\n/,'').replace(/\s+/g,' ').trim()||'';
 return text?text.length>110?text.slice(0,107)+'…':text:'Saved from an earlier answer';
}
export function pathwayDate(createdAt:string){
 const date=new Date(createdAt);
 return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
}
