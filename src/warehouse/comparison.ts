import type {WarehouseCourse,WarehouseComparison,ProviderMatch} from './types';
export function buildComparison(courses:WarehouseCourse[],providerMatches:ProviderMatch[]=[],qualifications:WarehouseComparison['qualifications']=[],courseRequested=false):WarehouseComparison {
 const providers=[...new Map(providerMatches.filter(m=>m.status==='MATCHED').flatMap(m=>m.providers).map(p=>[p.id,p])).values()];
 const provider=(c:WarehouseCourse)=>providers.find(p=>p.id===c.providerId||p.name===c.provider);
 const options=courses.length?courses.map(c=>({id:c.id,title:c.provider,subtitle:[c.name,c.code].filter(Boolean).join(' · ')})):providers.map(p=>({id:p.id,title:p.name,subtitle:p.rtoCode?'RTO '+p.rtoCode:'Provider'}));
 const codes=[...new Set(courses.map(c=>c.code).filter(Boolean))];
 const same=courses.length>1&&codes.length===1&&courses.every(c=>c.code===codes[0]);
 const rows:WarehouseComparison['rows']=[];
 const add=(key:string,label:string,basis:WarehouseComparison['rows'][number]['basis'],values:(string[]|string|null|undefined)[],meaning:string)=>{
  const cells=values.map(v=>Array.isArray(v)?v.filter(Boolean):v?[v]:[]);
  const canonical=cells.map(v=>v.map(x=>x.trim().toLowerCase().replace(/\s+/g,' ')).sort().join('|'));
  const status=cells.every(v=>!v.length)?'UNKNOWN':cells.some(v=>!v.length)?'INCOMPLETE':new Set(canonical).size===1&&cells.length>1?'SHARED':'DIFFERENT_RECORDS';
  rows.push({key,label,basis,status,values:cells,meaning});
 };
 if(courses.length){
  add('duration','Duration','COURSE_RECORD',courses.map(c=>c.duration),'Compare the time commitment alongside study load and attendance; a shorter course is not automatically better.');
  add('delivery','How and where you study','COURSE_RECORD',courses.map(c=>[...c.delivery,...c.locations.slice(0,4)]),'Use the course locations shown. Other campuses do not establish delivery at that campus.');
  add('attendance','Attendance and practical setup','YUZEE_ANALYSIS',courses.map(c=>c.comparisonDetails?.attendance),'Consider whether the recorded attendance pattern fits your work and other commitments.');
  add('assessment','Assessment approach','YUZEE_ANALYSIS',courses.map(c=>c.assessments),'Look at how learning can be demonstrated. Broad assessment descriptions may be shared across the qualification.');
  add('practice','Practical experience','YUZEE_ANALYSIS',courses.map(c=>c.comparisonDetails?.practice),'Separate a recorded placement arrangement from Yuzee suggestions for building practical evidence.');
  add('support','Learner support','PROVIDER_RECORD',courses.map(c=>provider(c)?.support),'Recorded provider services may help you study; the level of support for this course is not established by a tick alone.');
  add('credit','Credit and recognition','YUZEE_ANALYSIS',courses.map(c=>c.comparisonDetails?.credit),'Recognition and credit depend on your evidence and the provider decision.');
  add('cost','Recorded tuition','COURSE_RECORD',courses.map(c=>[c.fees.domestic!==null?'Domestic: '+c.fees.domestic:'',c.fees.international!==null?'International: '+c.fees.international:''].filter(Boolean)),'Compare like student categories and funding conditions. Not supplied never means free.');
  add('strengths','Who it may suit','YUZEE_ANALYSIS',courses.map(c=>c.bestFor),'Use Yuzee analysis against your priorities; this is not an established provider advantage.');
  add('limits','Trade-offs and further learning','YUZEE_ANALYSIS',courses.map(c=>c.considerations),'Common qualification limits apply to all comparable options; do not treat them as a weakness unique to one RTO.');
 }else{
  add('area','Provider base','PROVIDER_RECORD',providers.map(p=>p.area),'An institution address does not establish where a particular course runs.');
  add('type','Provider type','PROVIDER_RECORD',providers.map(p=>p.type),'Provider type describes the institution, not a ranking of teaching quality.');
  add('support','Learner support','PROVIDER_RECORD',providers.map(p=>p.support),'Use these recorded services as discussion points for your study needs.');
  add('about','Provider overview','PROVIDER_RECORD',providers.map(p=>p.description),'Compare the stated focus without treating description length as quality.');
 }
 const notes=courseRequested?providers.filter(p=>!courses.some(c=>c.providerId===p.id||c.provider===p.name)).map(p=>`No matching course was returned for ${p.name}; their provider details alone do not establish that they offer the requested course.`):[];
 notes.push(...courses.flatMap(c=>c.evidenceIssues?.slice(0,1)||[]));
 return {notes,snippetId:'rto_course_comparison',title:courses.length?'Compare the learning experience':'Compare these providers',options,rows,providerMatches,qualifications,baseline:same?`These options share ${codes[0]}. The national qualification is the common starting point; compare the recorded delivery and learner experience below.`:courses.length>1?'These records are not all the same qualification. Compare level and intended outcome before interpreting differences as provider quality.':'Use the available provider details now. A named qualification enables a more specific comparison of learning and delivery.'};
}
