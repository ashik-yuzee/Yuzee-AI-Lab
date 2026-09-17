import {parseOalaMention} from '../oala/invocation';

// Small semantic index. These are routing descriptions, never user-facing answers.
export const needScenarios = [
  {id:'answer', text:'Explain electives and prerequisites in simple words. What do these terms mean?'},
  {id:'answer', text:'Teach me a skill with worked examples and practice. Help me understand prioritisation and communication.'},
  {id:'answer', text:'Explain Yuzee services and career options. Give a shorter answer to my follow-up.'},
  {id:'clarify', text:'Can I fit study around my work and children? Understand my available hours and caring responsibilities before recommending.'},
  {id:'clarify', text:'I am not sure which career or study option fits me. Help me work out my goals and preferences.'},
  {id:'research', text:'What are the tuition fees for this course at this university for the next study year? Check official current prices.'},
  {id:'research', text:'Can I enrol in this degree at this university? Check its entry requirements, application deadline and intake dates.'},
  {id:'research', text:'Check the attendance timetable and placement requirements for this course and provider.'},
  {id:'research', text:'Find the official units, syllabus and accreditation of this course for this year.'},
] as const;
export type NeedKind = typeof needScenarios[number]['id'];
export type NeedHint = {status:'selected'|'abstained'; kind?:NeedKind; score?:number; margin?:number; reason:string};
export type NeedsHistory = {role:string; content:string; preflight?:TurnNeeds; telemetry?:{preflight?:TurnNeeds}}[];
export type TurnNeeds = {
  version:'turn-needs-v1'; action:'answer'|'clarify'|'research'; reason:string;
  basis:'rules'|'minilm'; missing:string[]; question:string;
  classifier?:NeedHint;
  scope:{target:string; studyYear:string; location:string};
  research?:{title:string; description:string};
};
export function chooseNeed(candidates:{id:string;score:number}[]):NeedHint {
  const ranked=candidates.filter(c=>needScenarios.some(s=>s.id===c.id)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1)
    .sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
  if(ranked.length<2)return {status:'abstained',reason:'incomplete-ranking'};
  const [a,b]=ranked, margin=a.score-b.score;
  if(a.score<.5||margin<.08)return {status:'abstained',reason:'uncertain'};
  return {status:'selected',kind:a.id as NeedKind,score:a.score,margin,reason:'semantic-match'};
}
export function acceptNeedHint(value:unknown):NeedHint|undefined {
  const h=value as NeedHint|undefined;
  if(h?.status==='abstained')return {status:'abstained',reason:['incomplete-ranking','uncertain','cancelled','input-length','not-ready','busy','timeout','unavailable','inference-failed','token-budget'].includes(h.reason)?h.reason:'not-provided'};
  if(!h||h.status!=='selected'||!needScenarios.some(s=>s.id===h.kind)||typeof h.score!=='number'||!Number.isFinite(h.score)||h.score<.5||h.score>1||typeof h.margin!=='number'||!Number.isFinite(h.margin)||h.margin<.08||h.margin>2)return;
  return {status:'selected',kind:h.kind,score:h.score,margin:h.margin,reason:'semantic-match'};
}
function explicitTarget(text:string):string {
  // Only explicit user wording is copied. No assistant claims are promoted to scope.
  const labelled=text.match(/(?:^|\n)\s*(?:course|qualification|option)\s*:\s*([^\n?!.]{3,250})/i)?.[1];
  if(labelled)return labelled.trim();
  const named=text.match(/\b((?:Bachelor|Master|Diploma|Certificate|Graduate Certificate|Graduate Diploma)[\w\s'’&()-]{2,110}?\s+(?:at|from)\s+)([^\n?.!,;]{2,140})/i);
  if(!named)return '';
  const provider=named[2].split(/\s+(?:in\s+20\d\d|for|cost|costs|fees|with|while|but|and I|because|please)\b/i)[0].trim();
  return provider?`${named[1]}${provider}`.trim():'';
}
const boundary=/\b(stop|pause|cancel|no more|don['’]t search|do not search|no research|never mind|suicid\w*|self.harm|emergency)\b/i;
const freshTopic=/\b(?:instead|different (?:course|topic)|new topic|forget (?:that|the course)|not (?:that|this) course)\b/i;
const lookup=/\b(fees?|tuition|entry requirements?|admission requirements?|application deadlines?|intake dates?|timetable|attendance requirements?|scholarships?|accreditation|placement requirements?)\b/i;
const concept=/\b(?:what (?:is|are|does)|explain|meaning of|define|teach)\b[\s\S]*\b(?:mean|meaning|concept|in general|simply|simple terms)\b|\b(?:what is (?:an? )?(?:elective|prerequisite|scholarship|tuition fee|accreditation)|explain (?:electives|prioritisation|communication))\b/i;
const selfFit=/\b(?:fit|manage|juggle|balance|suit|manageable)\b[\s\S]*\b(?:work|family|children|childcare|study|schedule)\b|\b(?:work|family|children|childcare)\b[\s\S]*\b(?:fit|manage|juggle|balance|study)\b/i;

/** Inspect each submitted turn before generation. Never turns similarity into evidence. */
export function assessTurnNeeds(input:{text:string;history?:NeedsHistory;structured?:boolean;location?:string;hint?:unknown}):TurnNeeds {
  const text=parseOalaMention(input.text).message;
  const hint=acceptNeedHint(input.hint);
  const result:TurnNeeds={version:'turn-needs-v1',action:'answer',reason:'ordinary-answer',basis:'rules',missing:[],question:text,
    classifier:hint||{status:'abstained',reason:input.structured?'quiz-answer':'not-provided'},
    scope:{target:'',studyYear:'',location:typeof input.location==='string'?input.location.slice(0,150):''}};
  if(input.structured){
    const last=input.history?.at(-1);
    const pending=last?.role==='assistant'?(last.preflight||last.telemetry?.preflight):undefined;
    // The server validates the active interaction first. Completing our specific
    // course clarification may unlock the offer; unrelated Quiz events keep their controller.
    if(pending?.action==='clarify'&&pending.missing.includes('course-and-provider')&&explicitTarget(text))
      return assessTurnNeeds({...input,structured:false,hint:undefined});
    result.reason='quiz-answer';return result;
  }
  if(boundary.test(text)||/Research reference: [a-f0-9-]{36}/.test(text)){result.reason='respect-boundary-or-saved-research';return result;}
  if(!text.trim()||text.length>1800){result.reason='defer-complex-input-to-counsellor';return result;}
  if(/^actually\b|^correction\b/i.test(text)&&!explicitTarget(text)){result.reason='user-correction';return result;}
  if((text.match(/\?/g)||[]).length>1||/\b(compare|versus)\b/i.test(text)){result.reason='multi-option-needs-counsellor';return result;}
  if(/\b(calculate|add|total|sum)\b/i.test(text)&&/\d/.test(text)){result.reason='use-supplied-numbers';return result;}
  if(/^what (?:is|are) (?:an? |the )?(?:entry requirements?|tuition fees?|scholarships?|accreditation)[?.!\s]*$/i.test(text)){result.reason='teach-without-search';return result;}
  if(/^(?:hi|hello|thanks|thank you|yes|no|okay|not sure)[.!\s]*$/i.test(text)||/\b(?:what (?:does yuzee|services)|who are you|what is yuzee)\b/i.test(text))return result;
  const history=input.history||[];
  const previous=history.at(-1);
  const pending=previous?.role==='assistant'?(previous.preflight||previous.telemetry?.preflight):undefined;
  const continuation=pending?.action==='clarify'&&pending.missing.includes('course-and-provider')&&!freshTopic.test(text)&&!!explicitTarget(text);
  const question=continuation?pending!.question:text;
  const ownTarget=explicitTarget(text);
  // Only carry a previous target for an explicit referent, not into an unrelated topic.
  const referent=/\b(this|that|it|same|the course|these units)\b/i.test(question)||continuation;
  let previousTarget='',previousTargetText='';
  if(referent&&!freshTopic.test(text)){
    for(const message of history.filter(m=>m.role==='user').slice(-3).reverse()){
      if(freshTopic.test(message.content))break;
      previousTarget=explicitTarget(message.content);
      if(previousTarget){previousTargetText=message.content;break;}
    }
  }
  result.scope.target=ownTarget||previousTarget;
  result.scope.studyYear=text.match(/\b20[2-9]\d\b/)?.[0]||(continuation?pending!.scope.studyYear:'')||previousTargetText.match(/\b20[2-9]\d\b/)?.[0]||'';
  result.question=continuation?`${question}\nCourse: ${ownTarget}`:text;
  if(concept.test(text)){result.reason='teach-without-search';return result;}
  const needsResearch=lookup.test(question)||(/\b(?:can I|when can I|how do I) enrol\b/i.test(question)&&!!result.scope.target)||(/\b(check|look up|find|verify|current|latest|official)\b/i.test(question)&&/\b(course|units|syllabus|provider|university)\b/i.test(question));
  const semanticResearch=hint?.kind==='research'&&/\b(course|provider|university|enrol|enroll|admission)\b/i.test(text);
  if(needsResearch||semanticResearch){
    result.basis=needsResearch?'rules':'minilm';
    if(!result.scope.target){result.action='clarify';result.reason='research-needs-scope';result.missing=['course-and-provider'];return result;}
    result.action='research';result.reason='specific-information-needs-sources';
    result.research={title:/fees?|tuition/i.test(question)?'Check course fees':/entry|admission/i.test(question)?'Check entry requirements':/timetable|attendance/i.test(question)?'Check attendance details':'Check official course details',description:'Look up relevant sources for this question. Review the details before searching.'};
    return result;
  }
  if(selfFit.test(text)||(hint?.kind==='clarify'&&/\b(study|work|family|children)\b/i.test(text))){
    const userContext=[...history.filter(m=>m.role==='user').slice(-3).map(m=>m.content),text].join('\n');
    if(!/\b(?:study|studying)\s+(?:for\s+)?\d+\s*(?:hours?|hrs?)\b|\b(?:have|spare|available)\s+(?:about\s+)?\d+\s*(?:hours?|hrs?)\b|\b\d+\s*(?:hours?|hrs?)\s+(?:a|per|each)\s+week\s+(?:for|to)\s+study\b/i.test(userContext)){
      result.action='clarify';result.reason='personal-fit-needs-availability';result.missing=['available-study-time'];result.basis=selfFit.test(text)?'rules':'minilm';
    }
  }
  return result;
}

export function needsInstruction(plan:TurnNeeds):string {
  const direction=plan.action==='clarify'
    ?`Give any useful general answer, then ask only the smallest unresolved question in the existing interaction schema. Missing candidate: ${plan.missing.join(', ')}. Check full conversation first: if already answered or irrelevant do not ask again. Do not guess the user's constraints. Do not show a research form yet. A fee clarification needs the course and provider, not an unsolicited explanation of government funding rules.`
    :plan.action==='research'
      ?'This specific request may need current source evidence. Explain what is known and what needs checking. The interface can offer an optional scoped lookup. No lookup has happened yet: do not claim to have searched, confirmed fees, or verified a provider. Unknown publication status is not proof that rates are not yet published. Do not supply specific subsidy bands, funding eligibility, mandatory extra charges or provider requirements from memory, including in option descriptions. Ask only a necessary fee-category question using plain labels without asserting eligibility. Do not repeat a generic intake or tell the user to fill a second generic form.'
      :'Answer the actual question with useful depth. Do not add a generic research invitation or ask what the user wants to know after they already told you. Ask a follow-up only if genuinely necessary.';
  return `TURN_NEEDS_GUIDANCE (server-owned, advisory; preserve main prompt and canonical JSON):\n${direction}\nThe classifier is fallible; prioritise the actual request and retained context. Similarity is not evidence. Financial rules, fee figures, funding eligibility and repayment calculations require dated relevant evidence; without it give a conditional conceptual explanation and identify the missing source. Never quote internal routing labels. Research remains a separate explicit user action.`;
}
export function researchOffer(plan:TurnNeeds|undefined){
  return plan?.version==='turn-needs-v1'&&plan.action==='research'&&plan.research&&plan.scope.target?plan:undefined;
}

/** Add only a resolved user-stated course, not a transcript or inferred personal profile. */
export function needsQuery(text:string,history:NeedsHistory):string {
  const current=parseOalaMention(text).message;
  const {scope}=assessTurnNeeds({text:current,history});
  if(!scope.target||current.includes(scope.target))return current;
  const query=`Current question: ${current}\nUser-stated course: ${scope.target}`;
  return query.length<=1800?query:current;
}
