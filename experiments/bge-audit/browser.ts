const button=document.querySelector('#run') as HTMLButtonElement,status=document.querySelector('#status')!;
button.onclick=async()=>{
 button.disabled=true;const start=performance.now(),gaps:number[]=[];let last=start;
 const memory=()=>{const m=(performance as any).memory;return m?{usedJSHeapSize:m.usedJSHeapSize,totalJSHeapSize:m.totalJSHeapSize,jsHeapSizeLimit:m.jsHeapSizeLimit}:null;};
 const memoryBefore=memory();const beat=setInterval(()=>{const n=performance.now();gaps.push(n-last);last=n;},50);
 const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});let workerCreationMs:number|undefined;
 try{
  const cases=(await(await fetch('/tests/fixtures/bge-heldout-skills.txt')).text()).trim().split('\n').map(l=>{const[expected,text]=l.split('|');return{expected,text};});
  const result:any=await new Promise((resolve,reject)=>{worker.onerror=e=>reject(Error(e.message));worker.onmessage=e=>{
   if(e.data.type==='entered')workerCreationMs=performance.now()-start;
   if(e.data.type==='progress')status.textContent=e.data.text;
   if(e.data.type==='result')resolve(e.data.result);
   if(e.data.type==='error')reject(Error(e.data.message));
  };worker.postMessage({type:'run',cases});});
  clearInterval(beat);result.startup.workerCreationMs=workerCreationMs;
  result.observations={totalMs:performance.now()-start,memoryBefore,memoryAfter:memory(),uiHeartbeat:{targetMs:50,ticks:gaps.length,maxGapMs:Math.max(...gaps)},visibility:document.visibilityState,cacheState:'Existing model caches; not forcibly cleared',deviceMemoryGB:(navigator as any).deviceMemory??null};
  const name=(document.querySelector('#name') as HTMLSelectElement).value;
  const response=await fetch('http://127.0.0.1:3001/record/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});
  if(!response.ok)throw Error('Diagnostic collector refused save: '+response.status);
  const summaries=Object.fromEntries(['batch12','batch1'].map(k=>{const rows=result.queries.map((q:any)=>q.decisions[k]);return[k,{correct:rows.filter((r:any)=>r.decision.toolId===r.expected).length,wrong:rows.filter((r:any)=>r.decision.status==='selected'&&r.decision.toolId!==r.expected).length,abstained:rows.filter((r:any)=>r.decision.status==='abstained').length,top1:rows.filter((r:any)=>r.top1Correct).length}];}));
  document.querySelector('#summary')!.textContent=JSON.stringify({saved:name+'.json',summaries,startup:result.startup.marks,indexTiming:result.timing,observations:result.observations},null,2);
  const a=document.querySelector('#download') as HTMLAnchorElement;a.href=URL.createObjectURL(new Blob([JSON.stringify(result)],{type:'application/json'}));a.download=name+'.json';a.hidden=false;status.textContent='Complete. Full diagnostics saved locally.';
 }catch(e){status.textContent='Error: '+String(e);}finally{clearInterval(beat);worker.terminate();button.disabled=false;}
};
