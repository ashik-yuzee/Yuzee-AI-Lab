import {load,run} from './diagnostics';
const entered=performance.now();
self.onmessage=async(e)=>{
 if(e.data.type!=='run')return;
 try{
  const {extractor,marks,events}=await load('wasm');
  const result=await run(extractor,e.data.cases,s=>self.postMessage({type:'progress',text:s}));
  const resources=performance.getEntriesByType('resource').map((r:any)=>({name:r.name,duration:r.duration,startTime:r.startTime,responseEnd:r.responseEnd,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}));
  await extractor.dispose();
  self.postMessage({type:'result',result:{...result,runtime:{device:'wasm',threads:1,userAgent:navigator.userAgent},startup:{marks,events,workerEntryTime:entered,resources}}});
 }catch(e){self.postMessage({type:'error',message:String(e)});}
};
self.postMessage({type:'entered'});
