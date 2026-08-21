package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.CompactionMetrics;
import com.yuzee.tokenlab.model.TokenUsage;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class UsageAccumulator {

    private final AtomicInteger userFacingChatCalls = new AtomicInteger(0);
    private final AtomicLong totalUserInputTokens = new AtomicLong(0);
    private final AtomicLong totalModelInputTokens = new AtomicLong(0);
    private final AtomicLong totalModelOutputTokens = new AtomicLong(0);
    private final AtomicLong totalThinkingTokens = new AtomicLong(0);
    private final AtomicLong totalCachedTokens = new AtomicLong(0);
    private final AtomicLong totalUserFacingTokens = new AtomicLong(0);

    private final AtomicInteger compactionCalls = new AtomicInteger(0);
    private final AtomicLong compactionInputTokens = new AtomicLong(0);
    private final AtomicLong compactionOutputTokens = new AtomicLong(0);
    private final AtomicLong compactionTotalTokens = new AtomicLong(0);

    private final AtomicLong baselineEstimatedTokens = new AtomicLong(0);

    public void recordUserChatCall(TokenUsage usage, int baselineEst) {
        if (usage == null) return;
        userFacingChatCalls.incrementAndGet();
        if (usage.getCurrentUserTokens() != null) {
            totalUserInputTokens.addAndGet(usage.getCurrentUserTokens());
        }
        totalModelInputTokens.addAndGet(usage.getInputTokens());
        totalModelOutputTokens.addAndGet(usage.getOutputTokens());
        if (usage.getThinkingTokens() != null) {
            totalThinkingTokens.addAndGet(usage.getThinkingTokens());
        }
        if (usage.getCachedTokens() != null) {
            totalCachedTokens.addAndGet(usage.getCachedTokens());
        }
        totalUserFacingTokens.addAndGet(usage.getTotalTokens());
        baselineEstimatedTokens.addAndGet(baselineEst);
    }

    public void recordCompactionCall(CompactionMetrics metrics) {
        if (metrics == null) return;
        compactionCalls.incrementAndGet();
        compactionInputTokens.addAndGet(metrics.getCompactionInputTokens());
        compactionOutputTokens.addAndGet(metrics.getCompactionOutputTokens());
        compactionTotalTokens.addAndGet(metrics.getCompactionTotalCost());
    }

    public long getTrueTotalConsumption() {
        return totalUserFacingTokens.get() + compactionTotalTokens.get();
    }

    public long getTokensSaved() {
        long baseline = baselineEstimatedTokens.get();
        long actual = getTrueTotalConsumption();
        return Math.max(0, baseline - actual);
    }

    public double getNetSavingsPercentage() {
        long baseline = baselineEstimatedTokens.get();
        if (baseline <= 0) return 0.0;
        double saved = (double) getTokensSaved();
        return Math.round((saved / (double) baseline) * 1000.0) / 10.0;
    }

    public double getCacheHitRatio() {
        long totalIn = totalModelInputTokens.get();
        long cached = totalCachedTokens.get();
        if (totalIn <= 0) return 0.0;
        return Math.round(((double) cached / (double) totalIn) * 1000.0) / 10.0;
    }

    public void reset() {
        userFacingChatCalls.set(0);
        totalUserInputTokens.set(0);
        totalModelInputTokens.set(0);
        totalModelOutputTokens.set(0);
        totalThinkingTokens.set(0);
        totalCachedTokens.set(0);
        totalUserFacingTokens.set(0);

        compactionCalls.set(0);
        compactionInputTokens.set(0);
        compactionOutputTokens.set(0);
        compactionTotalTokens.set(0);

        baselineEstimatedTokens.set(0);
    }

    public int getUserFacingChatCalls() { return userFacingChatCalls.get(); }
    public long getTotalUserInputTokens() { return totalUserInputTokens.get(); }
    public long getTotalModelInputTokens() { return totalModelInputTokens.get(); }
    public long getTotalModelOutputTokens() { return totalModelOutputTokens.get(); }
    public long getTotalThinkingTokens() { return totalThinkingTokens.get(); }
    public long getTotalCachedTokens() { return totalCachedTokens.get(); }
    public long getTotalUserFacingTokens() { return totalUserFacingTokens.get(); }
    public int getCompactionCalls() { return compactionCalls.get(); }
    public long getCompactionInputTokens() { return compactionInputTokens.get(); }
    public long getCompactionOutputTokens() { return compactionOutputTokens.get(); }
    public long getCompactionTotalTokens() { return compactionTotalTokens.get(); }
    public long getBaselineEstimatedTokens() { return baselineEstimatedTokens.get(); }
}
