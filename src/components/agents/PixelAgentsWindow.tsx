import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,Check,ChevronDown,ChevronUp,Circle,GripHorizontal,Loader2,X} from 'lucide-react';
import type {AgentActivity,OrchestrationViewModel} from '../../agents/contract';
import {drawOffice,loadOffice} from './pixel/office';

/** Docks are cells of a 3×3 grid (row*3+col); the centre (4) is never a dock. */
export const DOCK_NAMES=['top left','top','top right','left','','right','bottom left','bottom','bottom right'];
const M=16, TOP=72, KEY='yuzee-agent-window-dock'; // TOP clears the 56px navbar

export function dockPosition(dock:number,w:number,h:number,vw:number,vh:number){
  const col=dock%3, row=Math.floor(dock/3);
  const x=col===0?M:col===2?vw-w-M:(vw-w)/2, y=row===0?TOP:row===2?vh-h-M:(vh-h)/2;
  return {x:Math.round(Math.max(0,Math.min(x,vw-w))),y:Math.round(Math.max(0,Math.min(y,vh-h)))};
}
/** Nearest edge/corner for a window dropped at x,y. */
export function snapDock(x:number,y:number,w:number,h:number,vw:number,vh:number){
  const cx=x+w/2, cy=y+h/2, col=cx<vw/3?0:cx>vw*2/3?2:1, row=cy<vh/3?0:cy>vh*2/3?2:1;
  if(col!==1||row!==1)return row*3+col;
  const d=[cx,vw-cx,cy,vh-cy], i=d.indexOf(Math.min(...d));
  return [3,5,1,7][i];
}
/** Arrow-key docking: one step in that direction, hopping over the centre. */
export function moveDock(dock:number,key:string){
  const [dc,dr]=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[key]??[0,0];
  const step=(c:number,r:number)=>[Math.max(0,Math.min(2,c+dc)),Math.max(0,Math.min(2,r+dr))];
  let [c,r]=step(dock%3,Math.floor(dock/3));
  if(c===1&&r===1)[c,r]=step(c,r);
  return c===1&&r===1?dock:r*3+c;
}
const readDock=()=>{try{const v=localStorage.getItem(KEY);return v!==null&&DOCK_NAMES[+v]?+v:2;}catch{return 2;}};
const media=(q:string)=>typeof matchMedia==='function'&&matchMedia(q).matches;

function PixelOffice({vm}:{vm:OrchestrationViewModel|null}){
  const ref=useRef<HTMLCanvasElement>(null), vmRef=useRef(vm), kick=useRef(()=>{});
  vmRef.current=vm;
  useEffect(()=>{
    const canvas=ref.current!, ctx=canvas.getContext('2d'), reduce=matchMedia('(prefers-reduced-motion: reduce)');
    if(!ctx)return;
    const seen=new Map();
    let raf=0, sprites:Awaited<ReturnType<typeof loadOffice>>|null=null, alive=true;
    const frame=()=>{
      raf=0; if(!sprites)return;
      const moving=drawOffice(ctx,sprites,vmRef.current,seen,performance.now(),reduce.matches,devicePixelRatio||1);
      if(moving&&!reduce.matches&&document.visibilityState==='visible')raf=requestAnimationFrame(frame);
    };
    kick.current=()=>{if(!raf)raf=requestAnimationFrame(frame);};
    const ro=new ResizeObserver(()=>{const dpr=devicePixelRatio||1;canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);kick.current();});
    ro.observe(canvas);
    loadOffice().then(s=>{if(alive){sprites=s;kick.current();}},()=>{}); // without sprites the text list still carries everything
    const wake=()=>kick.current();
    document.addEventListener('visibilitychange',wake);reduce.addEventListener('change',wake);
    return ()=>{alive=false;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('visibilitychange',wake);reduce.removeEventListener('change',wake);};
  },[]);
  useEffect(()=>kick.current(),[vm]);
  return <canvas ref={ref} aria-hidden="true" className="block h-full w-full [image-rendering:pixelated]"/>;
}

const STATUS:Record<AgentActivity['status'],{icon:React.ReactNode;text:string}>={
  queued:{icon:<Circle className="h-3.5 w-3.5 text-slate-400"/>,text:'Waiting'},
  running:{icon:<Loader2 className="h-3.5 w-3.5 text-[var(--accent)] motion-safe:animate-spin"/>,text:'Working'},
  completed:{icon:<Check className="h-3.5 w-3.5 text-emerald-600"/>,text:'Done'},
  failed:{icon:<AlertTriangle className="h-3.5 w-3.5 text-rose-600"/>,text:'Couldn’t finish'},
};

export function PixelAgentsWindow({vm,onClose}:{vm:OrchestrationViewModel|null;onClose:()=>void}){
  const titleId=useId(), win=useRef<HTMLDivElement>(null), grab=useRef<{dx:number;dy:number;moved:boolean}|null>(null);
  const [dock,setDock]=useState(readDock);
  const [drag,setDrag]=useState<{x:number;y:number}|null>(null);
  const [min,setMin]=useState(false);
  const [narrow,setNarrow]=useState(()=>media('(max-width: 639px)'));
  const [view,setView]=useState({vw:innerWidth,vh:innerHeight,w:400,h:440});
  const [said,setSaid]=useState('');

  useLayoutEffect(()=>{
    const el=win.current!, mq=matchMedia('(max-width: 639px)');
    const measure=()=>{setNarrow(mq.matches);setView({vw:innerWidth,vh:innerHeight,w:el.offsetWidth,h:el.offsetHeight});};
    measure(); el.focus();
    const ro=new ResizeObserver(measure); ro.observe(el);
    addEventListener('resize',measure);
    return ()=>{ro.disconnect();removeEventListener('resize',measure);};
  },[]);
  const settle=(d:number)=>{setDock(d);setSaid(`Docked ${DOCK_NAMES[d]}`);try{localStorage.setItem(KEY,String(d));}catch{}};

  const onPointerDown=(e:React.PointerEvent)=>{
    if(narrow||e.button!==0||(e.target as Element).closest('[data-no-drag]'))return;
    const r=win.current!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current={dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};
    setDrag({x:r.left,y:r.top});
  };
  const onPointerMove=(e:React.PointerEvent)=>{
    if(!grab.current)return; grab.current.moved=true;
    setDrag({x:Math.max(0,Math.min(e.clientX-grab.current.dx,view.vw-view.w)),y:Math.max(0,Math.min(e.clientY-grab.current.dy,view.vh-view.h))});
  };
  const onPointerUp=()=>{
    if(!grab.current||!drag)return;
    if(grab.current.moved)settle(snapDock(drag.x,drag.y,view.w,view.h,view.vw,view.vh)); grab.current=null; setDrag(null);
  };

  const acts=vm?.activities??[];
  const count=(s:AgentActivity['status'])=>acts.filter(a=>a.status===s).length;
  const summary=!vm?'No specialists working':[`${count('running')} working`,`${count('completed')} done`,count('failed')?`${count('failed')} couldn’t finish`:''].filter(Boolean).join(' · ');
  const pos=drag??dockPosition(dock,view.w,view.h,view.vw,view.vh);

  return createPortal(
    <div ref={win} role="dialog" aria-labelledby={titleId} tabIndex={-1}
      onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}
      style={narrow?undefined:{left:pos.x,top:pos.y}}
      className={`fixed z-[45] flex flex-col overflow-hidden border border-slate-700 bg-[#1e2235] text-slate-100 shadow-2xl outline-none ${narrow
        ?'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]'
        :`w-[400px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] rounded-xl ${drag?'':'motion-safe:transition-[left,top] motion-safe:duration-200 motion-safe:ease-out'}`}`}>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        className={`flex items-center gap-2 border-b border-slate-700 bg-[#262b42] px-3 py-2 select-none ${narrow?'':'cursor-grab touch-none active:cursor-grabbing'}`}>
        {!narrow&&<button type="button" aria-label={`Move window, docked ${DOCK_NAMES[dock]}. Arrow keys dock it to another side or corner.`}
          onKeyDown={e=>{const d=moveDock(dock,e.key);if(d!==dock||e.key.startsWith('Arrow')){e.preventDefault();if(d!==dock)settle(d);}}}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"><GripHorizontal className="h-4 w-4"/></button>}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold leading-tight">Your Yuzee team</h2>
          <p className="truncate text-xs text-slate-400">{summary}</p>
        </div>
        <button type="button" data-no-drag onClick={()=>setMin(m=>!m)} aria-expanded={!min} aria-label={min?'Expand team window':'Minimise team window'}
          className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">{min?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</button>
        <button type="button" data-no-drag onClick={onClose} aria-label="Close team window"
          className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"><X className="h-4 w-4"/></button>
        <span className="sr-only" aria-live="polite">{said}</span>
      </div>
      {!min&&<>
        <div className={`relative ${narrow?'h-[38vh] min-h-[160px]':'h-[240px] shrink-0'}`}>
          <PixelOffice vm={vm}/>
        </div>
        {!vm&&<p className="border-t border-slate-700 px-3 py-2 text-xs text-slate-300">Every specialist has a desk here. They sit down and start working when Oala gives them part of your question.</p>}
        {vm&&<ul aria-label="Specialists" className="max-h-28 min-h-0 overflow-y-auto border-t border-slate-700 px-3 py-2 text-xs">
          <li className="flex gap-2 py-0.5"><span className="mt-px shrink-0">{vm.state==='failed'?STATUS.failed.icon:vm.state==='completed'||vm.state==='partial_failure'?STATUS.completed.icon:STATUS.running.icon}</span>
            <span><span className="font-semibold">Oala</span> — {vm.statusMessage||vm.understood||'Coordinating your team'}</span></li>
          {acts.map(a=><li key={a.id} className="flex gap-2 py-0.5">
            <span className="mt-px shrink-0">{STATUS[a.status].icon}</span>
            <span className="min-w-0"><span className="font-semibold">{a.displayName}</span> — {STATUS[a.status].text}{(a.status==='completed'?a.summary:a.currentMessage)?`: ${a.status==='completed'?a.summary:a.currentMessage}`:''}</span>
          </li>)}
        </ul>}
        <p className="border-t border-slate-700 px-3 py-1 text-[10px] text-slate-500">
          Pixel art: <a className="underline hover:text-slate-300" href="https://github.com/pixel-agents-hq/pixel-agents" target="_blank" rel="noopener noreferrer">Pixel Agents</a> (MIT) · characters based on <a className="underline hover:text-slate-300" href="https://jik-a-4.itch.io/metrocity-free-topdown-character-pack" target="_blank" rel="noopener noreferrer">JIK-A-4 Metro City</a>
        </p>
      </>}
    </div>,
    document.body,
  );
}
