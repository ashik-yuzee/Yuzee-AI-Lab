package com.yuzee.tokenlab.dto;

import java.util.List;

public class CapabilitiesResponse {
    private boolean configured;
    private List<String> availableModels;
    private String defaultModel;
    private boolean supportsThinking;
    private boolean supportsCachedTokens;
    private boolean supportsInteractionsApi;
    private boolean supportsExplicitCache;
    private boolean geminiApiKeyPresent;
    private String runtime;

    public CapabilitiesResponse() {}

    public boolean isConfigured() { return configured; }
    public void setConfigured(boolean configured) { this.configured = configured; }

    public List<String> getAvailableModels() { return availableModels; }
    public void setAvailableModels(List<String> availableModels) { this.availableModels = availableModels; }

    public String getDefaultModel() { return defaultModel; }
    public void setDefaultModel(String defaultModel) { this.defaultModel = defaultModel; }

    public boolean isSupportsThinking() { return supportsThinking; }
    public void setSupportsThinking(boolean supportsThinking) { this.supportsThinking = supportsThinking; }

    public boolean isSupportsCachedTokens() { return supportsCachedTokens; }
    public void setSupportsCachedTokens(boolean supportsCachedTokens) { this.supportsCachedTokens = supportsCachedTokens; }

    public boolean isSupportsInteractionsApi() { return supportsInteractionsApi; }
    public void setSupportsInteractionsApi(boolean supportsInteractionsApi) { this.supportsInteractionsApi = supportsInteractionsApi; }

    public boolean isSupportsExplicitCache() { return supportsExplicitCache; }
    public void setSupportsExplicitCache(boolean supportsExplicitCache) { this.supportsExplicitCache = supportsExplicitCache; }

    public boolean isGeminiApiKeyPresent() { return geminiApiKeyPresent; }
    public void setGeminiApiKeyPresent(boolean geminiApiKeyPresent) { this.geminiApiKeyPresent = geminiApiKeyPresent; }

    public String getRuntime() { return runtime; }
    public void setRuntime(String runtime) { this.runtime = runtime; }
}
