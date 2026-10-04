/**
 * MULTI_AGENT mode — shared contract between the orchestrator (server), the SSE stream and the UI.
 * Spec: Yuzee Agentic Orchestration v1.0 (docs/MULTI-AGENT.md). Browser-safe: types and constants only.
 *
 * Event flow on the existing /api/conversations/:id/messages SSE stream (event name "orchestration"):
 *   ORCHESTRATION_STARTED → PLAN_CREATED → (AGENT_STARTED → AGENT_PROGRESS* → AGENT_COMPLETED|AGENT_FAILED)*
 *   → MERGE_STARTED → MERGE_COMPLETED → RESPONSE_STREAM_STARTED → RESPONSE_COMPLETED
 * Every event reflects real backend work; nothing is delayed or invented for the animation.
 */
export const MULTI_AGENT_MODE='MULTI_AGENT' as const;

export type AgentType='PROFILE_SPECIALIST'|'SKILLS_SPECIALIST'|'JOBS_SPECIALIST'|'MARKET_SPECIALIST'|'COMPANY_SPECIALIST'|'LEARNING_SPECIALIST'|'PATHWAY_SPECIALIST'|'OPPORTUNITY_SPECIALIST';
export type DomainTag='PROFILE'|'SKILLS'|'JOBS'|'COURSES'|'PROVIDERS'|'MARKET'|'COMPANY'|'PATHWAY'|'EXPERIENCE'|'APPLICATION'|'OFFERS'|'FUNDING'|'LOCATION'|'SALARY'|'EDUCATION_REQUIREMENTS';
/** 0 conversational · 1 single-domain retrieval · 2 personalised comparison · 3 multi-domain planning · 4 journey execution. */
export type ComplexityLevel=0|1|2|3|4;
export type OrchestrationState='idle'|'understanding_request'|'planning'|'agents_running'|'merging'|'composing'|'completed'|'partial_failure'|'failed';
export type AgentStatus='queued'|'running'|'completed'|'failed';
/** retrieval = the specialist's work is a tool/data lookup only (level 1, no model call); analysis = narrow mini-prompt model call. */
export type AgentExecution='retrieval'|'analysis';

export const AGENT_DISPLAY:Record<AgentType,{title:string;short:string}>={
  PROFILE_SPECIALIST:{title:'Profile Specialist',short:'Profile'},
  SKILLS_SPECIALIST:{title:'Skills Specialist',short:'Skills'},
  JOBS_SPECIALIST:{title:'Jobs Specialist',short:'Jobs'},
  MARKET_SPECIALIST:{title:'Market Specialist',short:'Market'},
  COMPANY_SPECIALIST:{title:'Company Specialist',short:'Company'},
  LEARNING_SPECIALIST:{title:'Learning Specialist',short:'Learning'},
  PATHWAY_SPECIALIST:{title:'Pathway Specialist',short:'Pathway'},
  OPPORTUNITY_SPECIALIST:{title:'Opportunity Specialist',short:'Opportunity'},
};

/** Source priority (spec §29): lower is stronger. Inference is never presented as verified fact. */
export type SourceKind='VERIFIED_ORGANISATION'|'GOVERNMENT_DATASET'|'YUZEE_FIRST_PARTY'|'PARTNER_API'|'PROVIDER_RECORD'|'JOB_FEED'|'THIRD_PARTY'|'USER_PROFILE'|'INFERENCE';
export interface EvidenceRef{
  id:string;               // warehouse evidenceId, index chunk id or profile:<field>
  source:SourceKind;
  label:string;            // human label: "training.gov.au qualification", "Job record (Seek sample)"
  retrievedAt:string;      // query time (ISO)
  updatedAt?:string|null;  // evidence timestamp, when the record has one
  stale?:boolean;          // older than the freshness window for its kind
}
export interface AgentFinding{
  text:string;
  basis:'FACT'|'INFERENCE';
  /** Short normalised subject used for dedupe/conflict checks, e.g. "cert iii requirement", "demand:ux designer:perth". */
  subject?:string;
  /** For conflict detection on the same subject: SUPPORTS / CONTRADICTS a stated position, or a value. */
  stance?:'POSITIVE'|'NEGATIVE'|'MIXED'|'NEUTRAL';
  evidenceIds:string[];
  importance?:'critical'|'useful'|'optional';
}
export type NextActionType='VIEW_JOB'|'SAVE_JOB'|'REQUEST_JOB_MATCH'|'REQUEST_COURSE_OFFER'|'COMPARE_COURSES'|'BUILD_PATHWAY'|'START_SKILL_ACTIVITY'|'ADD_TO_JOURNEY'|'SAVE_COMPANY'|'REQUEST_INTERNSHIP'|'REQUEST_WORK_PLACEMENT'|'UPDATE_PROFILE'|'ASK_FOLLOW_UP';
export interface NextAction{
  action:NextActionType;
  label:string;            // button text, human language
  reason:string;           // why, tied to evidence
  priority:number;         // 1 = best next action
  expectedImpact?:'high'|'medium'|'low';
  estimatedEffort?:string;
  /** Follow-up message the UI sends when the action maps to a chat turn (ASK_FOLLOW_UP, COMPARE_COURSES, ...). */
  prompt?:string;
  evidenceIds?:string[];
}
/** Structured envelope every specialist returns (spec §11). Never user-facing prose. */
export interface AgentResult{
  agent:AgentType;
  taskId:string;
  status:'completed'|'failed';
  execution:AgentExecution;
  summary:string;          // one line, human language, shown on the collapsed card
  facts:AgentFinding[];
  findings:AgentFinding[];
  recommendations:AgentFinding[];
  missingData:string[];
  sources:EvidenceRef[];
  confidence:number;       // 0..1
  warnings:string[];
  /** Agent-specific structured output (e.g. Skills: matched/missing_critical/...; Pathway: routes). */
  data?:Record<string,unknown>;
  metrics:{durationMs:number;model?:string;inputTokens?:number;cachedTokens?:number;outputTokens?:number;thinkingTokens?:number;costUsd?:number;reused?:boolean};
  error?:{reason:'TIMEOUT'|'ERROR'|'CANCELLED'|'SKIPPED_DEPENDENCY';message:string};
}
export interface PlannedAgent{id:string;type:AgentType;dependsOn:string[];execution:AgentExecution;task:string}
export interface OrchestrationPlan{
  complexityLevel:ComplexityLevel;
  domains:DomainTag[];
  /** Human sentence: what Yuzee understood. */
  understood:string;
  /** Level ≥ 2 opens the full team panel; levels 0–1 show at most a compact status. */
  visible:boolean;
  agents:PlannedAgent[];
  classifier:{method:'rules'|'rules+planner';signals:string[]};
}
export interface MergeOutcome{
  confidence:number;
  conflicts:Array<{subject:string;agents:AgentType[];statements:string[]}>;
  missingData:string[];
  staleEvidence:number;
  counts:{facts:number;findings:number;duplicatesRemoved:number;evidence:number};
  failedAgents:AgentType[];
}
/** Persisted on the assistant message (MessageItem.orchestration) so the work survives the conversation. */
export interface OrchestrationRecord{
  id:string;
  version:string;
  plan:OrchestrationPlan;
  results:AgentResult[];
  merge:MergeOutcome|null;
  nextActions:NextAction[];
  state:OrchestrationState;
  startedAt:number;
  completedAt?:number;
  metrics:{totalMs:number;agentsMs:number;composeMs?:number;agentCostUsd:number;agentTokens:number;reusedResults:number};
}

interface Base{orchestrationId:string;at:number}
export type OrchestrationEvent=Base&(
  |{type:'ORCHESTRATION_STARTED';state:'understanding_request'}
  |{type:'PLAN_CREATED';plan:OrchestrationPlan}
  |{type:'AGENT_STARTED';agentId:string;agent:AgentType;display:{title:string;message:string}}
  |{type:'AGENT_PROGRESS';agentId:string;agent:AgentType;display:{message:string}}
  |{type:'AGENT_COMPLETED';agentId:string;agent:AgentType;display:{title:string;message:string};result:AgentResult}
  |{type:'AGENT_FAILED';agentId:string;agent:AgentType;display:{title:string;message:string};result:AgentResult}
  |{type:'MERGE_STARTED';display:{message:string}}
  |{type:'MERGE_COMPLETED';merge:MergeOutcome;nextActions:NextAction[];display:{message:string}}
  |{type:'RESPONSE_STREAM_STARTED';display:{message:string}}
  |{type:'RESPONSE_COMPLETED';record:OrchestrationRecord}
);

/** UI view model (spec §26). */
export interface AgentActivity{
  id:string;type:AgentType;displayName:string;status:AgentStatus;dependsOn:string[];
  currentMessage?:string;summary?:string;startedAt?:number;completedAt?:number;evidenceCount?:number;result?:AgentResult;
}
export interface OrchestrationViewModel{
  id:string;complexityLevel:ComplexityLevel;state:OrchestrationState;understood:string;visible:boolean;
  activities:AgentActivity[];completedCount:number;totalCount:number;runningCount:number;
  merge?:MergeOutcome;nextActions:NextAction[];statusMessage?:string;
}
