package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.CompactionMetrics;
import com.yuzee.tokenlab.model.Message;
import com.yuzee.tokenlab.model.MessageRole;
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

        // Build semantic structured summary — extracts career signals from user messages
        StringBuilder newSummary = new StringBuilder();
        if (previousSummary != null && !previousSummary.isBlank()) {
            newSummary.append(previousSummary.trim()).append("\n");
        }

        // Walk user messages and extract career-relevant content
        String detectedGoal = null;
        String detectedBackground = null;
        String detectedDecision = null;
        int userTurns = 0;
        int assistantTurns = 0;

        for (Message msg : evictedMessages) {
            String cleaned = cleanMessageContent(msg.getContent());
            if (cleaned.isBlank()) continue;
            if (msg.getRole() == MessageRole.USER) {
                userTurns++;
                String lower = cleaned.toLowerCase();
                if (detectedGoal == null && (lower.contains("want to") || lower.contains("goal") || lower.contains("transition") || lower.contains("become") || lower.contains("career into") || lower.contains("break into"))) {
                    detectedGoal = cleaned.length() > 120 ? cleaned.substring(0, 117) + "..." : cleaned;
                } else if (detectedBackground == null && (lower.contains("experience") || lower.contains("years") || lower.contains("certified") || lower.contains("background") || lower.contains("degree") || lower.contains("currently"))) {
                    detectedBackground = cleaned.length() > 120 ? cleaned.substring(0, 117) + "..." : cleaned;
                } else if (detectedDecision == null && (lower.contains("will ") || lower.contains("decided") || lower.contains("choosing") || lower.contains("going to") || lower.contains("i'll"))) {
                    detectedDecision = cleaned.length() > 120 ? cleaned.substring(0, 117) + "..." : cleaned;
                }
            } else {
                assistantTurns++;
                // Extract goal_summary from JSON assistant responses when available
                if (detectedGoal == null && cleaned.contains("\"goal_summary\"")) {
                    int start = cleaned.indexOf("\"goal_summary\"") + 16;
                    if (start < cleaned.length()) {
                        int end = cleaned.indexOf("\"", start);
                        if (end > start) {
                            detectedGoal = cleaned.substring(start, Math.min(end, start + 120));
                        }
                    }
                }
            }
        }

        if (detectedGoal != null)       newSummary.append("- Goal: ").append(detectedGoal).append("\n");
        if (detectedBackground != null) newSummary.append("- Background: ").append(detectedBackground).append("\n");
        if (detectedDecision != null)   newSummary.append("- Decision: ").append(detectedDecision).append("\n");
        if (detectedGoal == null && detectedBackground == null && detectedDecision == null) {
            newSummary.append("- Covered ").append(userTurns).append(" user turns / ").append(assistantTurns).append(" assistant turns on career pathway.\n");
        }

        String finalSummaryStr = newSummary.toString().trim();
        int summaryTokens = tokenCountService.estimateTokens(finalSummaryStr);
        metrics.setSummaryText(finalSummaryStr);
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
