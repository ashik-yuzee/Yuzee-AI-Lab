package com.yuzee.tokenlab.protocol.v13;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UserEvent(
        @JsonProperty("ui") UiEvent ui,
        @JsonProperty("interaction") InteractionEvent interaction
) {
    public record UiEvent(
            @JsonProperty("selected_mode") String selectedMode
    ) {}

    public record InteractionEvent(
            @JsonProperty("question_id") String questionId,
            @JsonProperty("selected_options") List<String> selectedOptions,
            @JsonProperty("ranked_options") List<String> rankedOptions,
            @JsonProperty("fields") Map<String, String> fields,
            @JsonProperty("self_input") String selfInput
    ) {}
}
