package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.service.YuzeeProtocolRegistry;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/protocol")
@CrossOrigin(origins = "*")
public class ProtocolController {

    private final YuzeeProtocolRegistry protocolRegistry;

    public ProtocolController(YuzeeProtocolRegistry protocolRegistry) {
        this.protocolRegistry = protocolRegistry;
    }

    @GetMapping("/info")
    public Map<String, Object> getProtocolInfo() {
        return Map.of(
                "protocolVersion", protocolRegistry.getProtocolVersion(),
                "promptVersion", protocolRegistry.getPromptVersion(),
                "schemaVersion", protocolRegistry.getSchemaVersion(),
                "targetRuntimeModel", protocolRegistry.getTargetRuntimeModel(),
                "promptHash", protocolRegistry.getPromptHash(),
                "schemaHash", protocolRegistry.getSchemaHash(),
                "promptCharCount", protocolRegistry.getPromptCharCount(),
                "promptByteCount", protocolRegistry.getPromptByteCount(),
                "schemaByteCount", protocolRegistry.getSchemaByteCount()
        );
    }

    @GetMapping("/schema")
    public String getSchema() {
        return protocolRegistry.getResponseSchemaJson();
    }

    @GetMapping("/prompt")
    public String getPrompt() {
        return protocolRegistry.getProductionPrompt();
    }
}
