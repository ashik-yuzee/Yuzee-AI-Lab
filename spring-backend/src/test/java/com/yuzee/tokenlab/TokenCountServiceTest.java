package com.yuzee.tokenlab;

import com.yuzee.tokenlab.service.TokenCountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class TokenCountServiceTest {

    private TokenCountService tokenCountService;

    @BeforeEach
    void setUp() {
        tokenCountService = new TokenCountService();
    }

    @Test
    void testEstimateTokens_EmptyString() {
        assertEquals(0, tokenCountService.estimateTokens(""));
        assertEquals(0, tokenCountService.estimateTokens(null));
    }

    @Test
    void testEstimateTokens_NormalText() {
        String text = "I want to transition into cybersecurity and build a 6-month study roadmap.";
        int tokens = tokenCountService.estimateTokens(text);
        assertTrue(tokens >= 15 && tokens <= 25, "Estimated tokens should be within realistic range (~18-22)");
    }

    @Test
    void testBreakDownContext() {
        var breakdown = tokenCountService.breakDownContext(
                "You are Yuzee AI Guide.",
                "Goal: Cybersecurity",
                "Summary v1",
                "User: Hello",
                "What is SOC Tier 1?",
                120
        );

        assertNotNull(breakdown);
        assertTrue(breakdown.getTotalAssembledTokens() > 0);
        assertEquals(120, breakdown.getRemovedTokens());
        assertEquals(5, breakdown.getIncludedSections().size());
    }
}
