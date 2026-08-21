package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.ContextMetrics;
import org.springframework.stereotype.Service;

@Service
public class TokenCountService {

    /**
     * Approximate token estimation rule: ~3.8-4 characters per token for English text
     * and punctuation. For Gemini models, 1 token is roughly 4 chars or 0.75 words.
     */
    public int estimateTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        // Normalized token heuristic
        String trimmed = text.trim();
        int charCount = trimmed.length();
        int wordCount = trimmed.split("\\s+").length;
        
        // Balanced heuristic matching standard Gemini tokenization
        int estimate = (int) Math.ceil((charCount * 0.26) + (wordCount * 0.15));
        return Math.max(1, estimate);
    }

    public ContextMetrics breakDownContext(
            String systemInstruction,
            String careerContext,
            String summary,
            String recentHistory,
            String currentMessage,
            int removedTokens
    ) {
        ContextMetrics metrics = new ContextMetrics();
        int sysTokens = estimateTokens(systemInstruction);
        int careerTokens = estimateTokens(careerContext);
        int sumTokens = estimateTokens(summary);
        int recTokens = estimateTokens(recentHistory);
        int curTokens = estimateTokens(currentMessage);

        metrics.setSystemInstructionTokens(sysTokens);
        metrics.setCareerContextTokens(careerTokens);
        metrics.setSummaryTokens(sumTokens);
        metrics.setRecentTurnsTokens(recTokens);
        metrics.setCurrentMessageTokens(curTokens);
        metrics.setTotalAssembledTokens(sysTokens + careerTokens + sumTokens + recTokens + curTokens);
        metrics.setRemovedTokens(removedTokens);

        if (sysTokens > 0) {
            metrics.getIncludedSections().add(new ContextMetrics.SectionDetail(
                "System Instruction", 
                "Stable role and boundary guidance", 
                sysTokens, 
                preview(systemInstruction)
            ));
        }
        if (careerTokens > 0) {
            metrics.getIncludedSections().add(new ContextMetrics.SectionDetail(
                "Career Context Capsule", 
                "Structured user career stage & target constraints", 
                careerTokens, 
                preview(careerContext)
            ));
        }
        if (sumTokens > 0) {
            metrics.getIncludedSections().add(new ContextMetrics.SectionDetail(
                "Conversation Summary", 
                "Compact semantic key-value memory of past turns", 
                sumTokens, 
                preview(summary)
            ));
        }
        if (recTokens > 0) {
            metrics.getIncludedSections().add(new ContextMetrics.SectionDetail(
                "Recent Dialogue Turns", 
                "Verbatim user/assistant recent exchanges", 
                recTokens, 
                preview(recentHistory)
            ));
        }
        if (curTokens > 0) {
            metrics.getIncludedSections().add(new ContextMetrics.SectionDetail(
                "Current User Message", 
                "Active incoming user prompt", 
                curTokens, 
                preview(currentMessage)
            ));
        }

        return metrics;
    }

    private String preview(String text) {
        if (text == null) return "";
        String clean = text.replaceAll("\\s+", " ").trim();
        return clean.length() > 80 ? clean.substring(0, 77) + "..." : clean;
    }
}
