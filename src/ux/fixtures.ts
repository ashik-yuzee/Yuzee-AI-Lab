import type { YuzeeResponseV13 } from "../types";
export function makeResponse(overrides: Record<string, any> = {}): any {
  return {
    schema_version: '1.3',
    current_mode: 'A_CONVERSATION',
    response_intent: 'GENERAL_DELIVERY',
    content_blocks: [
      { id: 'b1', type: 'text', level: 'none', variant: 'default', title: '', text: 'Hello', items: [], columns: [], rows: [] },
    ],
    interaction: {
      kind: 'none', input_type: 'none', question_id: '', question: '', options: [],
      allow_other_input: false, other_input_label: '', fields: [], recommended_actions: [],
    },
    service_trigger: {
      service_intent_detected: false,
      primary_requested_service: 'NONE',
      confidence: 'LOW',
      reason: 'No service intent',
      trigger_now: false,
      needs_more_clarity: false,
      actions: [],
    },
    rmo_readiness: {
      readiness: 'NOT_READY',
      ready_to_generate: false,
      missing_inputs: [],
      verification_required: false,
    },
    state: {
      active_response_mode: 'Standard',
      effective_response_mode: 'Standard',
      mode_source: 'default',
      safety_override_applied: false,
      user_confidence: { score: -1, band: 'unknown', evidence_strength: 'none', trend: 'unknown', reason_codes: [] },
      progress: { explained: false, failed_attempts: 0, loop_count_same_issue: 0, security_breach_count: 0, active_security_penalty: '' },
    },
    followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: '', triggers: [] },
    ...overrides,
  };
}


const option = (id: string, label: string) => ({id,label,value:label,description:''});
const block = (type: string, title: string, text: string) => ({id:type,type,level:'none',variant:'default',title,text,items:[],columns:[],rows:[]});
const base = makeResponse();
const question = (input_type: string, question: string, options: any[] = []) => ({...base.interaction,kind:'question',input_type,question_id:'example-'+input_type,question,options,allow_other_input:['single_select','multi_select'].includes(input_type),other_input_label:'Something else'});
export const experienceFixtures: {id:string;label:string;response:YuzeeResponseV13}[] = [
 {id:'text',label:'Start exploring',response:makeResponse({content_blocks:[block('text','',"You do not need to choose a career today. We can start with one thing you enjoy and try a small activity.")],interaction:question('text','What is one activity you enjoy, at school, work or home?')})},
 {id:'single',label:'Choose one direction',response:makeResponse({content_blocks:[block('text','',"We can start wherever feels useful to you. You can change direction later.")],interaction:question('single_select','What would you like help with first?',[option('explore','Explore work I might enjoy'),option('learn','Learn a useful skill'),option('unsure','I’m not sure yet')])})},
 {id:'multi',label:'Fit around daily life',response:makeResponse({content_blocks:[block('text','',"Let’s fit your next step around your daily life. Select only what matters to you.")],interaction:question('multi_select','What does your next step need to fit around?',[option('hours','Work hours'),option('family','Caring for someone'),option('cost','A limited budget')])})},
 {id:'rank',label:'Put priorities in order',response:makeResponse({content_blocks:[block('text','',"All three priorities can matter. Putting them in order helps us compare the trade-offs.")],interaction:question('ranked_select','Which matters most to you right now?',[option('income','Keeping my income'),option('hours','Flexible hours'),option('interest','Enjoying the work')])})},
 {id:'location',label:'Prepare a request',response:makeResponse({current_mode:'S_SERVICE_HANDOFF',content_blocks:[block('text','',"We can prepare a draft for cybersecurity training. Nothing will be sent: provider requests are not connected here. These details help describe the training you need.")],interaction:{...base.interaction,kind:'handoff',input_type:'fields',question_id:'example-location',question:'Where would you like to study?',fields:[{id:'location',label:'Location',input_type:'australian_location',required:true,options:[]},{id:'residency',label:'Residency for study',input_type:'single_select',required:true,options:[option('domestic','Domestic'),option('international','International')]}]},rmo_readiness:{readiness:'PARTIAL',ready_to_generate:false,missing_inputs:['location','residency'],verification_required:false}})},
 {id:'compare',label:'Compare three routes',response:makeResponse({current_mode:'B_DELIVERY',content_blocks:[block('text','',"You can explore a change while keeping your job. These are ways to test an interest; availability and costs still need checking."),{...block('comparison','Three ways to explore',''),columns:[{key:'study',label:'Part-time study'},{key:'trial',label:'Work trial'},{key:'self',label:'Self-study'}],rows:[{id:'time',criteria:'Time and flexibility',cells:[{key:'study',value:'Regular study blocks; check the timetable.'},{key:'trial',value:'Arrange a short visit or supervised activity.'},{key:'self',value:'Choose your own short sessions.'}]},{id:'learn',criteria:'What you can find out',cells:[{key:'study',value:'Whether you enjoy learning the subject.'},{key:'trial',value:'What some everyday tasks feel like.'},{key:'self',value:'Whether the topic keeps your interest.'}]},{id:'check',criteria:'Before you commit',cells:[{key:'study',value:'Check workload, cost and entry requirements.'},{key:'trial',value:'Check supervision, pay and what is allowed.'},{key:'self',value:'Choose one small task with a clear outcome.'}]}]}],interaction:{...base.interaction,recommended_actions:[{id:'small-plan',label:'Make a small plan',message:'Help me plan one small activity to try this week.'}]}})},
];
