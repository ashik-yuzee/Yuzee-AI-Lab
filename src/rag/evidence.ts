/**
 * EXP-RAG evidence: the typed warehouse lookup (WarehousePack) is converted into compact, labelled
 * evidence chunks instead of being injected as raw JSON, ranked against the turn query, merged with
 * semantic catalogue-index hits, de-duplicated and packed under a token budget.
 */
import type {WarehousePack} from '../warehouse/types';
import type {IndexHit} from './warehouseIndex';
import {Bm25Index,rrf,dot,packByBudget,estimateTokens} from './search';
import {embed,embedderAvailable,type EmbedProvider} from './embedder';

export interface EvidenceChunk{id:string;group:'lookup'|'catalogue'|'context';entity:string;text:string;tokens:number;anchor?:boolean;evidenceId?:string}
const s=(v:unknown,max=220)=>{if(v==null||v==='')return '';const t=(typeof v==='object'?JSON.stringify(v):String(v)).replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max).replace(/\s+\S*$/,'')+'…':t;};
const ls=(a:unknown,n=6,max=160)=>Array.isArray(a)?a.slice(0,n).map(x=>s(typeof x==='object'&&x?(x as any).name||(x as any).title||(x as any).label||x:x,max)).filter(Boolean).join('; '):'';
const kv=(label:string,v:string)=>v?`${label}: ${v}`:'';
const lines=(...l:string[])=>l.filter(Boolean).join('\n');
const chunk=(id:string,entity:string,text:string,extra:Partial<EvidenceChunk>={}):EvidenceChunk=>({id,group:'lookup',entity,text,tokens:estimateTokens(text),...extra});
const objectLine=(o:any)=>o&&typeof o==='object'?Object.entries(o).filter(([,v])=>v!==null&&v!==undefined&&v!=='').slice(0,8).map(([k,v])=>`${k.replace(/_/g,' ')} ${s(v,60)}`).join(', '):'';

/** Split a typed lookup pack into self-describing evidence chunks. Anchors are always kept. */
export function packEvidence(pack:WarehousePack|null|undefined):EvidenceChunk[]{
  if(!pack||pack.status==='NOT_NEEDED')return [];
  if(pack.status!=='READY')return [chunk('status','status',`[warehouse status] ${pack.status}: ${pack.message||'No records were returned for this turn.'} Do not imply records exist; give useful general guidance and name what is missing.`,{anchor:true})];
  const out:EvidenceChunk[]=[];const c=pack.connected;
  if(c?.location?.requested||c?.location?.region){
    const loc=c.location;
    out.push(chunk('location','location',`[area] Requested "${s(loc.requested,80)}" -> ${loc.region?`resolved to ${loc.region.name} (${loc.region.tier}, ${loc.region.state})`:loc.candidates?.length?`ambiguous: ${loc.candidates.slice(0,4).map(x=>`${x.name} (${x.state})`).join('; ')} — do not pick one`:'not resolved; regional records below are wider-area or national only'}.${c.scopeNote?' '+s(c.scopeNote,300):''}`,{anchor:true}));
  }
  if(pack.comparison){
    const cmp=pack.comparison,opts=cmp.options;
    out.push(chunk('comparison','comparison',lines(
      `[comparison] ${s(cmp.title,120)}. ${s(cmp.baseline,300)}`,
      `Options: ${opts.map((o,i)=>`${i+1}) ${s(o.title,80)} — ${s(o.subtitle,100)}`).join('; ')}`,
      ...cmp.rows.map(r=>`- ${r.label} [${r.status.toLowerCase().replace(/_/g,' ')}; ${r.basis.toLowerCase().replace(/_/g,' ')}]: ${r.values.map((v,i)=>`${i+1}) ${v.length?v.map(x=>s(x,110)).join(' | '):'not supplied'}`).join('; ')}. Meaning: ${s(r.meaning,160)}`),
      ...(cmp.notes||[]).map(n=>`Note: ${s(n,240)}`),
      ...cmp.providerMatches.filter(m=>m.status!=='MATCHED').map(m=>`Provider "${s(m.query,60)}": ${m.status.toLowerCase().replace(/_/g,' ')}${m.providers.length?` (${m.providers.slice(0,4).map(p=>p.name).join('; ')})`:''} — do not substitute another provider.`),
    ),{anchor:true}));
    for(const q of cmp.qualifications||[])out.push(chunk(`units:${q.code}`,q.code,`[qualification units] ${q.code} (${s(q.scope,80)}): core ${q.units.filter(u=>/core/i.test(u.type)).slice(0,10).map(u=>u.title).join('; ')||'not supplied'}; electives (national list, not what a provider delivers) ${q.units.filter(u=>!/core/i.test(u.type)).slice(0,8).map(u=>u.title).join('; ')||'not supplied'}`,{evidenceId:q.evidenceId}));
  }
  const {courses,omitted,state,place,elsewhere}=localCourses(pack);
  if(omitted)out.push(chunk('courses:out-of-area','status',`[local scope] ${omitted} matching course record(s) are delivered only outside ${state} and are omitted. Do not name interstate providers as local options; mention other states only if the user asks.`,{anchor:true}));
  if(place&&elsewhere.size)out.push(chunk('courses:elsewhere','status',`[local scope] Records marked "elsewhere in ${state}" list campuses that do not include ${place}. Lead with providers delivering in or near ${place}; mention others only as alternatives the user would need to travel to or study online with, and say so.`,{anchor:true}));
  for(const course of courses){
    const who=`${course.name} — ${course.provider}`;
    out.push(chunk(`course:${course.id}:facts`,`course:${course.id}`,lines(
      `[course${elsewhere.has(course.id)?`, elsewhere in ${state}`:''}] ${who} (${[course.code,course.level&&`AQF level ${course.level}`,course.type].filter(Boolean).join('; ')})`,
      kv('Duration',s(course.duration,80)),kv('Delivery',course.delivery.join(', ')),kv('Course locations',course.locations.slice(0,6).join('; ')),
      kv('Entry',course.entry.slice(0,4).map(e=>s(e,160)).join('; ')),
      `Recorded tuition: domestic ${course.fees.domestic??'not supplied'}; international ${course.fees.international??'not supplied'}${course.fees.details.length?`; funding options noted: ${course.fees.details.slice(0,3).join('; ')}`:''}`,
      ...(course.evidenceIssues||[]).map(e=>`Evidence issue: ${s(e,300)}`),
      `Source: Yuzee course catalogue${course.source.updatedAt?`, updated ${s(course.source.updatedAt,10)}`:''}.`,
    ),{anchor:true,evidenceId:course.evidenceId}));
    const q=course.quality.map(x=>`${x.label} ${x.value}/100`).join('; ');
    const analysis=lines(
      `[course analysis] ${who}: ${s(course.description,320)}`,
      kv('May suit',course.bestFor.slice(0,3).join('; ')),kv('Considerations',course.considerations.slice(0,3).map(x=>s(x,180)).join('; ')),
      kv('Skills',course.skills.slice(0,8).join('; ')),kv('Next steps/pathways',course.outcomes.slice(0,4).join('; ')),kv('Assessment',course.assessments.slice(0,4).join('; ')),
      q?`Catalogue course scores (the course's intended outcome, never personal fit or job probability): ${q}.${course.qualityExplanation?' Reason: '+s(course.qualityExplanation,240):''}`:'',
    );
    if(analysis.split('\n').length>1)out.push(chunk(`course:${course.id}:analysis`,`course:${course.id}`,analysis,{evidenceId:course.evidenceId}));
    for(const section of course.intelligence||[])out.push(chunk(`course:${course.id}:${section.key}`,`course:${course.id}`,`[course detail · ${section.label}] ${who}: ${section.items.map(i=>s(i,200)).join('; ')}`,{evidenceId:course.evidenceId}));
  }
  if(c?.localOverview){
    const o=c.localOverview;
    out.push(chunk('local-overview','local',lines(
      `[local overview] ${o.area}, ${o.state} (${o.scope})${o.limited?' — limited coverage':''}`,
      o.profile?`Profile: ${o.profile.area} (${o.profile.scope}) ${o.profile.setting||''}${o.profile.population?`, population ${o.profile.population}`:''} — ${o.profile.period}, ${o.profile.source}`:'',
      ...o.community.slice(0,6).map(g=>`${g.label}: ${g.recordedCount} recorded (e.g. ${g.examples.slice(0,3).map(e=>e.name).join('; ')})`),
      kv('Coverage',s(o.coverage,220)),
    ),{anchor:true,evidenceId:o.evidenceId}));
  }
  for(const p of c?.providers||[])out.push(chunk(`provider:${p.id}`,`provider:${p.id}`,lines(
    `[provider] ${p.name} (${[p.type,[p.city,p.state].filter(Boolean).join(', ')].filter(Boolean).join('; ')})`,
    kv('Campuses (institution list, not course delivery)',p.campuses.slice(0,5).map(x=>[x.name,x.town,x.state].filter(Boolean).join(', ')).join('; ')),
    kv('Recorded learner support',p.support.join('; ')),
    p.higherEducationFunding?`Higher-education funding record (provider entitlement, not the learner's eligibility): ${objectLine(p.higherEducationFunding)}`:'',
    ...(p.funding||[]).slice(0,4).map((f:any)=>`Course funding record: ${objectLine(f)}`),
  ),{evidenceId:p.evidenceId}));
  for(const career of c?.careers||[])out.push(chunk(`career:${career.id}`,`career:${career.id}`,lines(
    `[career] ${career.title}: ${s(career.description,260)}`,
    kv('Tasks',career.tasks.slice(0,4).map(t=>s(t,140)).join('; ')),kv('Skills',career.skills.slice(0,8).join('; ')),kv('Work styles',career.workStyles.slice(0,4).join('; ')),
    kv('Course links',career.courseLinks.slice(0,3).map(l=>`${l.courseName} (${l.method})`).join('; ')),
    `Scope: ${s(career.profileScope,120)}; source ${s(career.profileSource,80)}.`,
  ),{evidenceId:career.evidenceId}));
  if(c?.industries?.length)out.push(chunk('industries','industries',`[industries] ${c.industries.slice(0,8).map(i=>`${i.name} (${i.method}; ${i.scope})`).join('; ')}`,{evidenceId:c.industries[0].evidenceId}));
  for(const sig of c?.signals||[])out.push(chunk(`signal:${sig.id}`,`signal:${sig.kind}`,`[signal · ${sig.kind.toLowerCase().replace(/_/g,' ')}] ${s(sig.title,120)}: ${s(sig.text,200)} — scope ${sig.scope}, area ${sig.region}${sig.period?`, period ${sig.period}`:''}${sig.metrics?`; ${objectLine(sig.metrics)}`:''}; ${sig.localMatch?'matches the user\'s area':'wider than the user\'s area'}; source ${s(sig.source,80)} (${s(sig.method,60)}).`,{evidenceId:sig.evidenceId}));
  const x=c?.exploration;
  if(x){
    for(const r of x.roles)out.push(chunk(`role:${r.id}`,`role:${r.id}`,lines(
      `[possible role] ${r.title}: ${s(r.description,240)}`,
      kv('Tasks',r.tasks.slice(0,4).map(t=>s(t,130)).join('; ')),kv('Skills that matched the request',r.matchedSkills.slice(0,6).join('; ')),
      kv('Other skills',r.skills.slice(0,6).map(k=>k.name).join('; ')),kv('Australian mapping',r.mappings.slice(0,2).map(m=>`${m.anzsco_title} (${m.method})`).join('; ')),
      `Why shown: ${s(r.matchReason,160)} — a possibility to explore, not a suitability score. Scope: ${s(r.scope,100)}.`,
    ),{evidenceId:r.evidenceId}));
    for(const l of x.learning)out.push(chunk(`learning:${l.id}`,`learning:${l.skill}`,`[where to learn] ${l.skill} -> ${l.code} (${l.kind}; ${l.method}): ${l.courses.slice(0,4).map(k=>`${k.name} — ${k.provider}`).join('; ')||'no course record linked'}. A link shows relevant content, not provider-specific delivery or assessment. Scope: ${s(l.scope,100)}.`,{evidenceId:l.evidenceId}));
    for(const j of x.jobs.slice(0,8))out.push(chunk(`job:${j.id}`,'jobs',lines(
      `[job advertisement record] ${s(j.title,100)} — ${s(j.company,80)}, ${s(j.area,60)} (posted ${j.postedAt?.slice(0,10)||'date not supplied'}; ${[j.employmentType,j.workMode,j.salary].filter(Boolean).map(v=>s(v,40)).join('; ')})`,
      kv('Skills',j.skills.slice(0,6).join('; ')),kv('Requirements',j.requirements.slice(0,3).map(r=>s(r,120)).join('; ')),
      `Availability NOT_CONFIRMED_CURRENT: a recorded advertisement, not confirmed open today. Geography: ${j.geography.scope} ${j.geography.name}${j.geography.localMatch?' (user\'s area)':''}.`,
    ),{evidenceId:j.evidenceId}));
    if(x.observedSkills.length)out.push(chunk('observed-skills','jobs',`[skills seen in the retrieved job sample] ${x.observedSkills.slice(0,10).map(o=>`${o.name} ${o.count}/${o.denominator}`).join('; ')} — ${x.coverage.note||'counts cover only this sample, not market-wide demand'} (sample ${x.coverage.sampleSize}, with structured skills ${x.coverage.withStructuredSkills}; ${s(x.observedSkills[0].geography,60)}).`,{evidenceId:x.observedSkills[0].evidenceId}));
  }
  // Neo4j graph links (relationships with their own method, scope and period) and vacancy forecasts.
  const intel=pack.intelligence;
  if(intel){
    const label:Record<string,string>={MAPS_TO_OCCUPATION:'mapped occupations',REQUIRES_SKILL:'skills in the qualification',MATCHES_WORK:'matched work',OBSERVED_REGIONAL_DEMAND:'recorded regional demand',CROSSWALKS_TO:'O*NET crosswalk'};
    for(const g of intel.graph){
      const groups=new Map<string,string[]>();
      for(const c of g.connections){
        const detail=[c.period&&`period ${s(c.period,20)}`,c.state&&c.state,c.regionKey&&`region ${s(c.regionKey,30)}`,c.method&&`method ${s(c.method,40)}`].filter(Boolean).join(', ');
        const list=groups.get(c.relation)||[];list.push(`${s(c.name,80)}${c.entityType==='Occupation'?` (ANZSCO ${c.sourceId})`:''}${detail?` [${detail}]`:''}`);groups.set(c.relation,list);
      }
      out.push(chunk(`graph:${g.entityType}:${g.sourceId}`,`graph:${g.sourceId}`,`[graph links] ${g.entityType==='Qualification'?'Qualification':'Occupation'} ${s(g.name,90)} (${g.sourceId}): ${[...groups].map(([r,v])=>`${label[r]||r.toLowerCase().replace(/_/g,' ')}: ${v.join('; ')}`).join(' | ')}. Source-backed relationships from the warehouse graph; a link explains a connection, not personal fit.`,
        // Links of a qualification the lookup returned are what "where does this course lead" turns are about.
        {anchor:g.entityType==='Qualification'}));
    }
    for(const f of intel.forecasts){
      const head=`[vacancy outlook] Internet Vacancy Index (online job advertisements, seasonally adjusted), ${f.geography}, ${f.skillLevel}${f.relevantCareers.length?` — the level of: ${f.relevantCareers.join('; ')}`:''}.`;
      out.push(chunk(`forecast:${f.seriesId}`,'forecast',f.points?.length
        ?`${head} Last observed ${f.lastObservedPeriod}. Method: ${f.method}. Forecast: ${f.points.map(p=>`${p.period} ${p.value}${p.q10!=null?` (80% range ${p.q10}-${p.q90})`:''}`).join('; ')}. A state/national outlook for this skill level, not a prediction for one occupation, suburb or person.`
        :`${head} ${f.note||'No forecast available.'}${f.lastObservedPeriod?` Latest observation ${f.lastObservedPeriod}.`:''} Do not present any outlook figure for this series.`,{anchor:true}));
    }
  }
  return out;
}

const STATE_NAMES:Record<string,string>={ACT:'australian capital territory',NSW:'new south wales',NT:'northern territory',QLD:'queensland',SA:'south australia',TAS:'tasmania',VIC:'victoria',WA:'western australia'};
const inState=(text:string,state:string)=>new RegExp(`\\b${state}\\b`,'i').test(text)||text.toLowerCase().includes(STATE_NAMES[state]||'\u0000');
const anyState=(text:string)=>Object.keys(STATE_NAMES).some(k=>inState(text,k));
/** With a known user state, keep courses delivered there (or online/unstated); out-of-state-only records are dropped
 * unless nothing local remains, so the answer never presents an interstate provider as a local option. */
export function localCourses(pack:WarehousePack){
  const state=pack.connected?.location?.region?.state;
  // Town-level scope: same-state campuses that do not list the user's place are labelled, not dropped (travel/online may suit).
  const place=(pack.connected?.location?.region?.name||'').replace(/^(greater|city of)\s+/i,'').split(/[,(]/)[0].trim();
  const elsewhere=new Set<string>();
  const mark=(courses:WarehousePack['courses'])=>{if(place.length>=3)for(const c of courses)if(c.locations.length&&!c.locations.some(l=>l.toLowerCase().includes(place.toLowerCase()))&&!c.delivery.some(d=>/online|distance|remote/i.test(d)))elsewhere.add(c.id);return courses;};
  if(!state||!STATE_NAMES[state])return {courses:mark(pack.courses),omitted:0,state,place,elsewhere};
  const outOfArea=(c:WarehousePack['courses'][number])=>c.locations.length>0&&c.locations.every(l=>anyState(l)&&!inState(l,state))&&!c.delivery.some(d=>/online|distance|remote/i.test(d));
  const local=pack.courses.filter(c=>!outOfArea(c));
  return local.length?{courses:mark(local),omitted:pack.courses.length-local.length,state,place,elsewhere}:{courses:mark(pack.courses),omitted:0,state,place,elsewhere};
}

/** Same local scope for catalogue-index course hits (campuses are in the hit text: "campuses Geelong, VIC; ..."):
 * interstate-only campuses are dropped, same-state campuses away from the user's place are labelled. */
export function scopeCatalogue(hits:IndexHit[],pack:WarehousePack|null):IndexHit[]{
  const state=pack?.connected?.location?.region?.state;
  if(!state||!STATE_NAMES[state])return hits;
  const place=(pack!.connected!.location!.region!.name||'').replace(/^(greater|city of)\s+/i,'').split(/[,(]/)[0].trim().toLowerCase();
  return hits.flatMap(h=>{
    if(h.kind!=='course')return [h];
    const campuses=(h.text.match(/campuses ([^\n]+)/i)?.[1]||'').split(';').map(x=>x.trim()).filter(Boolean);
    if(!campuses.length||/online|distance|remote/i.test(h.text.match(/Study: [^\n]*/)?.[0]||''))return [h];
    if(campuses.every(c=>anyState(c)&&!inState(c,state)))return [];
    return place.length>=3&&!campuses.some(c=>c.toLowerCase().includes(place))?[{...h,text:`[elsewhere in ${state}, not ${place}] ${h.text}`}]:[h];
  });
}

// Chunk keys (the labelled head of each chunk) are embedded once and cached across turns.
const KEY_CHARS=320,DENSE_POOL=40;
const keyCache=new Map<string,Float32Array>();
async function keyVectors(chunks:EvidenceChunk[],provider:EmbedProvider):Promise<Map<string,Float32Array>>{
  const out=new Map<string,Float32Array>();const missing:EvidenceChunk[]=[];
  const key=(c:EvidenceChunk)=>`${provider}:${c.text.slice(0,KEY_CHARS)}`;
  for(const c of chunks){const v=keyCache.get(key(c));if(v)out.set(c.id,v);else missing.push(c);}
  if(missing.length){
    const vecs=await embed(missing.map(c=>c.text.slice(0,KEY_CHARS)),'passage',{batch:48,provider});
    missing.forEach((c,i)=>{const k=key(c);if(keyCache.size>3000)keyCache.delete(keyCache.keys().next().value!);keyCache.set(k,vecs[i]);out.set(c.id,vecs[i]);});
  }
  return out;
}

export const EVIDENCE_TUNING={budget:3400,comparisonBudget:4800,catalogueMax:4,catalogueMinDense:0.6,perEntity:3,perGroup:{jobs:4,role:4,signal:4,career:3,learning:3,provider:2}};

export interface EvidenceSelection{chunks:EvidenceChunk[];tokens:number;dropped:number;lookupCount:number;catalogueCount:number;dense:boolean}
/** Rank lookup chunks by relevance (anchors first), add de-duplicated catalogue hits, pack under budget. */
export async function selectEvidence(query:string,queryVectors:Float32Array[],lookup:EvidenceChunk[],catalogue:IndexHit[],context:EvidenceChunk[]=[],tuning=EVIDENCE_TUNING,provider:EmbedProvider='bge'):Promise<EvidenceSelection>{
  const budget=lookup.some(c=>c.id==='comparison')?tuning.comparisonBudget:tuning.budget;
  const anchors=lookup.filter(c=>c.anchor);
  const rest=lookup.filter(c=>!c.anchor);
  let dense=false;let ranked=rest;
  if(rest.length){
    const lex=new Bm25Index(rest.map(c=>({id:c.id,text:c.text}))).search(query,rest.length);
    let denseList:Array<{id:string}>=[];
    // Ranking only decides what is dropped. When every chunk survives the diversity caps and the whole set fits the
    // budget, the dense rerank cannot change the outcome, so the embedding call (an API round trip for Gemini) is skipped.
    const count=(key:(c:EvidenceChunk)=>string)=>rest.reduce((m,c)=>m.set(key(c),(m.get(key(c))||0)+1),new Map<string,number>());
    const capsHit=[...count(c=>c.entity).values()].some(n=>n>tuning.perEntity)||[...count(c=>c.id.split(':')[0])].some(([g,n])=>{const cap=(tuning.perGroup as Record<string,number>)[g];return !!cap&&n>cap;});
    const allFit=!capsHit&&[...context,...anchors,...rest].reduce((n,c)=>n+c.tokens,0)+catalogue.slice(0,tuning.catalogueMax).reduce((n,h)=>n+(h.tokens||estimateTokens(h.text)),0)<=budget;
    if(queryVectors.length&&embedderAvailable(provider)&&!allFit){
      // Dense rerank over a bounded pool: BM25 leaders first, then unmatched chunks in pack order.
      const lexIds=new Set(lex.map(x=>x.id));
      const pool=[...lex.map(x=>rest.find(c=>c.id===x.id)!),...rest.filter(c=>!lexIds.has(c.id))].slice(0,DENSE_POOL);
      try{const v=await keyVectors(pool,provider);dense=true;denseList=pool.map(c=>({id:c.id,s:Math.max(...queryVectors.map(q=>dot(q,v.get(c.id)!)))})).sort((a,b)=>b.s-a.s);}catch{dense=false;}
    }
    const fused=rrf(dense?[lex,denseList]:[lex]);
    ranked=[...rest].sort((a,b)=>(fused.get(b.id)??0)-(fused.get(a.id)??0));
  }
  // Diversity: no single course or result family crowds out the rest.
  const perEntity=new Map<string,number>(),perGroup=new Map<string,number>();
  const diverse=ranked.filter(c=>{
    const g=c.id.split(':')[0];const cap=(tuning.perGroup as Record<string,number>)[g];
    const e=(perEntity.get(c.entity)||0)+1,n=(perGroup.get(g)||0)+1;
    if(e>tuning.perEntity||(cap&&n>cap))return false;perEntity.set(c.entity,e);perGroup.set(g,n);return true;
  });
  // Catalogue hits: skip entities already present from the typed lookup.
  const codes=new Set(lookup.map(c=>c.text.match(/\(([A-Z]{3,5}\d{3,6}[A-Z]?)\b/)?.[1]).filter(Boolean));
  const courseIds=new Set(lookup.map(c=>c.entity.startsWith('course:')?c.entity.slice(7):'').filter(Boolean));
  const cat=catalogue.filter(h=>!(h.kind==='qualification'&&codes.has(h.entity))&&!(h.kind==='course'&&courseIds.has(h.entity)))
    .filter(h=>(h.dense??0)>=tuning.catalogueMinDense||(h.lexicalRank!=null&&h.lexicalRank<2&&(h.dense??0)>=tuning.catalogueMinDense-0.08))
    .slice(0,tuning.catalogueMax)
    .map(h=>({id:h.id,group:'catalogue' as const,entity:h.id,text:h.text,tokens:h.tokens||estimateTokens(h.text)}));
  // Context (saved research/workspace results) and anchors first, then lookup and catalogue round-robin by rank.
  const ordered=[...context,...anchors];
  for(let i=0;i<Math.max(diverse.length,cat.length);i++){if(diverse[i])ordered.push(diverse[i]);if(cat[i])ordered.push(cat[i]);}
  const seen=new Set<string>();const unique=ordered.filter(c=>!seen.has(c.id)&&seen.add(c.id));
  const {kept,dropped,used}=packByBudget(unique,budget,c=>c.tokens);
  return {chunks:kept,tokens:used,dropped:dropped.length,lookupCount:kept.filter(c=>c.group==='lookup').length,catalogueCount:kept.filter(c=>c.group==='catalogue').length,dense};
}

export function renderEvidence(sel:EvidenceSelection):string{
  if(!sel.chunks.length)return '';
  const part=(group:EvidenceChunk['group'],note:string)=>{const c=sel.chunks.filter(x=>x.group===group);return c.length?`<${group} note="${note}">\n${c.map(x=>x.text).join('\n\n')}\n</${group}>`:'';};
  return ['<retrieved_evidence>',
    part('context','Saved results from this conversation (AI output or research; not confirmed user facts).'),
    part('lookup','Records returned by the typed warehouse lookup for this turn.'),
    part('catalogue','Semantic matches from the Yuzee catalogue index for discovery. Qualification summaries are national-level; delivery, fees and locations differ by provider.'),
    '</retrieved_evidence>'].filter(Boolean).join('\n');
}
