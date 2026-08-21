package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.dto.BenchmarkRequest;
import com.yuzee.tokenlab.dto.BenchmarkResponse;
import com.yuzee.tokenlab.model.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class BenchmarkService {

    private final TokenCountService tokenCountService;
    private final TokenBudgetMemoryManager memoryManager;
    private final ConversationService conversationService;
    private final YuzeeProtocolRegistry protocolRegistry;

    public BenchmarkService(
            TokenCountService tokenCountService,
            TokenBudgetMemoryManager memoryManager,
            ConversationService conversationService,
            YuzeeProtocolRegistry protocolRegistry
    ) {
        this.tokenCountService = tokenCountService;
        this.memoryManager = memoryManager;
        this.conversationService = conversationService;
        this.protocolRegistry = protocolRegistry;
    }

    public BenchmarkResponse runBenchmark(BenchmarkRequest request) {
        BenchmarkResponse response = new BenchmarkResponse();
        Conversation conv = conversationService.getConversation(request.getConversationId())
                .orElseGet(() -> conversationService.createConversation(
                        "Benchmark Suite",
                        request.getModel() != null ? request.getModel() : "gemini-3.6-flash",
                        OptimizationStrategy.ADAPTIVE_HYBRID
                ));

        List<OptimizationStrategy> strategiesToTest = request.getStrategies();
        if (strategiesToTest == null || strategiesToTest.isEmpty()) {
            strategiesToTest = List.of(
                    OptimizationStrategy.BASELINE,
                    OptimizationStrategy.SLIDING_WINDOW,
                    OptimizationStrategy.SUMMARY_RECENT,
                    OptimizationStrategy.ADAPTIVE_HYBRID
            );
        }

        String testPrompt = request.getPrompt() != null && !request.getPrompt().isBlank() 
                ? request.getPrompt() 
                : "Help me transition into cybersecurity and build a 6-month study roadmap.";

        int userTokens = tokenCountService.estimateTokens(testPrompt);

        for (OptimizationStrategy strat : strategiesToTest) {
            BenchmarkResponse.BenchmarkResultItem item = new BenchmarkResponse.BenchmarkResultItem();
            item.setStrategy(strat);
            item.setModel(request.getModel() != null ? request.getModel() : "gemini-3.6-flash");

            TokenBudgetMemoryManager.MemoryAssemblyResult mem = memoryManager.assembleMemory(
                    conv, testPrompt, strat, 2000, 4
            );

            // Use real system prompt token estimate — not a hardcoded constant
            int sysTokens = tokenCountService.estimateTokens(protocolRegistry.getProductionPrompt());
            int careerTokens = conv.getCareerContext() != null ? tokenCountService.estimateTokens(conv.getCareerContext().toCompactPromptString()) : 0;
            int summaryTokens = tokenCountService.estimateTokens(mem.getSummaryText());
            int recentTokens = tokenCountService.estimateTokens(mem.getRecentHistoryText());
            int inputTokens = sysTokens + careerTokens + summaryTokens + recentTokens + userTokens;

            // outputTokens, thinkingTokens, cachedTokens, latencyMs are null for modelled estimates —
            // real values only come from live provider calls.
            int compactionCost = mem.getCompactionMetrics() != null ? mem.getCompactionMetrics().getCompactionTotalCost() : 0;

            item.setMode("estimated");
            item.setInputTokens(inputTokens);
            item.setOutputTokens(null);      // source=unavailable for modelled estimate
            item.setThinkingTokens(null);    // source=unavailable for modelled estimate
            item.setCachedTokens(null);      // source=unavailable for modelled estimate
            item.setTotalTokens(inputTokens);
            item.setLatencyMs(null);         // source=unavailable for modelled estimate
            item.setCompactionCost(compactionCost);
            item.setRetainedContextTokens(inputTokens - userTokens);
            item.setResponsePreview("Modelled context estimate only. Run Live Gemini benchmark for actual output metrics.");

            switch (strat) {
                case BASELINE -> {
                    item.setLabel("Baseline (Full History)");
                    item.setNotes("Highest token consumption; sends all turns verbatim without compaction.");
                }
                case SLIDING_WINDOW -> {
                    item.setLabel("Sliding Window (4 Turns)");
                    item.setNotes("Fixed turn window; evicts older turns without semantic summarization.");
                }
                case SUMMARY_RECENT -> {
                    item.setLabel("Summary + Recent Turns");
                    item.setNotes("Incremental compaction of older turns into compact structured bullet summary.");
                }
                case ADAPTIVE_HYBRID -> {
                    item.setLabel("Adaptive Hybrid (Budget Prioritized)");
                    item.setNotes("Optimal token efficiency; budget-aware prioritization + stable prefix for implicit caching.");
                }
            }

            response.getResults().add(item);
        }

        return response;
    }
}
