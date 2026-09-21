import type {ObjectiveMatch} from './routing';
import type {ObjectiveSession} from './contract';

export function defersWorkspace(text:string){return /\b(not now|overview (?:only|first)|stay in chat|no (?:tools|workspace)|do not open|don.t open)\b/i.test(text)||/\b(?:compare|open|start|run|do (?:this|that|it)|look at)\b.{0,65}\blater\b/i.test(text)||/^later[!. ]*$/i.test(text.trim());}

// Conservative preview gates. Similarity is NOT a calibrated probability.
export const AUTO_OPEN_POLICY = {version:'workspace-assist-v6-explicit',minSimilarity:0.70};
export function explicitWorkspaceRequest(text:string,label:string){
 if(defersWorkspace(text))return false;
 if(!/\b(workspace|worksheet|side by side|visual|interactive)\b/i.test(text)||!/\b(now|please open|open (?:a|the|my)|let.s)\b/i.test(text))return false;
 const words=label.toLowerCase().match(/[a-z]+/g)||[];
 const meaningful=words.filter(w=>!['a','an','the','my','me','i','am','to','in','of','do','what','which','is','are','and','for'].includes(w));
 const input=new Set(text.toLowerCase().match(/[a-z]+/g)||[]);
 return meaningful.length>=2&&meaningful.every(w=>input.has(w));
}
export function workspaceDisposition(decision:any,candidates:ObjectiveMatch[],hasActive:boolean,userText='',label='',catalogueComparison=false){
 if(defersWorkspace(userText))return 'NONE';
 if(decision.decision!=='SUGGEST'||hasActive)return 'NONE';
 const selected=candidates.find(c=>c.id===decision.objective_id);
 const requestedOpen=/\b(?:open|start|show|build)\s+(?:(?:a|the|my|this|that)\s+)?(?:interactive\s+)?(?:workspace|worksheet|right side|side panel)\b/i.test(userText);
 // Explicit opening is user intent, not a probability inferred from a cosine score.
 // The validated shortlist and independent HIGH/REQUIRED selection still must agree.
 if(requestedOpen&&decision.confidence==='HIGH'&&decision.workspace_need==='REQUIRED'&&selected)return 'AUTO_OPEN';
 // An explicit course comparison with actual retrieved alternatives has a stronger
 // task signal than an absolute embedding threshold. The selector must still agree.
 if(catalogueComparison&&decision.objective_id==='STUDY_004'&&selected&&decision.confidence==='HIGH'&&decision.workspace_need==='REQUIRED'&&/\b(compare|comparison|differences?)\b/i.test(userText)&&!/\b(?:do not|don't)\s+compare\b/i.test(userText))return 'AUTO_OPEN';
 // Gemini independently judges intent and usefulness. A valid lower-ranked match
 // can open; the embedding score remains only a minimum relevance check.
 if(decision.confidence==='HIGH'&&decision.workspace_need==='REQUIRED'&&selected&&selected.score>=AUTO_OPEN_POLICY.minSimilarity)return 'AUTO_OPEN';
 return 'SUGGEST';
}
export function resultReady(session:ObjectiveSession){
 return session.state!=='CANCELLED'&&!session.pendingAnswer&&!session.pendingCorrection&&!!session.plan&&(['COMPLETE','NEEDS_RESEARCH'].includes(session.plan.status)||(session.plan.status==='NEEDS_INPUT'&&session.plan.readiness?.blockers?.length>0))&&!session.plan.ui.some((c:any)=>c.required&&c.component!=='action_handoff');
}
export function workspaceResultMessage(session:ObjectiveSession){
 const prefix=session.plan?.status==='NEEDS_RESEARCH'?'Evidence still needed':session.plan?.status==='NEEDS_INPUT'?'Review the next options':'Activity result';
 return `${prefix}: ${session.label}`;
}
