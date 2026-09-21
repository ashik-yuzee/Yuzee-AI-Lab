import type {WarehouseCourse} from './types';
const empty=/^(?:missing(?:_or_not_verified)?|not_verified|unknown|not_applicable(?:_at_this_course_type)?|n\/?a|null|none)$/i;
export function cleanText(v:unknown,max=900):string|null {
 if(v===null||v===undefined||typeof v==='object'||typeof v==='boolean')return null;
 const t=String(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 return !t||empty.test(t)?null:t.replace(/_/g,' ').slice(0,max);
}
const json=(v:any)=>{if(typeof v!=='string')return v??{};try{return JSON.parse(v);}catch{return {};}};
const list=(v:any,max=8):string[]=>Array.isArray(v)?v.map(x=>cleanText(typeof x==='object'?x?.label||x?.name||x?.description:x)).filter(Boolean).slice(0,max) as string[]:cleanText(v)?[cleanText(v)!]:[];
const url=(value:any)=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.toString():null;}catch{return null;}};
const score=(v:any)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;
const label=(key:string)=>key.replace(/_/g,' ').replace(/^./,x=>x.toUpperCase());
// Only decision-useful sections are projected. Administrative fields stay in the warehouse.
function intelligenceSections(i:any):NonNullable<WarehouseCourse['intelligence']>{
 const readable=(v:any,depth=0):string[]=>{
  if(depth>2||v==null)return [];
  if(Array.isArray(v))return v.slice(0,4).flatMap(x=>readable(x,depth+1));
  if(typeof v==='object')return Object.entries(v).filter(([k])=>!/(?:source|url|confidence|verified|audit|status|score|id)$/.test(k)).slice(0,4).flatMap(([k,x])=>readable(x,depth+1).map(t=>`${label(k)}: ${t}`));
  if(typeof v==='boolean')return [v?'Yes':'No'];
  const t=cleanText(v,240);return t?[t]:[];
 };
 const definitions:Array<[string,string,any]>= [
  ['learning','Learning and practical work',i.learning_content],
  ['gaps','Skills to build further',i.skill_gap_map||i.skills?.skills_not_fully_closed],
  ['practice','Practical experience and portfolio',{internships:i.work_readiness?.internship_plan,portfolio:i.work_readiness?.portfolio_artifacts,placement:i.work_readiness?.placement_status}],
  ['roles','Roles and progression',{entry_roles:i.career_pathways?.entry_roles,roles_with_further_experience:i.career_pathways?.stretch_roles,not_immediate_roles:i.career_pathways?.not_immediate_roles}],
  ['role_basis','How career possibilities are described',{provider_claimed_roles:i.outcome_evidence?.provider_claimed_roles,yuzee_inferred_roles:i.outcome_evidence?.yuzee_inferred_roles}],
  ['progression','Credit and further study',i.credit_and_pathways],
  ['costs','Costs beyond tuition',Object.fromEntries(Object.entries(i.cost_full_picture||{}).filter(([k])=>!['tuition_fee','confidence','funding_options'].includes(k)))],
  ['professional','Professional and placement requirements',{registration_body:i.regulated_profession?.registration_body,placement_clearances:i.regulated_profession?.placement_clearances,licensing_steps:i.regulated_profession?.licensing_steps_after_graduation}],
  ['delivery','Attendance and study setup',i.delivery_detail],
  ['ai','AI and changing work',{context:i.ai_readiness?.context,portfolio_suggestions:i.ai_readiness?.ai_portfolio_suggestions}],
 ];
 return definitions.map(([key,title,value])=>({key,label:title,items:readable(value).slice(0,4).map(t=>t.slice(0,300))})).filter(s=>s.items.length);
}
export function normalizeCourse(r:any):WarehouseCourse {
 const i=json(r.intelligence_json),facts=i.verified_facts||{},outcome=i.yuzee_outcome_layer||{},skills=json(r.skills_json),q={...(i.trust_and_quality||{}),...json(r.quality_scores_json)};
 const frameworkLevel=[i.classification?.framework_level,i.course_identity?.framework_level,r.aqf_level].map(Number).find(n=>Number.isInteger(n)&&n>=1&&n<=10);
 const quality=[
  {key:'work',label:'Work readiness',value:score(r.work_readiness_score??q.work_readiness_score),explanation:'The catalogue’s assessment of preparation for the course’s intended work or progression outcome.'},
  {key:'future',label:'Future relevance',value:score(r.future_readiness_score??q.future_relevance_score),explanation:'The catalogue’s assessment of relevance to changing work and skills.'},
  {key:'overall',label:'Overall course readiness',value:score(r.yuzee_readiness_score??q.overall_yuzee_readiness_score),explanation:'The stored Yuzee course assessment. This is not your personal readiness or a job-success probability.'},
 ].filter(x=>x.value!==null) as WarehouseCourse['quality'];
 const course:WarehouseCourse={id:String(r.id),providerId:r.institution_id==null?'':String(r.institution_id),evidenceId:`warehouse_course_${r.id}`,name:cleanText(r.course_name)||'Course',provider:cleanText(r.institution_name)||'Provider not supplied',
  code:cleanText(r.national_code||r.course_code),level:frameworkLevel===undefined?null:String(frameworkLevel),type:cleanText(r.course_type||i.classification?.recognition_class),
  description:cleanText(outcome.student_outcome_headline||i.rendered_content?.short_summary||r.description),duration:cleanText(r.duration_text||facts.duration),delivery:list(json(r.delivery_modes_json)?.length?json(r.delivery_modes_json):facts.delivery_modes),locations:list(json(r.locations_json)?.length?json(r.locations_json):facts.campuses),
  entry:list(r.entry_requirements||facts.entry_requirements),fees:{domestic:cleanText(r.domestic_fee??facts.domestic_fee),international:cleanText(r.international_fee??facts.international_fee),details:list(i.cost_full_picture?.funding_options)},
  skills:list(skills.technical_skills||i.skills?.technical_skills||i.learning_content?.core_skills),outcomes:list(i.credit_and_pathways?.pathway_to_next_level||json(r.career_outcomes_json)),assessments:list(i.assessment_model?.assessment_types),bestFor:list(outcome.best_suited_for),
  considerations:[cleanText(outcome.honest_weakness),...list(outcome.not_ideal_for,3)].filter(Boolean) as string[],quality,qualityExplanation:cleanText(q.scoring_reason),
  intelligence:intelligenceSections(i),
  comparisonDetails:{learning:list(i.learning_content?.core_skills),practice:[...list(facts.work_placement?.model),...(facts.work_placement?.hours!=null?[`Recorded placement hours: ${facts.work_placement.hours}`]:[]),...list(i.work_readiness?.portfolio_artifacts,3).map(t=>'Yuzee portfolio guidance: '+t)],attendance:[...list(i.delivery_detail?.attendance_requirement),...list(i.delivery_detail?.mode)],credit:[...(typeof i.credit_and_pathways?.rpl_available==='boolean'?['Recognition of prior learning: '+(i.credit_and_pathways.rpl_available?'recorded as available':'recorded as unavailable')]:[]),...list(i.credit_and_pathways?.articulation_pathways,3)],strengths:list(outcome.best_suited_for),limitations:[cleanText(outcome.honest_weakness),...list(outcome.not_ideal_for,3)].filter(Boolean) as string[],outcome:cleanText(outcome.student_outcome_headline)},
  source:{label:'Yuzee course catalogue',url:url(r.canonical_url)||url(r.web_collect_url)||url(r.website),updatedAt:cleanText(r.intelligence_enriched_at||r.updated_at),origin:'YUZEE_WAREHOUSE'}};
 // Respect a conflict already identified by the warehouse itself. Do not silently
 // pick one of the contradictory interpretations or expose it as provider fact.
 const issueText=course.qualityExplanation||'';
 if(/critical conflict|unresolved conflict|conflicting (?:source|course|information|descriptions)|contradict(?:ory|ion)/i.test(issueText)&&!/\b(?:no|without|not an?) (?:critical )?(?:conflict|contradiction)/i.test(issueText)){
  course.evidenceIssues=[`${course.provider}: the catalogue flags conflicting course information. Course-specific duration, delivery, entry requirements and analysis are not established by this record.`,course.qualityExplanation!];
  Object.assign(course,{description:null,duration:null,delivery:[],locations:[],entry:[],fees:{domestic:null,international:null,details:[]},skills:[],outcomes:[],assessments:[],bestFor:[],considerations:[],quality:[],intelligence:[],comparisonDetails:{learning:[],practice:[],attendance:[],credit:[],strengths:[],limitations:[],outcome:null}});
 }
 return course;
}
