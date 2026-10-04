/**
 * MULTI_AGENT complexity gate (spec §7–8). Deterministic rules at t=0 decide the level, domains and specialists;
 * the warehouse query planner's classification (already paid for by the EXP-RAG lookup) refines the plan additively.
 * Same intent → same plan: no model call, no randomness.
 */
import type {AgentType,ComplexityLevel,DomainTag,OrchestrationPlan,PlannedAgent} from './contract';
import {AGENT_DISPLAY} from './contract';

export interface Route{level:ComplexityLevel;domains:DomainTag[];agents:AgentType[];personal:boolean;target:string|null;company:string|null;signals:string[]}

const DOMAIN_RULES:Array<[DomainTag,RegExp]>=[
  ['JOBS',/\b(jobs?|vacanc\w*|openings?|roles?|positions?|hiring|employers?|work as|internships?|placements?|graduate programs?)\b/i],
  ['COURSES',/\b(courses?|study|studying|qualifications?|certificates?|cert (?:i{1,3}|iv|[1-4])|diplomas?|degrees?|training|tafe|uni|university|micro-?credentials?|rpl|apprenticeships?|traineeships?|learn|learning|upskill\w*)\b/i],
  ['SKILLS',/\b(skills?|missing|gaps?|ready|readiness|suitable|suited|qualified|competitive|requirements?|what do i need|improve|asking for)\b/i],
  ['MARKET',/\b(demand|trends?|salar(?:y|ies)|pay|wages?|growth|growing|outlook|future|market|forecasts?|shortages?)\b/i],
  ['PATHWAY',/\b(how (?:do|can|would|could) i (?:become|get into|break into|start)|want to (?:become|be an?|get into|work (?:as|in))|(?:move|moving|switch|switching|change|changing|pivot|pivoting) (?:careers? )?(?:from .{2,40} )?(?:into|to)|switch(?:ing)? careers?|transition\w*|career change|change careers?|pathways?|paths?|routes?|roadmap|fastest way|quickest way|next steps?|what should i do|(?:career|study|action) plan|plan (?:for|to))\b/i],
  ['PROVIDERS',/\b(providers?|rtos?|institutions?|colleges?|campus(?:es)?)\b/i],
  ['FUNDING',/\b(funding|fee-?free|subsid\w*|scholarships?|cost|fees|afford\w*)\b/i],
];
const PERSONAL=/\b(am i|suits? me|fits? me|for me|my|mine|i am|i'?m|i'?ve|i have|i was|i work(?:ed)?|i studied|i did|i want|i need|i would like|i'?d like|i live|me)\b/i;
// "Show me…", "explain … to me", "near me" ask for information or a place, not a personalised judgement.
const IMPERSONAL=/\b(?:show|tell|give|let|help) me\b|\b(?:to|near|around|close to) me\b|\bi (?:want|need|would like|'?d like) to know\b|\bi wonder\b/gi;
const COMPARISON=/\b(compar\w*|versus|vs\.?|which (?:of these|one|is better|would)|better (?:option|fit|choice)|best fit|fits? me best|difference between)\b/i;
const ACTIONABLE=/\b(start getting me|get me (?:offers?|interviews?|a job|matched)|request\w* (?:offers?|matches|placements?)|apply (?:for|to) (?:them|these|those|jobs?)|help me apply|realistically apply|can apply for|close (?:any|my|the) gaps?|sign me up|enrol me)\b/i;
const DISCOVERY=/\b(?:find|search|look for|discover)\b.*\b(?:for me|i could|i can|that suit)\b|\bsuits? me\b|\b(?:i (?:could|might)|(?:could|can|might) i) (?:do|try)\b/i;
const DEFINITIONAL=/^\s*(?:what (?:does|do)\b.+\b(?:mean|stand for)\b|what(?: is|'s| are) (?:an? |the )?[\w\s/-]{1,30}\??\s*$|define\b|explain\b)/i;
const RECOMMENDING=/\b(best|top|good|should|which)\b/i;
const KNOWN_COMPANIES=/\b(google|microsoft|atlassian|canva|amazon|aws|apple|meta|facebook|ibm|oracle|salesforce|deloitte|kpmg|pwc|accenture|telstra|optus|bhp|rio tinto|fortescue|woodside|woolworths|coles|bunnings|wesfarmers|qantas|commonwealth bank|westpac|macquarie|xero|tesla|netflix|company [a-z])\b/i;
const NAMED_EMPLOYER=/\b(?:at|join(?:ing)?|work(?:ing)? for)\s+((?:[A-Z][\w&'.-]*)(?:\s+[A-Z][\w&'.-]*){0,2})/;
const NOT_EMPLOYERS=/^(?:tafe|uni|university|the|a|an|i|my|home|school|perth|sydney|melbourne|brisbane|adelaide|hobart|darwin|canberra|geelong|newcastle|wollongong|gold coast|cairns|townsville|australia|nsw|vic|qld|wa|sa|tas|nt|act|yuzee|oala|certificate|diploma|level|night|work)\b/i;
const LEAD=new Set('how many any find show me list are there the a an of these those what which some current available local new all for get to in this that'.split(' '));
const clean=(s:string)=>{const w=s.trim().split(/\s+/);while(w.length&&LEAD.has(w[0].toLowerCase()))w.shift();return w.join(' ').trim()||null;};

export function extractTarget(message:string):string|null{
  const m=message.match(/\b(?:become|be|into|as|get into|break into)\s+(?:an?\s+)?([a-z][a-z /-]{2,40}?)(?=[.,?!;]|\s+(?:jobs?|roles?|in|at|and|with|from|for|near|without|so|but)\b|$)/i)
    ||message.match(/((?:[\w-]+\s+){0,2}[\w-]+)\s+(?:jobs?|roles?|vacancies|positions?)\b/i);
  return m?clean(m[1]):null;
}
export function extractCompany(message:string):string|null{
  const known=message.match(KNOWN_COMPANIES)?.[1];
  if(known)return known.replace(/\b\w/g,c=>c.toUpperCase());
  const named=message.match(NAMED_EMPLOYER)?.[1]?.trim();
  return named&&!NOT_EMPLOYERS.test(named)?named:null;
}

const DOMAIN_AGENT:Partial<Record<DomainTag,AgentType>>={JOBS:'JOBS_SPECIALIST',COURSES:'LEARNING_SPECIALIST',SKILLS:'SKILLS_SPECIALIST',MARKET:'MARKET_SPECIALIST',COMPANY:'COMPANY_SPECIALIST'};
const ORDER:AgentType[]=['PROFILE_SPECIALIST','JOBS_SPECIALIST','COMPANY_SPECIALIST','SKILLS_SPECIALIST','MARKET_SPECIALIST','LEARNING_SPECIALIST','OPPORTUNITY_SPECIALIST','PATHWAY_SPECIALIST'];

/** Rules-only classification at t=0. */
export function classify(message:string):Route{
  const text=message.trim();
  const domains=new Set<DomainTag>(DOMAIN_RULES.filter(([,r])=>r.test(text)).map(([d])=>d));
  const company=extractCompany(text);
  if(company)domains.add('COMPANY');
  if(/\b(?:in|near|around) (?:me\b|[A-Z][a-z]+)|\b\d{4}\b/.test(text))domains.add('LOCATION');
  const personal=PERSONAL.test(text.replace(IMPERSONAL,' '));
  const comparison=COMPARISON.test(text),actionable=ACTIONABLE.test(text),discovery=DISCOVERY.test(text),pathway=domains.has('PATHWAY');
  const signals=[...[...domains].map(d=>`domain:${d}`),...(personal?['personal']:[]),...(comparison?['comparison']:[]),...(actionable?['actionable']:[]),...(discovery?['discovery']:[]),...(company?[`company:${company}`]:[])];
  const data=[...domains].filter(d=>d!=='LOCATION'&&d!=='FUNDING'&&d!=='PROVIDERS');
  const definitional=DEFINITIONAL.test(text)&&!personal&&!pathway&&!actionable&&!comparison&&!RECOMMENDING.test(text);
  let level:ComplexityLevel;
  if(definitional||(!data.length&&!actionable)){level=0;signals.push(definitional?'definitional':'no-data-domain');}
  else if(actionable)level=4;
  else if(pathway)level=3;
  else if(company)level=personal||data.length>=4?3:2;
  else if(data.length>=3)level=3;
  else if(personal||comparison||data.length===2)level=2;
  else level=1;
  if(personal&&level>=2)domains.add('PROFILE');
  const agents=new Set<AgentType>();
  if(level===1){
    const first=(['JOBS','COURSES','MARKET','SKILLS','COMPANY'] as DomainTag[]).find(d=>domains.has(d));
    if(first)agents.add(DOMAIN_AGENT[first]!);
  }else if(level>=2){
    if(personal||level>=3&&pathway||level===4)agents.add('PROFILE_SPECIALIST');
    for(const d of domains)if(DOMAIN_AGENT[d]&&d!=='SKILLS')agents.add(DOMAIN_AGENT[d]!);
    if(company)agents.add('JOBS_SPECIALIST');
    if(domains.has('SKILLS')||comparison&&domains.has('JOBS')||company&&personal)agents.add('SKILLS_SPECIALIST');
    if(discovery)agents.add('OPPORTUNITY_SPECIALIST');
    if(level>=3&&personal&&agents.has('SKILLS_SPECIALIST'))agents.add('LEARNING_SPECIALIST');
    if(level>=3&&pathway||level===4)for(const a of ['JOBS_SPECIALIST','SKILLS_SPECIALIST','LEARNING_SPECIALIST','PATHWAY_SPECIALIST'] as AgentType[])agents.add(a);
    if(level>=3&&pathway&&!actionable)agents.add('MARKET_SPECIALIST');
    if(level===4)agents.add('OPPORTUNITY_SPECIALIST');
  }
  if(level===0)agents.clear();
  // The plan's domains cover every selected specialist, not only the words that triggered them.
  const AGENT_DOMAIN:Partial<Record<AgentType,DomainTag>>={JOBS_SPECIALIST:'JOBS',SKILLS_SPECIALIST:'SKILLS',MARKET_SPECIALIST:'MARKET',LEARNING_SPECIALIST:'COURSES',COMPANY_SPECIALIST:'COMPANY',PATHWAY_SPECIALIST:'PATHWAY',PROFILE_SPECIALIST:'PROFILE'};
  for(const a of agents)if(AGENT_DOMAIN[a])domains.add(AGENT_DOMAIN[a]!);
  return {level,domains:[...domains],agents:ORDER.filter(a=>agents.has(a)),personal,target:extractTarget(text),company,signals};
}

const ID:Record<AgentType,string>={PROFILE_SPECIALIST:'profile',SKILLS_SPECIALIST:'skills',JOBS_SPECIALIST:'jobs',MARKET_SPECIALIST:'market',COMPANY_SPECIALIST:'company',LEARNING_SPECIALIST:'learning',PATHWAY_SPECIALIST:'pathway',OPPORTUNITY_SPECIALIST:'opportunities'};
export const agentId=(t:AgentType)=>ID[t];
/** Specialists whose work compares against the user (the rest analyse the market and catalogue for the goal). */
const USES_PROFILE=new Set<AgentType>(['SKILLS_SPECIALIST','OPPORTUNITY_SPECIALIST','PATHWAY_SPECIALIST']);

/** Spec §10 task wording. Evidence agents never make the final recommendation. */
export function taskFor(type:AgentType,route:Pick<Route,'target'|'company'>):string{
  const goal=route.target?`${route.target}`:'the user\'s goal';
  switch(type){
    case 'PROFILE_SPECIALIST':return `Review the user's profile only for information relevant to ${goal}. Return relevant qualifications, experience, transferable skills, location and study constraints, missing profile information and confidence. Do not recommend courses or jobs.`;
    case 'JOBS_SPECIALIST':return `Examine current ${goal} and adjacent opportunities relevant to the user's location. Return demand, common role titles, recurring requirements, employers, availability and notable patterns, including adjacent roles the user did not search for. Do not make a final recommendation.`;
    case 'SKILLS_SPECIALIST':return `Compare the user's current skills and experience with the recurring requirements for ${goal} and adjacent roles. Rank gaps as critical, useful or optional. Identify transferable skills. Do not recommend a final pathway.`;
    case 'MARKET_SPECIALIST':return `Evaluate demand and trend signals for ${goal} in the target location. Return demand direction, salary/range where supported, emerging requirements and material risks, labelling each as historical, current, inferred or uncertain. Do not make a final recommendation.`;
    case 'COMPANY_SPECIALIST':return `Find what ${route.company||'the named employer'} advertises and asks for, using only employer-specific records. Return roles, stated requirements and tools where present, and say plainly when no employer evidence exists. Do not make a final recommendation.`;
    case 'LEARNING_SPECIALIST':return `Identify the smallest effective learning options that could close likely gaps for ${goal}. Prefer short, efficient options over unnecessary full qualifications; return accredited and non-accredited possibilities where the evidence supports them. Do not make a final recommendation.`;
    case 'OPPORTUNITY_SPECIALIST':return `Look beyond the literal request for ${goal}: adjacent roles, traineeships, apprenticeships, placements or short activities in the evidence that could fit the user's profile, and why each is relevant. Do not make a final recommendation.`;
    case 'PATHWAY_SPECIALIST':return `Using the profile summary and the job, skill, course and market evidence, generate up to three realistic routes to ${goal}. Explain time, effort, barriers and why each route is viable; identify the best route and the best next action.`;
  }
}

export function buildPlan(route:Route,enabled:(t:AgentType)=>boolean=()=>true):OrchestrationPlan{
  const agents=route.agents.filter(enabled);
  const has=(t:AgentType)=>agents.includes(t);
  const planned:PlannedAgent[]=agents.map(type=>({
    id:ID[type],type,execution:route.level===1?'retrieval':'analysis',task:taskFor(type,route),
    // Only real consumers of the profile summary wait for it. Pathway reads the evidence itself and runs alongside the
    // other specialists (it used to wait for all of them: +2.5–3 s on every level-3 turn); Oala's composer merges them.
    dependsOn:route.level===1?[]:USES_PROFILE.has(type)&&has('PROFILE_SPECIALIST')?[ID.PROFILE_SPECIALIST]:[],
  }));
  const names=agents.map(a=>AGENT_DISPLAY[a].short.toLowerCase());
  const understood=route.level===0?'A direct question I can answer straight away.'
    :route.level===1?`A quick ${route.target?route.target+' ':''}lookup.`
    :`${route.target?`Your question about ${route.target}`:'Your question'} needs ${names.length>1?names.slice(0,-1).join(', ')+' and '+names.at(-1):names[0]} checks.`;
  return {complexityLevel:route.level,domains:route.domains,understood,visible:route.level>=2,agents:planned,classifier:{method:'rules',signals:route.signals}};
}

type PlannerView={action:string;facets?:string[];role_queries?:string[];job_queries?:string[];occupation_queries?:string[];provider_queries?:string[];location?:{name:string;postcode:string;state:string}};
/** Additive refinement from the warehouse planner (no extra tokens). Returns null when nothing changes. Agents and
 * dependencies are only added, so already-running work stays valid. */
export function refinePlan(plan:OrchestrationPlan,route:Route,p:PlannerView,enabled:(t:AgentType)=>boolean=()=>true):{plan:OrchestrationPlan;target:string|null}|null{
  const domains=new Set(plan.domains);const add:AgentType[]=[];
  const target=route.target||p.occupation_queries?.[0]||p.job_queries?.[0]||p.role_queries?.[0]||null;
  if(p.action==='NONE')return null;
  if(p.location&&(p.location.name||p.location.postcode||p.location.state))domains.add('LOCATION');
  if(p.provider_queries?.length)domains.add('PROVIDERS');
  if(p.facets?.includes('FUNDING'))domains.add('FUNDING');
  if(plan.complexityLevel>=2){
    if(p.action==='COURSES'||p.facets?.includes('LEARNING'))domains.add('COURSES');
    if(p.action==='SKILLS_JOBS'||p.facets?.includes('JOBS'))domains.add('JOBS');
    const want=(t:AgentType)=>!plan.agents.some(a=>a.type===t)&&enabled(t)&&add.push(t);
    if(domains.has('COURSES'))want('LEARNING_SPECIALIST');
    if(domains.has('JOBS'))want('JOBS_SPECIALIST');
    if(plan.complexityLevel>=3&&p.facets?.includes('LOCAL'))want('MARKET_SPECIALIST');
  }
  if(!add.length&&domains.size===plan.domains.length&&target===route.target)return null;
  const profile=plan.agents.some(a=>a.type==='PROFILE_SPECIALIST');
  const r={...route,target};
  const agents=[...plan.agents.map(a=>({...a,task:taskFor(a.type,r),dependsOn:a.dependsOn})),
    ...add.map(type=>({id:ID[type],type,execution:'analysis' as const,task:taskFor(type,r),dependsOn:profile&&USES_PROFILE.has(type)?[ID.PROFILE_SPECIALIST]:[]}))];
  // Pathway stays last so the panel reads in dependency order.
  agents.sort((a,b)=>(a.type==='PATHWAY_SPECIALIST'?1:0)-(b.type==='PATHWAY_SPECIALIST'?1:0));
  return {plan:{...plan,domains:[...domains],agents,classifier:{method:'rules+planner',signals:[...plan.classifier.signals,`planner:${p.action}`,...(p.facets||[]).map(f=>`facet:${f}`)]}},target};
}
