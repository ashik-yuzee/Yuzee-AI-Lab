package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.OptimizationStrategy;
import com.yuzee.tokenlab.model.ResponseMode;
import com.yuzee.tokenlab.model.ThinkingLevel;
import java.util.List;

public class BenchmarkRequest {
    private String conversationId;
    private String prompt;
    private String model;
    private ThinkingLevel thinkingLevel;
    private ResponseMode responseMode;
    private List<OptimizationStrategy> strategies;

    public BenchmarkRequest() {}

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public ThinkingLevel getThinkingLevel() { return thinkingLevel; }
    public void setThinkingLevel(ThinkingLevel thinkingLevel) { this.thinkingLevel = thinkingLevel; }

    public ResponseMode getResponseMode() { return responseMode; }
    public void setResponseMode(ResponseMode responseMode) { this.responseMode = responseMode; }

    public List<OptimizationStrategy> getStrategies() { return strategies; }
    public void setStrategies(List<OptimizationStrategy> strategies) { this.strategies = strategies; }
}
