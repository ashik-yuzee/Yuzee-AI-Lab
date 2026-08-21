package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.CareerContext;
import com.yuzee.tokenlab.model.ResponseMode;
import org.springframework.stereotype.Service;

@Service
public class ContextAssembler {

    private final YuzeeProtocolRegistry protocolRegistry;

    public ContextAssembler(YuzeeProtocolRegistry protocolRegistry) {
        this.protocolRegistry = protocolRegistry;
    }

    public static final String COMPACT_SYSTEM_PROMPT = 
        "Yuzee AI Career Guide: Provide realistic, actionable career pathways, skill gap plans, and study milestones. Return JSON adhering to schema v1.3.";

    public String resolveSystemInstruction(String mode, String customPrompt) {
        if ("compact".equalsIgnoreCase(mode)) {
            return COMPACT_SYSTEM_PROMPT;
        } else if ("custom".equalsIgnoreCase(mode) && customPrompt != null && !customPrompt.isBlank()) {
            return customPrompt.trim();
        }
        return protocolRegistry.getProductionPrompt();
    }

    public String formatResponseModeGuidance(ResponseMode mode) {
        if (mode == null) return "[User Selected Mode: Standard]";
        return switch (mode) {
            case QUICK -> "[User Selected Mode: Quick]";
            case STANDARD -> "[User Selected Mode: Standard]";
            case EXPLAIN -> "[User Selected Mode: Explain]";
            case EXPLORE -> "[User Selected Mode: Explore]";
            case DETAIL -> "[User Selected Mode: Detail]";
            case DECIDE -> "[User Selected Mode: Decide]";
        };
    }

    /**
     * Builds the dynamic context block (career capsule + summary + recent history).
     * This is injected as a user-turn prefix, NOT as SystemMessage or AssistantMessage.
     */
    public String buildDynamicContext(CareerContext careerContext, String summary, String recentHistory) {
        StringBuilder sb = new StringBuilder();
        if (careerContext != null) {
            String careerStr = careerContext.toCompactPromptString();
            if (!careerStr.isBlank()) sb.append(careerStr).append("\n\n");
        }
        if (summary != null && !summary.isBlank()) {
            sb.append("PREVIOUS_CONVERSATION_SUMMARY:\n").append(summary.trim()).append("\n\n");
        }
        if (recentHistory != null && !recentHistory.isBlank()) {
            sb.append("RECENT_DIALOGUE_TURNS:\n").append(recentHistory.trim()).append("\n\n");
        }
        return sb.toString().trim();
    }

    public String buildAssembledPrompt(
            String systemInstruction,
            CareerContext careerContext,
            String summary,
            String recentHistory,
            String currentMessage,
            ResponseMode responseMode
    ) {
        StringBuilder sb = new StringBuilder();

        // 1. Stable System Instruction (Prefix for Implicit Caching)
        if (systemInstruction != null && !systemInstruction.isBlank()) {
            sb.append("SYSTEM_INSTRUCTION:\n").append(systemInstruction.trim()).append("\n\n");
        }

        // 2. Stable Career Context Capsule
        if (careerContext != null) {
            String careerStr = careerContext.toCompactPromptString();
            if (!careerStr.isBlank()) {
                sb.append(careerStr).append("\n\n");
            }
        }

        // 3. Compact Historical Summary
        if (summary != null && !summary.isBlank()) {
            sb.append("PREVIOUS_CONVERSATION_SUMMARY:\n").append(summary.trim()).append("\n\n");
        }

        // 4. Recent dialogue turns
        if (recentHistory != null && !recentHistory.isBlank()) {
            sb.append("RECENT_DIALOGUE_TURNS:\n").append(recentHistory.trim()).append("\n\n");
        }

        // Response mode modifier if present
        String modeGuidance = formatResponseModeGuidance(responseMode);
        if (!modeGuidance.isBlank()) {
            sb.append("RESPONSE_MODE_DIRECTIVE:\n").append(modeGuidance).append("\n\n");
        }

        // 5. Current User Message
        sb.append("CURRENT_USER_MESSAGE:\n").append(currentMessage != null ? currentMessage.trim() : "");

        return sb.toString().trim();
    }
}
