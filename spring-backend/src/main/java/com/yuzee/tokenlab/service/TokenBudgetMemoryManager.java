package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class TokenBudgetMemoryManager {

    private final TokenCountService tokenCountService;
    private final ConversationCompactor compactor;

    public TokenBudgetMemoryManager(TokenCountService tokenCountService, ConversationCompactor compactor) {
        this.tokenCountService = tokenCountService;
        this.compactor = compactor;
    }

    public static class MemoryAssemblyResult {
        private String summaryText;
        private String recentHistoryText;
        private int recentTurnsCount;
        private int removedTokens;
        private CompactionMetrics compactionMetrics;
        private List<ContextMetrics.ExcludedDetail> excludedItems = new ArrayList<>();

        public MemoryAssemblyResult() {}

        public String getSummaryText() { return summaryText; }
        public void setSummaryText(String summaryText) { this.summaryText = summaryText; }

        public String getRecentHistoryText() { return recentHistoryText; }
        public void setRecentHistoryText(String recentHistoryText) { this.recentHistoryText = recentHistoryText; }

        public int getRecentTurnsCount() { return recentTurnsCount; }
        public void setRecentTurnsCount(int recentTurnsCount) { this.recentTurnsCount = recentTurnsCount; }

        public int getRemovedTokens() { return removedTokens; }
        public void setRemovedTokens(int removedTokens) { this.removedTokens = removedTokens; }

        public CompactionMetrics getCompactionMetrics() { return compactionMetrics; }
        public void setCompactionMetrics(CompactionMetrics compactionMetrics) { this.compactionMetrics = compactionMetrics; }

        public List<ContextMetrics.ExcludedDetail> getExcludedItems() { return excludedItems; }
        public void setExcludedItems(List<ContextMetrics.ExcludedDetail> excludedItems) { this.excludedItems = excludedItems; }
    }

    public MemoryAssemblyResult assembleMemory(
            Conversation conversation,
            String currentMessage,
            OptimizationStrategy strategy,
            int budgetTokens,
            int recentTurnsToKeep
    ) {
        MemoryAssemblyResult result = new MemoryAssemblyResult();
        List<Message> allMessages = conversation.getMessages();

        if (allMessages.isEmpty()) {
            result.setSummaryText("");
            result.setRecentHistoryText("");
            result.setRecentTurnsCount(0);
            result.setRemovedTokens(0);
            return result;
        }

        switch (strategy) {
            case BASELINE -> {
                // Baseline: Send complete verbatim history (high token benchmark)
                StringBuilder fullHistory = new StringBuilder();
                for (Message msg : allMessages) {
                    String role = msg.getRole() != null ? msg.getRole().name() : "USER";
                    fullHistory.append(role).append(": ").append(msg.getContent()).append("\n\n");
                }
                result.setRecentHistoryText(fullHistory.toString().trim());
                result.setRecentTurnsCount(allMessages.size());
                result.setSummaryText("");
                result.setRemovedTokens(0);
            }

            case SLIDING_WINDOW -> {
                // Turn-safe sliding window (keep last N*2 messages)
                int messagesToKeep = Math.max(2, recentTurnsToKeep * 2);
                int totalMsgs = allMessages.size();
                int startIndex = Math.max(0, totalMsgs - messagesToKeep);

                // Ensure turn boundary starts with USER message if possible
                if (startIndex > 0 && startIndex < totalMsgs && allMessages.get(startIndex).getRole() == MessageRole.ASSISTANT) {
                    startIndex = Math.max(0, startIndex - 1);
                }

                List<Message> keptMessages = allMessages.subList(startIndex, totalMsgs);
                List<Message> evictedMessages = allMessages.subList(0, startIndex);

                int evictedTokens = 0;
                for (Message evicted : evictedMessages) {
                    int t = tokenCountService.estimateTokens(evicted.getContent());
                    evictedTokens += t;
                    result.getExcludedItems().add(new ContextMetrics.ExcludedDetail(
                        "Evicted Turn (" + evicted.getRole() + ")",
                        "Outside sliding window limit (" + recentTurnsToKeep + " turns)",
                        t,
                        preview(evicted.getContent())
                    ));
                }

                StringBuilder recentHistory = new StringBuilder();
                for (Message msg : keptMessages) {
                    String role = msg.getRole() != null ? msg.getRole().name() : "USER";
                    recentHistory.append(role).append(": ").append(msg.getContent()).append("\n\n");
                }

                result.setRecentHistoryText(recentHistory.toString().trim());
                result.setRecentTurnsCount(keptMessages.size() / 2);
                result.setSummaryText("");
                result.setRemovedTokens(evictedTokens);
            }

            case SUMMARY_RECENT -> {
                // Summary + Recent turns
                int messagesToKeep = Math.max(2, recentTurnsToKeep * 2);
                int totalMsgs = allMessages.size();
                int startIndex = Math.max(0, totalMsgs - messagesToKeep);

                if (startIndex > 0 && startIndex < totalMsgs && allMessages.get(startIndex).getRole() == MessageRole.ASSISTANT) {
                    startIndex = Math.max(0, startIndex - 1);
                }

                List<Message> keptMessages = allMessages.subList(startIndex, totalMsgs);
                List<Message> evictedMessages = allMessages.subList(0, startIndex);

                String currentSummary = conversation.getSummary();
                if (!evictedMessages.isEmpty()) {
                    CompactionMetrics compaction = compactor.compactTurns(
                        currentSummary, 
                        evictedMessages, 
                        "Turns 1 to " + (startIndex / 2)
                    );
                    result.setCompactionMetrics(compaction);
                    // Use the actual summary text from compaction, not a fabricated placeholder
                    String actualSummary = compaction.getSummaryText() != null ? compaction.getSummaryText() : conversation.getSummary();
                    result.setSummaryText(actualSummary != null ? actualSummary : "");
                    result.setRemovedTokens(compaction.getTokensRemoved());
                } else {
                    result.setSummaryText(currentSummary);
                    result.setRemovedTokens(0);
                }

                StringBuilder recentHistory = new StringBuilder();
                for (Message msg : keptMessages) {
                    String role = msg.getRole() != null ? msg.getRole().name() : "USER";
                    recentHistory.append(role).append(": ").append(compactor.cleanMessageContent(msg.getContent())).append("\n\n");
                }

                result.setRecentHistoryText(recentHistory.toString().trim());
                result.setRecentTurnsCount(keptMessages.size() / 2);
            }

            case ADAPTIVE_HYBRID -> {
                // Prioritized Token Budget Allocation
                int availableBudget = budgetTokens;
                
                // Priority 1: Reserve current user message
                int currentMsgTokens = tokenCountService.estimateTokens(currentMessage);
                availableBudget -= currentMsgTokens;

                // Priority 2: Reserve recent conversation turns
                int messagesToKeep = Math.max(2, recentTurnsToKeep * 2);
                int totalMsgs = allMessages.size();
                int startIndex = Math.max(0, totalMsgs - messagesToKeep);

                List<Message> keptMessages = new ArrayList<>();
                List<Message> evictedMessages = new ArrayList<>();

                for (int i = 0; i < totalMsgs; i++) {
                    if (i >= startIndex) {
                        keptMessages.add(allMessages.get(i));
                    } else {
                        evictedMessages.add(allMessages.get(i));
                    }
                }

                StringBuilder recentHistory = new StringBuilder();
                int recentTokens = 0;
                for (Message msg : keptMessages) {
                    String cleaned = compactor.cleanMessageContent(msg.getContent());
                    int t = tokenCountService.estimateTokens(cleaned);
                    if (recentTokens + t <= availableBudget || keptMessages.indexOf(msg) >= keptMessages.size() - 2) {
                        String role = msg.getRole() != null ? msg.getRole().name() : "USER";
                        recentHistory.append(role).append(": ").append(cleaned).append("\n\n");
                        recentTokens += t;
                    } else {
                        evictedMessages.add(msg);
                    }
                }
                availableBudget -= recentTokens;

                // Priority 3: Historical summary if evicted messages exist
                String summary = conversation.getSummary();
                if (!evictedMessages.isEmpty()) {
                    CompactionMetrics compaction = compactor.compactTurns(
                        summary, 
                        evictedMessages, 
                        "Adaptive compact of " + evictedMessages.size() + " messages"
                    );
                    result.setCompactionMetrics(compaction);
                    result.setSummaryText(summary != null && !summary.isBlank() ? summary : "");
                    result.setRemovedTokens(compaction.getTokensRemoved());
                } else {
                    result.setSummaryText(summary);
                    result.setRemovedTokens(0);
                }

                result.setRecentHistoryText(recentHistory.toString().trim());
                result.setRecentTurnsCount(keptMessages.size() / 2);
            }
        }

        return result;
    }

    private String preview(String text) {
        if (text == null) return "";
        String clean = text.replaceAll("\\s+", " ").trim();
        return clean.length() > 60 ? clean.substring(0, 57) + "..." : clean;
    }
}
