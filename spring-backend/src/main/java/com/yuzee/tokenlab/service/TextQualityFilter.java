package com.yuzee.tokenlab.service;

import org.apache.tika.langdetect.optimaize.OptimaizeLangDetector;
import org.apache.tika.language.detect.LanguageDetector;
import org.apache.tika.language.detect.LanguageResult;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.regex.Pattern;

@Component
public class TextQualityFilter {

    private static final Pattern PURE_SYMBOLS = Pattern.compile("^[^a-z0-9]+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern REPEATED_CHAR = Pattern.compile("(.)\\1{4,}");
    private static final String[] KEYBOARD_ROWS = {"qwertyuiop", "asdfghjkl", "zxcvbnm"};

    private final LanguageDetector detector;

    public TextQualityFilter() {
        try {
            detector = new OptimaizeLangDetector().loadModels();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load language detection models", e);
        }
    }

    public boolean isRubbish(String input) {
        if (input == null || input.isBlank()) return true;
        String t = input.trim().toLowerCase();
        if (t.length() < 2) return true;

        if (PURE_SYMBOLS.matcher(t).matches()) return true;
        if (REPEATED_CHAR.matcher(t).find()) return true;

        for (String row : KEYBOARD_ROWS) {
            for (int i = 0; i <= row.length() - 5; i++) {
                String sub = row.substring(i, i + 5);
                if (t.contains(sub)) return true;
                String rev = new StringBuilder(sub).reverse().toString();
                if (t.contains(rev)) return true;
            }
        }

        // Single keyword with no context — no career value regardless of language
        if (!t.contains(" ")) return true;

        // Language detection via Tika/Optimaize — only English passes
        LanguageResult result = detector.detect(t);
        if (result == null || !result.isReasonablyCertain()) return true;
        if (!"en".equals(result.getLanguage())) return true;

        return false;
    }
}
