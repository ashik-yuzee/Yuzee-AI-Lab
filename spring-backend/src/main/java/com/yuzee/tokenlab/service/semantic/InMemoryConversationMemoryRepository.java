package com.yuzee.tokenlab.service.semantic;

import com.yuzee.tokenlab.model.MemoryRecord;
import com.yuzee.tokenlab.model.MemoryStatus;
import com.yuzee.tokenlab.model.MemoryType;
import com.yuzee.tokenlab.model.SemanticEpisode;
import com.yuzee.tokenlab.model.SemanticEpisodeStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@Service
public class InMemoryConversationMemoryRepository implements ConversationMemoryRepository {

    private final Map<String, List<SemanticEpisode>> episodes = new ConcurrentHashMap<>();
    private final Map<String, List<MemoryRecord>> memories = new ConcurrentHashMap<>();

    @Override
    public void saveEpisode(SemanticEpisode episode) {
        List<SemanticEpisode> list = episodes.computeIfAbsent(episode.getConversationId(), k -> new CopyOnWriteArrayList<>());
        // replace if id already present, else add
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getId().equals(episode.getId())) {
                list.set(i, episode);
                return;
            }
        }
        list.add(episode);
    }

    @Override
    public List<SemanticEpisode> getEpisodes(String conversationId) {
        return episodes.getOrDefault(conversationId, List.of());
    }

    @Override
    public Optional<SemanticEpisode> getActiveEpisode(String conversationId) {
        List<SemanticEpisode> list = episodes.getOrDefault(conversationId, List.of());
        // find last ACTIVE episode
        SemanticEpisode active = null;
        for (SemanticEpisode ep : list) {
            if (ep.getStatus() == SemanticEpisodeStatus.ACTIVE) {
                active = ep;
            }
        }
        return Optional.ofNullable(active);
    }

    @Override
    public void saveMemory(MemoryRecord record) {
        memories.computeIfAbsent(record.getConversationId(), k -> new CopyOnWriteArrayList<>()).add(record);
    }

    @Override
    public List<MemoryRecord> getMemories(String conversationId) {
        return memories.getOrDefault(conversationId, List.of());
    }

    @Override
    public List<MemoryRecord> getMemoriesByType(String conversationId, MemoryType type) {
        return getMemories(conversationId).stream()
                .filter(r -> r.getType() == type)
                .collect(Collectors.toList());
    }

    @Override
    public List<MemoryRecord> getActiveMemories(String conversationId) {
        return getMemories(conversationId).stream()
                .filter(r -> r.getStatus() == MemoryStatus.ACTIVE)
                .collect(Collectors.toList());
    }

    @Override
    public void supersede(String oldMemoryId, String newMemoryId) {
        long now = System.currentTimeMillis();
        for (List<MemoryRecord> list : memories.values()) {
            for (MemoryRecord r : list) {
                if (r.getId().equals(oldMemoryId)) {
                    r.setStatus(MemoryStatus.SUPERSEDED);
                    r.setValidTo(now);
                }
                if (r.getId().equals(newMemoryId)) {
                    r.setSupersedesMemoryId(oldMemoryId);
                }
            }
        }
    }
}
