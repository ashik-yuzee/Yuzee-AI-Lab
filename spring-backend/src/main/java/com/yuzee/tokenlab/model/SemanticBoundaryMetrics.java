package com.yuzee.tokenlab.model;

public class SemanticBoundaryMetrics {
    private double semanticSimilarityScore;
    private double recentTurnSimilarity;
    private double cohesionDrop;
    private boolean explicitShiftDetected;
    private double entityOverlap;
    private int episodeTokens;
    private int episodeTurns;
    private double tokenPressure;
    private double turnPressure;
    private double boundaryScore;
    private boolean boundaryDetected;
    private String primaryReason;

    public SemanticBoundaryMetrics() {}

    public double getSemanticSimilarityScore() { return semanticSimilarityScore; }
    public void setSemanticSimilarityScore(double semanticSimilarityScore) { this.semanticSimilarityScore = semanticSimilarityScore; }

    public double getRecentTurnSimilarity() { return recentTurnSimilarity; }
    public void setRecentTurnSimilarity(double recentTurnSimilarity) { this.recentTurnSimilarity = recentTurnSimilarity; }

    public double getCohesionDrop() { return cohesionDrop; }
    public void setCohesionDrop(double cohesionDrop) { this.cohesionDrop = cohesionDrop; }

    public boolean isExplicitShiftDetected() { return explicitShiftDetected; }
    public void setExplicitShiftDetected(boolean explicitShiftDetected) { this.explicitShiftDetected = explicitShiftDetected; }

    public double getEntityOverlap() { return entityOverlap; }
    public void setEntityOverlap(double entityOverlap) { this.entityOverlap = entityOverlap; }

    public int getEpisodeTokens() { return episodeTokens; }
    public void setEpisodeTokens(int episodeTokens) { this.episodeTokens = episodeTokens; }

    public int getEpisodeTurns() { return episodeTurns; }
    public void setEpisodeTurns(int episodeTurns) { this.episodeTurns = episodeTurns; }

    public double getTokenPressure() { return tokenPressure; }
    public void setTokenPressure(double tokenPressure) { this.tokenPressure = tokenPressure; }

    public double getTurnPressure() { return turnPressure; }
    public void setTurnPressure(double turnPressure) { this.turnPressure = turnPressure; }

    public double getBoundaryScore() { return boundaryScore; }
    public void setBoundaryScore(double boundaryScore) { this.boundaryScore = boundaryScore; }

    public boolean isBoundaryDetected() { return boundaryDetected; }
    public void setBoundaryDetected(boolean boundaryDetected) { this.boundaryDetected = boundaryDetected; }

    public String getPrimaryReason() { return primaryReason; }
    public void setPrimaryReason(String primaryReason) { this.primaryReason = primaryReason; }
}
