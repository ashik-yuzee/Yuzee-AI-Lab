package com.yuzee.tokenlab.dto;

import com.yuzee.tokenlab.model.ContextMetrics;

public class TokenCountRequest {
    private String conversationId;
    private String message;
    private String model;
    private Boolean deepDiagnostics;

    public TokenCountRequest() {}

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public Boolean getDeepDiagnostics() { return deepDiagnostics; }
    public void setDeepDiagnostics(Boolean deepDiagnostics) { this.deepDiagnostics = deepDiagnostics; }
}
