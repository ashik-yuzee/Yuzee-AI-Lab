package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.*;

public class ChatResponse {
    private String conversationId;
    private String messageId;
    private String assistantContent;
    private String model;
    private OptimizationStrategy optimizationStrategy;
    private ThinkingLevel thinkingLevel;
    private String appliedThinkingLevel;
    private TokenUsage usage;
    private ContextMetrics contextMetrics;
    private CompactionMetrics compactionMetrics;
    private Long latencyMs;
    private String finishReason;
    private String error;

    public ChatResponse() {}

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getAssistantContent() { return assistantContent; }
    public void setAssistantContent(String assistantContent) { this.assistantContent = assistantContent; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public OptimizationStrategy getOptimizationStrategy() { return optimizationStrategy; }
    public void setOptimizationStrategy(OptimizationStrategy optimizationStrategy) { this.optimizationStrategy = optimizationStrategy; }

    public ThinkingLevel getThinkingLevel() { return thinkingLevel; }
    public void setThinkingLevel(ThinkingLevel thinkingLevel) { this.thinkingLevel = thinkingLevel; }

    public String getAppliedThinkingLevel() { return appliedThinkingLevel; }
    public void setAppliedThinkingLevel(String appliedThinkingLevel) { this.appliedThinkingLevel = appliedThinkingLevel; }

    public TokenUsage getUsage() { return usage; }
    public void setUsage(TokenUsage usage) { this.usage = usage; }

    public ContextMetrics getContextMetrics() { return contextMetrics; }
    public void setContextMetrics(ContextMetrics contextMetrics) { this.contextMetrics = contextMetrics; }

    public CompactionMetrics getCompactionMetrics() { return compactionMetrics; }
    public void setCompactionMetrics(CompactionMetrics compactionMetrics) { this.compactionMetrics = compactionMetrics; }

    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }

    public String getFinishReason() { return finishReason; }
    public void setFinishReason(String finishReason) { this.finishReason = finishReason; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
