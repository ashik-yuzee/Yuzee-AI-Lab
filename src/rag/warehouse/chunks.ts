/**
 * Warehouse -> retrieval chunks for the EXP-RAG semantic index.
 * One chunk per meaningful entity, written as compact evidence text with its source and scope,
 * so a retrieved chunk can be placed in the prompt as-is. Private fields (contacts, emails, phones,
 * ABNs, user tables) are never read. Course offerings that share a national code are grouped,
 * because the qualification content is shared while delivery details stay in the typed lookup.
 */
import {cleanText} from '../../warehouse/normalize';

export type ChunkKind='qualification'|'course'|'occupation'|'anzsco'|'unit'|'provider'|'short_course';
export const CHUNKER_VERSION='warehouse-chunks-1.0';
export interface IndexChunk{id:string;kind:ChunkKind;entity:string;title:string;text:string;meta:Record<string,unknown>}

const json=(v:unknown):any=>{if(typeof v!=='string')return v??null;try{return JSON.parse(v);}catch{return null;}};
/** Text from HTML documents, including full pages with <style>/<script> blocks. */
export function plain(v:unknown,max=600):string{
  const raw=typeof v==='string'?v.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi,'. '):v;
  return clip(cleanText(raw,100_000)?.replace(/\s*\.(\s*\.)+/g,'.')||'',max);
}
/** Cut at a sentence end when one is near the limit, otherwise at a word boundary with an ellipsis. */
export function clip(t:string,max:number):string{
  if(t.length<=max)return t;
  const cut=t.slice(0,max),end=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('; '));
  return end>max*0.55?cut.slice(0,end+1):cut.replace(/\s+\S*$/,'')+'…';
}
const list=(v:unknown,max=6,len=140):string[]=>{
  const a=Array.isArray(v)?v:typeof v==='string'?v.split(/\s*[|;]\s*|\n+/):[];
  const out:string[]=[];
  for(const x of a){
    const t=plain(typeof x==='object'&&x?(x as any).role||(x as any).name||(x as any).label||(x as any).title||(x as any).skill_area||'':x,len);
    const item=t.replace(/[.;,\s]+$/,'');
    if(item&&!out.includes(item))out.push(item);
    if(out.length>=max)break;
  }
  return out;
};
const line=(label:string,items:string[]|string)=>{const v=Array.isArray(items)?items.join('; '):items;return v?`${label}: ${v}`:'';};
const join=(...lines:string[])=>lines.filter(Boolean).join('\n');
const LEVEL:Record<string,string>={'1':'Certificate I','2':'Certificate II','3':'Certificate III','4':'Certificate IV','5':'Diploma','6':'Advanced Diploma','7':'Bachelor','8':'Graduate Certificate/Diploma','9':'Masters','10':'Doctoral'};
export const levelLabel=(v:unknown)=>{const n=String(v??'').replace(/\.0$/,'');return LEVEL[n]||cleanText(v,40)||'';};

/** Yuzee course-intelligence fields that help discovery. Scores and confidence labels are excluded. */
function analysis(intel:any){
  const o=intel?.yuzee_outcome_layer||{},cp=intel?.career_pathways||{},rp=intel?.regulated_profession||{};
  return {
    headline:plain(o.student_outcome_headline||intel?.rendered_content?.short_summary,320),
    suits:list(o.best_suited_for,2,130),
    limits:[plain(o.honest_weakness,170).replace(/[.;\s]+$/,''),...list(o.not_ideal_for,1,120)].filter(Boolean),
    roles:list(cp.entry_roles,5),
    later:list(cp.stretch_roles,3),
    skills:list(intel?.learning_content?.core_skills||intel?.skills?.technical_skills,8,90),
    licensing:plain(rp.notes||(Array.isArray(rp.licensing_steps_after_graduation)?rp.licensing_steps_after_graduation.join('; '):''),200),
    next:list(intel?.credit_and_pathways?.pathway_to_next_level,3),
    delivery:plain(intel?.delivery_detail?.mode,60),
  };
}

export interface QualificationInput{
  code:string;title:string;nrtType:string|null;level:string|null;status:string|null;description:string|null;
  field:string|null;occupations:string|null;industry:string|null;anzsco:string|null;
  coreUnits:string[];offerings:number;providers:Array<{name:string;state:string}>;intel:any;
}
export function qualificationChunk(q:QualificationInput):IndexChunk{
  const a=analysis(q.intel);
  const states=[...new Set(q.providers.map(p=>p.state).filter(Boolean))].sort();
  const providers=q.providers.slice(0,5).map(p=>p.state?`${p.name} (${p.state})`:p.name);
  const kind=q.nrtType||'Qualification';
  return {id:`qual:${q.code}`,kind:'qualification',entity:q.code,title:`${q.title} (${q.code})`,
    meta:{code:q.code,level:q.level,type:kind,offerings:q.offerings,states,anzsco:q.anzsco},
    text:join(
      `${q.title} (${q.code}) — ${[q.level,kind,q.status&&q.status!=='Current'?q.status:''].filter(Boolean).join(' · ')}`,
      `Source: training.gov.au record${q.offerings?` and Yuzee catalogue (${q.offerings} offering${q.offerings===1?'':'s'}${states.length?' in '+states.join(', '):''})`:'; no current offering recorded in the Yuzee catalogue'}. National content is shared; delivery, fees and locations differ by provider.`,
      line('About',plain(q.description,400)),
      line('Field',[q.field||'',q.industry?`industry ${q.industry}`:''].filter(Boolean).join('; ')),
      line('Occupations named in the qualification',list(q.occupations,6,60)),
      line('Core units',q.coreUnits.slice(0,6)),
      a.headline&&`Yuzee analysis of a representative offering: ${a.headline}`,
      line('Possible entry roles (Yuzee analysis, not a guarantee)',a.roles),
      line('May suit',a.suits),line('Limits to know',a.limits),
      line('Licensing/registration note',a.licensing),
      line('Further study',a.next),
      line('Providers (examples)',providers),
    )};
}

export function courseChunk(r:any):IndexChunk{
  const intel=json(r.intelligence_json)||{},a=analysis(intel),facts=intel.verified_facts||{};
  const campuses=list(json(r.locations_json)?.map?.((l:any)=>[l?.suburb||l?.label,l?.state].filter(Boolean).join(', '))||facts.campuses,4,60);
  const delivery=list(json(r.delivery_modes_json)||facts.delivery_modes,3,40);
  const level=levelLabel(intel?.classification?.framework_level)||cleanText(r.aqf_level,40)||'';
  return {id:`course:${r.id}`,kind:'course',entity:String(r.id),title:`${cleanText(r.course_name,160)} — ${cleanText(r.institution_name,120)}`,
    meta:{courseId:String(r.id),provider:cleanText(r.institution_name,120),providerId:r.institution_id==null?null:String(r.institution_id),type:r.course_type,level,code:cleanText(r.national_code||r.course_code,30)},
    text:join(
      `${cleanText(r.course_name,160)} — ${cleanText(r.institution_name,120)} · ${[cleanText(r.course_type,40),level].filter(Boolean).join(' · ')}`,
      `Source: Yuzee course catalogue (provider course record${r.updated_at?`, updated ${String(r.updated_at).slice(0,10)}`:''}). Check current details with the provider.`,
      line('About',a.headline||plain(r.description,360)),
      line('You learn',a.skills),
      line('Possible roles (Yuzee analysis, not a guarantee)',a.roles),
      line('Study',[cleanText(r.duration_text||facts.duration,60)||'',delivery.join('/'),campuses.length?`campuses ${campuses.join('; ')}`:''].filter(Boolean).join('; ')),
      line('Entry',list(r.entry_requirements||facts.entry_requirements,3,160)),
      line('May suit',a.suits),line('Limits to know',a.limits),
    )};
}

export function occupationChunk(o:any,skills:string[],anzsco:string[]):IndexChunk{
  const styles=list(o.work_styles,4,200).map(s=>s.split(' - ')[0]);
  return {id:`occ:${o.job_id}`,kind:'occupation',entity:String(o.job_id),title:cleanText(o.job_title,120)||String(o.job_id),
    meta:{jobId:o.job_id,anzsco,category:o.career_category},
    text:join(
      `${cleanText(o.job_title,120)} — occupation profile${o.career_category?` (${cleanText(o.career_category,80)})`:''}`,
      `Source: O*NET occupation profile (general description, not a specific vacancy or Australian licensing rule)${anzsco.length?`; mapped Australian occupations: ${anzsco.slice(0,4).join('; ')}`:''}.`,
      line('About',plain(o.description,420)),
      line('Typical tasks',list(o.tasks,4,150)),
      line('Skills used',skills.slice(0,10)),
      line('Work styles',styles),
      line('Related study areas',list(o.keywords,5,50)),
    )};
}

export function anzscoChunk(o:any,projection:any):IndexChunk{
  const growth=projection?.growth_pct??o.jsa_5yr_growth_pct;
  const dated=projection?.release_date||o.jsa_updated_at;
  return {id:`anzsco:${o.anzsco_code}`,kind:'anzsco',entity:String(o.anzsco_code),title:`${cleanText(o.anzsco_title,120)} (ANZSCO ${o.anzsco_code})`,
    meta:{anzsco:o.anzsco_code,skillLevel:o.skill_level},
    text:join(
      `${cleanText(o.anzsco_title,120)} (ANZSCO ${o.anzsco_code}) — Australian occupation group${o.skill_level?`, skill level ${o.skill_level}`:''}`,
      `Source: ANZSCO / Jobs and Skills Australia record${dated?` (${String(dated).slice(0,10)})`:''}.`,
      line('About',plain(o.description,400)),
      growth!=null&&Number.isFinite(Number(growth))?`Outlook: national ${projection?.projection_horizon||5}-year employment projection ${Number(growth)>0?'+':''}${Number(growth).toFixed(1)}%${o.jsa_direction?` (${String(o.jsa_direction).toLowerCase()})`:''}. A national forecast, not local demand or a personal job outcome.`:'',
      o.is_shortage?`Recorded shortage status: ${cleanText(o.shortage_level,40)||'shortage'} (national assessment).`:'',
    )};
}

export function unitChunk(u:any,quals:Array<{code:string;title:string}>):IndexChunk{
  return {id:`unit:${u.unit_code}`,kind:'unit',entity:String(u.unit_code),title:`${cleanText(u.unit_title,160)} (${u.unit_code})`,
    meta:{unit:u.unit_code,package:cleanText(u.parent_package_title,120),quals:quals.map(q=>q.code)},
    text:join(
      `${cleanText(u.unit_title,160)} (${u.unit_code}) — unit of competency${u.parent_package_title?`, ${cleanText(u.parent_package_title,120)}`:''}`,
      'Source: training.gov.au unit record. A unit link shows where a skill can be learned; it is not proof a specific provider delivers it.',
      line('About',plain(u.description||u.application,460)),
      line('Included in',quals.slice(0,5).map(q=>`${q.title} (${q.code})`)),
    )};
}

export function providerChunk(p:any,courses:number):IndexChunk{
  const name=cleanText(p.public_known_as||p.business_name||p.legal_name,140)||'Provider';
  const support=[p.has_student_support&&'student support',p.has_disability_support&&'disability support',p.has_indigenous_support&&'Indigenous support',p.has_library&&'library',p.has_apprenticeships&&'apprenticeships'].filter(Boolean) as string[];
  return {id:`provider:${p.id}`,kind:'provider',entity:String(p.id),title:name,
    meta:{providerId:String(p.id),state:p.state,city:p.city,rto:p.rto_code||null},
    text:join(
      `${name}${name!==cleanText(p.legal_name,140)&&p.legal_name?` (${cleanText(p.legal_name,140)})`:''} — ${cleanText(p.rto_type,110)||'education'} provider${p.city||p.state?`, ${[p.city,p.state].filter(Boolean).join(', ')}`:''}`,
      `Source: Yuzee provider record${p.rto_code?` (RTO ${p.rto_code})`:''}${p.cricos_code?`; CRICOS ${p.cricos_code}`:''}${courses?`; ${courses} course record${courses===1?'':'s'} in the Yuzee catalogue`:''}. An institution address is not a course delivery location.`,
      line('Recorded learner support',support),
      p.higher_education_code?`Higher education provider code: ${p.higher_education_code}.`:'',
    )};
}

export function shortCourseChunk(s:any):IndexChunk{
  return {id:`short:${s.id}`,kind:'short_course',entity:String(s.id),title:`${cleanText(s.course_name,160)} — ${cleanText(s.institution_name,120)}`,
    meta:{providerId:s.institution_id==null?null:String(s.institution_id),category:s.category},
    text:join(
      `${cleanText(s.course_name,160)} — short course by ${cleanText(s.institution_name,120)}${s.category?` (${cleanText(s.category,60)}${s.level_code?`, ${cleanText(s.level_code,40)}`:''})`:''}`,
      'Source: Yuzee short-course record. Check current availability and fees with the provider.',
      line('About',plain(s.description,400)),
      line('Format',[s.duration_value?`${s.duration_value} ${cleanText(s.duration_unit,20)||''}`.trim():'',cleanText(s.delivery_type,30)||''].filter(Boolean).join('; ')),
    )};
}
