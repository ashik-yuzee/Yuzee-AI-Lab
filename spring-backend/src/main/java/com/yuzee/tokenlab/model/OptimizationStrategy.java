package com.yuzee.tokenlab.model;

public enum OptimizationStrategy {
    BASELINE,          // Full conversation history (high token overhead benchmark)
    SLIDING_WINDOW,    // Turn-safe sliding window
    SUMMARY_RECENT,    // Incremental summary + recent full turns
    ADAPTIVE_HYBRID    // Prioritized context budget allocation (Recommended default)
}
