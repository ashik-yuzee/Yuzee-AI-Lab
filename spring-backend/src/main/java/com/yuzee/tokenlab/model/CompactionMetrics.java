package com.yuzee.tokenlab.model;

public class CompactionMetrics {
    private String compactionEventId;
    private String sourceTurnsRange;
    private String summaryText;         // actual semantic summary produced by compaction
    private int sourceTokens;
    private int summaryTokens;
    private int tokensRemoved;
    private int compactionInputTokens;
    private int compactionOutputTokens;
    private int compactionTotalCost;
    private int estimatedNetSavingsPerTurn;
    private double estimatedBreakEvenTurns;
    private long timestamp;

    public CompactionMetrics() {}

    public String getCompactionEventId() { return compactionEventId; }
    public void setCompactionEventId(String compactionEventId) { this.compactionEventId = compactionEventId; }

    public String getSourceTurnsRange() { return sourceTurnsRange; }
    public void setSourceTurnsRange(String sourceTurnsRange) { this.sourceTurnsRange = sourceTurnsRange; }

    public String getSummaryText() { return summaryText; }
    public void setSummaryText(String summaryText) { this.summaryText = summaryText; }

    public int getSourceTokens() { return sourceTokens; }
    public void setSourceTokens(int sourceTokens) { this.sourceTokens = sourceTokens; }

    public int getSummaryTokens() { return summaryTokens; }
    public void setSummaryTokens(int summaryTokens) { this.summaryTokens = summaryTokens; }

    public int getTokensRemoved() { return tokensRemoved; }
    public void setTokensRemoved(int tokensRemoved) { this.tokensRemoved = tokensRemoved; }

    public int getCompactionInputTokens() { return compactionInputTokens; }
    public void setCompactionInputTokens(int compactionInputTokens) { this.compactionInputTokens = compactionInputTokens; }

    public int getCompactionOutputTokens() { return compactionOutputTokens; }
    public void setCompactionOutputTokens(int compactionOutputTokens) { this.compactionOutputTokens = compactionOutputTokens; }

    public int getCompactionTotalCost() { return compactionTotalCost; }
    public void setCompactionTotalCost(int compactionTotalCost) { this.compactionTotalCost = compactionTotalCost; }

    public int getEstimatedNetSavingsPerTurn() { return estimatedNetSavingsPerTurn; }
    public void setEstimatedNetSavingsPerTurn(int estimatedNetSavingsPerTurn) { this.estimatedNetSavingsPerTurn = estimatedNetSavingsPerTurn; }

    public double getEstimatedBreakEvenTurns() { return estimatedBreakEvenTurns; }
    public void setEstimatedBreakEvenTurns(double estimatedBreakEvenTurns) { this.estimatedBreakEvenTurns = estimatedBreakEvenTurns; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
