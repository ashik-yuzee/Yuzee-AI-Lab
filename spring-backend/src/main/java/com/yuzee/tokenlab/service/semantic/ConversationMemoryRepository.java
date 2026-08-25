package com.yuzee.tokenlab.service.semantic;

import com.yuzee.tokenlab.model.MemoryRecord;
import com.yuzee.tokenlab.model.MemoryType;
import com.yuzee.tokenlab.model.SemanticEpisode;

import java.util.List;
import java.util.Optional;

public interface ConversationMemoryRepository {
    void saveEpisode(SemanticEpisode episode);
    List<SemanticEpisode> getEpisodes(String conversationId);
    Optional<SemanticEpisode> getActiveEpisode(String conversationId);

    void saveMemory(MemoryRecord record);
    List<MemoryRecord> getMemories(String conversationId);
    List<MemoryRecord> getMemoriesByType(String conversationId, MemoryType type);
    List<MemoryRecord> getActiveMemories(String conversationId);
    void supersede(String oldMemoryId, String newMemoryId);
}
