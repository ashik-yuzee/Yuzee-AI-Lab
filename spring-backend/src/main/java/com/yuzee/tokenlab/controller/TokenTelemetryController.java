package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.dto.TokenCountRequest;
import com.yuzee.tokenlab.dto.TokenCountResponse;
import com.yuzee.tokenlab.model.CareerContext;
import com.yuzee.tokenlab.model.ContextMetrics;
import com.yuzee.tokenlab.model.Conversation;
import com.yuzee.tokenlab.service.ContextAssembler;
import com.yuzee.tokenlab.service.ConversationService;
import com.yuzee.tokenlab.service.TokenBudgetMemoryManager;
import com.yuzee.tokenlab.service.TokenCountService;
import com.yuzee.tokenlab.service.UsageAccumulator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/tokens")
@CrossOrigin(origins = "*")
public class TokenTelemetryController {

    private final TokenCountService tokenCountService;
    private final ConversationService conversationService;
    private final TokenBudgetMemoryManager memoryManager;
    private final ContextAssembler contextAssembler;
    private final UsageAccumulator usageAccumulator;

    public TokenTelemetryController(
            TokenCountService tokenCountService,
            ConversationService conversationService,
            TokenBudgetMemoryManager memoryManager,
            ContextAssembler contextAssembler,
            UsageAccumulator usageAccumulator
    ) {
        this.tokenCountService = tokenCountService;
        this.conversationService = conversationService;
        this.memoryManager = memoryManager;
        this.contextAssembler = contextAssembler;
        this.usageAccumulator = usageAccumulator;
    }

    @PostMapping("/count")
    public ResponseEntity<TokenCountResponse> countTokens(@RequestBody TokenCountRequest request) {
        String msg = request.getMessage() != null ? request.getMessage() : "";
        int userTokens = tokenCountService.estimateTokens(msg);

        String convId = request.getConversationId();
        Conversation conv = (convId != null) ? conversationService.getConversation(convId).orElse(null) : null;

        String sysPrompt = contextAssembler.resolveSystemInstruction(
                conv != null ? conv.getSystemPromptMode() : "default",
                conv != null ? conv.getCustomSystemPrompt() : null
        );
        CareerContext career = conv != null ? conv.getCareerContext() : new CareerContext();
        String summary = conv != null ? conv.getSummary() : "";

        TokenBudgetMemoryManager.MemoryAssemblyResult mem = conv != null 
                ? memoryManager.assembleMemory(conv, msg, conv.getStrategy(), conv.getContextBudget(), conv.getRecentTurnsToKeep())
                : new TokenBudgetMemoryManager.MemoryAssemblyResult();

        ContextMetrics breakdown = tokenCountService.breakDownContext(
                sysPrompt,
                career.toCompactPromptString(),
                summary,
                mem.getRecentHistoryText(),
                msg,
                mem.getRemovedTokens()
        );

        return ResponseEntity.ok(new TokenCountResponse(
                userTokens,
                breakdown.getTotalAssembledTokens(),
                true,
                breakdown
        ));
    }

    @GetMapping("/session-stats")
    public ResponseEntity<Map<String, Object>> getSessionStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("userFacingChatCalls", usageAccumulator.getUserFacingChatCalls());
        stats.put("totalUserInputTokens", usageAccumulator.getTotalUserInputTokens());
        stats.put("totalModelInputTokens", usageAccumulator.getTotalModelInputTokens());
        stats.put("totalModelOutputTokens", usageAccumulator.getTotalModelOutputTokens());
        stats.put("totalThinkingTokens", usageAccumulator.getTotalThinkingTokens());
        stats.put("totalCachedTokens", usageAccumulator.getTotalCachedTokens());
        stats.put("totalUserFacingTokens", usageAccumulator.getTotalUserFacingTokens());

        stats.put("compactionCalls", usageAccumulator.getCompactionCalls());
        stats.put("compactionInputTokens", usageAccumulator.getCompactionInputTokens());
        stats.put("compactionOutputTokens", usageAccumulator.getCompactionOutputTokens());
        stats.put("compactionTotalTokens", usageAccumulator.getCompactionTotalTokens());

        stats.put("trueTotalConsumption", usageAccumulator.getTrueTotalConsumption());
        stats.put("baselineEstimatedTokens", usageAccumulator.getBaselineEstimatedTokens());
        stats.put("tokensSaved", usageAccumulator.getTokensSaved());
        stats.put("netSavingsPercentage", usageAccumulator.getNetSavingsPercentage());
        stats.put("cacheHitRatio", usageAccumulator.getCacheHitRatio());

        int calls = usageAccumulator.getUserFacingChatCalls();
        stats.put("averageTokensPerTurn", calls > 0 ? (usageAccumulator.getTotalUserFacingTokens() / calls) : 0);
        stats.put("averageOutputPerTurn", calls > 0 ? (usageAccumulator.getTotalModelOutputTokens() / calls) : 0);
        stats.put("averageThinkingPerTurn", calls > 0 ? (usageAccumulator.getTotalThinkingTokens() / calls) : 0);

        return ResponseEntity.ok(stats);
    }

    @PostMapping("/session-reset")
    public ResponseEntity<Void> resetSessionStats() {
        usageAccumulator.reset();
        return ResponseEntity.ok().build();
    }
}
