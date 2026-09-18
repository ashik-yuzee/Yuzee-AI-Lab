import {useEffect,useRef,useState} from 'react';
import type {PointerEvent,KeyboardEvent} from 'react';

const WIDTH_KEY='yuzee-mini-pathway-width';
export function useDrawerResize(open:boolean,expanded:boolean){
 const [viewport,setViewport]=useState(()=>window.innerWidth);
 const [preferred,setPreferred]=useState<number|null>(()=>{
  try{const value=Number(localStorage.getItem(WIDTH_KEY));return Number.isFinite(value)&&value>=320?value:null;}catch{return null;}
 });
 const [resizing,setResizing]=useState(false);
 const drag=useRef<{id:number;x:number;width:number}|null>(null);
 // Leave room to read the chat when docked; small screens use the existing overlay.
 const maximum=Math.max(1,viewport>=1200?viewport-360:viewport);
 const minimum=Math.min(320,maximum);
 const clamp=(value:number)=>Math.round(Math.max(minimum,Math.min(maximum,value)));
 const defaultWidth=Math.floor(viewport*0.45);
 const width=clamp(preferred??defaultWidth);
 useEffect(()=>{const resize=()=>setViewport(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{try{if(preferred===null)localStorage.removeItem(WIDTH_KEY);else localStorage.setItem(WIDTH_KEY,String(preferred));}catch{/* Resizing still works if browser storage is unavailable. */}},[preferred]);
 useEffect(()=>{drag.current=null;setResizing(false);},[open,expanded,viewport]);
 const finish=(event:PointerEvent<HTMLDivElement>)=>{
  if(drag.current?.id!==event.pointerId)return;
  drag.current=null;setResizing(false);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const onPointerDown=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||expanded)return;
  event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,x:event.clientX,width};setResizing(true);
 };
 const onPointerMove=(event:PointerEvent<HTMLDivElement>)=>{
  if(drag.current?.id!==event.pointerId)return;
  setPreferred(clamp(drag.current.width+drag.current.x-event.clientX));
 };
 const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
  const step=event.shiftKey?80:20;
  const next=event.key==='ArrowLeft'?width+step:event.key==='ArrowRight'?width-step:event.key==='Home'?minimum:event.key==='End'?maximum:null;
  if(next===null)return;event.preventDefault();setPreferred(clamp(next));
 };
 return {width,resizing,separatorProps:{
  role:'separator' as const,tabIndex:0,'aria-label':'Resize mini pathway','aria-orientation':'vertical' as const,
  'aria-valuemin':minimum,'aria-valuemax':maximum,'aria-valuenow':width,'aria-valuetext':`${width} pixels wide`,
  'aria-controls':'mini-pathway-body',title:'Drag left or right to resize. Use arrow keys, or double-click to reset.',
  onPointerDown,onPointerMove,onPointerUp:finish,onPointerCancel:finish,
  onLostPointerCapture:()=>{drag.current=null;setResizing(false);},onKeyDown,onDoubleClick:()=>setPreferred(null),
 }};
}
