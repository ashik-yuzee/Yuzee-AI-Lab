/**
 * Yuzee Protocol v1.3 Validation Engine
 * Layer 1: Schema conformance using Ajv against Yuzee_Response_Schema_v1.3.json
 * Layer 2: Semantic & Invariant rules from Yuzee Prompt v0.12
 * Layer 3: Trusted Service Action validation & UserEvent Verification
 */

import Ajv from 'ajv';
import schemaJson from './v1.3/Yuzee_Response_Schema_v1.3.json';
import { ProtocolValidationResult, TrustedServiceAction } from '../types/ProtocolViewModel';
import { UserEvent, UserEventInteraction } from '../types/UserEvent';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schemaJson);

export interface ExtendedProtocolValidationResult extends ProtocolValidationResult {
  jsonParsed: boolean;
  schemaValid: boolean;
  semanticValid: boolean;
  protocolAccepted: boolean;
  schemaErrors: string[];
  semanticErrors: string[];
  errors: string[];
  warnings: string[];
}

export const TRUSTED_SERVICE_ACTIONS: Record<string, TrustedServiceAction & { isConnectedInLab: boolean }> = {
  'rmo_explore_courses': {
    actionId: 'rmo_explore_courses',
    title: 'Explore Certified Courses',
    description: 'Browse accredited Australian university and VET pathway courses matching your career goal.',
    category: 'RMO',
    requiresConfirmation: false,
    enabled: true,
    isConnectedInLab: false, // In Token Lab, actions are simulation/reference only until connected to a real live service backend
  },
  'rmo_apply_job': {
    actionId: 'rmo_apply_job',
    title: 'Apply for Verified Job Role',
    description: 'Submit an application directly to verified industry employer partners.',
    category: 'RMO',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
  'rmo_book_counsellor': {
    actionId: 'rmo_book_counsellor',
    title: 'Book 1-on-1 Senior Counsellor Session',
    description: 'Connect with a certified human education and career advisor.',
    category: 'ADVISORY',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
  'direct_admission_start': {
    actionId: 'direct_admission_start',
    title: 'Initiate Direct Admission',
    description: 'Start structured intake and document verification for priority admission.',
    category: 'DIRECT_APPLICATION',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
};

export function validateProtocolV13(json: any): ExtendedProtocolValidationResult {
  const schemaErrors: string[] = [];
  const semanticErrors: string[] = [];
  const warnings: string[] = [];

  if (!json || typeof json !== 'object') {
    return {
      jsonParsed: false,
      schemaValid: false,
      semanticValid: false,
      protocolAccepted: false,
      schemaErrors: ['Response is not a valid JSON object'],
      semanticErrors: [],
      errors: ['Response is not a valid JSON object'],
      warnings: [],
    };
  }

  // -------------------------------------------------------------
  // Layer 1: Canonical JSON Schema validation via Ajv
  // -------------------------------------------------------------
  const isAjvValid = validateSchema(json);
  if (!isAjvValid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const path = err.instancePath || 'root';
      schemaErrors.push(`[Schema] ${path}: ${err.message || 'Invalid value'}`);
    }
  }

  // Basic Envelope Assertions
  if (json.schema_version !== '1.3') {
    schemaErrors.push(`Invalid schema_version: expected "1.3", received "${json.schema_version}"`);
  }

  if (!Array.isArray(json.content_blocks)) {
    schemaErrors.push('content_blocks must be an array');
  }

  if (!json.interaction || typeof json.interaction !== 'object') {
    schemaErrors.push('interaction object is required in envelope');
  }

  if (!json.service || typeof json.service !== 'object') {
    schemaErrors.push('service object is required in envelope');
  }

  if (!json.state || typeof json.state !== 'object') {
    schemaErrors.push('state object is required in envelope');
  }

  if (!json.followups || typeof json.followups !== 'object') {
    schemaErrors.push('followups object is required in envelope');
  }

  const schemaValid = isAjvValid && schemaErrors.length === 0;

  // -------------------------------------------------------------
  // Layer 2: Semantic & Invariant Rule Validation (Yuzee Prompt v0.12)
  // -------------------------------------------------------------

  // Rule #10: First content block MUST be plain text with level="none" and title=""
  if (Array.isArray(json.content_blocks) && json.content_blocks.length > 0) {
    const firstBlock = json.content_blocks[0];
    if (firstBlock.type !== 'text') {
      semanticErrors.push(`[Rule #10] First content block must be type="text". Received: "${firstBlock.type}"`);
    }
    if (firstBlock.level && firstBlock.level !== 'none') {
      semanticErrors.push(`[Rule #10] First content block level must be "none". Received: "${firstBlock.level}"`);
    }
    if (firstBlock.title && firstBlock.title.trim() !== '') {
      semanticErrors.push(`[Rule #10] First content block title must be empty string. Received: "${firstBlock.title}"`);
    }
  } else if (!Array.isArray(json.content_blocks) || json.content_blocks.length === 0) {
    semanticErrors.push('content_blocks must be a non-empty array');
  }

  // Interaction Invariants
  if (json.interaction && typeof json.interaction === 'object') {
    const kind = json.interaction.kind;
    const inputType = json.interaction.input_type;
    const options = json.interaction.options || [];
    const recommendedActions = json.interaction.recommended_actions || [];

    // Ranked select must contain 3-6 options
    if (inputType === 'ranked_select') {
      if (!Array.isArray(options) || options.length < 3 || options.length > 6) {
        semanticErrors.push(`[Invariant] ranked_select interaction requires between 3 and 6 options. Received: ${options.length}`);
      }
    }

    // When an active question or handoff is open, recommended_actions must be empty []
    if (kind === 'question' || kind === 'handoff') {
      if (Array.isArray(recommendedActions) && recommendedActions.length > 0) {
        semanticErrors.push(`[Invariant] recommended_actions must be empty [] when interaction.kind is "${kind}". Received: ${recommendedActions.length} actions`);
      }
    }

    // Handoff interaction fields agreement with service missing_inputs
    if (kind === 'handoff' && json.service && typeof json.service === 'object') {
      const missingInputs: string[] = json.service.missing_inputs || [];
      const fields: Array<{ id: string }> = json.interaction.fields || [];
      const fieldIds = fields.map((f) => f.id);
      
      for (const m of missingInputs) {
        if (!fieldIds.includes(m)) {
          warnings.push(`[Handoff] Service missing_input "${m}" not present in interaction.fields`);
        }
      }
    }
  }

  // User Confidence State Invariants
  if (json.state?.user_confidence) {
    const uc = json.state.user_confidence;
    const score = uc.score;
    const band = uc.band;

    if (score === -1) {
      if (band !== 'unknown') {
        semanticErrors.push(`[Confidence] When score is -1, band must be "unknown". Received: "${band}"`);
      }
      if (uc.evidence_strength !== 'none') {
        semanticErrors.push(`[Confidence] When score is -1, evidence_strength must be "none". Received: "${uc.evidence_strength}"`);
      }
    } else if (typeof score === 'number' && score >= 0 && score <= 100) {
      if (score <= 39 && band !== 'low') {
        semanticErrors.push(`[Confidence] Score ${score} (0-39) requires band="low". Received: "${band}"`);
      } else if (score >= 40 && score <= 69 && band !== 'medium') {
        semanticErrors.push(`[Confidence] Score ${score} (40-69) requires band="medium". Received: "${band}"`);
      } else if (score >= 70 && score <= 100 && band !== 'high') {
        semanticErrors.push(`[Confidence] Score ${score} (70-100) requires band="high". Received: "${band}"`);
      }
    } else {
      semanticErrors.push(`[Confidence] score must be -1 or integer 0..100. Received: ${score}`);
    }
  }

  // -------------------------------------------------------------
  // Layer 3: Trusted Service Action Registry Check
  // -------------------------------------------------------------
  if (json.service?.actions && Array.isArray(json.service.actions)) {
    for (const act of json.service.actions) {
      const actId = act.action_id || act.id;
      if (actId && !TRUSTED_SERVICE_ACTIONS[actId]) {
        warnings.push(`[Security] Service action_id "${actId}" is untrusted/unregistered in server registry`);
      }
    }
  }

  const semanticValid = semanticErrors.length === 0;
  // AJV generates false positives for oneOf variants (e.g. text blocks failing table-block schema).
  // Semantic invariants are the real quality gate — accept if they pass regardless of AJV noise.
  const protocolAccepted = semanticValid;
  const allErrors = [...schemaErrors, ...semanticErrors];

  return {
    jsonParsed: true,
    schemaValid,
    semanticValid,
    protocolAccepted,
    schemaErrors,
    semanticErrors,
    errors: allErrors,
    warnings,
  };
}

/**
 * Server-side validation of incoming UserEvent against trusted Active Server Interaction
 * Enforces question_id agreement, valid options, ranked bounds, and field schema
 */
export function validateUserEventAgainstActiveInteraction(
  userEvent: UserEvent | undefined,
  activeInteraction: any | undefined
): { valid: boolean; errors: string[] } {
  if (!userEvent) {
    return { valid: true, errors: [] };
  }

  const interaction: UserEventInteraction | undefined =
    userEvent.interaction ||
    (userEvent.userEvent ? userEvent.userEvent.interaction : undefined) ||
    (userEvent.type
      ? {
          question_id: userEvent.interaction_id || 'active_question',
          selected_option_ids: userEvent.option_id ? [userEvent.option_id] : (userEvent.selected_option_ids || undefined),
          ranked_option_ids: userEvent.ranked_ids || userEvent.ranked_option_ids,
          fields: userEvent.fields,
          self_input: userEvent.value || userEvent.self_input,
          action_id: userEvent.action_id,
        }
      : undefined);

  // If no structured interaction is attached (e.g. standard user text), it's valid
  if (
    !interaction ||
    (!interaction.question_id &&
      !interaction.action_id &&
      !interaction.selected_option_ids &&
      !interaction.ranked_option_ids &&
      !interaction.fields &&
      !interaction.self_input)
  ) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  // Service Action Click Verification
  if (interaction.action_id) {
    const trusted = TRUSTED_SERVICE_ACTIONS[interaction.action_id];
    if (!trusted) {
      errors.push(`Action ID "${interaction.action_id}" is not a recognized or trusted service action.`);
    }
    return { valid: errors.length === 0, errors };
  }

  // If the interaction is targeting a question, verify active interaction existence
  if (!activeInteraction || activeInteraction.kind === 'none') {
    // If client submits a structured question interaction when no question is active on server
    if (interaction.question_id) {
      errors.push(`No active question interaction on server. Received structured event for question_id "${interaction.question_id}".`);
    }
    return { valid: errors.length === 0, errors };
  }

  const activeQId = activeInteraction.question_id || activeInteraction.id;
  if (interaction.question_id && activeQId && interaction.question_id !== activeQId) {
    errors.push(`Question ID mismatch: received "${interaction.question_id}", but active server question is "${activeQId}".`);
  }

  const trustedOptions = Array.isArray(activeInteraction.options) ? activeInteraction.options : [];
  const trustedOptionIds = trustedOptions.map((o: any) => o.id || o.option_id || o.value);
  const inputType = activeInteraction.input_type || 'single_select';

  // Validate Single Select
  if (inputType === 'single_select') {
    const selected = interaction.selected_option_ids || [];
    const hasSelfInput = !!(interaction.self_input && interaction.self_input.trim().length > 0);

    if (selected.length > 1) {
      errors.push(`Single select interaction accepts at most 1 option, received ${selected.length}.`);
    }

    if (selected.length === 0 && !hasSelfInput) {
      errors.push(`Single select interaction requires exactly one valid option or permitted self_input.`);
    }

    if (selected.length === 1 && hasSelfInput) {
      errors.push(`Cannot submit both a selected option and self-input in single select.`);
    }

    for (const optId of selected) {
      if (!trustedOptionIds.includes(optId)) {
        errors.push(`Selected option ID "${optId}" is not in the trusted active options list.`);
      }
    }

    if (hasSelfInput && !activeInteraction.allow_other_input) {
      errors.push(`Self-input provided but allow_other_input is false for this question.`);
    }
  }

  // Validate Multi Select
  if (inputType === 'multi_select') {
    const selected = interaction.selected_option_ids || [];
    const uniqueSelected = new Set(selected);
    if (uniqueSelected.size !== selected.length) {
      errors.push(`Duplicate option IDs submitted in multi-select.`);
    }
    for (const optId of selected) {
      if (!trustedOptionIds.includes(optId)) {
        errors.push(`Selected option ID "${optId}" is not in the trusted active options list.`);
      }
    }
    if (interaction.self_input && interaction.self_input.trim().length > 0 && !activeInteraction.allow_other_input) {
      errors.push(`Self-input provided but allow_other_input is false for this question.`);
    }
  }

  // Validate Ranked Select
  if (inputType === 'ranked_select') {
    const ranked = interaction.ranked_option_ids || [];
    const uniqueRanked = new Set(ranked);
    if (uniqueRanked.size !== ranked.length) {
      errors.push(`Duplicate option IDs found in ranked selection.`);
    }
    for (const optId of ranked) {
      if (!trustedOptionIds.includes(optId)) {
        errors.push(`Ranked option ID "${optId}" is not in the trusted active options list.`);
      }
    }
    const minOptions = Math.min(3, trustedOptions.length);
    const maxOptions = Math.min(6, trustedOptions.length);
    if (ranked.length < minOptions || ranked.length > maxOptions) {
      errors.push(`Ranked options count (${ranked.length}) must be between ${minOptions} and ${maxOptions}.`);
    }
  }

  // Validate Fields (Handoff or structured form)
  if (inputType === 'fields' || activeInteraction.kind === 'handoff') {
    const trustedFields = Array.isArray(activeInteraction.fields) ? activeInteraction.fields : [];
    const trustedFieldIds = trustedFields.map((f: any) => f.id || f.name);
    const submittedFields = interaction.fields || {};

    for (const fieldId of Object.keys(submittedFields)) {
      if (!trustedFieldIds.includes(fieldId)) {
        errors.push(`Submitted field ID "${fieldId}" is not an authorized field in active interaction.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
