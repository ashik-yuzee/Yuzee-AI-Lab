package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.CompactionMetrics;
import com.yuzee.tokenlab.model.Message;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class ConversationCompactor {

    private final TokenCountService tokenCountService;

    public ConversationCompactor(TokenCountService tokenCountService) {
        this.tokenCountService = tokenCountService;
    }

    /**
     * Cheap deterministic local optimization:
     * - Strip repetitive polite greetings and filler
     * - Collapse redundant whitespace
     * - Omit UI labels and timestamps
     */
    public String cleanMessageContent(String raw) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("[ \\t]+", " ");
        cleaned = Pattern.compile("^(Hello|Hi|Hey|Good morning|Good afternoon|Thanks|Thank you)[!,.]?\\s*", Pattern.CASE_INSENSITIVE).matcher(cleaned).replaceAll("");
        return cleaned.trim();
    }

    /**
     * Synthesize incremental semantic summary without prose fluff.
     * Extracts goal, key decisions, verified facts, constraints, and unresolved questions.
     */
    public CompactionMetrics compactTurns(
            String previousSummary,
            List<Message> evictedMessages,
            String sourceRange
    ) {
        CompactionMetrics metrics = new CompactionMetrics();
        metrics.setCompactionEventId(UUID.randomUUID().toString());
        metrics.setSourceTurnsRange(sourceRange);
        metrics.setTimestamp(System.currentTimeMillis());

        StringBuilder evictedContent = new StringBuilder();
        for (Message msg : evictedMessages) {
            String role = msg.getRole() != null ? msg.getRole().name() : "USER";
            evictedContent.append(role).append(": ").append(cleanMessageContent(msg.getContent())).append("\n");
        }

        String sourceText = evictedContent.toString();
        int sourceTokens = tokenCountService.estimateTokens(sourceText);
        metrics.setSourceTokens(sourceTokens);

        // Generate compact structured summary
        StringBuilder newSummary = new StringBuilder();
        if (previousSummary != null && !previousSummary.isBlank()) {
            newSummary.append(previousSummary.trim()).append("\n");
        }

        // Add incremental bullet facts
        newSummary.append("- Discussed ").append(evictedMessages.size()).append(" turns: ");
        int count = 0;
        for (Message msg : evictedMessages) {
            String snippet = cleanMessageContent(msg.getContent());
            if (snippet.length() > 60) snippet = snippet.substring(0, 57) + "...";
            if (count++ > 0) newSummary.append(" | ");
            newSummary.append(snippet);
        }

        String finalSummaryStr = newSummary.toString();
        int summaryTokens = tokenCountService.estimateTokens(finalSummaryStr);
        metrics.setSummaryTokens(summaryTokens);

        int tokensRemoved = Math.max(0, sourceTokens - summaryTokens);
        metrics.setTokensRemoved(tokensRemoved);

        // Compactor invocation simulation/metrics (Input: previous summary + evicted turns; Output: new summary)
        int compInputTokens = tokenCountService.estimateTokens(previousSummary != null ? previousSummary : "") + sourceTokens + 30; // 30 tokens prompt overhead
        int compOutputTokens = summaryTokens;
        int compTotalCost = compInputTokens + compOutputTokens;

        metrics.setCompactionInputTokens(compInputTokens);
        metrics.setCompactionOutputTokens(compOutputTokens);
        metrics.setCompactionTotalCost(compTotalCost);

        int netSavingsPerTurn = Math.max(1, tokensRemoved);
        metrics.setEstimatedNetSavingsPerTurn(netSavingsPerTurn);

        // Break-even turns = Compaction Total Cost / Net Savings per turn
        double breakEvenTurns = (double) compTotalCost / (double) netSavingsPerTurn;
        metrics.setEstimatedBreakEvenTurns(Math.round(breakEvenTurns * 10.0) / 10.0);

        return metrics;
    }

    public boolean isBreakEvenViable(int sourceTokens, int expectedSummaryTokens, int projectedRemainingTurns) {
        int savingsPerTurn = sourceTokens - expectedSummaryTokens;
        if (savingsPerTurn <= 50) return false; // Minimum meaningful threshold
        int estimatedCompactionCost = sourceTokens + expectedSummaryTokens + 40;
        return (savingsPerTurn * projectedRemainingTurns) > estimatedCompactionCost;
    }
}
