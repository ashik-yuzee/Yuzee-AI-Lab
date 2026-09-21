// Read-only relationship expansion. SQL templates and joins belong to the application.
const text=(x,n=500)=>x==null?'':String(x).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const json=x=>{try{return typeof x==='string'?JSON.parse(x):x||{};}catch{return {};}};
const list=(x,n=6)=>{const v=json(x);return(Array.isArray(v)?v:typeof x==='string'?x.split(' | '):[]).map(v=>text(typeof v==='object'?v.name||v.label||v.description:v,300)).filter(Boolean).slice(0,n);};
const number=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const flag=x=>x===1||x==='1'?true:x===0||x==='0'?false:null;
const {createOpportunityReader}=require('./opportunities.cjs');
const states=new Set(['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']);
function createLinkedReader(db,index){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
 const opportunities=createOpportunityReader(db,index);
 const query=(t,sql,args=[])=>tables.has(t)?db.prepare(sql).all(...args):[];
 const get=(t,sql,args=[])=>query(t,sql,args)[0];
 const safeLike=x=>String(x).replace(/[\\%_]/g,'\\$&');
 function localOverview(location){
  const region=location.region;if(!region)return null;
  const ancestors=location.chain.filter(r=>r.region_key!==region.key&&['SA3','SA4'].includes(r.tier)).map(r=>({name:text(r.name),scope:r.tier}));
  let profile=null;
  for(const r of location.chain.filter(r=>['SA2','SA3','SA4'].includes(r.tier))){
   const p=get('abs_region_profile','SELECT region_name,region_type,population,remoteness_area,source_year,source_name FROM abs_region_profile WHERE region_key=? ORDER BY source_year DESC LIMIT 1',[r.region_key]);
   if(p){profile={area:text(p.region_name),scope:text(p.region_type),population:number(p.population),setting:text(p.remoteness_area),period:String(p.source_year||''),source:text(p.source_name)};break;}
  }
  const column={SA2:'sa2_code',SA3:'sa3_code',SA4:'sa4_code'}[region.tier];
  const organisations=column?query('local_market_organisations',`SELECT id,name,organisation_type,suburb,state,source,last_verified_at,updated_at,gemini_proposed FROM local_market_organisations WHERE (${column}=?${region.tier==='SA2'?' OR (lower(suburb)=lower(?) AND state=?)':''}) AND coalesce(gemini_proposed,0)=0 ORDER BY lower(name),updated_at DESC LIMIT 251`,[region.key,...(region.tier==='SA2'?[region.name,region.state]:[])]):[];
  const seen=new Set(),groups=new Map();
  const categories={school:['learning','Learning and training'],rto:['learning','Learning and training'],university:['learning','Learning and training'],tafe:['learning','Learning and training'],employment_service:['employment','Help getting into work'],community_centre:['community','Community activities'],sport_club:['community','Community activities'],library:['community','Community activities'],support_service:['support','Community support'],employer:['business','Recorded businesses'],company:['business','Recorded businesses'],business:['business','Recorded businesses']};
  const typeOrder=['community_centre','rto','university','tafe','employment_service','library','sport_club','school','support_service','employer','company','business'];
  for(const o of organisations.slice(0,250).sort((a,b)=>typeOrder.indexOf(a.organisation_type)-typeOrder.indexOf(b.organisation_type)||String(a.name).localeCompare(String(b.name)))){
   const category=categories[o.organisation_type];if(!category||!text(o.name))continue;
   const key=[o.name,o.organisation_type,o.suburb,o.state].map(v=>text(v).toLowerCase()).join('|');if(seen.has(key))continue;seen.add(key);
   if(!groups.has(category[0]))groups.set(category[0],{key:category[0],label:category[1],recordedCount:0,examples:[]});
   const group=groups.get(category[0]);group.recordedCount++;
   if(group.examples.length<4)group.examples.push({name:text(o.name),type:text(o.organisation_type),source:text(o.source),updatedAt:text(o.last_verified_at||o.updated_at),area:text(o.suburb)||region.name});
  }
  return {evidenceId:'warehouse_local_overview_'+region.key,area:region.name,state:region.state,scope:region.tier,ancestors,profile,community:['community','learning','employment','support','business'].map(k=>groups.get(k)).filter(Boolean),limited:organisations.length>250,coverage:'Named organisations in the retrieved directory, deduplicated by name, type and place. Not a count of all local companies, current vacancies or confirmed service availability.'};
 }
 function resolveLocation(input){
  const name=text(input?.name,100),postcode=/^\d{4}$/.test(input?.postcode||'')?input.postcode:'',state=states.has(input?.state)?input.state:'';
  if(!name&&!postcode&&!state)return {requested:'',region:null,candidates:[],chain:[]};
  let matches=[];
  if(name)matches=query('region_spine',"SELECT * FROM region_spine WHERE lower(name)=lower(?)"+(state?' AND state=?':'')+' LIMIT 6',[name,...(state?[state]:[])]);
  if(!matches.length&&postcode){const p=query('dim_location_asgs','SELECT DISTINCT sa2_code,sa4_code,state_code FROM dim_location_asgs WHERE postcode=?'+(state?' AND state_code=?':'')+' LIMIT 6',[postcode,...(state?[state]:[])]);for(const r of p){const m=get('region_spine','SELECT * FROM region_spine WHERE region_key=?',[r.sa2_code||r.sa4_code]);if(m&&!matches.some(x=>x.region_key===m.region_key))matches.push(m);}}
  if(!matches.length&&name)matches=query('region_spine',"SELECT * FROM region_spine WHERE name LIKE ? ESCAPE '\\'"+(state?' AND state=?':'')+' LIMIT 6',[safeLike(name)+' -%',...(state?[state]:[])]);
  if(!name&&!postcode&&state)matches=query('region_spine',"SELECT * FROM region_spine WHERE tier='STATE' AND (state=? OR region_key=?) LIMIT 2",[state,state]);
  // A town, district and wider region may share a name. Prefer the exact local
  // node only when every other match is its ancestor, never across distinct places.
  if(matches.length>1){
   const locals=matches.filter(r=>r.tier==='SA2');
   if(locals.length===1){
    const ancestorKeys=new Set();let parent=locals[0];
    while(parent&&ancestorKeys.size<6&&!ancestorKeys.has(parent.region_key)){ancestorKeys.add(parent.region_key);parent=parent.parent_key?get('region_spine','SELECT * FROM region_spine WHERE region_key=?',[parent.parent_key]):null;}
    if(matches.every(r=>ancestorKeys.has(r.region_key)))matches=locals;
   }
  }
  const region=matches.length===1?matches[0]:null,chain=[];let node=region;
  while(node&&chain.length<5&&!chain.some(r=>r.region_key===node.region_key)){chain.push(node);node=node.parent_key?get('region_spine','SELECT * FROM region_spine WHERE region_key=?',[node.parent_key]):null;}
  return {requested:[name,postcode,state].filter(Boolean).join(', '),region:region?{key:region.region_key,name:region.name,tier:region.tier,state:region.state}:null,candidates:matches.length>1?matches.map(r=>({key:r.region_key,name:r.name,tier:r.tier,state:r.state})):[],chain};
 }
 function read(courses,plan={}){
  const facets=new Set(plan.facets||[]),all=!Array.isArray(plan.facets),has=x=>all||facets.has(x);
  const location=resolveLocation(plan.location),providers=[],careers=[],signals=[],industries=[],relationships=[];
  const exploration=opportunities.read(plan,location);
  const careerMap=new Map(),signalIds=new Set();
  const addSignal=(id,v)=>{if(!signalIds.has(id)&&signals.length<18){signalIds.add(id);signals.push({id,evidenceId:'warehouse_'+id,...v});}};
  function addCareer(code,title,link){
   if(!link&&careers.some(c=>c.groupCode===code))return;
   if(!code||careerMap.size>=6&&!careerMap.has(code))return;
   let c=careerMap.get(code);
   if(!c){
    const exact=get('canonical_occupation','SELECT * FROM canonical_occupation WHERE anzsco_code=?',[code]);
    const group=!exact&&code.length>4?get('canonical_occupation','SELECT * FROM canonical_occupation WHERE anzsco_code=?',[code.slice(0,4)]):null;
    const canonical=exact||group;const key=canonical?.anzsco_code||code;
    const onet=tables.has('onet_occupation')&&query('onet_anzsco_crosswalk','SELECT x.job_id,x.method,x.confidence,o.job_title,o.description,o.tasks,o.work_styles FROM onet_anzsco_crosswalk x JOIN onet_occupation o ON o.job_id=x.job_id WHERE x.anzsco_code=? ORDER BY x.confidence DESC,o.job_title ASC LIMIT 2',[key])[0];
    c={id:code,evidenceId:'warehouse_career_'+code,title:text(exact?.anzsco_title||title||canonical?.anzsco_title||code),description:text(exact?.description||onet?.description),tasks:list(onet?.tasks,5),workStyles:list(onet?.work_styles,3),skills:onet?query('onet_job_skill','SELECT skill_name FROM onet_job_skill WHERE job_id=? LIMIT 6',[onet.job_id]).map(r=>text(r.skill_name)):[],courseLinks:[],profileScope:group?`Occupation-group context: ${group.anzsco_title} (${key})`:'Occupation profile',profileMethod:text(onet?.method||canonical?.source),profileSource:onet?'O*NET occupation profile and stored ANZSCO crosswalk':text(canonical?.source),groupCode:key};
    careerMap.set(code,c);careers.push(c);
   }
   if(link&&!c.courseLinks.some(x=>x.courseId===link.courseId)){c.courseLinks.push(link);relationships.push({from:'course:'+link.courseId,to:'career:'+code,relation:'related_career',method:link.method,confidence:link.confidence});}
  }
  for(const course of courses){
   const id=String(course.id),code=course.national_code||course.course_code||'';
   if(has('PROVIDER')||has('LOCAL')||has('FUNDING')){
    const p=get('live_institutions','SELECT id,legal_name,rto_code,rto_type,higher_education_code,city,state,website_url,has_student_support,has_disability_support,has_library,has_apprenticeships FROM live_institutions WHERE id=?',[course.institution_id??'']);
    if(p&&!providers.some(x=>x.id===String(p.id))){
     const campuses=query('institution_campuses','SELECT location_name,town,state,postcode FROM institution_campuses WHERE rto_code=? LIMIT 8',[p.rto_code||'']).map(r=>({name:text(r.location_name),town:text(r.town),state:text(r.state),postcode:text(r.postcode)}));
     const he=get('he_provider_entitlement_v2','SELECT csp_undergraduate,csp_postgraduate,hecs_help,fee_help,effective_from,effective_to,current_status FROM he_provider_entitlement_v2 WHERE institution_id=? ORDER BY effective_from DESC LIMIT 1',[p.id]);
     const funding=[];
     providers.push({id:String(p.id),evidenceId:'warehouse_provider_'+p.id,name:text(p.legal_name),type:text(p.rto_type),higherEducationCode:text(p.higher_education_code),city:text(p.city),state:text(p.state),campuses,support:[p.has_student_support===1?'Student support':null,p.has_disability_support===1?'Disability support':null,p.has_library===1?'Library':null,p.has_apprenticeships===1?'Apprenticeship support':null].filter(Boolean),higherEducationFunding:he?{cspUndergraduate:flag(he.csp_undergraduate),cspPostgraduate:flag(he.csp_postgraduate),hecsHelp:flag(he.hecs_help),feeHelp:flag(he.fee_help),from:he.effective_from,to:he.effective_to,status:text(he.current_status)}:null,funding,courseIds:[id]});
    }else if(p)providers.find(x=>x.id===String(p.id)).courseIds.push(id);
    if(p&&has('FUNDING')&&code){const funding=query('course_funding_verdict','SELECT scheme,delivery_state,funding_status,student_tuition_out_of_pocket,currency,effective_period FROM course_funding_verdict WHERE rto_code=? AND national_code=?'+(location.region?.state?' AND delivery_state=?':'')+' ORDER BY effective_period DESC LIMIT 3',[p.rto_code||'',code,...(location.region?.state?[location.region.state]:[])]);providers.find(x=>x.id===String(p.id)).funding.push(...funding.map(r=>({...r,courseId:id,courseName:text(course.course_name)})));}
    if(p)relationships.push({from:'course:'+id,to:'provider:'+p.id,relation:'offered_by',method:'institution_id',confidence:null});
   }
   if(has('CAREERS')||has('LOCAL')||has('INDUSTRY')){
    const edges=query('course_occupation_edge','SELECT anzsco_code,anzsco_title,method,confidence_score FROM course_occupation_edge WHERE national_code=? ORDER BY is_primary DESC,confidence_score DESC LIMIT 3',[code]);
    const mappings=index.prepare('SELECT occupation_code AS anzsco_code,occupation_name AS anzsco_title,match_method AS method,match_confidence AS confidence_score FROM occupation_links WHERE qualification_code=? ORDER BY is_primary DESC LIMIT 3').all(code||'');
    for(const edge of [...edges,...mappings])addCareer(String(edge.anzsco_code||''),edge.anzsco_title,{courseId:id,courseName:text(course.course_name),method:text(edge.method),confidence:number(edge.confidence_score)});
    const profile=index.prepare('SELECT * FROM profile_links WHERE course_id=? LIMIT 1').get(id);
    for(const occ of list(profile?.anzsco_codes_json,3))addCareer(occ,'',{courseId:id,courseName:text(course.course_name),method:text(profile.mapping_method),confidence:number(profile.mapping_confidence)});
    if(has('INDUSTRY'))for(const name of list(profile?.industry_codes_json,4)){if(!industries.some(i=>i.name===name&&i.courseId===id))industries.push({id:id+'_'+industries.length,evidenceId:'warehouse_industry_'+id+'_'+industries.length,name,courseId:id,method:text(profile.mapping_method),scope:'Course-to-industry mapping'});}
   }
  }
  for(const phrase of (plan.occupation_queries||[]).slice(0,2)){
   const words=text(phrase,100).split(/\s+/).filter(Boolean).slice(0,4);if(!words.length)continue;
   const sql='SELECT anzsco_code,anzsco_title FROM canonical_occupation WHERE '+words.map(()=>"anzsco_title LIKE ? ESCAPE '\\'").join(' AND ')+' LIMIT 3';
   for(const row of query('canonical_occupation',sql,words.map(w=>'%'+safeLike(w)+'%')))addCareer(row.anzsco_code,row.anzsco_title);
  }
  for(const phrase of (plan.industry_queries||[]).slice(0,2)){
   const words=text(phrase,100).split(/\s+/).filter(Boolean).slice(0,4);if(!words.length)continue;
   const patterns=words.map(w=>'%'+safeLike(w)+'%');
   const mapped=index.prepare('SELECT * FROM industry_links WHERE '+words.map(()=>"industry_name LIKE ? ESCAPE '\\'").join(' AND ')+' LIMIT 8').all(...patterns);
   for(const r of mapped){
    if(!industries.some(x=>x.name===r.industry_name))industries.push({id:'mapped_'+r.course_id,evidenceId:'warehouse_industry_mapped_'+r.course_id,name:r.industry_name,method:r.mapping_method,scope:'Stored course-to-industry mapping'});
    const profile=index.prepare('SELECT * FROM profile_links WHERE course_id=? LIMIT 1').get(r.course_id);
    if(!courses.length){for(const code of list(profile?.anzsco_codes_json,3))addCareer(code,'');
    for(const occ of index.prepare('SELECT occupation_code,occupation_name FROM occupation_links WHERE qualification_code=? ORDER BY is_primary DESC LIMIT 2').all(r.qualification_code))addCareer(occ.occupation_code,occ.occupation_name);}
   }
   for(const r of query('dim_industry','SELECT anzsic_code,industry_name FROM dim_industry WHERE '+words.map(()=>"industry_name LIKE ? ESCAPE '\\'").join(' AND ')+' LIMIT 3',words.map(w=>'%'+safeLike(w)+'%'))){
    industries.push({id:'sector_'+r.anzsic_code,evidenceId:'warehouse_industry_sector_'+r.anzsic_code,name:text(r.industry_name),method:'Named industry match',scope:'Industry catalogue'});
    if(!courses.length)for(const link of query('dim_crosswalk_anzsic_anzsco','SELECT anzsco_code FROM dim_crosswalk_anzsic_anzsco WHERE anzsic_code=? LIMIT 3',[r.anzsic_code]))addCareer(link.anzsco_code,'');
   }
  }
  for(const role of exploration?.roles||[])for(const map of role.mappings.slice(0,1))addCareer(map.anzsco_code,map.anzsco_title);
  const chain=location.chain.filter(r=>r.tier!=='NATIONAL');
  // An area-only demand question starts from recorded occupation/region edges.
  // Do not use this fallback to replace a named skill or career with unrelated work.
  if(has('LOCAL')&&!careers.length&&![...(plan.occupation_queries||[]),...(plan.skill_queries||[]),...(plan.role_queries||[]),...(plan.job_queries||[])].length){
   for(const region of chain){
    const rows=query('region_demand_edge','SELECT * FROM region_demand_edge WHERE region_key=? AND period=(SELECT MAX(period) FROM region_demand_edge WHERE region_key=?) AND active_jobs>0 ORDER BY active_jobs DESC LIMIT 5',[region.region_key,region.region_key]);
    for(const r of rows)addCareer(r.anzsco_code,text(json(r.evidence_json).archetype));if(rows.length)break;
   }
  }
  for(const career of careers){
   if(has('LOCAL')||has('CAREERS')){
    let found=false;
    for(const region of chain){
     const demand=query('region_demand_edge','SELECT * FROM region_demand_edge WHERE region_key=? AND anzsco_code=? ORDER BY period DESC LIMIT 1',[region.region_key,career.groupCode]);
     if(demand.length){const r=demand[0];addSignal('demand_'+r.edge_id,{kind:'RECORDED_DEMAND',careerId:career.id,title:`Recorded demand for ${career.title}`,text:`${r.active_jobs} recorded job advertisements; ${r.employer_count} employers in the stored signal.`,metrics:{advertisements:number(r.active_jobs),employers:number(r.employer_count)},scope:r.scope||region.tier,region:region.name,period:r.period,source:r.source_name,method:r.method,localMatch:region.region_key===location.region?.key,updatedAt:r.updated_at});found=true;break;}
    }
    if(!found&&location.region?.state){const r=get('ivi_monthly_sa4','SELECT * FROM ivi_monthly_sa4 WHERE sa4_code=? AND anzsco_code=? ORDER BY period DESC LIMIT 1',[chain.find(r=>r.tier==='SA4')?.region_key||'',career.groupCode]);if(r)addSignal('ivi_'+r.row_id,{kind:'RECORDED_DEMAND',careerId:career.id,title:`Recorded vacancies for ${career.title}`,text:`${r.vacancy_count} vacancies in the stored regional series.`,metrics:{advertisements:number(r.vacancy_count),employers:null},scope:'SA4',region:r.region_name,period:r.period,source:r.source,method:'occupation and SA4',localMatch:location.region.tier==='SA4',updatedAt:r.imported_at});}
    const projections=query('jsa_employment_projection','SELECT * FROM jsa_employment_projection WHERE anzsco_code=? AND (state_code=? OR state_code IN (\'AUS\',\'ALL\')) ORDER BY release_date DESC,projection_horizon ASC LIMIT 2',[career.groupCode,location.region?.state||'AUS']);
    for(const r of projections)addSignal('projection_'+r.projection_id,{kind:'PROJECTION',careerId:career.id,title:`Employment outlook for ${career.title}`,text:`Stored projection: ${r.growth_pct}% employment change over ${r.projection_horizon} years from ${r.projection_year}.`,metrics:{growthPercent:number(r.growth_pct),horizonYears:number(r.projection_horizon),baseYear:number(r.projection_year)},scope:['AUS','ALL'].includes(r.state_code)?'NATIONAL':'STATE',region:r.state_code,period:r.release_date,source:'Jobs and Skills Australia',method:'Stored employment projection',localMatch:false,updatedAt:r.updated_at});
    // Employer signals are dated observations, not a promise of an open vacancy.
    if(location.region?.state)for(const r of query('employer_job_edge','SELECT edge_id,employer_name,scope,period,state_code,region_key,updated_at,method FROM employer_job_edge WHERE anzsco_code=? AND state_code=? AND is_active=1 ORDER BY period DESC LIMIT 3',[career.groupCode,location.region.state]))addSignal('employer_'+r.edge_id,{kind:'EMPLOYER_SIGNAL',careerId:career.id,title:text(r.employer_name),text:`Employer recorded against ${career.title}.`,scope:r.scope||'STATE',region:r.state_code,period:r.period,source:'Stored employer–occupation relationship',method:r.method,localMatch:!!r.region_key&&r.region_key===location.region.key&&r.scope===location.region.tier,updatedAt:r.updated_at});
   }
   if(has('INDUSTRY')&&tables.has('dim_industry'))for(const r of query('dim_crosswalk_anzsic_anzsco','SELECT x.anzsic_code,d.industry_name,x.source FROM dim_crosswalk_anzsic_anzsco x JOIN dim_industry d ON d.anzsic_code=x.anzsic_code WHERE x.anzsco_code=? LIMIT 3',[career.groupCode]))industries.push({id:career.id+'_'+r.anzsic_code,evidenceId:'warehouse_industry_'+career.id+'_'+r.anzsic_code,name:text(r.industry_name),careerId:career.id,method:text(r.source),scope:'Occupation-to-industry mapping'});
  }
  if(has('LOCAL')&&location.region?.tier==='SA2'){
   for(const r of query('salm_unemployment_sa2',"SELECT row_id,data_item,quarter,value,source FROM salm_unemployment_sa2 WHERE sa2_code=? AND is_unavailable=0 ORDER BY quarter_date DESC,CASE WHEN lower(data_item) LIKE '%rate%' THEN 0 ELSE 1 END LIMIT 2",[location.region.key]))addSignal('local_'+r.row_id,{kind:'LOCAL_CONTEXT',title:text(r.data_item),text:String(r.value)+(/rate/i.test(r.data_item)?'%':''),scope:'SA2',region:location.region.name,period:r.quarter,source:r.source,method:'Exact region key',localMatch:true});
  }
  const {chain:unused,...area}=location;
  return {location:area,localOverview:has('LOCAL')?localOverview(location):null,providers,careers,exploration,industries:industries.slice(0,12),signals,relationships,scopeNote:'Stored links and dated signals support exploration; they do not guarantee admission, employment, current vacancies or personal eligibility.'};
 }
 return {read};
}
module.exports={createLinkedReader};
