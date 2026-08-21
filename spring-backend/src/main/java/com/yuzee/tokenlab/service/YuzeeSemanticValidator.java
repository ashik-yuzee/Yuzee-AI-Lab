package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.protocol.v13.YuzeeResponseV13;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class YuzeeSemanticValidator {

    public record SemanticValidationResult(
            boolean valid,
            List<String> errors
    ) {}

    public SemanticValidationResult validate(YuzeeResponseV13 response) {
        List<String> errors = new ArrayList<>();
        if (response == null) {
            errors.add("Response object is null");
            return new SemanticValidationResult(false, errors);
        }

        // 1. Schema Version invariant
        if (!"1.3".equals(response.schemaVersion())) {
            errors.add("Invalid schema_version: expected '1.3' but got '" + response.schemaVersion() + "'");
        }

        // 2. First Content Block invariant: MUST be type='text', level='none', title=''
        if (response.contentBlocks() == null || response.contentBlocks().isEmpty()) {
            errors.add("content_blocks must contain at least one block");
        } else {
            YuzeeResponseV13.YuzeeContentBlock firstBlock = response.contentBlocks().get(0);
            if (!"text".equals(firstBlock.type())) {
                errors.add("First content block must have type='text', but got '" + firstBlock.type() + "'");
            }
            if (!"none".equals(firstBlock.level())) {
                errors.add("First content block must have level='none', but got '" + firstBlock.level() + "'");
            }
            if (firstBlock.title() != null && !firstBlock.title().isEmpty()) {
                errors.add("First content block must have title='' (empty), but got '" + firstBlock.title() + "'");
            }
        }

        // 3. Interaction invariants
        YuzeeResponseV13.YuzeeInteraction interaction = response.interaction();
        if (interaction != null) {
            String kind = interaction.kind();
            String inputType = interaction.inputType();

            if ("none".equals(kind)) {
                if (!"none".equals(inputType)) {
                    errors.add("When interaction.kind='none', input_type must be 'none', got '" + inputType + "'");
                }
                if (interaction.options() != null && !interaction.options().isEmpty()) {
                    errors.add("When interaction.kind='none', options must be empty");
                }
                if (interaction.fields() != null && !interaction.fields().isEmpty()) {
                    errors.add("When interaction.kind='none', fields must be empty");
                }
            } else if ("question".equals(kind)) {
                // When an active question/handoff is present: recommended_actions MUST be empty
                if (interaction.recommendedActions() != null && !interaction.recommendedActions().isEmpty()) {
                    errors.add("When interaction.kind='question', recommended_actions must be empty");
                }
                if (interaction.questionId() == null || interaction.questionId().isBlank()) {
                    errors.add("When interaction.kind='question', question_id must be non-empty");
                }

                if ("text".equals(inputType)) {
                    if (interaction.options() != null && !interaction.options().isEmpty()) {
                        errors.add("When input_type='text', options must be empty");
                    }
                } else if ("single_select".equals(inputType)) {
                    int optCount = interaction.options() != null ? interaction.options().size() : 0;
                    if (optCount < 2 || optCount > 5) {
                        errors.add("single_select questions must have 2-5 options, got " + optCount);
                    }
                } else if ("multi_select".equals(inputType)) {
                    int optCount = interaction.options() != null ? interaction.options().size() : 0;
                    if (optCount < 2 || optCount > 6) {
                        errors.add("multi_select questions must have 2-6 options, got " + optCount);
                    }
                } else if ("ranked_select".equals(inputType)) {
                    int optCount = interaction.options() != null ? interaction.options().size() : 0;
                    if (optCount < 3 || optCount > 6) {
                        errors.add("ranked_select questions must have 3-6 options, got " + optCount);
                    }
                    if (interaction.allowOtherInput()) {
                        errors.add("ranked_select questions must have allow_other_input=false");
                    }
                }
            } else if ("handoff".equals(kind)) {
                if (!"fields".equals(inputType)) {
                    errors.add("When interaction.kind='handoff', input_type must be 'fields', got '" + inputType + "'");
                }
                if (interaction.recommendedActions() != null && !interaction.recommendedActions().isEmpty()) {
                    errors.add("When interaction.kind='handoff', recommended_actions must be empty");
                }
                // Handoff fields must agree with missing service inputs
                if (response.service() != null) {
                    List<String> missingInputs = response.service().missingInputs();
                    List<YuzeeResponseV13.YuzeeField> fields = interaction.fields();
                    int fieldCount = fields != null ? fields.size() : 0;
                    int missingCount = missingInputs != null ? missingInputs.size() : 0;
                    if (fieldCount != missingCount) {
                        errors.add("Handoff interaction.fields (" + fieldCount + ") must match service.missing_inputs (" + missingCount + ")");
                    }
                }
            }
        }

        // 4. User Confidence invariants:
        // score=-1 <=> band unknown
        // 0-39 -> low
        // 40-69 -> medium
        // 70-100 -> high
        if (response.state() != null && response.state().userConfidence() != null) {
            YuzeeResponseV13.UserConfidenceState uc = response.state().userConfidence();
            int score = uc.score();
            String band = uc.band();
            if (score == -1 && !"unknown".equals(band)) {
                errors.add("User confidence score -1 must pair with band='unknown', got '" + band + "'");
            } else if (score >= 0 && score <= 39 && !"low".equals(band)) {
                errors.add("User confidence score " + score + " (0-39) must pair with band='low', got '" + band + "'");
            } else if (score >= 40 && score <= 69 && !"medium".equals(band)) {
                errors.add("User confidence score " + score + " (40-69) must pair with band='medium', got '" + band + "'");
            } else if (score >= 70 && score <= 100 && !"high".equals(band)) {
                errors.add("User confidence score " + score + " (70-100) must pair with band='high', got '" + band + "'");
            }
        }

        return new SemanticValidationResult(errors.isEmpty(), errors);
    }
}
