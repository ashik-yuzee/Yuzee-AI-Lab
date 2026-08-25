package com.yuzee.tokenlab.model;

import java.util.ArrayList;
import java.util.List;

public class Conversation {
    private String id;
    private String title;
    private long createdAt;
    private long updatedAt;
    private String model = "gemini-3.6-flash";
    private OptimizationStrategy strategy = OptimizationStrategy.ADAPTIVE_HYBRID;
    private PresetMode preset = PresetMode.BALANCED;
    private ResponseMode responseMode = ResponseMode.STANDARD;
    private ThinkingLevel thinkingLevel = ThinkingLevel.ADAPTIVE;
    private int contextBudget = 270000;
    private int recentTurnsToKeep = 100;
    private CareerContext careerContext = new CareerContext();
    private String summary = "";
    private int summaryVersion = 0;
    private String systemPromptMode = "default";
    private String customSystemPrompt = "";
    private boolean useInteractionsApi = false;
    private boolean useExplicitCache = false;
    private boolean useFlashLiteUtility = false;
    private List<Message> messages = new ArrayList<>();
    private List<CompactionMetrics> compactionHistory = new ArrayList<>();

    public Conversation() {
        long now = System.currentTimeMillis();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public Conversation(String id, String title) {
        this();
        this.id = id;
        this.title = title;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public OptimizationStrategy getStrategy() { return strategy; }
    public void setStrategy(OptimizationStrategy strategy) { this.strategy = strategy; }

    public PresetMode getPreset() { return preset; }
    public void setPreset(PresetMode preset) { this.preset = preset; }

    public ResponseMode getResponseMode() { return responseMode; }
    public void setResponseMode(ResponseMode responseMode) { this.responseMode = responseMode; }

    public ThinkingLevel getThinkingLevel() { return thinkingLevel; }
    public void setThinkingLevel(ThinkingLevel thinkingLevel) { this.thinkingLevel = thinkingLevel; }

    public int getContextBudget() { return contextBudget; }
    public void setContextBudget(int contextBudget) { this.contextBudget = contextBudget; }

    public int getRecentTurnsToKeep() { return recentTurnsToKeep; }
    public void setRecentTurnsToKeep(int recentTurnsToKeep) { this.recentTurnsToKeep = recentTurnsToKeep; }

    public CareerContext getCareerContext() { return careerContext; }
    public void setCareerContext(CareerContext careerContext) { this.careerContext = careerContext; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public int getSummaryVersion() { return summaryVersion; }
    public void setSummaryVersion(int summaryVersion) { this.summaryVersion = summaryVersion; }

    public String getSystemPromptMode() { return systemPromptMode; }
    public void setSystemPromptMode(String systemPromptMode) { this.systemPromptMode = systemPromptMode; }

    public String getCustomSystemPrompt() { return customSystemPrompt; }
    public void setCustomSystemPrompt(String customSystemPrompt) { this.customSystemPrompt = customSystemPrompt; }

    public boolean isUseInteractionsApi() { return useInteractionsApi; }
    public void setUseInteractionsApi(boolean useInteractionsApi) { this.useInteractionsApi = useInteractionsApi; }

    public boolean isUseExplicitCache() { return useExplicitCache; }
    public void setUseExplicitCache(boolean useExplicitCache) { this.useExplicitCache = useExplicitCache; }

    public boolean isUseFlashLiteUtility() { return useFlashLiteUtility; }
    public void setUseFlashLiteUtility(boolean useFlashLiteUtility) { this.useFlashLiteUtility = useFlashLiteUtility; }

    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }

    public List<CompactionMetrics> getCompactionHistory() { return compactionHistory; }
    public void setCompactionHistory(List<CompactionMetrics> compactionHistory) { this.compactionHistory = compactionHistory; }
}
