package com.yuzee.tokenlab.model;

import java.util.ArrayList;
import java.util.List;

public class ContextMetrics {
    private int systemInstructionTokens;
    private int careerContextTokens;
    private int summaryTokens;
    private int recentTurnsTokens;
    private int currentMessageTokens;
    private int totalAssembledTokens;
    private int removedTokens;
    private List<SectionDetail> includedSections = new ArrayList<>();
    private List<ExcludedDetail> excludedSections = new ArrayList<>();

    public static class SectionDetail {
        private String name;
        private String description;
        private int tokens;
        private String preview;

        public SectionDetail() {}
        public SectionDetail(String name, String description, int tokens, String preview) {
            this.name = name;
            this.description = description;
            this.tokens = tokens;
            this.preview = preview;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public int getTokens() { return tokens; }
        public void setTokens(int tokens) { this.tokens = tokens; }
        public String getPreview() { return preview; }
        public void setPreview(String preview) { this.preview = preview; }
    }

    public static class ExcludedDetail {
        private String name;
        private String reason;
        private int tokens;
        private String preview;

        public ExcludedDetail() {}
        public ExcludedDetail(String name, String reason, int tokens, String preview) {
            this.name = name;
            this.reason = reason;
            this.tokens = tokens;
            this.preview = preview;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public int getTokens() { return tokens; }
        public void setTokens(int tokens) { this.tokens = tokens; }
        public String getPreview() { return preview; }
        public void setPreview(String preview) { this.preview = preview; }
    }

    public ContextMetrics() {}

    public int getSystemInstructionTokens() { return systemInstructionTokens; }
    public void setSystemInstructionTokens(int systemInstructionTokens) { this.systemInstructionTokens = systemInstructionTokens; }

    public int getCareerContextTokens() { return careerContextTokens; }
    public void setCareerContextTokens(int careerContextTokens) { this.careerContextTokens = careerContextTokens; }

    public int getSummaryTokens() { return summaryTokens; }
    public void setSummaryTokens(int summaryTokens) { this.summaryTokens = summaryTokens; }

    public int getRecentTurnsTokens() { return recentTurnsTokens; }
    public void setRecentTurnsTokens(int recentTurnsTokens) { this.recentTurnsTokens = recentTurnsTokens; }

    public int getCurrentMessageTokens() { return currentMessageTokens; }
    public void setCurrentMessageTokens(int currentMessageTokens) { this.currentMessageTokens = currentMessageTokens; }

    public int getTotalAssembledTokens() { return totalAssembledTokens; }
    public void setTotalAssembledTokens(int totalAssembledTokens) { this.totalAssembledTokens = totalAssembledTokens; }

    public int getRemovedTokens() { return removedTokens; }
    public void setRemovedTokens(int removedTokens) { this.removedTokens = removedTokens; }

    public List<SectionDetail> getIncludedSections() { return includedSections; }
    public void setIncludedSections(List<SectionDetail> includedSections) { this.includedSections = includedSections; }

    public List<ExcludedDetail> getExcludedSections() { return excludedSections; }
    public void setExcludedSections(List<ExcludedDetail> excludedSections) { this.excludedSections = excludedSections; }
}
