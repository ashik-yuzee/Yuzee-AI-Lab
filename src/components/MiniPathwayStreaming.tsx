import React from 'react';
import {Sparkles} from 'lucide-react';
import type {YuzeeContentBlock,YuzeeResponseV13} from '../types';
import {miniPathwayPanelResponse} from '../miniPathway/presentation';
import {ProtocolV13Renderer} from './ProtocolV13Renderer';

export function MiniPathwayStreaming({stage,blocks,source,onStop}:{stage:string;blocks:YuzeeContentBlock[];source:YuzeeResponseV13|null;onStop:()=>void}){
 return <div className="mini-pathway-stream">
  <div className="mini-pathway-stream-status">
   <div role="status" aria-live="polite"><Sparkles size={17} aria-hidden="true"/><span>{stage}</span></div>
   <button type="button" onClick={onStop}>Stop</button>
  </div>
  <p className="mini-pathway-stream-caption">{blocks.length?'Draft · Sections may change while the full pathway is checked.':'Your pathway will appear here as each section arrives.'}</p>
  <div className="mini-pathway-report" aria-label="Pathway draft" aria-busy="true">
   {source&&blocks.map(block=><div key={block.id} className="mini-pathway-stream-section">
    <ProtocolV13Renderer data={miniPathwayPanelResponse({...source,response_intent:'GENERAL_DELIVERY',content_blocks:[block],interaction:{...source.interaction,kind:'none',recommended_actions:[]}})} readOnly hideRecommendedActions pathwayLearningCues/>
   </div>)}
   <div className="mini-pathway-skeleton" aria-hidden="true">
    <span className="mini-pathway-skeleton-line mini-pathway-skeleton-title"/>
    <span className="mini-pathway-skeleton-line"/>
    <span className="mini-pathway-skeleton-line"/>
    <span className="mini-pathway-skeleton-line mini-pathway-skeleton-short"/>
   </div>
  </div>
 </div>;
}
