/** Cooperative priority scheduler. Optional multi-chunk work yields after each embedding. */
export const taskPriority={route:0,needs:1,pathway:2,topic:3,suggest:4} as const;
export class EmbeddingQueue {
 private jobs=new Map<string,{priority:number;order:number;work:AsyncGenerator<void,void,unknown>}>();
 private order=0; private running=false;
 enqueue(id:string,type:keyof typeof taskPriority,work:AsyncGenerator<void,void,unknown>){
  if(this.jobs.size>=32||this.jobs.has(id))return false;
  this.jobs.set(id,{priority:taskPriority[type],order:this.order++,work});void this.pump();return true;
 }
 cancel(id:string){this.jobs.delete(id);}
 has(id:string){return this.jobs.has(id);}
 private async pump(){
  if(this.running)return;this.running=true;
  try{while(this.jobs.size){
   const [id,job]=[...this.jobs].sort((a,b)=>a[1].priority-b[1].priority||a[1].order-b[1].order)[0];
   try{const step=await job.work.next();if(step.done)this.jobs.delete(id);}catch{this.jobs.delete(id);}
   // Let pending postMessage/cancel events run before selecting the next chunk.
   await new Promise(resolve=>setTimeout(resolve,0));
  }}finally{this.running=false;}
 }
}
