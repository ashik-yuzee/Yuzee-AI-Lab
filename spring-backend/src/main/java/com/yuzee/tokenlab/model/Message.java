package com.yuzee.tokenlab.model;

public class Message {
    private String id;
    private MessageRole role;
    private String content;
    private TokenUsage usage;
    private ContextMetrics contextMetrics;
    private CompactionMetrics compactionMetrics;
    private QualityFeedback feedback;
    private String model;
    private ThinkingLevel thinkingLevel;
    private OptimizationStrategy optimizationStrategy;
    private PresetMode preset;
    private ResponseMode responseMode;
    private int recentTurnsCount;
    private boolean hasSummary;
    private long createdAt;
    private String structuredResponseJson;
    private Boolean schemaValid;
    private Boolean semanticValid;
    private java.util.List<String> validationErrors;

    public Message() {
        this.createdAt = System.currentTimeMillis();
    }

    public Message(String id, MessageRole role, String content) {
        this.id = id;
        this.role = role;
        this.content = content;
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public MessageRole getRole() { return role; }
    public void setRole(MessageRole role) { this.role = role; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public TokenUsage getUsage() { return usage; }
    public void setUsage(TokenUsage usage) { this.usage = usage; }

    public ContextMetrics getContextMetrics() { return contextMetrics; }
    public void setContextMetrics(ContextMetrics contextMetrics) { this.contextMetrics = contextMetrics; }

    public CompactionMetrics getCompactionMetrics() { return compactionMetrics; }
    public void setCompactionMetrics(CompactionMetrics compactionMetrics) { this.compactionMetrics = compactionMetrics; }

    public QualityFeedback getFeedback() { return feedback; }
    public void setFeedback(QualityFeedback feedback) { this.feedback = feedback; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public ThinkingLevel getThinkingLevel() { return thinkingLevel; }
    public void setThinkingLevel(ThinkingLevel thinkingLevel) { this.thinkingLevel = thinkingLevel; }

    public OptimizationStrategy getOptimizationStrategy() { return optimizationStrategy; }
    public void setOptimizationStrategy(OptimizationStrategy optimizationStrategy) { this.optimizationStrategy = optimizationStrategy; }

    public PresetMode getPreset() { return preset; }
    public void setPreset(PresetMode preset) { this.preset = preset; }

    public ResponseMode getResponseMode() { return responseMode; }
    public void setResponseMode(ResponseMode responseMode) { this.responseMode = responseMode; }

    public int getRecentTurnsCount() { return recentTurnsCount; }
    public void setRecentTurnsCount(int recentTurnsCount) { this.recentTurnsCount = recentTurnsCount; }

    public boolean isHasSummary() { return hasSummary; }
    public void setHasSummary(boolean hasSummary) { this.hasSummary = hasSummary; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public String getStructuredResponseJson() { return structuredResponseJson; }
    public void setStructuredResponseJson(String structuredResponseJson) { this.structuredResponseJson = structuredResponseJson; }

    public Boolean getSchemaValid() { return schemaValid; }
    public void setSchemaValid(Boolean schemaValid) { this.schemaValid = schemaValid; }

    public Boolean getSemanticValid() { return semanticValid; }
    public void setSemanticValid(Boolean semanticValid) { this.semanticValid = semanticValid; }

    public java.util.List<String> getValidationErrors() { return validationErrors; }
    public void setValidationErrors(java.util.List<String> validationErrors) { this.validationErrors = validationErrors; }
}
