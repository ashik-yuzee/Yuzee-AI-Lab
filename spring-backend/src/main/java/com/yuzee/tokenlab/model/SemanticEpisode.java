package com.yuzee.tokenlab.model;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class SemanticEpisode {
    private String id;
    private String conversationId;
    private int episodeIndex;
    private String title;
    private SemanticEpisodeStatus status;
    private List<Message> messages = new ArrayList<>();
    private List<String> messageIds = new ArrayList<>();
    private long startTime;
    private long endTime;
    private double cohesionScore;
    private int tokenCount;
    private String compressedSummary;
    private List<String> topicKeywords = new ArrayList<>();
    private long extractedAt;

    public SemanticEpisode() {
        this.id = UUID.randomUUID().toString();
        this.status = SemanticEpisodeStatus.ACTIVE;
        this.startTime = System.currentTimeMillis();
    }

    public void addMessage(Message msg) {
        messages.add(msg);
        if (msg.getId() != null) {
            messageIds.add(msg.getId());
        }
        if (msg.getContent() != null) {
            tokenCount += msg.getContent().length() / 4;
        }
        endTime = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public int getEpisodeIndex() { return episodeIndex; }
    public void setEpisodeIndex(int episodeIndex) { this.episodeIndex = episodeIndex; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public SemanticEpisodeStatus getStatus() { return status; }
    public void setStatus(SemanticEpisodeStatus status) { this.status = status; }

    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }

    public List<String> getMessageIds() { return messageIds; }
    public void setMessageIds(List<String> messageIds) { this.messageIds = messageIds; }

    public long getStartTime() { return startTime; }
    public void setStartTime(long startTime) { this.startTime = startTime; }

    public long getEndTime() { return endTime; }
    public void setEndTime(long endTime) { this.endTime = endTime; }

    public double getCohesionScore() { return cohesionScore; }
    public void setCohesionScore(double cohesionScore) { this.cohesionScore = cohesionScore; }

    public int getTokenCount() { return tokenCount; }
    public void setTokenCount(int tokenCount) { this.tokenCount = tokenCount; }

    public String getCompressedSummary() { return compressedSummary; }
    public void setCompressedSummary(String compressedSummary) { this.compressedSummary = compressedSummary; }

    public List<String> getTopicKeywords() { return topicKeywords; }
    public void setTopicKeywords(List<String> topicKeywords) { this.topicKeywords = topicKeywords; }

    public long getExtractedAt() { return extractedAt; }
    public void setExtractedAt(long extractedAt) { this.extractedAt = extractedAt; }
}
