package com.yuzee.tokenlab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuzee.tokenlab.dto.ChatRequest;
import com.yuzee.tokenlab.dto.StreamEvent;
import com.yuzee.tokenlab.model.*;
import com.yuzee.tokenlab.protocol.v13.YuzeeResponseV13;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class GeminiChatService {

    private final TokenCountService tokenCountService;
    private final ContextAssembler contextAssembler;
    private final TokenBudgetMemoryManager memoryManager;
    private final ConversationService conversationService;
    private final UsageAccumulator usageAccumulator;
    private final YuzeeProtocolRegistry protocolRegistry;
    private final YuzeeSchemaValidator schemaValidator;
    private final YuzeeSemanticValidator semanticValidator;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private GoogleGenAiChatModel chatModel;

    @Value("${spring.ai.google.genai.api-key:}")
    private String geminiApiKey;

    public GeminiChatService(
            TokenCountService tokenCountService,
            ContextAssembler contextAssembler,
            TokenBudgetMemoryManager memoryManager,
            ConversationService conversationService,
            UsageAccumulator usageAccumulator,
            YuzeeProtocolRegistry protocolRegistry,
            YuzeeSchemaValidator schemaValidator,
            YuzeeSemanticValidator semanticValidator,
            ObjectMapper objectMapper
    ) {
        this.tokenCountService = tokenCountService;
        this.contextAssembler = contextAssembler;
        this.memoryManager = memoryManager;
        this.conversationService = conversationService;
        this.usageAccumulator = usageAccumulator;
        this.protocolRegistry = protocolRegistry;
        this.schemaValidator = schemaValidator;
        this.semanticValidator = semanticValidator;
        this.objectMapper = objectMapper;
    }

    public boolean isConfigured() {
        return geminiApiKey != null && !geminiApiKey.isBlank();
    }

    /**
     * Determines adaptive thinking level deterministically based on user query complexity
     */
    public String resolveThinkingLevel(ThinkingLevel level, String prompt, String model) {
        String resolved;
        if (level != null && level != ThinkingLevel.ADAPTIVE) {
            resolved = level.name().toLowerCase();
        } else if (prompt == null) {
            resolved = "low";
        } else {
            String lower = prompt.toLowerCase();
            if (lower.contains("compare") || lower.contains("pathway") || lower.contains("trade-off") || lower.contains("decision") || lower.contains("plan")) {
                resolved = (model != null && model.contains("flash-lite")) ? "low" : "medium";
            } else if (lower.length() < 30 || lower.startsWith("what is") || lower.startsWith("hi") || lower.startsWith("format")) {
                resolved = "minimal";
            } else {
                resolved = (model != null && model.contains("flash-lite")) ? "minimal" : "low";
            }
        }

        // Gemini 3.7 Flash constraint: does not support minimal thinking level
        if ("gemini-3.7-flash".equals(model) && "minimal".equals(resolved)) {
            return "low";
        }
        return resolved;
    }

    public Flux<StreamEvent> streamChat(String conversationId, ChatRequest request) {
        Conversation conv = conversationService.getConversation(conversationId)
                .orElseGet(() -> conversationService.createConversation(
                        "Career Exploration",
                        request.getModel() != null ? request.getModel() : "gemini-3.6-flash",
                        request.getStrategy() != null ? request.getStrategy() : OptimizationStrategy.ADAPTIVE_HYBRID
                ));

        String userPrompt = request.getMessage() != null ? request.getMessage() : "";
        int userPromptTokens = tokenCountService.estimateTokens(userPrompt);

        // 1. Prepare memory strategy ON HISTORICAL TURNS ONLY (Before current turn)
        OptimizationStrategy strategy = request.getStrategy() != null ? request.getStrategy() : conv.getStrategy();
        int budget = request.getContextBudget() != null ? request.getContextBudget() : conv.getContextBudget();
        int recentTurns = request.getRecentTurnsToKeep() != null ? request.getRecentTurnsToKeep() : conv.getRecentTurnsToKeep();

        TokenBudgetMemoryManager.MemoryAssemblyResult memResult = memoryManager.assembleMemory(
                conv, userPrompt, strategy, budget, recentTurns
        );

        if (memResult.getCompactionMetrics() != null && !memResult.getCompactionMetrics().isSimulated()) {
            conv.getCompactionHistory().add(memResult.getCompactionMetrics());
            usageAccumulator.recordCompactionCall(memResult.getCompactionMetrics());
        }

        // 2. Assemble Context (Excluding system instruction from contents)
        String sysPrompt = contextAssembler.resolveSystemInstruction(
                request.getSystemPromptMode() != null ? request.getSystemPromptMode() : conv.getSystemPromptMode(),
                request.getCustomSystemPrompt() != null ? request.getCustomSystemPrompt() : conv.getCustomSystemPrompt()
        );
        CareerContext careerContext = request.getCareerContext() != null ? request.getCareerContext() : conv.getCareerContext();
        ResponseMode responseMode = request.getResponseMode() != null ? request.getResponseMode() : conv.getResponseMode();

        String dynamicContext = contextAssembler.buildDynamicContext(
                careerContext,
                memResult.getSummaryText(),
                memResult.getRecentHistoryText()
        );

        ContextMetrics contextMetrics = tokenCountService.breakDownContext(
                sysPrompt,
                careerContext != null ? careerContext.toCompactPromptString() : "",
                memResult.getSummaryText(),
                memResult.getRecentHistoryText(),
                userPrompt,
                memResult.getRemovedTokens()
        );
        contextMetrics.setExcludedSections(memResult.getExcludedItems());

        String targetModel = request.getModel() != null ? request.getModel() : conv.getModel();
        ThinkingLevel selectedThinking = request.getThinkingLevel() != null ? request.getThinkingLevel() : conv.getThinkingLevel();
        String appliedThinking = resolveThinkingLevel(selectedThinking, userPrompt, targetModel);

        String messageId = UUID.randomUUID().toString();
        long requestStartTime = System.currentTimeMillis();

        int maxOutputTokens = resolveOutputBudget(responseMode);
        int numericThinkingBudget = resolveNumericThinkingBudget(appliedThinking, targetModel);

        return Flux.create(sink -> {
            sink.next(StreamEvent.start(conv.getId(), messageId, appliedThinking));

            if (memResult.getCompactionMetrics() != null) {
                sink.next(StreamEvent.compaction(memResult.getCompactionMetrics()));
            }

            StringBuilder fullAccumulatedText = new StringBuilder();
            long[] providerTiming = new long[]{0, 0}; // [firstChunkTime, endTime]
            ChatResponse[] lastResponse = new ChatResponse[1];

            if (chatModel != null && isConfigured()) {
                // REAL SPRING AI GEMINI INVOCATION WITH STRUCTURED OUTPUT SCHEMA
                try {
                    // Dynamic context (career + history) prepended to user message — not as AssistantMessage
                    String userContent = dynamicContext != null && !dynamicContext.isBlank()
                            ? dynamicContext + "\n\nCURRENT_USER_MESSAGE:\n" + userPrompt
                            : userPrompt;

                    List<org.springframework.ai.chat.messages.Message> messages = new ArrayList<>();
                    messages.add(new SystemMessage(sysPrompt));
                    messages.add(new UserMessage(userContent));

                    GoogleGenAiChatOptions options = GoogleGenAiChatOptions.builder()
                            .model(targetModel)
                            .responseMimeType("application/json")
                            .responseSchema(protocolRegistry.getResponseSchemaJson())
                            .maxOutputTokens(maxOutputTokens)
                            .thinkingBudget(numericThinkingBudget)
                            .build();

                    Prompt prompt = new Prompt(messages, options);
                    Flux<ChatResponse> responseFlux = chatModel.stream(prompt);

                    responseFlux.subscribe(
                            chunkResponse -> {
                                lastResponse[0] = chunkResponse;
                                if (providerTiming[0] == 0) {
                                    providerTiming[0] = System.currentTimeMillis();
                                }
                                for (Generation gen : chunkResponse.getResults()) {
                                    String text = gen.getOutput().getText();
                                    if (text != null) {
                                        fullAccumulatedText.append(text);
                                        sink.next(StreamEvent.delta(text));
                                    }
                                }
                            },
                            error -> {
                                sink.next(StreamEvent.error(error.getMessage()));
                                sink.complete();
                            },
                            () -> {
                                providerTiming[1] = System.currentTimeMillis();
                                completeResponse(sink, conv, request, memResult, contextMetrics,
                                        fullAccumulatedText.toString(), userPrompt, userPromptTokens,
                                        messageId, requestStartTime, providerTiming, appliedThinking,
                                        selectedThinking, strategy, responseMode, lastResponse[0]);
                            }
                    );
                } catch (Exception e) {
                    sink.next(StreamEvent.error(e.getMessage()));
                    sink.complete();
                }
            } else {
                // Offline fallback mode
                String rawJson = generateOfflineResponse(userPrompt, careerContext);
                providerTiming[0] = System.currentTimeMillis();
                fullAccumulatedText.append(rawJson);
                sink.next(StreamEvent.delta(rawJson));
                providerTiming[1] = System.currentTimeMillis();

                completeResponse(sink, conv, request, memResult, contextMetrics,
                        fullAccumulatedText.toString(), userPrompt, userPromptTokens,
                        messageId, requestStartTime, providerTiming, appliedThinking,
                        selectedThinking, strategy, responseMode, null);
            }
        });
    }

    /** Maps thinking level string to numeric budget matching Node implementation. */
    public int resolveNumericThinkingBudget(String level, String model) {
        int budget = switch (level) {
            case "minimal" -> 0;
            case "low" -> 128;
            case "medium" -> 512;
            case "high" -> model != null && model.contains("flash-lite") ? 128 : 1024;
            default -> 128;
        };
        return budget;
    }

    /** Output budget per response mode matching Node implementation. */
    public int resolveOutputBudget(ResponseMode mode) {
        if (mode == null) return 2048;
        return switch (mode) {
            case QUICK -> 1024;
            case STANDARD -> 2048;
            case EXPLAIN, EXPLORE, DECIDE -> 3072;
            case DETAIL -> 4096;
        };
    }

    private void completeResponse(
            reactor.core.publisher.FluxSink<StreamEvent> sink,
            Conversation conv,
            ChatRequest request,
            TokenBudgetMemoryManager.MemoryAssemblyResult memResult,
            ContextMetrics contextMetrics,
            String rawJson,
            String userPrompt,
            int userPromptTokens,
            String messageId,
            long requestStartTime,
            long[] providerTiming,
            String appliedThinking,
            ThinkingLevel selectedThinking,
            OptimizationStrategy strategy,
            ResponseMode responseMode,
            ChatResponse finalChatResponse
    ) {
        YuzeeSchemaValidator.SchemaValidationResult schemaRes = schemaValidator.validate(rawJson);

        YuzeeResponseV13 responseObj = null;
        try {
            responseObj = objectMapper.readValue(rawJson, YuzeeResponseV13.class);
        } catch (Exception ignored) {}

        YuzeeSemanticValidator.SemanticValidationResult semanticRes = semanticValidator.validate(responseObj);

        List<String> allErrors = new ArrayList<>();
        allErrors.addAll(schemaRes.errors());
        allErrors.addAll(semanticRes.errors());

        boolean schemaValid = schemaRes.valid();
        boolean semanticValid = semanticRes.valid();
        boolean protocolAccepted = schemaValid && semanticValid;

        sink.next(StreamEvent.validation(
                schemaValid,
                semanticValid,
                allErrors,
                protocolRegistry.getPromptHash(),
                protocolRegistry.getSchemaHash()
        ));

        // Only emit structured response for accepted protocol output
        if (responseObj != null && protocolAccepted) {
            sink.next(StreamEvent.structured(responseObj, true, true, List.of()));
        }

        long totalLatency = System.currentTimeMillis() - requestStartTime;
        long ttft = providerTiming[0] > 0 ? providerTiming[0] - requestStartTime : 0;

        // Use real provider usage metadata when available; fall back to estimate
        Integer providerInput = null;
        Integer providerOutput = null;
        try {
            if (finalChatResponse != null && finalChatResponse.getMetadata() != null
                    && finalChatResponse.getMetadata().getUsage() != null) {
                var provUsage = finalChatResponse.getMetadata().getUsage();
                if (provUsage.getPromptTokens() != null) providerInput = provUsage.getPromptTokens().intValue();
                if (provUsage.getGenerationTokens() != null) providerOutput = provUsage.getGenerationTokens().intValue();
            }
        } catch (Exception ignored) {}

        int inputTokens = providerInput != null ? providerInput : contextMetrics.getTotalAssembledTokens();
        int outputTokens = providerOutput != null ? providerOutput : tokenCountService.estimateTokens(rawJson);

        TokenUsage usage = new TokenUsage();
        usage.setCurrentUserTokens(userPromptTokens);
        usage.setInputTokens(inputTokens);
        usage.setOutputTokens(outputTokens);
        usage.setThinkingTokens(null);  // not exposed by Spring AI Usage interface
        usage.setCachedTokens(null);    // not exposed by Spring AI Usage interface
        usage.setTotalTokens(inputTokens + outputTokens);
        usage.setLatencyMs(totalLatency);
        usage.setTimeToFirstTokenMs(ttft > 0 ? ttft : null);

        int baselineEst = inputTokens + (conv.getMessages().size() * 120);
        usageAccumulator.recordUserChatCall(usage, baselineEst);

        sink.next(StreamEvent.usage(usage, contextMetrics, memResult.getCompactionMetrics()));
        sink.next(StreamEvent.done());
        sink.complete();

        // Only accepted responses enter future model context
        Message userMsg = new Message(UUID.randomUUID().toString(), MessageRole.USER, userPrompt);
        conv.getMessages().add(userMsg);

        if (protocolAccepted) {
            Message assistantMsg = new Message(messageId, MessageRole.ASSISTANT, rawJson);
            assistantMsg.setStructuredResponseJson(rawJson);
            assistantMsg.setSchemaValid(true);
            assistantMsg.setSemanticValid(true);
            assistantMsg.setValidationErrors(List.of());
            assistantMsg.setUsage(usage);
            assistantMsg.setContextMetrics(contextMetrics);
            assistantMsg.setCompactionMetrics(memResult.getCompactionMetrics());
            assistantMsg.setModel(conv.getModel());
            assistantMsg.setThinkingLevel(selectedThinking);
            assistantMsg.setOptimizationStrategy(strategy);
            assistantMsg.setPreset(request.getPreset() != null ? request.getPreset() : conv.getPreset());
            assistantMsg.setResponseMode(responseMode);
            assistantMsg.setRecentTurnsCount(memResult.getRecentTurnsCount());
            assistantMsg.setHasSummary(memResult.getSummaryText() != null && !memResult.getSummaryText().isBlank());
            conv.getMessages().add(assistantMsg);
        }

        conversationService.save(conv);
    }

    private String generateOfflineResponse(String prompt, CareerContext context) {
        String role = (context != null && context.getTargetRole() != null && !context.getTargetRole().isBlank())
                ? context.getTargetRole() : "Cybersecurity Analyst";

        return """
        {
          "schema_version": "1.3",
          "current_mode": "A_CONVERSATION",
          "response_intent": "ACTION_PLAN",
          "content_blocks": [
            {
              "id": "b1",
              "type": "text",
              "level": "none",
              "variant": "default",
              "title": "",
              "text": "Based on your verified profile, here is a targeted pathway plan towards %s.",
              "items": [],
              "columns": [],
              "rows": []
            },
            {
              "id": "b2",
              "type": "steps",
              "level": "h2",
              "variant": "info",
              "title": "Actionable Milestones",
              "text": "Core pathway progression milestones:",
              "items": [
                {
                  "id": "s1",
                  "title": "Networking Core",
                  "text": "Master TCP/IP and packet inspection tools.",
                  "value": "Phase 1",
                  "status": "planned"
                },
                {
                  "id": "s2",
                  "title": "Defensive Labs",
                  "text": "Practice log triage in virtual SOC environments.",
                  "value": "Phase 2",
                  "status": "planned"
                }
              ],
              "columns": [],
              "rows": []
            }
          ],
          "interaction": {
            "kind": "question",
            "input_type": "single_select",
            "question_id": "q_next_step",
            "question": "Which milestone should we map out first?",
            "options": [
              {
                "id": "opt_networking",
                "label": "Networking & Protocols",
                "description": "Essential protocol fundamentals",
                "value": "networking"
              },
              {
                "id": "opt_soc_labs",
                "label": "Hands-on SOC Labs",
                "description": "Configuring SIEM detection alerts",
                "value": "soc_labs"
              }
            ],
            "allow_other_input": false,
            "other_input_label": "",
            "fields": [],
            "recommended_actions": []
          },
          "service": {
            "flow": "NONE",
            "intent_detected": false,
            "goal_summary": "Career transition",
            "trigger": "",
            "confidence": "",
            "selected_rmo": "",
            "offer_target": "",
            "missing_inputs": [],
            "actions": []
          },
          "state": {
            "active_response_mode": "standard",
            "effective_response_mode": "standard",
            "mode_source": "default",
            "safety_override_applied": false,
            "user_confidence": {
              "score": -1,
              "band": "unknown",
              "evidence_strength": "none",
              "trend": "unknown",
              "reason_codes": [
                "NEW_TOPIC_RESET"
              ]
            },
            "progress": {
              "explained": [
                "overview"
              ],
              "failed_attempts": 0,
              "loop_count_same_issue": 0
            }
          },
          "followups": {
            "enabled": true,
            "cancel_on_user_message": true,
            "topic_lock": true,
            "topic_key": "soc_pathway",
            "triggers": [
              {
                "after_seconds": 10,
                "message": "Would you like me to schedule a milestone check-in for next week?",
                "suggested_replies": [
                  "Yes, schedule check-in",
                  "Not now"
                ]
              }
            ]
          }
        }
        """.formatted(role);
    }
}
