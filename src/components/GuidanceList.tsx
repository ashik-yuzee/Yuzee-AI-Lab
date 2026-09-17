import {learningToneIn} from "../miniPathway/learningTypes";
import {PathwayLearningCues} from "./PathwayLearningCues";
import React from 'react';
import {ArrowRight,Flag,Check,TriangleAlert,Info} from 'lucide-react';
import type {YuzeeContentBlock} from '../types';

const states={
 current:{label:'Start here',tone:'blue',Icon:Flag},
 next:{label:'Next step',tone:'purple',Icon:ArrowRight},
 warning:{label:'Check this',tone:'amber',Icon:TriangleAlert},
 blocked:{label:'Needs attention',tone:'rose',Icon:TriangleAlert},
 complete:{label:'Completed',tone:'green',Icon:Check},
 positive:{label:'Potential benefit',tone:'neutral',Icon:Info},
 negative:{label:'Consideration',tone:'amber',Icon:Info},
};
export function GuidanceList({block,pathwayLearningCues=false}:{block:YuzeeContentBlock;pathwayLearningCues?:boolean}){
 const ordered=block.type==='steps';
 const checkSection=/\b(what.*check|needs checking|still.*check|to confirm|to verify)\b/i.test(block.title);
 const Rows=ordered?'ol':'ul';
 return <section className="guidance-section">
  {block.title&&<h4 className="guidance-section-title">{block.title}</h4>}
  {block.text&&<p className="guidance-intro">{block.text}</p>}
  <Rows role="list" className={`guidance-rows${ordered?' guidance-rows-ordered':''}`}>
   {block.items.map((item,index)=>{
    const state=checkSection&&item.status==='warning'?null:states[item.status as keyof typeof states];
    const tone=state?.tone||'neutral';
    // Older responses can put the same ordinal in the title and value.
    // Keep it in the native list marker; leave measurements and other data intact.
    const numberedTitle=ordered?item.title?.match(/^(?:(?:stage|step)\s+([1-9]\d*)\s*[:.\-–—]\s*|([1-9]\d*)[.)]\s+)(\S[\s\S]*)$/i):null;
    const ordinal=numberedTitle?Number(numberedTitle[1]||numberedTitle[2]):index+1;
    const repeatedValue=ordered&&(
     (Boolean(numberedTitle)&&item.value?.trim()===String(ordinal))||
     new RegExp(`^(?:stage|step)\\s+${ordinal}[.:]?$`,'i').test(item.value?.trim()||'')
    );
    const value=repeatedValue?'':item.value;
    return <li data-learning-tone={pathwayLearningCues?learningToneIn([item.title,item.text,item.value].filter(Boolean).join(" ")):undefined} key={item.id||index} value={numberedTitle?ordinal:undefined} className={`guidance-row guidance-tone-${tone}`}>
     <div className="guidance-row-content">
      <div className="guidance-row-heading">
       {item.title&&<p className="guidance-row-title">{numberedTitle?numberedTitle[3]:item.title}</p>}
       {state&&<span className="guidance-status">{['warning','blocked'].includes(item.status)&&<state.Icon size={13} aria-hidden="true"/>}{state.label}</span>}
      </div>
      {pathwayLearningCues&&<PathwayLearningCues text={[item.title,item.text,item.value].filter(Boolean).join(" ")}/>}
      {item.side_label&&<p className="guidance-side-label">{item.side_label}</p>}
      {(item.text||value)&&<p className="guidance-description">{item.text||value}</p>}
      {item.text&&value&&value!==item.text&&<p className="guidance-description">{value}</p>}
      {item.side_text&&<p className="guidance-description">{item.side_text}</p>}
     </div>
    </li>;
   })}
  </Rows>
 </section>;
}
