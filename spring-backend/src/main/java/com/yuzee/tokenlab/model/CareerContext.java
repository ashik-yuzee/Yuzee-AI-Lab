package com.yuzee.tokenlab.model;

import java.util.HashMap;
import java.util.Map;

public class CareerContext {
    private String goal = "";
    private String currentStage = "";
    private String targetRole = "";
    private String education = "";
    private String keySkills = "";
    private String location = "";
    private String timeline = "";
    private String constraints = "";
    private String preferences = "";
    private String decisions = "";
    private String openQuestions = "";

    public CareerContext() {}

    public Map<String, String> getPopulatedFields() {
        Map<String, String> map = new HashMap<>();
        if (goal != null && !goal.isBlank()) map.put("Goal", goal.trim());
        if (currentStage != null && !currentStage.isBlank()) map.put("Current Stage", currentStage.trim());
        if (targetRole != null && !targetRole.isBlank()) map.put("Target Role", targetRole.trim());
        if (education != null && !education.isBlank()) map.put("Education", education.trim());
        if (keySkills != null && !keySkills.isBlank()) map.put("Key Skills", keySkills.trim());
        if (location != null && !location.isBlank()) map.put("Location", location.trim());
        if (timeline != null && !timeline.isBlank()) map.put("Timeline", timeline.trim());
        if (constraints != null && !constraints.isBlank()) map.put("Constraints", constraints.trim());
        if (preferences != null && !preferences.isBlank()) map.put("Preferences", preferences.trim());
        if (decisions != null && !decisions.isBlank()) map.put("Decisions Made", decisions.trim());
        if (openQuestions != null && !openQuestions.isBlank()) map.put("Open Questions", openQuestions.trim());
        return map;
    }

    public String toCompactPromptString() {
        Map<String, String> fields = getPopulatedFields();
        if (fields.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("YUZEE_CAREER_CONTEXT:\n");
        fields.forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append("\n"));
        return sb.toString().trim();
    }

    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }

    public String getCurrentStage() { return currentStage; }
    public void setCurrentStage(String currentStage) { this.currentStage = currentStage; }

    public String getTargetRole() { return targetRole; }
    public void setTargetRole(String targetRole) { this.targetRole = targetRole; }

    public String getEducation() { return education; }
    public void setEducation(String education) { this.education = education; }

    public String getKeySkills() { return keySkills; }
    public void setKeySkills(String keySkills) { this.keySkills = keySkills; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getTimeline() { return timeline; }
    public void setTimeline(String timeline) { this.timeline = timeline; }

    public String getConstraints() { return constraints; }
    public void setConstraints(String constraints) { this.constraints = constraints; }

    public String getPreferences() { return preferences; }
    public void setPreferences(String preferences) { this.preferences = preferences; }

    public String getDecisions() { return decisions; }
    public void setDecisions(String decisions) { this.decisions = decisions; }

    public String getOpenQuestions() { return openQuestions; }
    public void setOpenQuestions(String openQuestions) { this.openQuestions = openQuestions; }
}
