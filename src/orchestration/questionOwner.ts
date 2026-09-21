import type {ObjectiveSession} from '../objectives/contract';

export function workspaceQuestionOwner(sessions:ObjectiveSession[],visibleSessionId?:string|null) {
 const session=sessions.find(s=>s.id===visibleSessionId&&s.state==='ACTIVE');
 const question=session?.plan?.ui?.find((c:any)=>c.required&&c.component!=='action_handoff');
 if(!session||!question||session.pendingAnswer||session.pendingCorrection)return {question_owner:'CHAT' as const};
 return {question_owner:'WORKSPACE' as const,session_id:session.id,objective:session.label,question_id:question.id,question:question.prompt};
}

export function shouldDeferChatQuestion(response:any,coordination:ReturnType<typeof workspaceQuestionOwner>) {
 return coordination.question_owner==='WORKSPACE' && response?.interaction?.kind==='question' &&
  !response?.state?.safety_override_applied && !/SAFETY|SECURITY|CRITICAL_CLARIFICATION/.test(response?.response_intent||'') && !response?.service_trigger?.trigger_now;
}
