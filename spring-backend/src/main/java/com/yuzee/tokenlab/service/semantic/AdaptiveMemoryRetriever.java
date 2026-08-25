package com.yuzee.tokenlab.service.semantic;

import com.yuzee.tokenlab.model.MemoryRecord;
import com.yuzee.tokenlab.model.SemanticEpisode;
import com.yuzee.tokenlab.model.SemanticEpisodeStatus;
import com.yuzee.tokenlab.model.SemanticMemoryTelemetry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AdaptiveMemoryRetriever {

    private static final int MAX_EVIDENCE_TOKENS = 600;
    private static final int MAX_STRUCTURED_MEMORIES = 8;
    private static final int MAX_HISTORICAL_EPISODES = 3;

    public static class RetrievalResult {
        private final List<SemanticEpisode> activeEpisodeMessages;
        private final List<MemoryRecord> structuredMemories;
        private final List<SemanticEpisode> historicalEpisodes;
        private final SemanticMemoryTelemetry telemetry;

        public RetrievalResult(List<SemanticEpisode> activeEpisodeMessages,
                               List<MemoryRecord> structuredMemories,
                               List<SemanticEpisode> historicalEpisodes,
                               SemanticMemoryTelemetry telemetry) {
            this.activeEpisodeMessages = activeEpisodeMessages;
            this.structuredMemories = structuredMemories;
            this.historicalEpisodes = historicalEpisodes;
            this.telemetry = telemetry;
        }

        public List<SemanticEpisode> getActiveEpisodeMessages() { return activeEpisodeMessages; }
        public List<MemoryRecord> getStructuredMemories() { return structuredMemories; }
        public List<SemanticEpisode> getHistoricalEpisodes() { return historicalEpisodes; }
        public SemanticMemoryTelemetry getTelemetry() { return telemetry; }
    }

    private final ConversationMemoryRepository memoryRepo;
    private final SemanticSimilarityService similarityService;
    private final MemoryQueryPlanner queryPlanner;

    public AdaptiveMemoryRetriever(ConversationMemoryRepository memoryRepo,
                                   SemanticSimilarityService similarityService,
                                   MemoryQueryPlanner queryPlanner) {
        this.memoryRepo = memoryRepo;
        this.similarityService = similarityService;
        this.queryPlanner = queryPlanner;
    }

    public RetrievalResult retrieve(String conversationId, String userMessage, int episodeTokenBudget) {
        long start = System.currentTimeMillis();

        MemoryQueryPlanner.QueryPlan plan = queryPlanner.plan(userMessage);

        // Active episode
        Optional<SemanticEpisode> activeOpt = memoryRepo.getActiveEpisode(conversationId);
        List<SemanticEpisode> activeEpisodeList = activeOpt.map(List::of).orElse(List.of());

        // Historical episodes: CLOSED or ARCHIVED, scored by similarity
        List<SemanticEpisode> allEpisodes = memoryRepo.getEpisodes(conversationId);
        List<SemanticEpisode> historicalEpisodes = allEpisodes.stream()
                .filter(ep -> ep.getStatus() == SemanticEpisodeStatus.CLOSED
                        || ep.getStatus() == SemanticEpisodeStatus.ARCHIVED)
                .sorted(Comparator.comparingDouble(ep -> -episodeSimilarity(ep, userMessage)))
                .limit(MAX_HISTORICAL_EPISODES)
                .collect(Collectors.toList());

        // Structured memories: active, sorted by createdAt desc, truncated
        List<MemoryRecord> structuredMemories = new ArrayList<>(memoryRepo.getActiveMemories(conversationId));
        structuredMemories.sort(Comparator.comparingLong(MemoryRecord::getCreatedAt).reversed());
        if (structuredMemories.size() > MAX_STRUCTURED_MEMORIES) {
            structuredMemories = structuredMemories.subList(0, MAX_STRUCTURED_MEMORIES);
        }

        // Lexical route: add memories matching key terms
        if (plan.requiresLexical() && !plan.getKeyTerms().isEmpty()) {
            List<MemoryRecord> all = memoryRepo.getActiveMemories(conversationId);
            List<String> ids = structuredMemories.stream().map(MemoryRecord::getId).collect(Collectors.toList());
            for (MemoryRecord r : all) {
                if (!ids.contains(r.getId()) && r.getCanonicalText() != null) {
                    String canonical = r.getCanonicalText().toLowerCase();
                    boolean matches = plan.getKeyTerms().stream().anyMatch(canonical::contains);
                    if (matches) {
                        structuredMemories.add(r);
                        ids.add(r.getId());
                        if (structuredMemories.size() >= MAX_STRUCTURED_MEMORIES) break;
                    }
                }
            }
            if (structuredMemories.size() > MAX_STRUCTURED_MEMORIES) {
                structuredMemories = structuredMemories.subList(0, MAX_STRUCTURED_MEMORIES);
            }
        }

        // Telemetry
        SemanticMemoryTelemetry telemetry = new SemanticMemoryTelemetry();
        telemetry.setEpisodeCount(allEpisodes.size());
        telemetry.setActiveEpisodeTurns(activeOpt.map(ep -> ep.getMessages().size()).orElse(0));
        telemetry.setActiveEpisodeTokens(activeOpt.map(SemanticEpisode::getTokenCount).orElse(0));
        telemetry.setHistoricalEpisodesSearched(historicalEpisodes.size());
        telemetry.setStructuredMemoriesRetrieved(structuredMemories.size());
        telemetry.setQueryPlanIntent(plan.getIntent().name());
        telemetry.setLexicalRouteUsed(plan.requiresLexical());
        telemetry.setTemporalRouteUsed(plan.requiresTemporal());
        telemetry.setRetrievalLatencyMs(System.currentTimeMillis() - start);

        return new RetrievalResult(activeEpisodeList, structuredMemories, historicalEpisodes, telemetry);
    }

    private double episodeSimilarity(SemanticEpisode ep, String query) {
        if (ep.getCompressedSummary() != null && !ep.getCompressedSummary().isEmpty()) {
            return similarityService.similarity(ep.getCompressedSummary(), query);
        }
        // fallback: concatenate message previews
        String preview = ep.getMessages().stream()
                .map(m -> m.getContent() != null ? m.getContent() : "")
                .collect(Collectors.joining(" "));
        return similarityService.similarity(preview, query);
    }
}
