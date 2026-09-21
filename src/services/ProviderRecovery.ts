/** Retry only stream creation, before any response content can be delivered. */
export async function openProviderStream<T>(open:()=>Promise<T>,signal:AbortSignal,onRetry:()=>void=()=>{},wait:(signal:AbortSignal)=>Promise<void>=waitForRetry):Promise<T> {
 for(let attempt=0;attempt<2;attempt++){
  signal.throwIfAborted();
  try{return await open();}catch(error:any){
   if(signal.aborted)throw error;
   const status=Number(error?.status);
   const dailyQuota=/per.day|daily.*quota|requests_per_day|tokens_per_day/i.test(error?.message||'');
   const transient=[429,500,502,503,504].includes(status)&&!dailyQuota;
   if(attempt||!transient)throw error;
   onRetry();await wait(signal);
  }
 }
 throw Error('Provider recovery exhausted');
}
function waitForRetry(signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();
  const cancel=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},1500);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
