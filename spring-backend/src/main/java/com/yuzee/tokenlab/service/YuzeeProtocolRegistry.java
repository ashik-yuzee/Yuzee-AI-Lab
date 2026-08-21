package com.yuzee.tokenlab.service;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
public class YuzeeProtocolRegistry {

    public static final String PROMPT_VERSION = "0.12";
    public static final String PROTOCOL_VERSION = "1.3";
    public static final String SCHEMA_VERSION = "1.3";
    public static final String TARGET_RUNTIME_MODEL = "gemini-3.7-flash";

    private String productionPrompt;
    private String responseSchemaJson;
    private String promptHash;
    private String schemaHash;

    @PostConstruct
    public void init() {
        try {
            ClassPathResource promptRes = new ClassPathResource("yuzee/prompts/Yuzee_Main_Prompt_Gemini_JSON_ONLY_FINAL_v0.12.md");
            try (InputStream is = promptRes.getInputStream()) {
                this.productionPrompt = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
            this.promptHash = computeSha256(this.productionPrompt);

            ClassPathResource schemaRes = new ClassPathResource("yuzee/protocol/v1.3/Yuzee_Response_Schema_v1.3.json");
            try (InputStream is = schemaRes.getInputStream()) {
                this.responseSchemaJson = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
            this.schemaHash = computeSha256(this.responseSchemaJson);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load Yuzee Production Protocol v1.3 bundle: " + e.getMessage(), e);
        }
    }

    public static String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return "sha256-unavailable";
        }
    }

    public String getProductionPrompt() {
        return productionPrompt;
    }

    public String getResponseSchemaJson() {
        return responseSchemaJson;
    }

    public String getPromptHash() {
        return promptHash;
    }

    public String getSchemaHash() {
        return schemaHash;
    }

    public String getPromptVersion() {
        return PROMPT_VERSION;
    }

    public String getProtocolVersion() {
        return PROTOCOL_VERSION;
    }

    public String getSchemaVersion() {
        return SCHEMA_VERSION;
    }

    public String getTargetRuntimeModel() {
        return TARGET_RUNTIME_MODEL;
    }

    public int getPromptCharCount() {
        return productionPrompt != null ? productionPrompt.length() : 0;
    }

    public int getPromptByteCount() {
        return productionPrompt != null ? productionPrompt.getBytes(StandardCharsets.UTF_8).length : 0;
    }

    public int getSchemaByteCount() {
        return responseSchemaJson != null ? responseSchemaJson.getBytes(StandardCharsets.UTF_8).length : 0;
    }
}
