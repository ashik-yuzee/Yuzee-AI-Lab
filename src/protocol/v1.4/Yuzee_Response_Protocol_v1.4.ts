/**
 * Yuzee Response Protocol v1.4 TypeScript Definition
 * Extends v1.3 with 7 new semantic block types and service_trigger/rmo_readiness split.
 */

// Re-export unchanged v1.3 types
export type {
  YuzeeBlockLevel, YuzeeVariant, InteractionKind, InteractionInputType,
  UserConfidenceBand, ConfidenceEvidenceStrength, ConfidenceTrend, ConfidenceReasonCode,
  YuzeeItem, YuzeeColumn, YuzeeCell, YuzeeRow,
  YuzeeOption, YuzeeField, RecommendedAction, YuzeeInteraction,
  UserConfidenceState, YuzeeProgress, YuzeeState, FollowupTrigger, YuzeeFollowups,
} from '../v1.3/Yuzee_Response_Protocol_v1.3';

// New block types
export type YuzeeBlockTypeV14 =
  | 'heading' | 'text' | 'list' | 'steps' | 'table' | 'comparison' | 'callout' | 'key_value'
  | 'cards' | 'timeline' | 'flow' | 'pathway_map' | 'scorecard' | 'chart' | 'progress';

// ---- Data shape types ----

export interface CardFact { label: string; value: string; }
export interface CardItem { id: string; title: string; subtitle: string; description: string; status: string; badge: string; facts: CardFact[]; }
export interface CardsData { cards: CardItem[]; }

export interface TimelineMilestone { id: string; label: string; description: string; time_label: string; status: 'completed'|'current'|'upcoming'|'blocked'|'paused'|'unknown'; optional: boolean; }
export interface TimelineData { milestones: TimelineMilestone[]; }

export interface FlowNode { id: string; label: string; description: string; node_type: string; status: string; }
export interface FlowEdge { from: string; to: string; label: string; condition: string; }
export interface FlowData { nodes: FlowNode[]; edges: FlowEdge[]; }

export interface PathwayStep { id: string; label: string; description: string; status: string; }
export interface PathwayLane { id: string; title: string; summary: string; recommended: boolean; steps: PathwayStep[]; }
export interface PathwayMapData { goal: string; lanes: PathwayLane[]; }

export interface ScorecardMetric { id: string; label: string; value: number|string; value_type: 'number'|'percentage'|'rating'|'text'; unit: string; max?: number; status: string; trend: 'up'|'down'|'stable'|'unknown'; description: string; }
export interface ScorecardData { metrics: ScorecardMetric[]; }

export interface ChartSeries { id: string; label: string; values: number[]; unit: string; }
export interface ChartData { chart_type: 'bar'|'line'|'donut'|'funnel'; categories: string[]; series: ChartSeries[]; source_status: 'verified'|'provided'|'estimated'|'to_verify'; }

export interface ProgressStage { id: string; label: string; status: 'completed'|'current'|'upcoming'|'blocked'|'paused'|'failed'|'unknown'; description: string; }
export interface ProgressData { stages: ProgressStage[]; }

export type BlockData = CardsData | TimelineData | FlowData | PathwayMapData | ScorecardData | ChartData | ProgressData | Record<string, never>;

// Discriminated content block union
interface BaseBlock { id: string; level: 'none'|'h2'|'h3'; variant: 'default'|'info'|'success'|'warning'|'danger'|'muted'; title: string; text: string; items: any[]; columns: any[]; rows: any[]; }

// Legacy blocks (data: {})
export interface TextBlockV14 extends BaseBlock { type: 'text'; data: Record<string, never>; }
export interface ListBlockV14 extends BaseBlock { type: 'list'; data: Record<string, never>; }
export interface CalloutBlockV14 extends BaseBlock { type: 'callout'; data: Record<string, never>; }
export interface HeadingBlockV14 extends BaseBlock { type: 'heading'; data: Record<string, never>; }
export interface StepsBlockV14 extends BaseBlock { type: 'steps'; data: Record<string, never>; }
export interface TableBlockV14 extends BaseBlock { type: 'table'; data: Record<string, never>; }
export interface ComparisonBlockV14 extends BaseBlock { type: 'comparison'; data: Record<string, never>; }
export interface KeyValueBlockV14 extends BaseBlock { type: 'key_value'; data: Record<string, never>; }

// New blocks
export interface CardsBlockV14 extends BaseBlock { type: 'cards'; data: CardsData; }
export interface TimelineBlockV14 extends BaseBlock { type: 'timeline'; data: TimelineData; }
export interface FlowBlockV14 extends BaseBlock { type: 'flow'; data: FlowData; }
export interface PathwayMapBlockV14 extends BaseBlock { type: 'pathway_map'; data: PathwayMapData; }
export interface ScorecardBlockV14 extends BaseBlock { type: 'scorecard'; data: ScorecardData; }
export interface ChartBlockV14 extends BaseBlock { type: 'chart'; data: ChartData; }
export interface ProgressBlockV14 extends BaseBlock { type: 'progress'; data: ProgressData; }

export type ContentBlockV14 =
  | TextBlockV14 | ListBlockV14 | CalloutBlockV14 | HeadingBlockV14
  | StepsBlockV14 | TableBlockV14 | ComparisonBlockV14 | KeyValueBlockV14
  | CardsBlockV14 | TimelineBlockV14 | FlowBlockV14 | PathwayMapBlockV14
  | ScorecardBlockV14 | ChartBlockV14 | ProgressBlockV14;

// Service trigger (replaces v1.3 `service` object)
export interface ServiceTriggerAction {
  id: string; title: string; description: string;
  action_id: string; requires_confirmation: boolean; rmo_type: string;
}
export interface ServiceTrigger {
  service_intent_detected: boolean;
  primary_requested_service: 'NONE'|'EDU_OFFER_RMO'|'JOB_MATCH_RMO'|'APPRENTICESHIP_RMO'|'TRAINEESHIP_RMO'|'INTERNSHIP_RMO'|'WORK_PLACEMENT_RMO'|'RPL_RMO'|'EARN_AND_LEARN_RMO'|'GRAD_PROGRAM_RMO'|'PATHWAY_RMO'|'OTHER_YUZEE_SERVICE';
  confidence: 'HIGH'|'MEDIUM'|'LOW';
  reason: string;
  trigger_now: boolean;
  needs_more_clarity: boolean;
  actions: ServiceTriggerAction[];
}
export interface RmoReadiness {
  readiness: 'READY'|'PARTIAL'|'NOT_READY';
  ready_to_generate: boolean;
  missing_inputs: Array<'goal'|'location'|'residency'>;
  verification_required: string[];
}

// Full v1.4 response
export interface YuzeeResponseV14 {
  schema_version: '1.4';
  current_mode: 'A_CONVERSATION'|'B_DELIVERY'|'S_SERVICE_HANDOFF';
  response_intent: string;
  content_blocks: ContentBlockV14[];
  interaction: any; // same shape as v1.3
  service_trigger: ServiceTrigger;
  rmo_readiness: RmoReadiness;
  state: any; // same shape as v1.3
  followups: any; // same shape as v1.3
}
