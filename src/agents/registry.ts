/** MULTI_AGENT specialist registry (spec §9, §23, §34). Versioned, discoverable, switchable per agent via env. */
import type {AgentType} from './contract';
import {AGENT_DISPLAY} from './contract';
import type {ChunkKind} from '../rag/warehouse/chunks';

export const REGISTRY_VERSION='agents-1.3';
export const SPECIALIST_MODEL='gemini-3.5-flash-lite';
export interface AgentDefinition{
  type:AgentType;version:string;promptVersion:string;title:string;capabilities:string[];
  /** 'specialist_results' = needs at least one upstream result, so it is skipped when every dependency failed. */
  requiredInputs:string[];optionalInputs:string[];
  /** packSlices: evidence chunk families from the typed WarehousePack; index: catalogue-index kinds it may search. */
  allowedTools:{packSlices:string[];index:ChunkKind[]};
  timeoutMs:number;model:string;
  permissions:{read_profile:boolean;search_jobs:boolean;search_courses:boolean;read_market:boolean;save_jobs:false;apply_to_job:false;send_messages:false;write_profile:false;request_offers:false};
  /** Human status shown when the specialist starts (spec §4/§18 tone). */
  status:(target:string|null,company:string|null)=>string;
}
const NO_WRITES={save_jobs:false,apply_to_job:false,send_messages:false,write_profile:false,request_offers:false} as const;
const perms=(p:{read_profile?:boolean;search_jobs?:boolean;search_courses?:boolean;read_market?:boolean})=>({read_profile:!!p.read_profile,search_jobs:!!p.search_jobs,search_courses:!!p.search_courses,read_market:!!p.read_market,...NO_WRITES});
const def=(type:AgentType,d:Omit<AgentDefinition,'type'|'title'|'version'|'promptVersion'|'model'>&{promptVersion?:string}):AgentDefinition=>({type,title:AGENT_DISPLAY[type].title,version:'1.0',promptVersion:`${type.toLowerCase()}@1.3`,model:SPECIALIST_MODEL,...d});

export const AGENTS:Record<AgentType,AgentDefinition>={
  PROFILE_SPECIALIST:def('PROFILE_SPECIALIST',{capabilities:['PROFILE_REVIEW','CONSTRAINT_EXTRACTION','MISSING_DATA_DETECTION'],requiredInputs:['message'],optionalInputs:['profile_facts','memory_capsule','user_statements','location'],
    allowedTools:{packSlices:[],index:[]},timeoutMs:5000,permissions:perms({read_profile:true}),status:()=>'Reviewing your experience and goals…'}),
  JOBS_SPECIALIST:def('JOBS_SPECIALIST',{capabilities:['JOB_SEARCH','JOB_REQUIREMENT_ANALYSIS','ADJACENT_ROLE_DISCOVERY'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['job','observed-skills','role','location','local-overview'],index:['occupation','anzsco']},timeoutMs:5500,permissions:perms({search_jobs:true}),
    status:t=>t?`Checking current ${t} roles…`:'Checking current job records…'}),
  SKILLS_SPECIALIST:def('SKILLS_SPECIALIST',{capabilities:['SKILL_GAP_ANALYSIS','TRANSFERABLE_SKILLS'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['role','observed-skills','career','job'],index:['occupation','unit']},timeoutMs:5500,permissions:perms({search_jobs:true}),
    status:()=>'Comparing your skills with what employers ask for…'}),
  MARKET_SPECIALIST:def('MARKET_SPECIALIST',{capabilities:['DEMAND_SIGNALS','SALARY_SIGNALS','TREND_LABELLING'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['signal','career','industries','local-overview','location'],index:['anzsco','occupation']},timeoutMs:5500,permissions:perms({read_market:true}),
    status:t=>t?`Checking demand and hiring signals for ${t} roles…`:'Checking demand and hiring signals…'}),
  COMPANY_SPECIALIST:def('COMPANY_SPECIALIST',{capabilities:['EMPLOYER_ROLES','EMPLOYER_REQUIREMENTS'],requiredInputs:['message','company'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['job','provider'],index:['provider']},timeoutMs:5500,permissions:perms({search_jobs:true}),
    status:(_t,c)=>c?`Looking at what ${c} advertises and asks for…`:'Looking at the employer…'}),
  LEARNING_SPECIALIST:def('LEARNING_SPECIALIST',{capabilities:['COURSE_SEARCH','SHORT_COURSE_SEARCH','SMALLEST_INTERVENTION'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['course','learning','comparison','units','courses','provider'],index:['short_course','course','qualification','unit']},timeoutMs:5500,permissions:perms({search_courses:true}),
    status:()=>'Finding the smallest learning steps that would help…'}),
  PATHWAY_SPECIALIST:def('PATHWAY_SPECIALIST',{promptVersion:'pathway_specialist@2.2',capabilities:['ROUTE_GENERATION','TRADE_OFFS','NEXT_ACTION'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['role','observed-skills','job','learning','course','units','signal','career'],index:['qualification','short_course','occupation']},timeoutMs:6500,permissions:perms({search_jobs:true,search_courses:true,read_market:true}),status:t=>t?`Building realistic routes into ${t}…`:'Building realistic routes to your goal…'}),
  OPPORTUNITY_SPECIALIST:def('OPPORTUNITY_SPECIALIST',{capabilities:['ADJACENT_OPPORTUNITIES','EARN_AND_LEARN'],requiredInputs:['message'],optionalInputs:['profile_summary','warehouse_pack'],
    allowedTools:{packSlices:['role','career','job'],index:['occupation','anzsco','qualification']},timeoutMs:5500,permissions:perms({search_jobs:true,search_courses:true}),
    status:()=>'Looking for related opportunities you may not have searched for…'}),
};

/** MULTI_AGENT_DISABLED=COMPANY_SPECIALIST,MARKET_SPECIALIST switches agents off without a deploy. */
export const disabledAgents=()=>new Set((process.env.MULTI_AGENT_DISABLED||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean));
export const agentEnabled=(t:AgentType)=>!disabledAgents().has(t);
export const registryView=()=>({version:REGISTRY_VERSION,agents:Object.values(AGENTS).map(({status,...a})=>({...a,enabled:agentEnabled(a.type)}))});
