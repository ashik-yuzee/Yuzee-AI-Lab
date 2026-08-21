package com.yuzee.tokenlab.model;

public class QualityFeedback {
    private String type; // good, context_missing, too_verbose, too_short, incorrect, other
    private String comment;
    private long timestamp;

    public QualityFeedback() {}

    public QualityFeedback(String type, String comment, long timestamp) {
        this.type = type;
        this.comment = comment;
        this.timestamp = timestamp;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
