package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.OptimizationStrategy;
import java.util.ArrayList;
import java.util.List;

public class BenchmarkResponse {
    private List<BenchmarkResultItem> results = new ArrayList<>();

    public static class BenchmarkResultItem {
        private OptimizationStrategy strategy;
        private String label;
        private String model;
        private String mode; // "estimated" or "live"
        private int inputTokens;
        private Integer outputTokens;      // null = unavailable (not fabricated)
        private Integer thinkingTokens;    // null = unavailable
        private Integer cachedTokens;      // null = unavailable
        private int totalTokens;
        private Long latencyMs;            // null = unavailable (not fabricated)
        private int compactionCost;
        private String responsePreview;
        private int retainedContextTokens;
        private String notes;

        public BenchmarkResultItem() {}

        public OptimizationStrategy getStrategy() { return strategy; }
        public void setStrategy(OptimizationStrategy strategy) { this.strategy = strategy; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }

        public String getMode() { return mode; }
        public void setMode(String mode) { this.mode = mode; }

        public int getInputTokens() { return inputTokens; }
        public void setInputTokens(int inputTokens) { this.inputTokens = inputTokens; }

        public Integer getOutputTokens() { return outputTokens; }
        public void setOutputTokens(Integer outputTokens) { this.outputTokens = outputTokens; }

        public Integer getThinkingTokens() { return thinkingTokens; }
        public void setThinkingTokens(Integer thinkingTokens) { this.thinkingTokens = thinkingTokens; }

        public Integer getCachedTokens() { return cachedTokens; }
        public void setCachedTokens(Integer cachedTokens) { this.cachedTokens = cachedTokens; }

        public int getTotalTokens() { return totalTokens; }
        public void setTotalTokens(int totalTokens) { this.totalTokens = totalTokens; }

        public Long getLatencyMs() { return latencyMs; }
        public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }

        public int getCompactionCost() { return compactionCost; }
        public void setCompactionCost(int compactionCost) { this.compactionCost = compactionCost; }

        public String getResponsePreview() { return responsePreview; }
        public void setResponsePreview(String responsePreview) { this.responsePreview = responsePreview; }

        public int getRetainedContextTokens() { return retainedContextTokens; }
        public void setRetainedContextTokens(int retainedContextTokens) { this.retainedContextTokens = retainedContextTokens; }

        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }

    public BenchmarkResponse() {}

    public List<BenchmarkResultItem> getResults() { return results; }
    public void setResults(List<BenchmarkResultItem> results) { this.results = results; }
}
