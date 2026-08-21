package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.dto.ChatRequest;
import com.yuzee.tokenlab.dto.StreamEvent;
import com.yuzee.tokenlab.service.GeminiChatService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/conversations")
@CrossOrigin(origins = "*")
public class ChatController {

    private final GeminiChatService geminiChatService;

    public ChatController(GeminiChatService geminiChatService) {
        this.geminiChatService = geminiChatService;
    }

    @PostMapping(value = "/{id}/messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<StreamEvent>> streamChatMessage(
            @PathVariable("id") String id,
            @RequestBody ChatRequest request
    ) {
        return geminiChatService.streamChat(id, request)
                .map(event -> ServerSentEvent.<StreamEvent>builder()
                        .event(event.getType())
                        .data(event)
                        .build());
    }
}
