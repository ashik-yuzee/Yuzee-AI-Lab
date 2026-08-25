package com.yuzee.tokenlab.service.semantic;

/**
 * Lexical semantic similarity — no external embedding model required.
 * Uses token-overlap Jaccard similarity as a lightweight proxy.
 * ponytail: global lexical fallback — add EmbeddingModel injection if throughput matters
 */
public interface SemanticSimilarityService {
    /** Returns Jaccard similarity [0.0, 1.0] between two texts. */
    double similarity(String a, String b);

    /** Returns centroid similarity: average pairwise Jaccard of all texts. */
    double centroidCohesion(java.util.List<String> texts);
}
