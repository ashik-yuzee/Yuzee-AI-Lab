export function pathwayFixture(score=25):any {
 return {schema_version:'1.3',current_mode:'B_DELIVERY',response_intent:'EXPLORE_OPTIONS',
 content_blocks:[{id:'opening',type:'text',level:'none',variant:'default',title:'',text:'You can explore different career routes before committing to a qualification. Start with a small activity that helps you understand the work.',items:[],columns:[],rows:[]}],
 interaction:{kind:'none',input_type:'none',question_id:'',question:'',options:[],allow_other_input:false,other_input_label:'',fields:[],recommended_actions:[]},
 service_trigger:{service_intent_detected:false,primary_requested_service:'NONE',confidence:'LOW',reason:'Exploring options',trigger_now:false,needs_more_clarity:false,actions:[]},
 rmo_readiness:{readiness:'NOT_READY',ready_to_generate:false,missing_inputs:[],verification_required:false},
 state:{active_response_mode:'Standard',effective_response_mode:'Standard',mode_source:'default',safety_override_applied:false,user_confidence:{score,band:score<0?'unknown':score<40?'low':score<70?'medium':'high',evidence_strength:score<0?'none':'moderate',trend:'unknown',reason_codes:score<0?[]:['EXPLICIT_UNCERTAINTY','ROUTE_UNRESOLVED']},progress:{explained:true,failed_attempts:0,loop_count_same_issue:0,security_breach_count:0,active_security_penalty:''}},
 followups:{enabled:false,cancel_on_user_message:true,topic_lock:false,topic_key:'',triggers:[]}};
}

/** Synthetic report covering the same topology as the supplied HTML reference. */
export function pathwayReportFixture(score=25):any {
 const response=pathwayFixture(score),base=response.content_blocks[0];
 const block=(id:string,type:string,title:string,text='',extra:any={})=>({...base,id,type,title,text,...extra});
 const table=(id:string,title:string,labels:string[],values:string[][])=>block(id,'table',title,'Every route depends on the learner’s circumstances.',{columns:labels.map((label,i)=>({key:`c${i}`,label})),rows:values.map((cells,i)=>({id:`${id}-r${i}`,cells:cells.map((value,i)=>({key:`c${i}`,value}))}))});
 const routes=['Core route','Hybrid route','Alternative route'];
 response.content_blocks=[
  block('overview','text','','Explore three approaches to IT support. Keep current work commitments in view and test practical learning before paying for training.'),
  table('route-summary','Pathway summary',['Pathway Route','Duration','Cost','Experience suitability','Funding'],routes.map(name=>[name,'Depends on available study time','Check tuition, materials and travel','Seek supervised practice','Eligibility and employer support need checking'])),
  ...routes.flatMap((name,i)=>[
   table(`route-summary-r${i}-timeline`,`${name}: chronological milestones`,['Chronological Milestone','Stage Description','Strategic Mechanism','Where to Start'],['Explore','Learn','Practise','Review'].map((stage,j)=>[`${j+1}. ${stage}`,`${name}: ${stage.toLowerCase()} with a realistic task.\nSub-step: document what was difficult.`,`${name}: build evidence before the next commitment.`,`${name}: stage ${j+1} starting point`])),
   block(`route-summary-r${i}-considerations`,'text',`${name}: access and trade-offs`,'Check timetable, device access and caring commitments. A flexible route may require more independent planning; choose a small weekly task and review progress before increasing the load.'),
  ]),
  {...table('route-comparison','Comparative Analysis',['Pathway Archetype','Time','Cost','Risk','Foundational Depth','Flexibility'],routes.map(name=>[name,'Depends on pace','Check provider figures','Assess schedule conflicts','Review curriculum and practical coverage','Check attendance requirements'])),type:'comparison'},
  block('experience-playbook','steps','Six-Part Experience Playbook','',{items:[
   ['Target experience','Choose a small supervised support task that lets you practise diagnosis and explain a fix.'],
   ['Build evidence','Record the problem, checks, result and what you learned. Remove personal or employer information.'],
   ['Prepare outreach','Describe the task you can attempt, the supervision needed and the time you can offer.'],
   ['Check readiness','Practise explaining why each troubleshooting step follows from the previous result.'],
   ['Set experience goals','Agree on a safe task and request specific feedback from the supervisor.'],
   ['Plan follow-on learning','Use feedback to choose the next skill to practise; experience does not guarantee a job.'],
  ].map(([title,text],i)=>({id:`play-${i}`,title,text,value:'',status:''}))}),
 ];
 return response;
}
