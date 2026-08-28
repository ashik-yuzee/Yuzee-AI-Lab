import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { OptimizationMode } from "../types";
import {
  Sparkles,
  Cpu,
  FlaskConical,
  Menu,
  Activity,
  Settings,
  User,
  Network,
} from "lucide-react";
import { AppleSelect, AppleSelectOption } from "./ui/AppleSelect";
import { GEMINI_MODELS, calcTurnCost, formatCost } from "../data/models";

export const Navbar: React.FC = () => {
  const {
    currentConversation,
    selectedModel,
    capabilities,
    updateCurrentConversationSettings,
    applyOptimizationMode,
    isAdvancedLabOpen,
    setAdvancedLabOpen,
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
    sessionStats,
  } = useTokenLab();

  const currentMode: OptimizationMode = (currentConversation?.mode as OptimizationMode) || "AUTO";

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
      value: "AUTO",
      label: "Auto (Balanced)",
      description: "Dynamic budget, prefix caching, adaptive thinking",
      badge: "Default",
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

  // Conversation total cost — sum across all assistant messages
  const convTotalCost = (currentConversation?.messages || []).reduce((sum, m) => {
    if (m.role !== "assistant" || !m.telemetry?.usage || !m.telemetry?.model) return sum;
    return sum + (calcTurnCost(m.telemetry.model, m.telemetry.usage) ?? 0);
  }, 0);

  return (
    <header id="main-header" className="h-14 border-b border-slate-200 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand & Mobile Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          id="btn-toggle-sidebar"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-hidden cursor-pointer"
          title="Toggle Navigation"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-xs">
            <span className="text-sm font-semibold tracking-tight">Y</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 tracking-tight text-sm">Yuzee AI</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded">
                Token Lab
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Clean Selectors (Model + Optimization Mode + Lab Button) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Apple Model Selector Dropdown */}
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

        {/* 3 Simple Optimization Modes */}
        <div className="hidden sm:block">
          <AppleSelect
            id="select-optimization-mode"
            value={currentMode}
            options={modeOptions}
            onChange={(newMode) => applyOptimizationMode(newMode as OptimizationMode)}
            leadingIcon={Sparkles}
            compact
            popoverWidth="w-72 sm:w-84"
            showSearchThreshold={10}
          />
        </div>

        {/* Lab Trigger Button */}
        <button
          id="btn-open-lab"
          onClick={() => setAdvancedLabOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-2xs cursor-pointer ${
            isAdvancedLabOpen
              ? "bg-indigo-50 border-indigo-300 text-indigo-800 font-semibold"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
          }`}
          title="Open Lab (Context, Thinking, Memory Capsule, Benchmark, Traces)"
          aria-label="Open Lab"
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
          <span>Lab</span>
        </button>
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

        {convTotalCost > 0 && (
          <span
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold"
            title="Estimated cost for this conversation only (not the full session). Session totals are in the sidebar."
          >
            <span className="font-normal text-emerald-600 text-[10px]">Chat</span>
            {formatCost(convTotalCost)}
          </span>
        )}

        {/* Whiteboard toggle */}
        <button
          id="btn-toggle-whiteboard"
          onClick={() => { setWhiteboardOpen(!isWhiteboardOpen); if (!isWhiteboardOpen) setTokenInspectorOpen(false); }}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isWhiteboardOpen
              ? "bg-violet-50 border-violet-300 text-violet-700"
              : "bg-white border-slate-200 text-slate-500 hover:text-violet-700 hover:bg-violet-50 hover:border-violet-200"
          }`}
          title="Pathway Whiteboard"
          aria-label="Pathway Whiteboard"
        >
          <Network className="w-4 h-4" />
        </button>

        <button
          id="btn-header-telemetry-pill"
          onClick={() => { setTokenInspectorOpen(!isTokenInspectorOpen); if (!isTokenInspectorOpen) setWhiteboardOpen(false); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
            isTokenInspectorOpen
              ? "bg-sky-50 border-sky-300 text-sky-900 font-semibold shadow-xs"
              : "bg-slate-50 hover:bg-white border-slate-200 text-slate-700 hover:border-sky-300"
          }`}
          title="Click to view full turn & session telemetry diagnostics"
          aria-label="Token Telemetry"
        >
          <Activity className="w-3.5 h-3.5 text-sky-600" />
          <span className="text-[11px]">
            {cachedTokens > 0 ? <>⚡ <strong>{inputTokens}</strong> new</> : <>In <strong>{inputTokens}</strong></>}
            {" "}· Out <strong>{outputTokens}</strong>
          </span>
        </button>
      </div>
    </header>
  );
};
