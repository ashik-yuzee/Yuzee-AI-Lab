package com.yuzee.tokenlab.service.semantic;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LexicalSemanticSimilarityService implements SemanticSimilarityService {

    @Override
    public double similarity(String a, String b) {
        Set<String> tokA = tokenize(a);
        Set<String> tokB = tokenize(b);
        if (tokA.isEmpty() && tokB.isEmpty()) return 0.0;
        Set<String> intersection = new HashSet<>(tokA);
        intersection.retainAll(tokB);
        Set<String> union = new HashSet<>(tokA);
        union.addAll(tokB);
        return (double) intersection.size() / union.size();
    }

    @Override
    public double centroidCohesion(List<String> texts) {
        if (texts == null || texts.size() < 2) return 1.0;
        int count = 0;
        double total = 0.0;
        for (int i = 0; i < texts.size(); i++) {
            for (int j = i + 1; j < texts.size(); j++) {
                total += similarity(texts.get(i), texts.get(j));
                count++;
            }
        }
        return count == 0 ? 1.0 : total / count;
    }

    private Set<String> tokenize(String text) {
        if (text == null || text.isEmpty()) return new HashSet<>();
        return Arrays.stream(text.toLowerCase().split("[^a-z0-9]+"))
                .filter(t -> t.length() >= 2)
                .collect(Collectors.toSet());
    }
}
