package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.TokenUsage;
import com.yuzee.tokenlab.model.ContextMetrics;
import com.yuzee.tokenlab.model.CompactionMetrics;
import com.yuzee.tokenlab.protocol.v13.YuzeeResponseV13;
import java.util.List;

public class StreamEvent {
    private String type; // start, delta, structured, validation, usage, compaction, done, error
    private String delta;
    private String conversationId;
    private String messageId;
    private TokenUsage usage;
    private ContextMetrics contextMetrics;
    private CompactionMetrics compactionMetrics;
    private String appliedThinkingLevel;
    private String error;
    private YuzeeResponseV13 structuredResponse;
    private Boolean schemaValid;
    private Boolean semanticValid;
    private List<String> validationErrors;
    private String promptHash;
    private String schemaHash;

    public StreamEvent() {}

    public static StreamEvent start(String conversationId, String messageId, String appliedThinkingLevel) {
        StreamEvent e = new StreamEvent();
        e.setType("start");
        e.setConversationId(conversationId);
        e.setMessageId(messageId);
        e.setAppliedThinkingLevel(appliedThinkingLevel);
        return e;
    }

    public static StreamEvent delta(String text) {
        StreamEvent e = new StreamEvent();
        e.setType("delta");
        e.setDelta(text);
        return e;
    }

    public static StreamEvent structured(YuzeeResponseV13 response, boolean schemaValid, boolean semanticValid, List<String> validationErrors) {
        StreamEvent e = new StreamEvent();
        e.setType("structured");
        e.setStructuredResponse(response);
        e.setSchemaValid(schemaValid);
        e.setSemanticValid(semanticValid);
        e.setValidationErrors(validationErrors);
        return e;
    }

    public static StreamEvent validation(boolean schemaValid, boolean semanticValid, List<String> validationErrors, String promptHash, String schemaHash) {
        StreamEvent e = new StreamEvent();
        e.setType("validation");
        e.setSchemaValid(schemaValid);
        e.setSemanticValid(semanticValid);
        e.setValidationErrors(validationErrors);
        e.setPromptHash(promptHash);
        e.setSchemaHash(schemaHash);
        return e;
    }

    public static StreamEvent usage(TokenUsage usage, ContextMetrics contextMetrics, CompactionMetrics compaction) {
        StreamEvent e = new StreamEvent();
        e.setType("usage");
        e.setUsage(usage);
        e.setContextMetrics(contextMetrics);
        e.setCompactionMetrics(compaction);
        return e;
    }

    public static StreamEvent compaction(CompactionMetrics compaction) {
        StreamEvent e = new StreamEvent();
        e.setType("compaction");
        e.setCompactionMetrics(compaction);
        return e;
    }

    public static StreamEvent done() {
        StreamEvent e = new StreamEvent();
        e.setType("done");
        return e;
    }

    public static StreamEvent error(String error) {
        StreamEvent e = new StreamEvent();
        e.setType("error");
        e.setError(error);
        return e;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDelta() { return delta; }
    public void setDelta(String delta) { this.delta = delta; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public TokenUsage getUsage() { return usage; }
    public void setUsage(TokenUsage usage) { this.usage = usage; }

    public ContextMetrics getContextMetrics() { return contextMetrics; }
    public void setContextMetrics(ContextMetrics contextMetrics) { this.contextMetrics = contextMetrics; }

    public CompactionMetrics getCompactionMetrics() { return compactionMetrics; }
    public void setCompactionMetrics(CompactionMetrics compactionMetrics) { this.compactionMetrics = compactionMetrics; }

    public String getAppliedThinkingLevel() { return appliedThinkingLevel; }
    public void setAppliedThinkingLevel(String appliedThinkingLevel) { this.appliedThinkingLevel = appliedThinkingLevel; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public YuzeeResponseV13 getStructuredResponse() { return structuredResponse; }
    public void setStructuredResponse(YuzeeResponseV13 structuredResponse) { this.structuredResponse = structuredResponse; }

    public Boolean getSchemaValid() { return schemaValid; }
    public void setSchemaValid(Boolean schemaValid) { this.schemaValid = schemaValid; }

    public Boolean getSemanticValid() { return semanticValid; }
    public void setSemanticValid(Boolean semanticValid) { this.semanticValid = semanticValid; }

    public List<String> getValidationErrors() { return validationErrors; }
    public void setValidationErrors(List<String> validationErrors) { this.validationErrors = validationErrors; }

    public String getPromptHash() { return promptHash; }
    public void setPromptHash(String promptHash) { this.promptHash = promptHash; }

    public String getSchemaHash() { return schemaHash; }
    public void setSchemaHash(String schemaHash) { this.schemaHash = schemaHash; }
}
