package com.yuzee.tokenlab.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class YuzeeSchemaValidator {

    private final YuzeeProtocolRegistry protocolRegistry;
    private final ObjectMapper objectMapper;
    private JsonSchema jsonSchema;

    public YuzeeSchemaValidator(YuzeeProtocolRegistry protocolRegistry, ObjectMapper objectMapper) {
        this.protocolRegistry = protocolRegistry;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        try {
            JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
            this.jsonSchema = factory.getSchema(protocolRegistry.getResponseSchemaJson());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize Yuzee JSON Schema validator: " + e.getMessage(), e);
        }
    }

    public record SchemaValidationResult(
            boolean valid,
            List<String> errors
    ) {}

    public SchemaValidationResult validate(String rawJson) {
        List<String> errors = new ArrayList<>();
        if (rawJson == null || rawJson.isBlank()) {
            errors.add("Raw JSON response is empty or null");
            return new SchemaValidationResult(false, errors);
        }

        try {
            JsonNode rootNode = objectMapper.readTree(rawJson);
            Set<ValidationMessage> validationMessages = jsonSchema.validate(rootNode);
            if (validationMessages != null && !validationMessages.isEmpty()) {
                for (ValidationMessage vm : validationMessages) {
                    errors.add(vm.getMessage());
                }
                return new SchemaValidationResult(false, errors);
            }
            return new SchemaValidationResult(true, List.of());
        } catch (Exception e) {
            errors.add("JSON parsing exception: " + e.getMessage());
            return new SchemaValidationResult(false, errors);
        }
    }
}
