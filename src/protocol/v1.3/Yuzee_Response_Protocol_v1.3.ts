/**
 * Yuzee Response Protocol v1.3 Canonical TypeScript Definition
 * Source of truth: Yuzee_Response_Protocol_v1.3_for_Gemini.md & Yuzee_Response_Schema_v1.3.json
 */

export type YuzeeBlockType = 'heading' | 'text' | 'list' | 'steps' | 'table' | 'comparison' | 'callout' | 'key_value'
  | 'cards' | 'timeline' | 'flow' | 'pathway_map' | 'scorecard' | 'chart' | 'progress';
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
  requires_confirmation: boolean;
}

export interface YuzeeService {
  flow: 'NONE' | 'RMO' | 'DIRECT_APPLICATION' | 'OTHER_YUZEE_SERVICE';
  intent_detected: boolean;
  goal_summary: string;
  trigger: '' | 'user_request' | 'system_flag' | 'ai_inferred';
  confidence: '' | 'high' | 'medium' | 'low';
  selected_rmo: '' | 'Education' | 'Job' | 'CareerPathway' | 'EarnAndLearn' | 'Apprenticeship' | 'Business' | 'StaffUpskilling';
  offer_target: '' | 'course' | 'job' | 'pathway' | 'mixed';
  missing_inputs: Array<'goal' | 'location' | 'residency'>;
  actions: ServiceAction[];
}

export interface UserConfidenceState {
  score: number;
  band: UserConfidenceBand;
  evidence_strength: ConfidenceEvidenceStrength;
  trend: ConfidenceTrend;
  reason_codes: ConfidenceReasonCode[];
}

export interface YuzeeProgress {
  explained: string[];
  failed_attempts: number;
  loop_count_same_issue: number;
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
  after_seconds: 10 | 300 | 600;
  message: string;
  suggested_replies: string[];
}

export interface YuzeeFollowups {
  enabled: boolean;
  cancel_on_user_message: boolean;
  topic_lock: boolean;
  topic_key: string;
  triggers: FollowupTrigger[];
}

export interface YuzeeResponseV13 {
  schema_version: '1.3';
  current_mode: 'A_CONVERSATION' | 'B_DELIVERY' | 'S_SERVICE_HANDOFF';
  response_intent: string;
  content_blocks: YuzeeContentBlock[];
  interaction: YuzeeInteraction;
  service: YuzeeService;
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
