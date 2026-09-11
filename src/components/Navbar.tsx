import React, { useState, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { OptimizationMode } from "../types";
import {
  Sparkles,
  Cpu,
  Menu,
  Activity,
  Settings,
  User,
  Network,
  FileJson,
  Wrench,
} from "lucide-react";
import { AppleSelect, AppleSelectOption } from "./ui/AppleSelect";
import { GEMINI_MODELS, calcTurnCost, formatCost } from "../data/models";

export const Navbar: React.FC<{ onOpenRenderer?: () => void }> = ({ onOpenRenderer }) => {
  const {
    currentConversation,
    selectedModel,
    capabilities,
    updateCurrentConversationSettings,
    applyOptimizationMode,
    isSidebarOpen,
    setSidebarOpen,
    isTokenInspectorOpen,
    setTokenInspectorOpen,
    isWhiteboardOpen,
    setWhiteboardOpen,
    setSettingsOpen,
    setProfileOpen,
    userProfile,
    userContradictions,
    activeTurnTelemetry,
    setAdvancedLabOpen,
    setActiveLabTab,
  } = useTokenLab();

  const currentMode: OptimizationMode = (currentConversation?.mode as OptimizationMode) || "AUTO";
  const [localMode, setLocalMode] = useState<OptimizationMode | null>(null);
  const displayMode = localMode ?? currentMode;
  // Reset local override when switching conversations
  useEffect(() => { setLocalMode(null); }, [currentConversation?.id]);

  // Server-driven model registry
  const availableList = capabilities?.modelsList?.length ? capabilities.modelsList : GEMINI_MODELS;

  const modelOptions: AppleSelectOption[] = availableList
    .filter((m) => m.selectable !== false && m.status !== "retired")
    .map((m) => {
      let group = m.categoryGroup || "Current Models";
      let badge = m.badge;
      let badgeColor: "emerald" | "blue" | "amber" | "purple" | "slate" = "blue";

      if (m.isDefault) {
        badge = "Default";
        badgeColor = "emerald";
      } else if (m.isRecommended) {
        badge = "Recommended";
        badgeColor = "blue";
      } else if (m.id === "gemini-3.7-flash") {
        badge = "Latest";
        badgeColor = "purple";
      } else if (m.family === "flash-lite") {
        badge = badge || "Fast";
        badgeColor = "amber";
      } else if (m.family === "legacy") {
        badge = badge || "Legacy";
        badgeColor = "slate";
      }

      return {
        value: m.id,
        label: m.name,
        description: m.shortDescription || m.longDescription || "",
        group,
        badge,
        badgeColor,
      };
    });

  const modeOptions: AppleSelectOption[] = [
    {
      value: "VANILLA",
      label: "Vanilla (AI Studio)",
      description: "No optimisation, no compaction, 8192 token output cap",
      badge: "Default",
      badgeColor: "purple",
    },
    {
      value: "AUTO",
      label: "Auto (Balanced)",
      description: "Dynamic budget, prefix caching, adaptive thinking",
      badge: "Adaptive",
      badgeColor: "blue",
    },
    {
      value: "SAVE_TOKENS",
      label: "Save Tokens (Aggressive)",
      description: "Compaction after 2 turns, 1,000 token budget",
      badge: "Economical",
      badgeColor: "emerald",
    },
    {
      value: "FULL_CONTEXT",
      label: "Full Context (Baseline)",
      description: "Sends entire history without compression",
      badge: "Baseline",
      badgeColor: "slate",
    },
  ];

  // Latest turn telemetry — show uncached input when cache is active
  const rawInput = activeTurnTelemetry?.usage?.inputTokens || 0;
  const cachedTokens = activeTurnTelemetry?.usage?.cachedTokens || 0;
  const uncachedInput = activeTurnTelemetry?.usage?.uncachedInputTokens ?? (rawInput - cachedTokens);
  const inputTokens = cachedTokens > 0 ? uncachedInput : rawInput;
  const outputTokens = activeTurnTelemetry?.usage?.outputTokens || 0;

  // Conversation total cost — sum across all assistant messages; fallback model to conv model
  const convTotalCost = (currentConversation?.messages || []).reduce((sum, m) => {
    if (m.role !== "assistant" || !m.telemetry?.usage) return sum;
    const model = m.telemetry?.model || currentConversation?.model || "";
    if (!model) return sum;
    return sum + (calcTurnCost(model, m.telemetry.usage) ?? 0);
  }, 0);
  const hasAssistantMsg = (currentConversation?.messages || []).some(m => m.role === "assistant");

  return (
    <header id="main-header" className="h-14 border-b border-[#e6e9ee] bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30" style={{ boxShadow: "0 1px 0 #e6e9ee" }}>
      {/* Left: Brand & Mobile Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          id="btn-toggle-sidebar"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden cursor-pointer"
          title="Toggle Navigation"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

      </div>

      {/* Middle: Selectors + actions — hidden entirely on mobile, visible md+ */}
      <div className="hidden md:flex items-center gap-2">
        <AppleSelect
          id="select-model"
          value={currentConversation?.model || selectedModel}
          options={modelOptions}
          onChange={(newModel) => updateCurrentConversationSettings({ model: newModel })}
          leadingIcon={Cpu}
          compact
          popoverWidth="w-80 sm:w-96"
          showSearchThreshold={5}
        />

        <AppleSelect
          id="select-optimization-mode"
          value={displayMode}
          options={modeOptions}
          onChange={(newMode) => { setLocalMode(newMode as OptimizationMode); applyOptimizationMode(newMode as OptimizationMode); }}
          leadingIcon={Sparkles}
          compact
          popoverWidth="w-72 sm:w-84"
          showSearchThreshold={10}
        />

        <button
          id="btn-pathway"
          onClick={() => { setWhiteboardOpen(!isWhiteboardOpen); if (!isWhiteboardOpen) setTokenInspectorOpen(false); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-2xs cursor-pointer ${
            isWhiteboardOpen
              ? "bg-violet-50 border-violet-300 text-violet-800 font-semibold"
              : "bg-white border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"
          }`}
          title={isWhiteboardOpen ? "Close pathway" : "Open pathway"}
        >
          <Network className="w-3.5 h-3.5 text-violet-600" />
          <span>Pathway</span>
        </button>

        <button
          id="btn-renderer"
          onClick={onOpenRenderer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
          title="Protocol v1.3 Renderer"
        >
          <FileJson className="w-3.5 h-3.5 text-slate-500" />
          <span>Renderer</span>
        </button>

        <button
          id="btn-lab"
          onClick={() => { setAdvancedLabOpen(true); setActiveLabTab("context"); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
          title="Lab Tools"
        >
          <Wrench className="w-3.5 h-3.5 text-slate-500" />
          <span>Lab</span>
        </button>
      </div>

      {/* Mobile-only: model selector */}
      <div className="md:hidden">
        <AppleSelect
          id="select-model-mobile"
          value={currentConversation?.model || selectedModel}
          options={modelOptions}
          onChange={(newModel) => updateCurrentConversationSettings({ model: newModel })}
          leadingIcon={Cpu}
          compact
          popoverWidth="w-72"
          showSearchThreshold={5}
        />
      </div>

      {/* Right: Settings + Conv Cost + Telemetry Pill */}
      <div className="flex items-center gap-2">
        <button
          id="btn-open-profile"
          onClick={() => setProfileOpen(true)}
          className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
          title="User Profile — facts Oala learns about you"
          aria-label="User Profile"
        >
          <User className="w-4 h-4" />
          {(userProfile.length > 0 || (userContradictions || []).some((c: any) => !c.resolved)) && (
            <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none ${(userContradictions || []).some((c: any) => !c.resolved) ? "bg-amber-500" : "bg-emerald-500"}`}>
              {(userContradictions || []).some((c: any) => !c.resolved) ? "!" : userProfile.length > 9 ? "9+" : userProfile.length}
            </span>
          )}
        </button>

        <button
          id="btn-open-settings"
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
          title="App Settings (storage, API status)"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {hasAssistantMsg && (
          <span
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold"
            title="Estimated cost for this conversation. All-conversation totals are in the Overall Telemetry sidebar."
          >
            <span className="font-normal text-emerald-600 text-[10px]">Conv</span>
            {formatCost(convTotalCost)}
          </span>
        )}


        <button
          id="btn-header-telemetry-pill"
          onClick={() => { setTokenInspectorOpen(!isTokenInspectorOpen); if (!isTokenInspectorOpen) setWhiteboardOpen(false); }}
          className={`w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center sm:justify-start sm:gap-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
            isTokenInspectorOpen
              ? "bg-[var(--accent)]/5 border-[var(--accent)]/30 text-[var(--accent)] font-semibold"
              : "bg-[#f7f8fa] hover:bg-white border-[#e6e9ee] text-[#5b6472] hover:border-[var(--accent)]/30"
          }`}
          title="Conversation Telemetry — click to view full turn & context diagnostics"
          aria-label="Conversation Telemetry"
        >
          <Activity className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent)]" />
          <span className="hidden sm:inline text-[11px]">
            {cachedTokens > 0 ? <>⚡ <strong>{inputTokens}</strong> new</> : <>In <strong>{inputTokens}</strong></>}
            {" "}· Out <strong>{outputTokens}</strong>
          </span>
        </button>
      </div>
    </header>
  );
};
