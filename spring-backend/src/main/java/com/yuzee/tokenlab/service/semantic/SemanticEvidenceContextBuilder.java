package com.yuzee.tokenlab.service.semantic;

import com.yuzee.tokenlab.model.Conversation;
import com.yuzee.tokenlab.model.MemoryRecord;
import com.yuzee.tokenlab.model.SemanticEpisode;
import com.yuzee.tokenlab.model.SemanticMemoryTelemetry;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SemanticEvidenceContextBuilder {

    public static class SemanticContext {
        private final String evidenceText;
        private final String summaryText;
        private final SemanticMemoryTelemetry telemetry;

        public SemanticContext(String evidenceText, String summaryText, SemanticMemoryTelemetry telemetry) {
            this.evidenceText = evidenceText;
            this.summaryText = summaryText;
            this.telemetry = telemetry;
        }

        public String getEvidenceText() { return evidenceText; }
        public String getSummaryText() { return summaryText; }
        public SemanticMemoryTelemetry getTelemetry() { return telemetry; }
    }

    private final AdaptiveMemoryRetriever retriever;
    private final SemanticEpisodeSegmenter segmenter;
    private final ConversationMemoryRepository memoryRepo;

    public SemanticEvidenceContextBuilder(AdaptiveMemoryRetriever retriever,
                                          SemanticEpisodeSegmenter segmenter,
                                          ConversationMemoryRepository memoryRepo) {
        this.retriever = retriever;
        this.segmenter = segmenter;
        this.memoryRepo = memoryRepo;
    }

    public SemanticContext buildContext(Conversation conversation, String userMessage) {
        long assemblyStart = System.currentTimeMillis();

        // Update episode segmentation
        List<SemanticEpisode> segmented = segmenter.segmentAll(conversation.getId(), conversation.getMessages());
        for (SemanticEpisode ep : segmented) {
            memoryRepo.saveEpisode(ep);
        }

        // Retrieve
        AdaptiveMemoryRetriever.RetrievalResult retrieval = retriever.retrieve(conversation.getId(), userMessage, 600);

        // Build evidence text
        StringBuilder sb = new StringBuilder();

        // Long-term memory
        sb.append("LONG_TERM_MEMORY:\n");
        List<MemoryRecord> memories = retrieval.getStructuredMemories();
        if (memories != null) {
            for (MemoryRecord r : memories) {
                String type = r.getType() != null ? r.getType().name() : "UNKNOWN";
                String text = r.getCanonicalText() != null ? r.getCanonicalText() : "";
                sb.append("- [").append(type).append("] ").append(text).append("\n");
            }
        }
        sb.append("\n");

        // Episode history
        sb.append("EPISODE_HISTORY:\n");
        List<SemanticEpisode> historical = retrieval.getHistoricalEpisodes();
        if (historical != null) {
            for (SemanticEpisode ep : historical) {
                if (ep.getCompressedSummary() != null && !ep.getCompressedSummary().isEmpty()) {
                    sb.append("Episode ").append(ep.getEpisodeIndex()).append(": ")
                            .append(ep.getCompressedSummary()).append("\n");
                }
            }
        }
        sb.append("\n");

        // Active episode
        sb.append("ACTIVE_EPISODE:\n");
        List<SemanticEpisode> activeList = retrieval.getActiveEpisodeMessages();
        if (activeList != null && !activeList.isEmpty()) {
            SemanticEpisode active = activeList.get(0);
            if (active.getMessages() != null) {
                for (com.yuzee.tokenlab.model.Message msg : active.getMessages()) {
                    String role = msg.getRole() != null ? msg.getRole().name() : "UNKNOWN";
                    String content = msg.getContent() != null ? msg.getContent() : "";
                    sb.append(role).append(": ").append(content).append("\n\n");
                }
            }
        }

        SemanticMemoryTelemetry telemetry = retrieval.getTelemetry();
        telemetry.setAssemblyLatencyMs(System.currentTimeMillis() - assemblyStart);

        return new SemanticContext(sb.toString(), "", telemetry);
    }
}
