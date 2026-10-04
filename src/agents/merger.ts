/**
 * Deterministic evidence merger (spec §12–13, §29, §41). No model call: normalises envelopes, removes duplicate
 * findings (duplicates never raise confidence), surfaces conflicts, ranks sources, separates FACT from INFERENCE,
 * counts stale evidence, derives next actions the lab can honour, and renders the compact composer package.
 */
import type {AgentFinding,AgentResult,AgentType,EvidenceRef,MergeOutcome,NextAction,OrchestrationPlan,SourceKind} from './contract';
import {AGENT_DISPLAY} from './contract';
import {neutralise} from '../rag/pipeline';
import {estimateTokens} from '../services/TokenBudgetMemoryManager';

export const SOURCE_PRIORITY:SourceKind[]=['VERIFIED_ORGANISATION','GOVERNMENT_DATASET','YUZEE_FIRST_PARTY','PARTNER_API','PROVIDER_RECORD','JOB_FEED','THIRD_PARTY','USER_PROFILE','INFERENCE'];
export const PACKAGE_TOKENS=2500;
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
type Kind='fact'|'finding'|'recommendation';
export interface MergedFinding extends AgentFinding{agents:AgentType[];kind:Kind;refs:EvidenceRef[]}

export function mergeFindings(results:AgentResult[]):{items:MergedFinding[];duplicatesRemoved:number}{
  const items:MergedFinding[]=[];const byKey=new Map<string,MergedFinding>();let duplicatesRemoved=0;
  for(const r of results.filter(r=>r.status==='completed')){
    const refs=new Map(r.sources.map(s=>[s.id,s]));
    for(const [kind,list] of [['fact',r.facts],['finding',r.findings],['recommendation',r.recommendations]] as Array<[Kind,AgentFinding[]]>)for(const f of list){
      const keys=[`t:${norm(f.text)}`,...(f.subject&&f.evidenceIds.length?[`s:${norm(f.subject)}|${f.stance||''}|${[...f.evidenceIds].sort().join(',')}`]:[])];
      const hit=keys.map(k=>byKey.get(k)).find(Boolean);
      if(hit){duplicatesRemoved++;if(!hit.agents.includes(r.agent))hit.agents.push(r.agent);continue;}
      const m:MergedFinding={...f,agents:[r.agent],kind,refs:f.evidenceIds.map(id=>refs.get(id)).filter(Boolean) as EvidenceRef[]};
      items.push(m);for(const k of keys)byKey.set(k,m);
    }
  }
  return {items,duplicatesRemoved};
}

export function mergeResults(results:AgentResult[],plan:Pick<OrchestrationPlan,'agents'>):{merge:MergeOutcome;nextActions:NextAction[];items:MergedFinding[];agreements:number}{
  const ok=results.filter(r=>r.status==='completed');
  const {items,duplicatesRemoved}=mergeFindings(results);
  const bySubject=new Map<string,MergedFinding[]>();
  for(const f of items)if(f.subject)bySubject.set(norm(f.subject),[...(bySubject.get(norm(f.subject))||[]),f]);
  const conflicts:MergeOutcome['conflicts']=[];let agreements=0;
  for(const [subject,list] of bySubject){
    const pos=list.filter(f=>f.stance==='POSITIVE'),neg=list.filter(f=>f.stance==='NEGATIVE');
    if(pos.length&&neg.length)conflicts.push({subject,agents:[...new Set([...pos,...neg].flatMap(f=>f.agents))],statements:[...pos,...neg].map(f=>f.text)});
    else if(new Set(list.flatMap(f=>f.agents)).size>1)agreements++;
  }
  const sources=new Map<string,EvidenceRef>();for(const r of ok)for(const s of r.sources)sources.set(s.id,sources.get(s.id)?.stale?sources.get(s.id)!:s);
  // One vote per agent (not per finding), scaled by the share of checks that finished; conflicts lower it.
  const mean=ok.length?ok.reduce((n,r)=>n+r.confidence,0)/ok.length:0;
  const confidence=Math.max(0,Math.min(1,Math.round((mean*(results.length?ok.length/results.length:1)-0.05*conflicts.length)*100)/100));
  const seen=new Set<string>();
  const missingData=ok.flatMap(r=>r.missingData).filter(m=>{const k=norm(m);return k&&!seen.has(k)&&!!seen.add(k);}).slice(0,8);
  const merge:MergeOutcome={confidence,conflicts,missingData,staleEvidence:[...sources.values()].filter(s=>s.stale).length,
    counts:{facts:items.filter(f=>f.basis==='FACT').length,findings:items.length,duplicatesRemoved,evidence:sources.size},
    failedAgents:results.filter(r=>r.status==='failed').map(r=>r.agent)};
  return {merge,nextActions:nextActions(results,plan),items,agreements};
}

/** Only actions the lab can honour: BUILD_PATHWAY, follow-up prompts (ASK_FOLLOW_UP, COMPARE_COURSES, VIEW_JOB,
 * REQUEST_JOB_MATCH) and UPDATE_PROFILE. */
export function nextActions(results:AgentResult[],plan:Pick<OrchestrationPlan,'agents'>):NextAction[]{
  const get=(t:AgentType)=>results.find(r=>r.agent===t&&r.status==='completed');
  const data=(t:AgentType)=>(get(t)?.data||{}) as any;
  const out:Omit<NextAction,'priority'>[]=[];
  const path=get('PATHWAY_SPECIALIST');
  if(path){
    const na=data('PATHWAY_SPECIALIST').next_action;const best=data('PATHWAY_SPECIALIST').best_route||data('PATHWAY_SPECIALIST').routes?.[0]?.name;
    if(na&&typeof na.label==='string'&&(na.action==='UPDATE_PROFILE'||typeof na.prompt==='string'&&na.prompt.trim()||na.action==='BUILD_PATHWAY'&&best))
      out.push({action:na.action,label:na.label.slice(0,60),reason:String(na.reason||'').slice(0,200),...(na.action!=='UPDATE_PROFILE'?{prompt:(na.prompt?.trim()||`Build a step-by-step pathway for: ${best}`).slice(0,300)}:{}),expectedImpact:'high',evidenceIds:path.sources.slice(0,4).map(s=>s.id)});
    if(best)out.push({action:'BUILD_PATHWAY',label:'Build this pathway',reason:`Turns the recommended route into steps: ${String(best).slice(0,120)}`,prompt:`Build a step-by-step pathway for: ${String(best).slice(0,200)}`,expectedImpact:'high'});
  }
  const options=data('LEARNING_SPECIALIST').options||[];
  if(options.length>=2)out.push({action:'COMPARE_COURSES',label:'Compare learning options',reason:`${options.length} learning options were found for the gaps`,prompt:`Compare ${options[0].title} and ${options[1].title} for me`,evidenceIds:[...options[0].evidenceIds,...options[1].evidenceIds].slice(0,4)});
  const jobs=get('JOBS_SPECIALIST');const jobIds=jobs?.sources.filter(s=>s.id.startsWith('job:')).map(s=>s.id)||[];
  if(jobIds.length)out.push(plan.agents.some(a=>a.type==='PROFILE_SPECIALIST')
    ?{action:'REQUEST_JOB_MATCH',label:'Which of these jobs fit me?',reason:`${jobIds.length} job records were checked`,prompt:'Which of the job records you found fit me best, and why?',evidenceIds:jobIds.slice(0,4)}
    :{action:'VIEW_JOB',label:'Show the job records',reason:`${jobIds.length} job records were found`,prompt:'Show me the job records you found, with their dates and locations',evidenceIds:jobIds.slice(0,4)});
  const skill=data('SKILLS_SPECIALIST').recommended_next_skill;
  if(typeof skill==='string'&&skill.trim())out.push({action:'ASK_FOLLOW_UP',label:'Close my top skill gap',reason:`The skills check ranked this as the most useful next skill: ${skill.trim().slice(0,80)}`,prompt:`What is the quickest way to build ${skill.trim().slice(0,80)}?`});
  const opp=(data('OPPORTUNITY_SPECIALIST').opportunities||[])[0];
  if(opp?.title)out.push({action:'ASK_FOLLOW_UP',label:`Explore ${String(opp.title).slice(0,40)}`,reason:String(opp.why||'A related opportunity you did not search for').slice(0,200),prompt:`Tell me more about ${String(opp.title).slice(0,80)} and whether it could fit me`,evidenceIds:opp.evidenceIds});
  const missing=get('PROFILE_SPECIALIST')?.missingData||[];
  if(missing.length)out.push({action:'UPDATE_PROFILE',label:'Add your missing details',reason:`Would sharpen the advice: ${missing.slice(0,3).join(', ')}`});
  const seen=new Set<string>();
  return out.filter(a=>{const k=a.action==='ASK_FOLLOW_UP'?a.label:a.action;return !seen.has(k)&&!!seen.add(k);}).slice(0,4).map((a,i)=>({...a,priority:i+1}));
}

const labels=(refs:EvidenceRef[])=>{
  const c=new Map<string,number>();for(const r of [...refs].sort((a,b)=>SOURCE_PRIORITY.indexOf(a.source)-SOURCE_PRIORITY.indexOf(b.source)))c.set(r.label,(c.get(r.label)||0)+1);
  return c.size?` (${[...c].map(([l,n])=>n>1?`${l} ×${n}`:l).join('; ')}${refs.some(r=>r.stale)?'; includes older records':''})`:'';
};
const who=(a:AgentType[])=>a.map(t=>AGENT_DISPLAY[t].short).join('+');
const list=(v:unknown,n=6)=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,n).join('; '):'';

/** The compact <specialist_findings> block for the composer (≤ PACKAGE_TOKENS). All model-derived text is neutralised. */
export function renderPackage(results:AgentResult[],merge:MergeOutcome,actions:NextAction[]):string{
  const {items}=mergeFindings(results);
  const d=(t:AgentType)=>results.find(r=>r.agent===t&&r.status==='completed')?.data as any;
  const ranked=(k:Kind|'FACT'|'INFERENCE')=>items.filter(f=>k==='FACT'||k==='INFERENCE'?f.kind!=='recommendation'&&f.basis===k:f.kind===k)
    .sort((a,b)=>(a.importance==='critical'?0:a.importance==='useful'?1:2)-(b.importance==='critical'?0:b.importance==='useful'?1:2)||Math.min(...a.refs.map(r=>SOURCE_PRIORITY.indexOf(r.source)),9)-Math.min(...b.refs.map(r=>SOURCE_PRIORITY.indexOf(r.source)),9));
  const structured:string[]=[];
  const sk=d('SKILLS_SPECIALIST');if(sk)structured.push(`- Skills: matched ${list(sk.matched_skills)||'none shown'}; commonly required but not shown in the profile (critical) ${list(sk.missing_critical_skills)||'none'}; optional ${list(sk.missing_optional_skills)||'none'}; transferable ${list(sk.transferable_skills)||'none'}${sk.recommended_next_skill?`; most useful next skill ${sk.recommended_next_skill}`:''}`);
  const mk=d('MARKET_SPECIALIST');if(mk)structured.push(`- Market (direction ${mk.demand_direction||'UNKNOWN'}): ${(mk.signals||[]).slice(0,5).map((s:any)=>`[${s.timeframe}] ${s.text}`).join(' | ')||'no usable signals'}`);
  const jb=d('JOBS_SPECIALIST');if(jb)structured.push(`- Jobs: ${jb.direct_matches??0} direct record(s); titles ${list(jb.common_titles)||'n/a'}; recurring requirements ${list(jb.recurring_requirements)||'n/a'}; employers ${list(jb.employers,5)||'n/a'}${jb.adjacent_roles?.length?`; adjacent roles ${jb.adjacent_roles.slice(0,4).map((r:any)=>`${r.title} (${r.why})`).join('; ')}`:''}`);
  const co=d('COMPANY_SPECIALIST');if(co)structured.push(co.employer_evidence_found===false?`- Employer ${co.company||''}: no employer-specific records; make no claims about this employer's values, tools or hiring.`:`- Employer ${co.company||''}: roles ${list(co.roles)||'n/a'}; stated requirements ${list(co.requirements)||'n/a'}`);
  const ln=d('LEARNING_SPECIALIST');if(ln?.options?.length)structured.push(`- Learning options: ${ln.options.slice(0,5).map((o:any)=>`${o.title} (${o.kind}, ${o.size}) — ${o.why}`).join('; ')}`);
  const op=d('OPPORTUNITY_SPECIALIST');if(op?.opportunities?.length)structured.push(`- Opportunities beyond the request: ${op.opportunities.slice(0,4).map((o:any)=>`${o.title} (${o.kind}) — ${o.why}`).join('; ')}`);
  const pw=d('PATHWAY_SPECIALIST');if(pw?.routes?.length)structured.push(`- Routes:${pw.routes.map((r:any,i:number)=>` ${i+1}) ${r.name}: ${list(r.steps,5)}; time ${r.time}; effort ${r.effort}${r.barriers?.length?`; barriers ${list(r.barriers,3)}`:''}; why ${r.why}`).join(' |')}${pw.best_route?` | Best route: ${pw.best_route}`:''}`);
  const status=results.map(r=>r.status==='completed'?`${AGENT_DISPLAY[r.agent].short} ✓ ${r.summary}${r.metrics.reused?' (reused from earlier in this chat)':''}`:`${AGENT_DISPLAY[r.agent].short} ✗ did not finish (${r.error?.reason.toLowerCase().replace('_',' ')}) — leave this area out, do not guess`);
  // A ready-made outline, so the composer can write at low thinking: the specialists already did the analysis.
  const plan=[
    pw?.best_route&&`best route: ${pw.best_route}`,
    actions[0]&&`best next action: ${actions[0].label} (${actions[0].reason})`,
    sk?.missing_critical_skills?.length&&`main gaps to name: ${list(sk.missing_critical_skills,2)}`,
    [...(jb?.adjacent_roles||[]),...(op?.opportunities||[])].length&&`worth mentioning beyond the request: ${[...(jb?.adjacent_roles||[]),...(op?.opportunities||[])].slice(0,2).map((x:any)=>x.title).join('; ')}`,
  ].filter(Boolean);
  const lines=[
    ...(plan.length?[`ANSWER PLAN (direct answer first, then): ${plan.join(' | ')}`]:[]),
    `Checks: ${status.join(' | ')}`,
    ...(merge.failedAgents.length?[`UNFINISHED CHECKS: ${merge.failedAgents.map(a=>AGENT_DISPLAY[a].short.toLowerCase()).join(', ')}. Say so in one short plain sentence (e.g. "The ${AGENT_DISPLAY[merge.failedAgents[0]].short.toLowerCase()} check didn't finish, so I've left that out rather than guessing") and make no claims in that area.`]:[]),
    `Overall confidence ${merge.confidence} (evidence coverage, not the user's chances).${merge.staleEvidence?` ${merge.staleEvidence} older record(s): give their dates.`:''}`,
    ...(merge.conflicts.length?['CONFLICTS (preserve the nuance, do not pick one silently):',...merge.conflicts.map(c=>`- ${c.subject}: ${c.statements.map(s=>`"${s}"`).join(' vs ')} (${who(c.agents)})`)]:[]),
    'FACTS (from returned records):',...ranked('FACT').map(f=>`- [${who(f.agents)}] ${f.text}${labels(f.refs)}`),
    'INFERENCES (specialist judgement; present as such):',...ranked('INFERENCE').map(f=>`- [${who(f.agents)}] ${f.text}${labels(f.refs)}`),
    ...(structured.length?['STRUCTURED RESULTS:',...structured]:[]),
    ...(ranked('recommendation').length?['SPECIALIST SUGGESTIONS (inference):',...ranked('recommendation').map(f=>`- [${who(f.agents)}] ${f.text}`)]:[]),
    ...(merge.missingData.length?[`MISSING DATA: ${merge.missingData.join('; ')}`]:[]),
    ...(actions.length?[`NEXT ACTIONS THE APP SHOWS AS BUTTONS (mention the best one naturally; do not list them all): ${actions.map(a=>a.label).join('; ')}`]:[]),
  ];
  let used=0;const kept:string[]=[];
  for(const l of lines){const t=estimateTokens(l);if(used+t>PACKAGE_TOKENS)continue;used+=t;kept.push(l);}
  return `<specialist_findings note="Merged, evidence-checked specialist results for this turn (internal; write one Oala answer).">\n${neutralise(kept.join('\n'))}\n</specialist_findings>`;
}
