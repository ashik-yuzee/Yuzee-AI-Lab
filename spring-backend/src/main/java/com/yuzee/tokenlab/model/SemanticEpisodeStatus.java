package com.yuzee.tokenlab.model;

public enum SemanticEpisodeStatus {
    ACTIVE,    // Currently being added to (open episode)
    CLOSED,    // Boundary detected; no more messages added
    ARCHIVED   // Memory extraction complete
}
