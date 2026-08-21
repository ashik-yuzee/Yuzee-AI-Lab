import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { OptimizationMode } from "../types";
import {
  Sparkles,
  Cpu,
  FlaskConical,
  Menu,
  Activity,
} from "lucide-react";
import { AppleSelect, AppleSelectOption } from "./ui/AppleSelect";
import { GEMINI_MODELS } from "../data/models";

export const Navbar: React.FC = () => {
  const {
    currentConversation,
    capabilities,
    updateCurrentConversationSettings,
    applyOptimizationMode,
    isAdvancedLabOpen,
    setAdvancedLabOpen,
    isSidebarOpen,
    setSidebarOpen,
    isTokenInspectorOpen,
    setTokenInspectorOpen,
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

      if (m.id === "gemini-3.7-flash") {
        badge = "Latest";
        badgeColor = "purple";
      } else if (m.id === "gemini-3.6-flash") {
        badge = "Recommended";
        badgeColor = "emerald";
      } else if (m.family === "flash-lite") {
        badge = badge || "Fast & Cheap";
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

  // Latest turn telemetry stats for collapsed header pill
  const inputTokens = activeTurnTelemetry?.usage?.inputTokens || 0;
  const outputTokens = activeTurnTelemetry?.usage?.outputTokens || 0;
  const tokensSaved = activeTurnTelemetry?.compactionMetrics?.tokensRemoved || 
    (sessionStats?.tokensSaved ? Math.min(sessionStats.tokensSaved, 99999) : 0);

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
          value={currentConversation?.model || "gemini-3.6-flash"}
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
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
          <span>Lab</span>
        </button>
      </div>

      {/* Right: Collapsed Telemetry Pill (In X · Out Y · Saved Z) */}
      <div className="flex items-center gap-2">
        <button
          id="btn-header-telemetry-pill"
          onClick={() => setTokenInspectorOpen(!isTokenInspectorOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
            isTokenInspectorOpen
              ? "bg-sky-50 border-sky-300 text-sky-900 font-semibold shadow-xs"
              : "bg-slate-50 hover:bg-white border-slate-200 text-slate-700 hover:border-sky-300"
          }`}
          title="Click to view full turn & session telemetry diagnostics"
        >
          <Activity className="w-3.5 h-3.5 text-sky-600" />
          <span className="text-[11px]">
            In <strong>{inputTokens}</strong> · Out <strong>{outputTokens}</strong>
            {tokensSaved > 0 && (
              <> · <span className="text-emerald-700">Saved <strong>{tokensSaved}</strong></span></>
            )}
          </span>
        </button>
      </div>
    </header>
  );
};
