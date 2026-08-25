package com.yuzee.tokenlab.service.semantic;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class MemoryQueryPlanner {

    public enum QueryIntent {
        LOCAL_CONTINUATION, PROFILE_LOOKUP, PREFERENCE_LOOKUP, GOAL_LOOKUP,
        HISTORICAL_RECALL, TEMPORAL_QUERY, EXACT_VALUE_LOOKUP, GENERAL
    }

    public static class QueryPlan {
        private QueryIntent intent;
        private List<String> keyTerms;
        private boolean requiresLexical;
        private boolean requiresTemporal;

        public QueryPlan() {}

        public QueryIntent getIntent() { return intent; }
        public void setIntent(QueryIntent intent) { this.intent = intent; }

        public List<String> getKeyTerms() { return keyTerms; }
        public void setKeyTerms(List<String> keyTerms) { this.keyTerms = keyTerms; }

        public boolean requiresLexical() { return requiresLexical; }
        public void setRequiresLexical(boolean requiresLexical) { this.requiresLexical = requiresLexical; }

        public boolean requiresTemporal() { return requiresTemporal; }
        public void setRequiresTemporal(boolean requiresTemporal) { this.requiresTemporal = requiresTemporal; }
    }

    private static final Set<String> STOPWORDS = Set.of(
            "the", "and", "for", "with", "that", "this", "have", "from",
            "not", "are", "you", "can", "what", "how", "why", "did",
            "was", "has", "does"
    );

    private static final Pattern DIGIT_PATTERN = Pattern.compile("\\d+");

    public QueryPlan plan(String userMessage) {
        QueryPlan plan = new QueryPlan();
        String lower = userMessage != null ? userMessage.toLowerCase() : "";

        // key terms
        List<String> keyTerms = Arrays.stream(lower.split("\\s+"))
                .filter(t -> t.length() >= 3)
                .filter(t -> !STOPWORDS.contains(t))
                .limit(10)
                .collect(Collectors.toList());
        plan.setKeyTerms(keyTerms);

        // intent
        QueryIntent intent;
        if (lower.length() < 50 || (lower.endsWith("?") && !hasTopicShiftTerms(lower))) {
            intent = QueryIntent.LOCAL_CONTINUATION;
        } else if (containsAny(lower, "earlier", "before", "previously", "last time", "told you", "remember", "you said")) {
            intent = QueryIntent.HISTORICAL_RECALL;
        } else if (containsAny(lower, "when", "changed", "update", "now vs", "used to", "anymore")) {
            intent = QueryIntent.TEMPORAL_QUERY;
        } else if (DIGIT_PATTERN.matcher(lower).find() || containsAny(lower, "rm", "myr", "budget", "salary", "score", "gpa", "cgpa", "grade")) {
            intent = QueryIntent.EXACT_VALUE_LOOKUP;
        } else if (containsAny(lower, "my background", "my degree", "my qualification", "studied", "graduated")) {
            intent = QueryIntent.PROFILE_LOOKUP;
        } else if (containsAny(lower, "prefer", "like", "don't like", "interested in", "not interested", "avoid")) {
            intent = QueryIntent.PREFERENCE_LOOKUP;
        } else if (containsAny(lower, "goal", "want to", "aim", "aspire", "plan to", "looking for")) {
            intent = QueryIntent.GOAL_LOOKUP;
        } else {
            intent = QueryIntent.GENERAL;
        }
        plan.setIntent(intent);

        plan.setRequiresLexical(intent == QueryIntent.EXACT_VALUE_LOOKUP || intent == QueryIntent.TEMPORAL_QUERY);
        plan.setRequiresTemporal(intent == QueryIntent.TEMPORAL_QUERY || intent == QueryIntent.HISTORICAL_RECALL);

        return plan;
    }

    private boolean hasTopicShiftTerms(String lower) {
        return containsAny(lower, "earlier", "before", "previously", "last time", "told you",
                "remember", "you said", "when", "changed", "update", "used to", "anymore",
                "budget", "salary", "goal", "want to", "prefer", "background", "degree");
    }

    private boolean containsAny(String text, String... terms) {
        for (String term : terms) {
            if (text.contains(term)) return true;
        }
        return false;
    }
}
