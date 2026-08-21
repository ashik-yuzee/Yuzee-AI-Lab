package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.*;
import com.yuzee.tokenlab.protocol.v13.UserEvent;

public class ChatRequest {
    private String message;
    private String model;
    private OptimizationStrategy strategy;
    private PresetMode preset;
    private ResponseMode responseMode;
    private ThinkingLevel thinkingLevel;
    private Integer contextBudget;
    private Integer recentTurnsToKeep;
    private CareerContext careerContext;
    private String systemPromptMode;
    private String customSystemPrompt;
    private Boolean useInteractionsApi;
    private Boolean useExplicitCache;
    private String protocolVersion;
    private UserEvent userEvent;

    public ChatRequest() {}

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

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

    public Integer getContextBudget() { return contextBudget; }
    public void setContextBudget(Integer contextBudget) { this.contextBudget = contextBudget; }

    public Integer getRecentTurnsToKeep() { return recentTurnsToKeep; }
    public void setRecentTurnsToKeep(Integer recentTurnsToKeep) { this.recentTurnsToKeep = recentTurnsToKeep; }

    public CareerContext getCareerContext() { return careerContext; }
    public void setCareerContext(CareerContext careerContext) { this.careerContext = careerContext; }

    public String getSystemPromptMode() { return systemPromptMode; }
    public void setSystemPromptMode(String systemPromptMode) { this.systemPromptMode = systemPromptMode; }

    public String getCustomSystemPrompt() { return customSystemPrompt; }
    public void setCustomSystemPrompt(String customSystemPrompt) { this.customSystemPrompt = customSystemPrompt; }

    public Boolean getUseInteractionsApi() { return useInteractionsApi; }
    public void setUseInteractionsApi(Boolean useInteractionsApi) { this.useInteractionsApi = useInteractionsApi; }

    public Boolean getUseExplicitCache() { return useExplicitCache; }
    public void setUseExplicitCache(Boolean useExplicitCache) { this.useExplicitCache = useExplicitCache; }

    public String getProtocolVersion() { return protocolVersion; }
    public void setProtocolVersion(String protocolVersion) { this.protocolVersion = protocolVersion; }

    public UserEvent getUserEvent() { return userEvent; }
    public void setUserEvent(UserEvent userEvent) { this.userEvent = userEvent; }
}
