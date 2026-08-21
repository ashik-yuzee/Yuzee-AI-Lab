package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.dto.CapabilitiesResponse;
import com.yuzee.tokenlab.service.GeminiChatService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/config")
@CrossOrigin(origins = "*")
public class CapabilityController {

    private final GeminiChatService geminiChatService;

    @Value("${spring.ai.google.genai.api-key:}")
    private String geminiApiKey;

    public CapabilityController(GeminiChatService geminiChatService) {
        this.geminiChatService = geminiChatService;
    }

    @GetMapping("/capabilities")
    public ResponseEntity<CapabilitiesResponse> getCapabilities() {
        CapabilitiesResponse cap = new CapabilitiesResponse();
        boolean hasKey = geminiApiKey != null && !geminiApiKey.isBlank();

        cap.setGeminiApiKeyPresent(hasKey);
        cap.setConfigured(hasKey);
        cap.setAvailableModels(List.of("gemini-3.6-flash", "gemini-3.5-flash"));
        cap.setDefaultModel("gemini-3.6-flash");
        cap.setSupportsThinking(true);
        cap.setSupportsCachedTokens(true);
        cap.setSupportsInteractionsApi(false); // Experimental option
        cap.setSupportsExplicitCache(false);
        cap.setRuntime("spring-boot");

        return ResponseEntity.ok(cap);
    }
}
