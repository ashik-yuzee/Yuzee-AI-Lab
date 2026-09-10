/**
 * Yuzee Response Protocol v1.3 Canonical TypeScript Definition
 * Source of truth: Yuzee_Response_Protocol_v1.3_for_Gemini.md & Yuzee_Response_Schema_v1.3.json
 */

export type YuzeeBlockType = 'heading' | 'text' | 'list' | 'steps' | 'table' | 'comparison' | 'callout' | 'key_value'
  | 'cards' | 'timeline' | 'flow' | 'pathway_map' | 'scorecard' | 'chart' | 'progress' | 'checklist';
export type YuzeeBlockLevel = 'none' | 'h2' | 'h3';
export type YuzeeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

export type InteractionKind = 'none' | 'question' | 'handoff';
export type InteractionInputType = 'none' | 'text' | 'single_select' | 'multi_select' | 'ranked_select' | 'fields';

export type UserConfidenceBand = 'unknown' | 'low' | 'medium' | 'high';
export type ConfidenceEvidenceStrength = 'none' | 'weak' | 'moderate' | 'strong';
export type ConfidenceTrend = 'unknown' | 'down' | 'stable' | 'up';
export type ConfidenceReasonCode =
  | 'EXPLICIT_UNCERTAINTY'
  | 'EXPLICIT_CONFIDENCE'
  | 'GOAL_UNCLEAR'
  | 'GOAL_CLEAR'
  | 'CHOICE_UNSTABLE'
  | 'CHOICE_STABLE'
  | 'CRITERIA_UNCLEAR'
  | 'CRITERIA_PARTIAL'
  | 'CRITERIA_CLEAR'
  | 'ROUTE_UNRESOLVED'
  | 'ROUTE_CHOSEN'
  | 'ACTION_NOT_READY'
  | 'ACTION_EXPLORING'
  | 'ACTION_READY'
  | 'CONTRADICTION_PRESENT'
  | 'NEW_TOPIC_RESET';

export interface YuzeeItem {
  id: string;
  title: string;
  text: string;
  value: string;
  status: string;
  icon?: string;       // emoji or descriptive text for left-side icon
  side_label?: string; // uppercase label for right-side column
  side_text?: string;  // body text for right-side column
}

export interface YuzeeColumn {
  key: string;
  label: string;
}

export interface YuzeeCell {
  key: string;
  value: string;
}

export interface YuzeeRow {
  id: string;
  criteria?: string;
  cells: YuzeeCell[];
}

export interface YuzeeContentBlock {
  id: string;
  type: YuzeeBlockType;
  level: YuzeeBlockLevel;
  variant: YuzeeVariant;
  title: string;
  text: string;
  items: YuzeeItem[];
  columns: YuzeeColumn[];
  rows: YuzeeRow[];
  data?: Record<string, unknown>; // v1.4 extensibility field; empty object for legacy types
}

export interface YuzeeOption {
  id: string;
  label: string;
  description: string;
  value: string;
}

export interface YuzeeField {
  id: 'goal' | 'location' | 'residency';
  label: string;
  input_type: 'text' | 'australian_location' | 'single_select';
  required: boolean;
  options: YuzeeOption[];
}

export interface RecommendedAction {
  id: string;
  label: string;
  message: string;
}

export interface YuzeeInteraction {
  kind: InteractionKind;
  input_type: InteractionInputType;
  question_id: string;
  question: string;
  options: YuzeeOption[];
  allow_other_input: boolean;
  other_input_label: string;
  fields: YuzeeField[];
  recommended_actions: RecommendedAction[];
}

export interface ServiceAction {
  id: string;
  title: string;
  description: string;
  action_id: string;
  rmo_type?: 'RMO' | 'DIRECT_APPLICATION' | 'OTHER' | '';
  requires_confirmation: boolean;
}

export type PrimaryRequestedService =
  | 'NONE'
  | 'EDU_OFFER_RMO'
  | 'JOB_MATCH_RMO'
  | 'APPRENTICESHIP_RMO'
  | 'TRAINEESHIP_RMO'
  | 'INTERNSHIP_RMO'
  | 'WORK_PLACEMENT_RMO'
  | 'RPL_RMO'
  | 'EARN_AND_LEARN_RMO'
  | 'GRAD_PROGRAM_RMO'
  | 'PATHWAY_RMO'
  | 'OTHER_YUZEE_SERVICE';

export type ServiceClassificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface YuzeeService {
  service_intent_detected: boolean;
  primary_requested_service: PrimaryRequestedService;
  confidence: ServiceClassificationConfidence;
  reason: string;
  trigger_now: boolean;
  needs_more_clarity: boolean;
  actions: ServiceAction[];
}

export interface UserConfidenceState {
  score: number;
  band: UserConfidenceBand;
  evidence_strength: ConfidenceEvidenceStrength;
  trend: ConfidenceTrend;
  reason_codes: ConfidenceReasonCode[];
}

export type SecurityPenalty = '' | '10_min_timeout' | '24_hr_ban';

export interface YuzeeProgress {
  explained: boolean;
  failed_attempts: number;
  loop_count_same_issue: number;
  security_breach_count: number;
  active_security_penalty: SecurityPenalty;
}

export interface YuzeeState {
  active_response_mode: string;
  effective_response_mode: string;
  mode_source: 'tag' | 'sticky' | 'default';
  safety_override_applied: boolean;
  user_confidence: UserConfidenceState;
  progress: YuzeeProgress;
}

export interface FollowupTrigger {
  delay_seconds: 10 | 300 | 600;
  message: string;
}

export interface YuzeeFollowups {
  enabled: boolean;
  cancel_on_user_message: boolean;
  topic_lock: boolean;
  topic_key: string;
  triggers: FollowupTrigger[];
}

export type RmoReadinessStatus = 'READY' | 'PARTIAL' | 'NOT_READY';

export interface YuzeeRmoReadiness {
  readiness: RmoReadinessStatus;
  ready_to_generate: boolean;
  missing_inputs: Array<'goal' | 'location' | 'residency'>;
  verification_required: boolean;
}

export interface YuzeeResponseV13 {
  schema_version: '1.3';
  current_mode: 'A_CONVERSATION' | 'B_DELIVERY' | 'S_SERVICE_HANDOFF';
  response_intent: string;
  content_blocks: YuzeeContentBlock[];
  interaction: YuzeeInteraction;
  service_trigger: YuzeeService;
  rmo_readiness: YuzeeRmoReadiness;
  state: YuzeeState;
  followups: YuzeeFollowups;
}

export function interactionRenderer(input: InteractionInputType): string | null {
  switch (input) {
    case 'text': return 'FreeTextQuestionComponent';
    case 'single_select': return 'SingleSelectQuestionComponent';
    case 'multi_select': return 'MultiSelectQuestionComponent';
    case 'ranked_select': return 'RankedSelectQuestionComponent';
    case 'fields': return 'HandoffFieldsComponent';
    default: return null;
  }
}
