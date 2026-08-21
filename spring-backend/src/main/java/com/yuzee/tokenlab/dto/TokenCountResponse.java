package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.ContextMetrics;

public class TokenCountResponse {
    private int userMessageTokens;
    private int estimatedTotalInputTokens;
    private boolean exactCount;
    private ContextMetrics breakdown;

    public TokenCountResponse() {}

    public TokenCountResponse(int userMessageTokens, int estimatedTotalInputTokens, boolean exactCount, ContextMetrics breakdown) {
        this.userMessageTokens = userMessageTokens;
        this.estimatedTotalInputTokens = estimatedTotalInputTokens;
        this.exactCount = exactCount;
        this.breakdown = breakdown;
    }

    public int getUserMessageTokens() { return userMessageTokens; }
    public void setUserMessageTokens(int userMessageTokens) { this.userMessageTokens = userMessageTokens; }

    public int getEstimatedTotalInputTokens() { return estimatedTotalInputTokens; }
    public void setEstimatedTotalInputTokens(int estimatedTotalInputTokens) { this.estimatedTotalInputTokens = estimatedTotalInputTokens; }

    public boolean isExactCount() { return exactCount; }
    public void setExactCount(boolean exactCount) { this.exactCount = exactCount; }

    public ContextMetrics getBreakdown() { return breakdown; }
    public void setBreakdown(ContextMetrics breakdown) { this.breakdown = breakdown; }
}
