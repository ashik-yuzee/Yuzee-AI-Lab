package com.yuzee.tokenlab.service.semantic;

import com.yuzee.tokenlab.model.Message;
import com.yuzee.tokenlab.model.SemanticBoundaryMetrics;
import com.yuzee.tokenlab.model.SemanticEpisode;
import com.yuzee.tokenlab.model.SemanticEpisodeStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SemanticEpisodeSegmenter {

    private static final Set<String> EXPLICIT_SHIFT_PHRASES = Set.of(
            "anyway", "actually", "by the way", "changing topic", "different question",
            "never mind", "wait", "forget that", "let me ask", "new topic",
            "on another note", "switching to", "one more thing"
    );

    private final SemanticSimilarityService similarityService;

    @Value("${yuzee.token-lab.semantic-memory.soft-max-tokens-per-episode:800}")
    private int softMaxTokensPerEpisode;

    @Value("${yuzee.token-lab.semantic-memory.soft-max-turns-per-episode:6}")
    private int softMaxTurnsPerEpisode;

    @Value("${yuzee.token-lab.semantic-memory.boundary-threshold:0.55}")
    private double boundaryThreshold;

    private static final double EXPLICIT_SHIFT_THRESHOLD = 0.3;

    public SemanticEpisodeSegmenter(SemanticSimilarityService similarityService) {
        this.similarityService = similarityService;
    }

    public List<SemanticEpisode> segmentAll(String conversationId, List<Message> messages) {
        List<SemanticEpisode> allEpisodes = new ArrayList<>();
        if (messages == null || messages.isEmpty()) return allEpisodes;

        SemanticEpisode current = newEpisode(conversationId, 0);
        allEpisodes.add(current);

        for (Message msg : messages) {
            if (!current.getMessages().isEmpty()) {
                SemanticBoundaryMetrics metrics = computeBoundaryScore(current, msg);
                if (metrics.isBoundaryDetected()) {
                    finalizeEpisode(current);
                    current = newEpisode(conversationId, allEpisodes.size());
                    allEpisodes.add(current);
                }
            }
            current.addMessage(msg);
        }
        // current stays ACTIVE
        return allEpisodes;
    }

    public SemanticBoundaryMetrics computeBoundaryScore(SemanticEpisode activeEpisode, Message candidateMessage) {
        SemanticBoundaryMetrics m = new SemanticBoundaryMetrics();
        List<Message> episodeMsgs = activeEpisode.getMessages();
        String candidateContent = candidateMessage.getContent() != null ? candidateMessage.getContent() : "";

        // recentTurnSimilarity: similarity to last 2 messages concatenated
        int size = episodeMsgs.size();
        String recentText = episodeMsgs.subList(Math.max(0, size - 2), size).stream()
                .map(msg -> msg.getContent() != null ? msg.getContent() : "")
                .collect(Collectors.joining(" "));
        double recentSim = similarityService.similarity(candidateContent, recentText);
        m.setRecentTurnSimilarity(recentSim);
        m.setSemanticSimilarityScore(recentSim);

        // cohesionDrop: current cohesion vs new cohesion with candidate added
        List<String> contents = episodeMsgs.stream()
                .map(msg -> msg.getContent() != null ? msg.getContent() : "")
                .collect(Collectors.toList());
        double currentCohesion = similarityService.centroidCohesion(contents);
        List<String> contentsWithNew = new ArrayList<>(contents);
        contentsWithNew.add(candidateContent);
        double newCohesion = similarityService.centroidCohesion(contentsWithNew);
        double cohesionDrop = Math.max(0.0, currentCohesion - newCohesion);
        m.setCohesionDrop(cohesionDrop);

        // explicitShiftDetected
        String lower = candidateContent.toLowerCase();
        boolean explicitShift = EXPLICIT_SHIFT_PHRASES.stream().anyMatch(lower::contains);
        m.setExplicitShiftDetected(explicitShift);

        // pressure
        int episodeTokens = activeEpisode.getTokenCount();
        int episodeTurns = size; // each message = 1; turns approximated by message count
        m.setEpisodeTokens(episodeTokens);
        m.setEpisodeTurns(episodeTurns);
        double tokenPressure = softMaxTokensPerEpisode > 0 ? (double) episodeTokens / softMaxTokensPerEpisode : 0.0;
        double turnPressure = softMaxTurnsPerEpisode > 0 ? (double) episodeTurns / softMaxTurnsPerEpisode : 0.0;
        m.setTokenPressure(tokenPressure);
        m.setTurnPressure(turnPressure);

        // entityOverlap: similarity between candidate and all episode content concatenated
        String allEpisodeText = String.join(" ", contents);
        double entityOverlap = similarityService.similarity(candidateContent, allEpisodeText);
        m.setEntityOverlap(entityOverlap);

        // boundaryScore
        double score = (1 - recentSim) * 0.35
                + cohesionDrop * 0.25
                + (explicitShift ? 0.3 : 0.0)
                + Math.max(0.0, tokenPressure - 1.0) * 0.1
                + Math.max(0.0, turnPressure - 1.0) * 0.1
                + (1 - entityOverlap) * 0.1;
        score = Math.max(0.0, Math.min(1.0, score));
        m.setBoundaryScore(score);
        m.setBoundaryDetected(score >= boundaryThreshold);

        // primaryReason
        m.setPrimaryReason(determinePrimaryReason(m));
        return m;
    }

    private String determinePrimaryReason(SemanticBoundaryMetrics m) {
        if (m.isExplicitShiftDetected()) return "EXPLICIT_SHIFT";
        if (m.getCohesionDrop() >= 0.2) return "COHESION_DROP";
        if (m.getTokenPressure() > 1.0) return "TOKEN_PRESSURE";
        if (m.getTurnPressure() > 1.0) return "TURN_PRESSURE";
        if (m.getRecentTurnSimilarity() < 0.15) return "LOW_SIMILARITY";
        return "COMPOSITE";
    }

    private void finalizeEpisode(SemanticEpisode ep) {
        ep.setStatus(SemanticEpisodeStatus.CLOSED);
        List<Message> msgs = ep.getMessages();
        long endTime = msgs.isEmpty()
                ? System.currentTimeMillis()
                : msgs.get(msgs.size() - 1).getCreatedAt();
        ep.setEndTime(endTime);
    }

    private SemanticEpisode newEpisode(String conversationId, int index) {
        SemanticEpisode ep = new SemanticEpisode();
        ep.setId(UUID.randomUUID().toString());
        ep.setConversationId(conversationId);
        ep.setEpisodeIndex(index);
        ep.setStatus(SemanticEpisodeStatus.ACTIVE);
        return ep;
    }
}
