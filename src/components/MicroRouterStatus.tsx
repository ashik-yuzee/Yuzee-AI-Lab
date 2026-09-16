import React,{useEffect,useState} from 'react';
import {getRouterStatus,onRouterStatus,startWarmup,type RouterStatus} from '../services/MicroToolRouter';
export function MicroRouterStatus(){
 const [status,setStatus]=useState<RouterStatus>(getRouterStatus);
 useEffect(()=>{const unsub=onRouterStatus(setStatus);startWarmup();return unsub;},[]);
 return <span role="status" className="text-xs text-slate-500" data-router-status={status}>
  {status==='ready'?'Oala assist ready':status==='unavailable'?'Oala can still answer':'Preparing Oala assist'}
  {status==='unavailable'&&<button type="button" className="ml-2 underline" onClick={startWarmup}>Retry</button>}
 </span>;
}
