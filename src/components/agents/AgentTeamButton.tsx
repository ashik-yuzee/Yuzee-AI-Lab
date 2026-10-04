import {useCallback,useRef,useState} from 'react';
import {Users} from 'lucide-react';
import {useTokenLab} from '../../context/TokenLabContext';
import {PixelAgentsWindow} from './PixelAgentsWindow';

/** Composer button (MULTI_AGENT only): badge = specialists running right now; opens the pixel office window. */
export function AgentTeamButton(){
  const {liveOrchestration}=useTokenLab();
  const [open,setOpen]=useState(false);
  const button=useRef<HTMLButtonElement>(null);
  const close=useCallback(()=>{setOpen(false);button.current?.focus();},[]);
  const n=liveOrchestration?.runningCount??0;
  return <>
    <button ref={button} type="button" onClick={()=>open?close():setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label={n?`${n} specialist${n===1?'':'s'} working`:'Open your Yuzee team'} title="Your Yuzee team"
      className={`relative w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-purple-500 ${open?'text-[var(--accent)] bg-[var(--accent-8)]':'text-[#8a929d] hover:text-[var(--accent)] hover:bg-[var(--accent-8)]'}`}>
      <Users className="w-4 h-4"/>
      {n>0&&<span aria-hidden="true" className="absolute top-0.5 right-0.5 sm:-top-1 sm:-right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold leading-4 text-center motion-safe:animate-pulse">{n>9?'9+':n}</span>}
    </button>
    {open&&<PixelAgentsWindow vm={liveOrchestration} onClose={close}/>}
  </>;
}
