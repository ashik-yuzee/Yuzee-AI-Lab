package com.yuzee.tokenlab;

import com.yuzee.tokenlab.model.*;
import com.yuzee.tokenlab.service.ConversationCompactor;
import com.yuzee.tokenlab.service.TokenBudgetMemoryManager;
import com.yuzee.tokenlab.service.TokenCountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class TokenBudgetMemoryManagerTest {

    private TokenBudgetMemoryManager memoryManager;
    private TokenCountService tokenCountService;
    private ConversationCompactor compactor;

    @BeforeEach
    void setUp() {
        tokenCountService = new TokenCountService();
        compactor = new ConversationCompactor(tokenCountService);
        memoryManager = new TokenBudgetMemoryManager(tokenCountService, compactor);
    }

    @Test
    void testSlidingWindowTurnSafety() {
        Conversation conv = new Conversation("test-1", "Test Conversation");
        conv.getMessages().add(new Message("1", MessageRole.USER, "Turn 1 user"));
        conv.getMessages().add(new Message("2", MessageRole.ASSISTANT, "Turn 1 assistant"));
        conv.getMessages().add(new Message("3", MessageRole.USER, "Turn 2 user"));
        conv.getMessages().add(new Message("4", MessageRole.ASSISTANT, "Turn 2 assistant"));
        conv.getMessages().add(new Message("5", MessageRole.USER, "Turn 3 user"));
        conv.getMessages().add(new Message("6", MessageRole.ASSISTANT, "Turn 3 assistant"));

        // Keep 2 turns (last 4 messages: msgs 3, 4, 5, 6)
        var result = memoryManager.assembleMemory(conv, "Turn 4 user", OptimizationStrategy.SLIDING_WINDOW, 2000, 2);

        assertNotNull(result);
        assertEquals(2, result.getRecentTurnsCount());
        assertTrue(result.getRemovedTokens() > 0, "Evicted turns should report removed tokens");
        assertFalse(result.getExcludedItems().isEmpty());
    }

    @Test
    void testAdaptiveHybridBudgetEnforcement() {
        Conversation conv = new Conversation("test-2", "Adaptive Test");
        for (int i = 1; i <= 6; i++) {
            conv.getMessages().add(new Message("u" + i, MessageRole.USER, "User message content for turn " + i));
            conv.getMessages().add(new Message("a" + i, MessageRole.ASSISTANT, "Assistant response with details for turn " + i));
        }

        var result = memoryManager.assembleMemory(conv, "Final question", OptimizationStrategy.ADAPTIVE_HYBRID, 500, 2);

        assertNotNull(result);
        assertTrue(result.getRecentTurnsCount() <= 2);
    }
}
