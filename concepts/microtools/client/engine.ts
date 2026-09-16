import catalogData from './catalog.json';

export type EntityType = 'course' | 'occupation' | 'skill' | 'company' | 'industry' | 'specialisation';
export type Entity = { id: string; type: EntityType; name: string; parentId?: string; origin: 'sample' };
export type Inputs = Record<string, string>;
export type Context = { journeyId: string; goal: string; entities: Entity[]; inputs: Inputs };
export type Evidence = 'SAMPLE' | 'UNKNOWN';
export type Finding = { label: string; text: string; state: Evidence };
export type Result = {
  version: 'microtools-poc/1'; id: string; toolId: string; parentId: string | null;
  status: 'answer' | 'unavailable' | 'error'; title: string; summary: string;
  findings: Finding[]; unresolvedQuestions: string[]; entities: Entity[];
  context: Context; signature: string; mode: 'fixture';
};
export type Action = { type: 'MICRO_TOOL'; toolId: string; entityRefs: Entity[]; label: string; why: string };
export type Event = { version: 'microtools-poc/1'; conversationId: string; parentMessageId: string; action: Action; inputValues?: Inputs };
export type Field = { key: string; label: string; hint: string; options?: string[]; kind?: 'course' };
export type Definition = { label: string; type: EntityType; fields?: Field[]; priority?: number };
export const catalog = catalogData;
const field = (key: string, label: string, hint: string, options?: string[]): Field => ({ key, label, hint, options });
export const definitions: Record<string, Definition> = {
  COURSE_001: { label: 'Understand this course', type: 'course' },
  COURSE_002: { label: 'Compare another course', type: 'course', fields: [{key:'second_course', label:'Which course would you like to compare?', hint:'Choose a second sample course.', kind:'course'}] },
  COURSE_007: { label: 'See the skills you could learn', type: 'course', priority: 1 },
  COURSE_008: { label: 'Explore possible careers', type: 'course', priority: 2 },
  COURSE_011: { label: 'Check fees and support', type: 'course', priority: 3, fields: [field('student_status','How would you apply?','This helps identify which fee information to request.',['Domestic student','International student','Not sure yet']),field('location','Where would you like to study?','Enter a city, region or country. We will not use your device location.')] },
  SKILL_001: { label: 'Understand this skill', type: 'skill', priority: 1 },
  SKILL_002: { label: 'See the level a role needs', type: 'skill', fields: [field('context_role','Which role are you considering?','For example, a junior data analyst.')] },
  SKILL_003: { label: 'Check what you still need', type: 'skill', fields: [field('current_skill_profile','What have you already done?','A project, work task or study example is enough. “Not sure” is also fine.'),field('target_skill_profile','What do you want to be able to do?','Describe the task or expectation you want to work towards.')] },
  SKILL_009: { label: 'Find a way to practise', type: 'skill', fields: [field('target_depth','How far would you like to take this skill?','Choose the depth you want to explore.',['Try the basics','Use it at work','Build advanced capability'])] },
  CAREER_001: { label: 'Explore this career', type: 'occupation', priority: 1 },
  CAREER_002: { label: 'Compare career stages', type: 'occupation', priority: 2 },
  CAREER_003: { label: 'Explore specialisations', type: 'occupation', priority: 1 },
  JOB_004: { label: 'See skills for this role', type: 'occupation', priority: 3 },
  COMP_001: { label: 'Understand this employer', type: 'company' },
  COMP_002: { label: 'Explore roles at this company', type: 'company', priority: 1 },
  COMP_003: { label: 'See skills this company uses', type: 'company', priority: 2 },
  INST_004: { label: 'Review the curriculum skills', type: 'course' },
  INST_006: { label: 'Check industry alignment', type: 'course', priority: 1, fields: [field('target_industry','Which industry should this support?','Enter the industry you want to compare with.'),field('location','Which location matters?','Enter a city, region or country.')] },
  INST_007: { label: 'Explore curriculum improvements', type: 'course', priority: 1 },
  IND_001: { label: 'Understand this industry', type: 'industry' },
  IND_003: { label: 'Explore industry specialisations', type: 'industry', priority: 1 },
  IND_004: { label: 'Explore roles in this industry', type: 'industry', priority: 2, fields: [field('location','Where would you like to explore work?','Enter a city, region or country.')] },
};
export const entities: Record<string, Entity> = {
  course_data: { id:'course_data',type:'course',name:'Diploma of Applied Data',origin:'sample' },
  course_business: { id:'course_business',type:'course',name:'Certificate in Business Insights',origin:'sample' },
  role_analyst: { id:'role_analyst',type:'occupation',name:'Data analyst',origin:'sample' },
  role_support: { id:'role_support',type:'occupation',name:'Customer support specialist',origin:'sample' },
  skill_data: { id:'skill_data',type:'skill',name:'Working with data',origin:'sample' },
  skill_communication: { id:'skill_communication',type:'skill',name:'Explaining findings',origin:'sample' },
  company: { id:'company',type:'company',name:'Harbour Works',origin:'sample' },
  industry: { id:'industry',type:'industry',name:'Digital services',origin:'sample' },
  specialisation: { id:'specialisation',type:'specialisation',name:'Business analytics',parentId:'role_analyst',origin:'sample' },
  industry_niche: {id:'industry_niche',type:'specialisation',name:'Customer insights services',parentId:'industry',origin:'sample'},
};
export const journeys = [
  {id:'study',name:'Find my study path',audience:'Students & families',goal:'Understand a course and where it could lead.',question:'What could this course help me do?',toolId:'COURSE_001',entityId:'course_data',icon:'study'},
  {id:'career',name:'Explore a career change',audience:'People exploring their next step',goal:'Explore a role, its specialisations and skills.',question:'What would working as a data analyst involve?',toolId:'CAREER_001',entityId:'role_analyst',icon:'career'},
  {id:'company',name:'Understand an employer',audience:'Job seekers & teams',goal:'Understand the work and skills at an employer.',question:'What kind of work happens at Harbour Works?',toolId:'COMP_001',entityId:'company',icon:'company'},
  {id:'curriculum',name:'Review a course',audience:'Educators & training teams',goal:'Explore how curriculum skills connect to industry needs.',question:'How do the skills in this course connect to work?',toolId:'INST_004',entityId:'course_data',icon:'curriculum'},
  {id:'industry',name:'Explore an industry',audience:'People exploring possibilities',goal:'Find the roles and learning paths within an industry.',question:'Where could I fit in digital services?',toolId:'IND_001',entityId:'industry',icon:'industry'},
];
const finding = (label: string,text: string,state: Evidence='SAMPLE'): Finding => ({label,text,state});
const get = (...ids: string[]) => ids.map(id=>entities[id]);
function content(id: string, ctx: Context, selected: Entity[]): Pick<Result,'title'|'summary'|'findings'|'unresolvedQuestions'|'entities'|'status'> {
  const active = selected[0];
  const base = {title: definitions[id].label, summary:'', findings:[] as Finding[], unresolvedQuestions:[] as string[], entities:selected, status:'answer' as Result['status']};
  switch(id) {
    case 'COURSE_001': return {...base,title:active.name,summary:'A practical introduction to working with data and explaining what it means. Start with the skills, then explore the work they could support.',findings:[finding('What you would do','Practise organising a small dataset and turn it into a clear report.'),finding('How you would learn','The sample curriculum combines guided activities with a small project.'),finding('Before you decide','Entry requirements, fees, recognition and study schedules still need provider information.','UNKNOWN')]};
    case 'COURSE_002': return {...base,title:'Two ways to start with data',summary:'One sample course offers more project practice; the other introduces business reporting. Your preferred depth is the main trade-off.',entities:[active,entities[ctx.inputs.second_course]],findings:[finding(active.name,'Sample focus: organise data, practise analysis and complete a small project.'),finding(entities[ctx.inputs.second_course].name,'Sample focus: understand business questions and present a simple report.'),finding('What could change the choice','Published duration, price, entry requirements and recognition are not connected. No overall winner can be established.','UNKNOWN')],unresolvedQuestions:['Which matters most to you: practical depth, study time or cost?']};
    case 'COURSE_007': case 'INST_004': return {...base,title:'The skills behind the course',summary:'See what a learner would practise, where it appears in the sample curriculum, and what still needs evidence.',entities:[...selected,...get('skill_data','skill_communication')],findings:[finding('Working with data','Core unit: Data Foundations. Taught and practised by organising a small dataset. Expected depth: introductory; assessed proficiency is unknown.'),finding('Explaining findings','Core unit: Reporting a Result. Practised through a short presentation. Expected depth: introductory; workplace readiness is unknown.'),finding('What this does not establish','Completing a unit alone does not prove that someone can do the task independently at work.','UNKNOWN')]};
    case 'COURSE_008': return {...base,title:'Where these skills could lead',summary:'Use these sample connections to explore a role. They are starting points for a conversation, not verified graduate outcomes.',entities:[...selected,...get('role_analyst','role_support')],findings:[finding('Data analyst · possible direction','Explore tasks involving data organisation and reporting. Additional role requirements need to be checked.'),finding('Customer support · adjacent direction','Reporting and communication may be relevant to support work.'),finding('Later progression','More responsibility would require further capability and experience; this course does not establish readiness.','UNKNOWN')]};
    case 'COURSE_011': return {...base,status:'unavailable',title:'Fee information is not connected yet',summary:`You entered ${ctx.inputs.location} and “${ctx.inputs.student_status}”. This concept cannot retrieve a published fee or confirm funding eligibility.`,findings:[],unresolvedQuestions:['A dated provider fee schedule and applicable funding rules are needed.']};
    case 'CAREER_001': return {...base,title:`A closer look at ${active.name.toLowerCase()}`,summary:active.id==='role_analyst'?'A data analyst helps people answer questions using data. Explore a specialisation or the skills behind the work.':'A customer support specialist helps people solve problems and understand a service.',entities:[...selected,...get('skill_data','skill_communication')],findings:[finding('Everyday work',active.id==='role_analyst'?'Check information, investigate a question and explain the result.':'Understand a question, investigate an issue and explain the next step.'),finding('Working with others','Ask clear questions and share findings in language people understand.'),finding('What needs checking','Employer requirements, current openings, pay and local demand are not connected.','UNKNOWN')]};
    case 'CAREER_003': return {...base,title:'Different directions within the role',summary:'A specialisation describes a focus of work. It does not tell us someone’s seniority or proficiency.',entities:[...selected,entities.specialisation],findings:[finding('Business analytics · sample specialisation','Focus on business questions, useful measures and reports people can act on.'),finding('Skill focus','Working with data and explaining findings. Tools and entry requirements vary by employer.','UNKNOWN')],unresolvedQuestions:['Which type of problem would you enjoy working on?']};
    case 'CAREER_002': return {...base,title:'Career stages, explained simply',summary:'Career stage is about the responsibility someone can handle. Years of experience alone do not determine the stage.',entities:[...selected,...get('skill_data')],findings:[finding('Supported work','Complete defined tasks with guidance and explain the steps taken.'),finding('Independent work','Choose an approach, check the quality of the result and explain trade-offs.'),finding('Leading work','Guide complex decisions, review others’ work and take responsibility for outcomes.') ]};
    case 'JOB_004': return {...base,title:`Skills to explore for ${active.name.toLowerCase()}`,summary:'This sample separates practical tasks from communication. Actual employer requirements need their own evidence.',entities:[...selected,...get('skill_data','skill_communication')],findings:[finding('Technical · working with data','Organise information and check it for problems. Required depth is not established.'),finding('Professional · explaining findings','Explain the result and its limitations clearly.'),finding('Source scope','Illustrative occupation mapping only. No current job advertisement has been retrieved.','UNKNOWN')]};
    case 'SKILL_001': return {...base,title:active.name,summary:active.id==='skill_data'?'Turn information into something people can understand and use. Start with a small question, then check the data before drawing conclusions.':'Help someone understand a result, why it matters, and what remains uncertain.',findings:[finding('Try a small task',active.id==='skill_data'?'Organise a small table, look for missing entries and explain one pattern.':'Present a finding in three sentences: the result, what it means, and its limitation.'),finding('Evidence you could keep','Keep the original task, your finished work and a short explanation of the choices you made.') ]};
    case 'SKILL_002': return {...base,title:'What does being able to do it look like?',summary:`For your focus, “${ctx.inputs.context_role}”, use these sample capability steps to frame a conversation. They are not a verified role standard.`,findings:[finding('With support','Follow a worked example and explain the basic steps.'),finding('Independently','Choose a method, check the result and explain limitations.'),finding('For complex work','Handle unfamiliar problems and review the quality of others’ work.')],unresolvedQuestions:['A real role description is needed to establish the required depth.']};
    case 'SKILL_003': return {...base,title:'Separate a skill gap from missing evidence',summary:'You have described your experience and your target. This sample cannot assess your ability from those descriptions alone.',findings:[finding('Your experience',ctx.inputs.current_skill_profile,'UNKNOWN'),finding('Your target',ctx.inputs.target_skill_profile,'UNKNOWN'),finding('A useful next step','Choose a small practical task and compare your work against clear criteria. Missing evidence does not mean a missing skill.','UNKNOWN')],unresolvedQuestions:['A real assessment or work sample is needed before classifying skills as strong, partial or missing.']};
    case 'SKILL_009': return {...base,title:'Start with a small way to practise',summary:`Your selected depth is “${ctx.inputs.target_depth}”. These example learning routes show the kind of choice a connected tool could return.`,findings:[finding('Try a project','Use a small task to see what you can already do. Keep the result as evidence.'),finding('Ask for feedback','Review the work with someone who can explain the task criteria.'),finding('Consider learning support','If a specific gap is established, compare a unit, short course or other suitable learning option.')],unresolvedQuestions:['No live courses, prices or recognised credentials have been matched.']};
    case 'COMP_001': return {...base,title:'Inside Harbour Works',summary:'Harbour Works is a fictional digital services employer. Explore how a company answer can lead into roles and skills.',findings:[finding('Example work','Help clients understand service information and improve customer experiences.'),finding('People involved','The sample includes data analysis and customer support functions.'),finding('Hiring status','No vacancies, headcount or hiring plans have been verified.','UNKNOWN')]};
    case 'COMP_002': return {...base,title:'The work inside this company',summary:'These are fictional role families, not advertised vacancies. A connected version would clearly separate current openings from past roles.',entities:[...selected,...get('role_analyst','role_support')],findings:[finding('Data analysis','Investigate service information and prepare reports.'),finding('Customer support','Help customers understand and use a service.'),finding('Current openings','No company careers feed is connected. These examples must not be treated as jobs available now.','UNKNOWN')]};
    case 'COMP_003': return {...base,title:'Skills connected to the sample roles',summary:'This shows how role evidence would be grouped into a company skills view. It cannot establish a real employer’s skill needs.',entities:[...selected,...get('skill_data','skill_communication')],findings:[finding('Working with data','Example connection: data analysis role family.'),finding('Explaining findings','Example connection: analysis and customer support role families.'),finding('Frequency and recency','No dated job advertisements have been retrieved. Frequency, breadth and unmet needs are unknown.','UNKNOWN')]};
    case 'INST_006': return {...base,title:'Where the curriculum needs evidence',summary:`You selected ${ctx.inputs.target_industry} in ${ctx.inputs.location}. This sample shows the comparison structure; current industry evidence is not connected.`,findings:[finding('Foundation to examine','The sample course includes organising data and explaining findings.'),finding('Possible area to investigate','Check whether learners practise with realistic tasks and receive useful feedback.'),finding('No established industry gap','Without dated industry requirements, we cannot call content missing, outdated or well aligned.','UNKNOWN')],unresolvedQuestions:['Current role requirements and assessment evidence are needed.']};
    case 'INST_007': return {...base,title:'A measured next step for the curriculum',summary:'Start by validating the possible gap. Avoid a major curriculum change before the evidence supports it.',findings:[finding('First · check the evidence','Compare current assessment tasks with dated requirements from the target industry.'),finding('Then · choose a proportionate change','If a gap is confirmed, consider a practical task or feedback activity before a new unit.'),finding('Review the effect','Agree what successful learner work should demonstrate. No curriculum gap has yet been confirmed.','UNKNOWN')]};
    case 'IND_001': return {...base,title:'Explore digital services',summary:'This sample industry brings together people who help organisations use information and deliver services. Explore a focus area or the roles within it.',findings:[finding('Kinds of work','Data analysis, customer support and service improvement.'),finding('Classification','This is a sample grouping, not a verified official industry classification.','UNKNOWN'),finding('Local opportunities','Employment levels, growth and shortages need separate, dated sources.','UNKNOWN')]};
    case 'IND_003': return {...base,title:'A more specific area to explore',summary:'A niche narrows the kind of work. It stays connected to its parent industry so you can move back out.',entities:[...selected,...get('industry_niche','role_analyst')],findings:[finding('Customer insights services','Sample niche: understand how people use a service and where it can improve.'),finding('Connected work','Data analysis and explaining findings.'),finding('Origin','Illustrative grouping only; not an official classification.') ]};
    case 'IND_004': return {...base,title:'Roles connected to this industry',summary:`You are exploring ${ctx.inputs.location}. The role connections below are examples; they do not show local vacancies or demand.`,entities:[...selected,...get('role_analyst','role_support')],findings:[finding('Specialist work · data analyst','Investigate questions and explain patterns.'),finding('Supporting work · customer support','Help people solve service problems.'),finding('Demand is unknown','No local employment or vacancy data has been retrieved.','UNKNOWN')]};
    default: throw new Error('This tool has no reviewed sample adapter.');
  }
}
export function allowedNext(toolId: string): string[] {
  return catalog.find(t=>t.id===toolId)?.allowed_next_tools.split(';').map(x=>x.trim()).filter(x=>!!definitions[x]) ?? [];
}
export function missingFields(action: Action, ctx: Context): Field[] {
  return (definitions[action.toolId]?.fields ?? []).filter(f=>!ctx.inputs[f.key]?.trim());
}
export function signature(action: Action, ctx: Context): string {
  const fields = definitions[action.toolId]?.fields ?? [];
  return JSON.stringify([action.toolId, action.entityRefs.map(x=>x.id).sort(), fields.map(f=>[f.key,ctx.inputs[f.key]?.trim() ?? ''])]);
}
export function makeAction(toolId: string, refs: Entity[], why='Explore a connected part of this answer.'): Action {
  const d=definitions[toolId]; if(!d) throw new Error('Tool is not enabled in this concept.');
  return {type:'MICRO_TOOL',toolId,entityRefs:refs,label:d.label,why};
}
export function actionInputs(action: Action, ctx: Context): Inputs {
  return Object.fromEntries((definitions[action.toolId]?.fields??[]).map(f=>[f.key,ctx.inputs[f.key]?.trim()??'']));
}
export function validateEvent(event: Event, parent: Result, ctx: Context): void {
  const a=event.action, d=definitions[a.toolId];
  if(event.version!=='microtools-poc/1'||event.parentMessageId!==parent.id||event.conversationId!==ctx.journeyId||ctx.journeyId!==parent.context.journeyId) throw new Error('The action no longer matches this answer.');
  if(!d||a.type!=='MICRO_TOOL'||!allowedNext(parent.toolId).includes(a.toolId)) throw new Error('This tool is not available from this answer.');
  if(!a.entityRefs.length||a.entityRefs.some(e=>e.type!==d.type||!parent.context.entities.some(p=>p.id===e.id&&p.type===e.type)||!entities[e.id]||entities[e.id].type!==e.type||entities[e.id].name!==e.name)) throw new Error('Choose a valid item from this answer.');
  if(a.entityRefs.length!==1) throw new Error('Select one starting item.');
  if(event.inputValues && JSON.stringify(Object.entries(event.inputValues).sort())!==JSON.stringify(Object.entries(actionInputs(a,ctx)).sort())) throw new Error('The submitted details no longer match this request.');
  const missing=missingFields(a,ctx); if(missing.length) throw new Error(`Please answer: ${missing.map(f=>f.label).join(' ')}`);
  for(const f of d.fields??[]) {
    const value=ctx.inputs[f.key]?.trim();
    if(!value||value.length>500) throw new Error('Use between 1 and 500 characters for each detail.');
    if(f.options&&!f.options.includes(value)) throw new Error('Choose one of the available options.');
  }
  if(a.toolId==='COURSE_002'&&(!entities[ctx.inputs.second_course]||entities[ctx.inputs.second_course].type!=='course'||ctx.inputs.second_course===a.entityRefs[0].id)) throw new Error('Choose a different course to compare.');
  if(a.toolId==='INST_007'&&parent.toolId!=='INST_006') throw new Error('Review industry alignment first.');
}
export function makeResult(toolId: string, ctx: Context, refs: Entity[], parentId: string|null, id: string, mode:'normal'|'no_data'|'error'='normal'): Result {
  const action=makeAction(toolId,refs);
  const data=mode==='normal'?content(toolId,ctx,refs):{
    title:mode==='error'?'This sample request did not finish':'No information came back',
    summary:mode==='error'?'The simulated service failed. Your earlier answers are still here. You can try again.':'This test response contains no evidence. That does not mean there are no options or that you lack a skill.',
    findings:[], unresolvedQuestions:['More information is needed before this question can be answered.'],entities:refs,status:mode==='error'?'error' as const:'unavailable' as const,
  };
  const all=[...ctx.entities]; for(const e of data.entities) if(!all.some(x=>x.id===e.id))all.push(e);
  return {version:'microtools-poc/1',id,toolId,parentId,...data,context:{...ctx,entities:all,inputs:{...ctx.inputs}},mode:'fixture',signature:signature(action,ctx)};
}
export function startJourney(journeyId: string): Result {
  const j=journeys.find(x=>x.id===journeyId);if(!j)throw new Error('Unknown journey.');
  const e=entities[j.entityId];return makeResult(j.toolId,{journeyId,goal:j.goal,entities:[e],inputs:{}},[e],null,`root-${j.id}`);
}
export function suggestions(parent: Result, history: Result[], limit=3): Action[] {
  if(parent.status!=='answer')return [];
  const actions:Action[]=[];
  for(const toolId of allowedNext(parent.toolId)) {
    const d=definitions[toolId];
    // Prefer entities in this answer; only carry a known entity forward when the answer has none of that type.
    const local=parent.entities.filter(e=>e.type===d.type);
    const refs=local.length?local:parent.context.entities.filter(e=>e.type===d.type);
    for(const e of refs.slice(0,2)) {
      const a=makeAction(toolId,[e],e.type==='skill'?`Continue with ${e.name.toLowerCase()}.`:`Build on ${e.name}.`);
      if(refs.length>1)a.label=`${d.label} · ${e.name}`;
      const sig=signature(a,parent.context);
      if(history.some(r=>r.status==='answer'&&r.signature===sig))continue;
      actions.push(a);
    }
  }
  return actions.sort((a,b)=>(definitions[a.toolId].priority??5)-(definitions[b.toolId].priority??5)).slice(0,Math.min(5,Math.max(0,limit)));
}
export function interpretQuestion(question: string, parent: Result, history: Result[]): {action?:Action; reply?:string} {
  const q=question.trim().toLowerCase();
  if(!q)return {reply:'Write a question first.'};
  const candidates=suggestions(parent,history,5);
  const intent = /fee|cost|fund|price/.test(q)?['COURSE_011']:/compar.*course|another course/.test(q)?['COURSE_002']:/gap|still need|already know/.test(q)?['SKILL_003']:/practis|practice|learn this/.test(q)?['SKILL_009']:/specialis|specializ/.test(q)?['CAREER_003','IND_003']:/level|senior|career stage/.test(q)?['SKILL_002','CAREER_002']:/job|career|role/.test(q)?['COURSE_008','CAREER_001','IND_004','COMP_002']:/skill/.test(q)?['COURSE_007','SKILL_001','JOB_004','COMP_003']:[];
  const matches=candidates.filter(a=>intent.includes(a.toolId));
  if(matches.length===1)return {action:matches[0]};
  if(matches.length>1)return {reply:'There is more than one related item. Choose the skill or role you mean from the options below.'};
  return {reply:'This concept understands a few questions about skills, careers, levels and fees. I cannot answer that question yet. Choose a related option below, or return to an earlier answer.'};
}
export type Trace = {at:string; type:'impression'|'click'|'needs_input'|'result'|'navigate'|'question_unmatched'|'finish'; toolId?:string; parentId?:string; resultId?:string; status?:string; entityIds?:string[]};
export function portableResult(result: Result, history: Result[]) {
  return {schema_version:result.version,tool_id:result.toolId,mode:result.mode,status:result.status,
    entity_context:result.entities.map(({id,type})=>({id,type})),concise_summary:result.summary,
    findings:result.findings,evidence_state:result.status==='answer'?'SAMPLE':'UNKNOWN',sources:[],
    unresolved_questions:result.unresolvedQuestions,
    next_actions:suggestions(result,history).map(a=>({toolId:a.toolId,label:a.label,entityRefs:a.entityRefs.map(({id,type})=>({id,type})),required_input_keys:missingFields(a,result.context).map(f=>f.key)}))};
}
