package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.model.Conversation;
import com.yuzee.tokenlab.model.QualityFeedback;
import com.yuzee.tokenlab.service.ConversationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@CrossOrigin(origins = "*")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @GetMapping
    public List<Conversation> listConversations() {
        return conversationService.getAllConversations();
    }

    @PostMapping
    public Conversation createConversation(@RequestBody(required = false) Conversation request) {
        String title = request != null ? request.getTitle() : "New Career Exploration";
        String model = request != null ? request.getModel() : "gemini-3.6-flash";
        return conversationService.createConversation(title, model, request != null ? request.getStrategy() : null);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Conversation> getConversation(@PathVariable("id") String id) {
        return conversationService.getConversation(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable("id") String id) {
        if (conversationService.deleteConversation(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Conversation> updateConversation(
            @PathVariable("id") String id,
            @RequestBody Conversation updated
    ) {
        return conversationService.getConversation(id)
                .map(existing -> {
                    if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
                    if (updated.getModel() != null) existing.setModel(updated.getModel());
                    if (updated.getStrategy() != null) existing.setStrategy(updated.getStrategy());
                    if (updated.getPreset() != null) existing.setPreset(updated.getPreset());
                    if (updated.getResponseMode() != null) existing.setResponseMode(updated.getResponseMode());
                    if (updated.getThinkingLevel() != null) existing.setThinkingLevel(updated.getThinkingLevel());
                    if (updated.getCareerContext() != null) existing.setCareerContext(updated.getCareerContext());
                    if (updated.getContextBudget() > 0) existing.setContextBudget(updated.getContextBudget());
                    if (updated.getRecentTurnsToKeep() > 0) existing.setRecentTurnsToKeep(updated.getRecentTurnsToKeep());
                    if (updated.getSystemPromptMode() != null) existing.setSystemPromptMode(updated.getSystemPromptMode());
                    if (updated.getCustomSystemPrompt() != null) existing.setCustomSystemPrompt(updated.getCustomSystemPrompt());
                    return ResponseEntity.ok(conversationService.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/feedback")
    public ResponseEntity<Void> recordFeedback(
            @PathVariable("id") String id,
            @RequestParam("messageId") String messageId,
            @RequestBody QualityFeedback feedback
    ) {
        return conversationService.getConversation(id)
                .map(conv -> {
                    conv.getMessages().stream()
                            .filter(m -> m.getId().equals(messageId))
                            .findFirst()
                            .ifPresent(m -> m.setFeedback(feedback));
                    conversationService.save(conv);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/reset-memory")
    public ResponseEntity<Conversation> resetMemory(@PathVariable("id") String id) {
        return conversationService.getConversation(id)
                .map(conv -> {
                    conv.setSummary("");
                    conv.setSummaryVersion(0);
                    conv.getCompactionHistory().clear();
                    return ResponseEntity.ok(conversationService.save(conv));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
