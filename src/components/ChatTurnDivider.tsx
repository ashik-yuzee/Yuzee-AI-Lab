import React from 'react';

export function ChatTurnDivider({createdAt}:{createdAt?:number}){
 const date=typeof createdAt==='number'&&Number.isFinite(createdAt)&&createdAt>0?new Date(createdAt):null;
 const valid=date&&!Number.isNaN(date.getTime());
 const now=new Date(),yesterday=new Date(now);
 yesterday.setDate(now.getDate()-1);
 const day=valid?(date.toDateString()===now.toDateString()?'Today':date.toDateString()===yesterday.toDateString()?'Yesterday':date.toLocaleDateString('en-AU',{day:'numeric',month:'short',...(date.getFullYear()!==now.getFullYear()?{year:'numeric' as const}:{})})):'';
 const time=valid?date.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',hour12:true}).toUpperCase():'';
 return <div className="mb-6 text-center text-[13px] leading-6 text-slate-500" data-chat-turn-divider>
  {valid?<time dateTime={date.toISOString()} title={date.toLocaleString()}>{day} {time}</time>:<span>New exchange</span>}
 </div>;
}
