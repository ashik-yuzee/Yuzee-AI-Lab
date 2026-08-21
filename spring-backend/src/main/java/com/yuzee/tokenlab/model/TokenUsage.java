package com.yuzee.tokenlab.model;

public class TokenUsage {
    private Integer currentUserTokens; // tokens in user typed text
    private int inputTokens;           // total model input tokens
    private int outputTokens;          // completion tokens
    private Integer thinkingTokens;    // hidden reasoning/thinking tokens
    private Integer cachedTokens;      // cached content tokens
    private Integer toolTokens;        // tool use tokens
    private int totalTokens;           // total prompt + completion
    private Integer uncachedInputTokens;
    private Double cacheHitPercentage;
    private Long latencyMs;
    private Long timeToFirstTokenMs;

    public TokenUsage() {}

    public Integer getCurrentUserTokens() { return currentUserTokens; }
    public void setCurrentUserTokens(Integer currentUserTokens) { this.currentUserTokens = currentUserTokens; }

    public int getInputTokens() { return inputTokens; }
    public void setInputTokens(int inputTokens) { this.inputTokens = inputTokens; }

    public int getOutputTokens() { return outputTokens; }
    public void setOutputTokens(int outputTokens) { this.outputTokens = outputTokens; }

    public Integer getThinkingTokens() { return thinkingTokens; }
    public void setThinkingTokens(Integer thinkingTokens) { this.thinkingTokens = thinkingTokens; }

    public Integer getCachedTokens() { return cachedTokens; }
    public void setCachedTokens(Integer cachedTokens) { this.cachedTokens = cachedTokens; }

    public Integer getToolTokens() { return toolTokens; }
    public void setToolTokens(Integer toolTokens) { this.toolTokens = toolTokens; }

    public int getTotalTokens() { return totalTokens; }
    public void setTotalTokens(int totalTokens) { this.totalTokens = totalTokens; }

    public Integer getUncachedInputTokens() { return uncachedInputTokens; }
    public void setUncachedInputTokens(Integer uncachedInputTokens) { this.uncachedInputTokens = uncachedInputTokens; }

    public Double getCacheHitPercentage() { return cacheHitPercentage; }
    public void setCacheHitPercentage(Double cacheHitPercentage) { this.cacheHitPercentage = cacheHitPercentage; }

    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }

    public Long getTimeToFirstTokenMs() { return timeToFirstTokenMs; }
    public void setTimeToFirstTokenMs(Long timeToFirstTokenMs) { this.timeToFirstTokenMs = timeToFirstTokenMs; }
}
