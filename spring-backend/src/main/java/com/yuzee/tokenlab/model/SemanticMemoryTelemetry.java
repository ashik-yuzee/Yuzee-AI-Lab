package com.yuzee.tokenlab.model;

public class SemanticMemoryTelemetry {
    private int episodeCount;
    private int activeEpisodeTurns;
    private int activeEpisodeTokens;
    private double activeEpisodeCohesion;
    private int historicalEpisodesSearched;
    private int structuredMemoriesRetrieved;
    private int evidenceCandidates;
    private int evidenceSelected;
    private int evidenceExcluded;
    private int activeEpisodeTokensInContext;
    private int structuredStateTokensInContext;
    private int historicalEvidenceTokensInContext;
    private int totalEvidenceTokens;
    private int tokensExcludedByBudget;
    private String queryPlanIntent;
    private boolean lexicalRouteUsed;
    private boolean semanticRouteUsed;
    private boolean temporalRouteUsed;
    private long segmentationLatencyMs;
    private long retrievalLatencyMs;
    private long assemblyLatencyMs;

    public SemanticMemoryTelemetry() {}

    public int getEpisodeCount() { return episodeCount; }
    public void setEpisodeCount(int episodeCount) { this.episodeCount = episodeCount; }

    public int getActiveEpisodeTurns() { return activeEpisodeTurns; }
    public void setActiveEpisodeTurns(int activeEpisodeTurns) { this.activeEpisodeTurns = activeEpisodeTurns; }

    public int getActiveEpisodeTokens() { return activeEpisodeTokens; }
    public void setActiveEpisodeTokens(int activeEpisodeTokens) { this.activeEpisodeTokens = activeEpisodeTokens; }

    public double getActiveEpisodeCohesion() { return activeEpisodeCohesion; }
    public void setActiveEpisodeCohesion(double activeEpisodeCohesion) { this.activeEpisodeCohesion = activeEpisodeCohesion; }

    public int getHistoricalEpisodesSearched() { return historicalEpisodesSearched; }
    public void setHistoricalEpisodesSearched(int historicalEpisodesSearched) { this.historicalEpisodesSearched = historicalEpisodesSearched; }

    public int getStructuredMemoriesRetrieved() { return structuredMemoriesRetrieved; }
    public void setStructuredMemoriesRetrieved(int structuredMemoriesRetrieved) { this.structuredMemoriesRetrieved = structuredMemoriesRetrieved; }

    public int getEvidenceCandidates() { return evidenceCandidates; }
    public void setEvidenceCandidates(int evidenceCandidates) { this.evidenceCandidates = evidenceCandidates; }

    public int getEvidenceSelected() { return evidenceSelected; }
    public void setEvidenceSelected(int evidenceSelected) { this.evidenceSelected = evidenceSelected; }

    public int getEvidenceExcluded() { return evidenceExcluded; }
    public void setEvidenceExcluded(int evidenceExcluded) { this.evidenceExcluded = evidenceExcluded; }

    public int getActiveEpisodeTokensInContext() { return activeEpisodeTokensInContext; }
    public void setActiveEpisodeTokensInContext(int activeEpisodeTokensInContext) { this.activeEpisodeTokensInContext = activeEpisodeTokensInContext; }

    public int getStructuredStateTokensInContext() { return structuredStateTokensInContext; }
    public void setStructuredStateTokensInContext(int structuredStateTokensInContext) { this.structuredStateTokensInContext = structuredStateTokensInContext; }

    public int getHistoricalEvidenceTokensInContext() { return historicalEvidenceTokensInContext; }
    public void setHistoricalEvidenceTokensInContext(int historicalEvidenceTokensInContext) { this.historicalEvidenceTokensInContext = historicalEvidenceTokensInContext; }

    public int getTotalEvidenceTokens() { return totalEvidenceTokens; }
    public void setTotalEvidenceTokens(int totalEvidenceTokens) { this.totalEvidenceTokens = totalEvidenceTokens; }

    public int getTokensExcludedByBudget() { return tokensExcludedByBudget; }
    public void setTokensExcludedByBudget(int tokensExcludedByBudget) { this.tokensExcludedByBudget = tokensExcludedByBudget; }

    public String getQueryPlanIntent() { return queryPlanIntent; }
    public void setQueryPlanIntent(String queryPlanIntent) { this.queryPlanIntent = queryPlanIntent; }

    public boolean isLexicalRouteUsed() { return lexicalRouteUsed; }
    public void setLexicalRouteUsed(boolean lexicalRouteUsed) { this.lexicalRouteUsed = lexicalRouteUsed; }

    public boolean isSemanticRouteUsed() { return semanticRouteUsed; }
    public void setSemanticRouteUsed(boolean semanticRouteUsed) { this.semanticRouteUsed = semanticRouteUsed; }

    public boolean isTemporalRouteUsed() { return temporalRouteUsed; }
    public void setTemporalRouteUsed(boolean temporalRouteUsed) { this.temporalRouteUsed = temporalRouteUsed; }

    public long getSegmentationLatencyMs() { return segmentationLatencyMs; }
    public void setSegmentationLatencyMs(long segmentationLatencyMs) { this.segmentationLatencyMs = segmentationLatencyMs; }

    public long getRetrievalLatencyMs() { return retrievalLatencyMs; }
    public void setRetrievalLatencyMs(long retrievalLatencyMs) { this.retrievalLatencyMs = retrievalLatencyMs; }

    public long getAssemblyLatencyMs() { return assemblyLatencyMs; }
    public void setAssemblyLatencyMs(long assemblyLatencyMs) { this.assemblyLatencyMs = assemblyLatencyMs; }
}
