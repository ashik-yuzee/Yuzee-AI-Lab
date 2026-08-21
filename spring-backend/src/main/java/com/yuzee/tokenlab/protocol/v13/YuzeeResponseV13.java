package com.yuzee.tokenlab.protocol.v13;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = false)
public record YuzeeResponseV13(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("current_mode") String currentMode,
        @JsonProperty("response_intent") String responseIntent,
        @JsonProperty("content_blocks") List<YuzeeContentBlock> contentBlocks,
        @JsonProperty("interaction") YuzeeInteraction interaction,
        @JsonProperty("service") YuzeeService service,
        @JsonProperty("state") YuzeeState state,
        @JsonProperty("followups") YuzeeFollowups followups
) {
    public record YuzeeContentBlock(
            @JsonProperty("id") String id,
            @JsonProperty("type") String type,
            @JsonProperty("level") String level,
            @JsonProperty("variant") String variant,
            @JsonProperty("title") String title,
            @JsonProperty("text") String text,
            @JsonProperty("items") List<YuzeeItem> items,
            @JsonProperty("columns") List<YuzeeColumn> columns,
            @JsonProperty("rows") List<YuzeeRow> rows
    ) {}

    public record YuzeeItem(
            @JsonProperty("id") String id,
            @JsonProperty("title") String title,
            @JsonProperty("text") String text,
            @JsonProperty("value") String value,
            @JsonProperty("status") String status
    ) {}

    public record YuzeeColumn(
            @JsonProperty("key") String key,
            @JsonProperty("label") String label
    ) {}

    public record YuzeeRow(
            @JsonProperty("id") String id,
            @JsonProperty("cells") List<YuzeeCell> cells
    ) {}

    public record YuzeeCell(
            @JsonProperty("key") String key,
            @JsonProperty("value") String value
    ) {}

    public record YuzeeOption(
            @JsonProperty("id") String id,
            @JsonProperty("label") String label,
            @JsonProperty("description") String description,
            @JsonProperty("value") String value
    ) {}

    public record YuzeeField(
            @JsonProperty("id") String id,
            @JsonProperty("label") String label,
            @JsonProperty("input_type") String inputType,
            @JsonProperty("required") boolean required,
            @JsonProperty("options") List<YuzeeOption> options
    ) {}

    public record RecommendedAction(
            @JsonProperty("id") String id,
            @JsonProperty("label") String label,
            @JsonProperty("message") String message
    ) {}

    public record YuzeeInteraction(
            @JsonProperty("kind") String kind,
            @JsonProperty("input_type") String inputType,
            @JsonProperty("question_id") String questionId,
            @JsonProperty("question") String question,
            @JsonProperty("options") List<YuzeeOption> options,
            @JsonProperty("allow_other_input") boolean allowOtherInput,
            @JsonProperty("other_input_label") String otherInputLabel,
            @JsonProperty("fields") List<YuzeeField> fields,
            @JsonProperty("recommended_actions") List<RecommendedAction> recommendedActions
    ) {}

    public record ServiceAction(
            @JsonProperty("id") String id,
            @JsonProperty("title") String title,
            @JsonProperty("description") String description,
            @JsonProperty("action_id") String actionId,
            @JsonProperty("requires_confirmation") boolean requiresConfirmation
    ) {}

    public record YuzeeService(
            @JsonProperty("flow") String flow,
            @JsonProperty("intent_detected") boolean intentDetected,
            @JsonProperty("goal_summary") String goalSummary,
            @JsonProperty("trigger") String trigger,
            @JsonProperty("confidence") String confidence,
            @JsonProperty("selected_rmo") String selectedRmo,
            @JsonProperty("offer_target") String offerTarget,
            @JsonProperty("missing_inputs") List<String> missingInputs,
            @JsonProperty("actions") List<ServiceAction> actions
    ) {}

    public record UserConfidenceState(
            @JsonProperty("score") int score,
            @JsonProperty("band") String band,
            @JsonProperty("evidence_strength") String evidenceStrength,
            @JsonProperty("trend") String trend,
            @JsonProperty("reason_codes") List<String> reasonCodes
    ) {}

    public record YuzeeProgress(
            @JsonProperty("explained") List<String> explained,
            @JsonProperty("failed_attempts") int failedAttempts,
            @JsonProperty("loop_count_same_issue") int loopCountSameIssue
    ) {}

    public record YuzeeState(
            @JsonProperty("active_response_mode") String activeResponseMode,
            @JsonProperty("effective_response_mode") String effectiveResponseMode,
            @JsonProperty("mode_source") String modeSource,
            @JsonProperty("safety_override_applied") boolean safetyOverrideApplied,
            @JsonProperty("user_confidence") UserConfidenceState userConfidence,
            @JsonProperty("progress") YuzeeProgress progress
    ) {}

    public record FollowupTrigger(
            @JsonProperty("after_seconds") int afterSeconds,
            @JsonProperty("message") String message,
            @JsonProperty("suggested_replies") List<String> suggestedReplies
    ) {}

    public record YuzeeFollowups(
            @JsonProperty("enabled") boolean enabled,
            @JsonProperty("cancel_on_user_message") boolean cancelOnUserMessage,
            @JsonProperty("topic_lock") boolean topicLock,
            @JsonProperty("topic_key") String topicKey,
            @JsonProperty("triggers") List<FollowupTrigger> triggers
    ) {}
}
