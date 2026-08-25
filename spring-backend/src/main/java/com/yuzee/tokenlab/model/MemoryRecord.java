package com.yuzee.tokenlab.model;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class MemoryRecord {
    private String id;
    private String conversationId;
    private String episodeId;
    private MemoryType type;
    private String canonicalText;
    private List<String> sourceMessageIds = new ArrayList<>();
    private long createdAt;
    private String eventTime;
    private long validFrom;
    private long validTo;
    private MemoryStatus status;
    private double confidence;
    private List<String> entities = new ArrayList<>();
    private List<String> topics = new ArrayList<>();
    private String supersedesMemoryId;
    private String extractedBy;

    public MemoryRecord() {}

    public static MemoryRecord create(String conversationId, String episodeId, MemoryType type,
                                      String canonicalText, List<String> sourceMessageIds) {
        MemoryRecord r = new MemoryRecord();
        r.id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        r.createdAt = now;
        r.validFrom = now;
        r.conversationId = conversationId;
        r.episodeId = episodeId;
        r.type = type;
        r.canonicalText = canonicalText;
        r.sourceMessageIds = sourceMessageIds != null ? new ArrayList<>(sourceMessageIds) : new ArrayList<>();
        r.status = MemoryStatus.ACTIVE;
        r.confidence = 1.0;
        r.entities = new ArrayList<>();
        r.topics = new ArrayList<>();
        return r;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getEpisodeId() { return episodeId; }
    public void setEpisodeId(String episodeId) { this.episodeId = episodeId; }

    public MemoryType getType() { return type; }
    public void setType(MemoryType type) { this.type = type; }

    public String getCanonicalText() { return canonicalText; }
    public void setCanonicalText(String canonicalText) { this.canonicalText = canonicalText; }

    public List<String> getSourceMessageIds() { return sourceMessageIds; }
    public void setSourceMessageIds(List<String> sourceMessageIds) { this.sourceMessageIds = sourceMessageIds; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public String getEventTime() { return eventTime; }
    public void setEventTime(String eventTime) { this.eventTime = eventTime; }

    public long getValidFrom() { return validFrom; }
    public void setValidFrom(long validFrom) { this.validFrom = validFrom; }

    public long getValidTo() { return validTo; }
    public void setValidTo(long validTo) { this.validTo = validTo; }

    public MemoryStatus getStatus() { return status; }
    public void setStatus(MemoryStatus status) { this.status = status; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public List<String> getEntities() { return entities; }
    public void setEntities(List<String> entities) { this.entities = entities; }

    public List<String> getTopics() { return topics; }
    public void setTopics(List<String> topics) { this.topics = topics; }

    public String getSupersedesMemoryId() { return supersedesMemoryId; }
    public void setSupersedesMemoryId(String supersedesMemoryId) { this.supersedesMemoryId = supersedesMemoryId; }

    public String getExtractedBy() { return extractedBy; }
    public void setExtractedBy(String extractedBy) { this.extractedBy = extractedBy; }
}
