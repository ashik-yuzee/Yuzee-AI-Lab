package com.yuzee.tokenlab.service;

import com.yuzee.tokenlab.model.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ConversationService {

    private final Map<String, Conversation> conversations = new ConcurrentHashMap<>();

    public ConversationService() {
        // Seed an initial demo conversation
        Conversation defaultConv = new Conversation(UUID.randomUUID().toString(), "Cybersecurity Pathway Planning");
        CareerContext context = new CareerContext();
        context.setGoal("Transition from Helpdesk IT to Junior SOC Analyst");
        context.setCurrentStage("2 years IT Support, CompTIA Network+ certified");
        context.setTargetRole("Security Operations Center (SOC) Analyst Tier 1");
        context.setKeySkills("Networking, TCP/IP, Linux basics, Active Directory");
        context.setTimeline("6-9 months part-time study");
        context.setConstraints("Budget < $1,000, self-paced online preferred");
        defaultConv.setCareerContext(context);
        conversations.put(defaultConv.getId(), defaultConv);
    }

    public List<Conversation> getAllConversations() {
        List<Conversation> list = new ArrayList<>(conversations.values());
        list.sort((a, b) -> Long.compare(b.getUpdatedAt(), a.getUpdatedAt()));
        return list;
    }

    public Optional<Conversation> getConversation(String id) {
        return Optional.ofNullable(conversations.get(id));
    }

    public Conversation createConversation(String title, String model, OptimizationStrategy strategy) {
        String id = UUID.randomUUID().toString();
        Conversation conv = new Conversation(id, title != null && !title.isBlank() ? title : "New Exploration");
        if (model != null && !model.isBlank()) conv.setModel(model);
        if (strategy != null) conv.setStrategy(strategy);
        conversations.put(id, conv);
        return conv;
    }

    public Conversation save(Conversation conversation) {
        conversation.setUpdatedAt(System.currentTimeMillis());
        conversations.put(conversation.getId(), conversation);
        return conversation;
    }

    public boolean deleteConversation(String id) {
        return conversations.remove(id) != null;
    }

    public void clearAll() {
        conversations.clear();
    }
}
