import React, { useState, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { CareerContextCapsule } from "../types";
import { Briefcase, X, Save, RotateCcw, Check, Sparkles } from "lucide-react";

export const CareerContextModal: React.FC = () => {
  const { isCareerContextOpen, setCareerContextOpen, currentConversation, updateCurrentConversationSettings } = useTokenLab();

  const [form, setForm] = useState<CareerContextCapsule>({
    goal: "",
    currentStage: "",
    targetRole: "",
    education: "",
    keySkills: "",
    location: "",
    timeline: "",
    constraints: "",
    preferences: "",
    decisions: "",
    openQuestions: "",
  });

  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (currentConversation?.careerContext) {
      setForm({
        goal: currentConversation.careerContext.goal || (currentConversation.careerContext as any).Goal || "",
        currentStage: currentConversation.careerContext.currentStage || (currentConversation.careerContext as any)["Current Stage"] || "",
        targetRole: currentConversation.careerContext.targetRole || (currentConversation.careerContext as any)["Target Role"] || "",
        education: currentConversation.careerContext.education || (currentConversation.careerContext as any).Education || "",
        keySkills: currentConversation.careerContext.keySkills || (currentConversation.careerContext as any)["Key Skills"] || "",
        location: currentConversation.careerContext.location || (currentConversation.careerContext as any).Location || "",
        timeline: currentConversation.careerContext.timeline || (currentConversation.careerContext as any).Timeline || "",
        constraints: currentConversation.careerContext.constraints || (currentConversation.careerContext as any).Constraints || "",
        preferences: currentConversation.careerContext.preferences || (currentConversation.careerContext as any).Preferences || "",
        decisions: currentConversation.careerContext.decisions || (currentConversation.careerContext as any).Decisions || "",
        openQuestions: currentConversation.careerContext.openQuestions || (currentConversation.careerContext as any)["Open Questions"] || "",
      });
    }
  }, [currentConversation]);

  if (!isCareerContextOpen) return null;

  const estimatedTokens = Math.max(
    0,
    Math.ceil(
      Object.values(form)
        .filter(Boolean)
        .join(" ").length * 0.28
    )
  );

  const handleSave = () => {
    updateCurrentConversationSettings({ careerContext: form });
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      setCareerContextOpen(false);
    }, 800);
  };

  const handleClear = () => {
    const empty = {
      goal: "",
      currentStage: "",
      targetRole: "",
      education: "",
      keySkills: "",
      location: "",
      timeline: "",
      constraints: "",
      preferences: "",
      decisions: "",
      openQuestions: "",
    };
    setForm(empty);
    updateCurrentConversationSettings({ careerContext: empty });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="career-context-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Career Context Capsule</h2>
              <p className="text-xs text-slate-500">Structured user career parameters (Only populated fields are sent to Gemini)</p>
            </div>
          </div>

          <button
            onClick={() => setCareerContextOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Token Cost Pill */}
        <div className="px-4 py-2 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between text-xs text-sky-900 font-medium">
          <span>
            Capsule Token Footprint: <strong>~{estimatedTokens} tokens</strong>
          </span>
          <span className="text-[11px] text-sky-700">Injected stably for Gemini implicit cache hits</span>
        </div>

        {/* Form Fields */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Career Goal / Ambition</label>
              <input
                type="text"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="e.g., Transition from IT Helpdesk to SOC Analyst Tier 1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target Role Title</label>
              <input
                type="text"
                value={form.targetRole}
                onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                placeholder="e.g., Junior Security Operations Center Analyst"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Current Stage / Experience</label>
              <input
                type="text"
                value={form.currentStage}
                onChange={(e) => setForm({ ...form, currentStage: e.target.value })}
                placeholder="e.g., 2 years desktop support, CompTIA Network+"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Key Verified Skills</label>
              <input
                type="text"
                value={form.keySkills}
                onChange={(e) => setForm({ ...form, keySkills: e.target.value })}
                placeholder="e.g., TCP/IP, Linux basics, Active Directory, Wireshark"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Study Timeline</label>
              <input
                type="text"
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                placeholder="e.g., 6-9 months part-time (10 hrs/week)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Budget / Constraints</label>
              <input
                type="text"
                value={form.constraints}
                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                placeholder="e.g., Budget under $1,000; self-paced online only"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Decisions Already Made</label>
            <textarea
              rows={2}
              value={form.decisions}
              onChange={(e) => setForm({ ...form, decisions: e.target.value })}
              placeholder="e.g., Decided on CompTIA Security+ first before attempting CySA+"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-500 resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Capsule</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCareerContextOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-career-capsule"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savedNotice ? "Saved!" : "Save Capsule"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
