/**
 * Yuzee UserEvent - Structured event DTO submitted from frontend interaction controls
 * Conforms to Protocol v1.3 wire contract
 */

export interface UserEventUI {
  selected_mode?: string; // 'Standard' | 'Quick' | 'Explain' | 'Explore' | 'Decide' | 'Detail'
}

export interface UserEventInteraction {
  question_id: string;
  selected_option_ids?: string[];
  ranked_option_ids?: string[];
  fields?: Record<string, string>;
  self_input?: string;
  action_id?: string;
}

export interface UserEventPayload {
  ui?: UserEventUI;
  interaction?: UserEventInteraction;
}

export interface UserEvent {
  message?: string;
  userEvent?: UserEventPayload;
  ui?: UserEventUI;
  interaction?: UserEventInteraction;
  timestamp?: number;
  
  // Legacy / convenience fields handled gracefully
  type?: 'option_selected' | 'ranked_submission' | 'fields_submitted' | 'text_answer' | 'action_clicked' | 'followup_clicked';
  interaction_id?: string;
  option_id?: string;
  value?: string;
  selected_option_ids?: string[];
  ranked_ids?: string[];
  ranked_option_ids?: string[];
  fields?: Record<string, string>;
  self_input?: string;
  action_id?: string;
}
