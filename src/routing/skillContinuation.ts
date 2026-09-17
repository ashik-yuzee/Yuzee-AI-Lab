import {abstain,eligibleTools,type RoutingDecision} from './policy';
import {isTopicMenu} from './skillSuggestions';
import {validateUserEventAgainstActiveInteraction} from '../protocol/validator';

/** Carry only an allowlisted skill across an explicit answer to its current question.
 * Free-text conversation, stale questions and topic menus keep ordinary routing. */
export function continueSkillQuestion(messages:any[],active:any,event:any):RoutingDecision {
 const last=messages.at(-1);
 if(!event||!last||last.role!=='assistant'||last.error||last.streamStopped||last.schemaValid===false||last.semanticValid===false||last.telemetry?.validation?.protocolAccepted===false)return abstain('no-skill-question');
 const response=last.structuredResponse;
 if(!response||active?.kind!=='question'||isTopicMenu(active)||response.interaction?.question_id!==active.question_id||!active.question_id)return abstain('no-skill-question');
 if(response.state?.safety_override_applied||response.service_trigger?.trigger_now||response.current_mode==='S_SERVICE_HANDOFF'||/SAFETY|SECURITY/.test(response.response_intent||''))return abstain('question-boundary');
 const answer=event.interaction||event.userEvent?.interaction||(event.type?{question_id:event.interaction_id,action_id:event.action_id,self_input:event.value||event.self_input,selected_option_ids:event.option_id?[event.option_id]:event.selected_option_ids,ranked_option_ids:event.ranked_ids||event.ranked_option_ids,fields:event.fields}:undefined);
 if(answer?.question_id!==active.question_id||answer?.action_id||!validateUserEventAgainstActiveInteraction(event,active).valid)return abstain('not-current-answer');
 const hasAnswer=!!(answer.self_input?.trim()||answer.selected_option_ids?.length||answer.ranked_option_ids?.length||Object.keys(answer.fields||{}).length);
 if(!hasAnswer)return abstain('empty-answer');
 // Free-entry corrections and new directions belong to the counsellor, not the old skill.
 if(/\b(stop|cancel|pause|instead|actually|change (?:topic|direction)|new (?:topic|question)|forget|ignore|suicid\w*|self.harm|emergency)\b/i.test(answer.self_input||''))return abstain('answer-boundary');
 const previous=last.telemetry?.routing;
 if(previous?.status!=='selected'||!eligibleTools.some(t=>t.id===previous.toolId))return abstain('no-skill-owner');
 return {status:'selected',toolId:previous.toolId,reason:'skill-question-continuation',version:'skill-input-v1'};
}
