import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { Download, X, FileJson, FileSpreadsheet, ShieldCheck, Check } from "lucide-react";

export const ExportModal: React.FC = () => {
  const { isExportOpen, setExportOpen, currentConversation, conversations, sessionStats } = useTokenLab();
  const [includeRawText, setIncludeRawText] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isExportOpen) return null;

  const exportData = conversations.map((conv) => ({
    conversationId: conv.id,
    title: conv.title,
    model: conv.model,
    strategy: conv.strategy,
    preset: conv.preset,
    responseMode: conv.responseMode,
    thinkingLevel: conv.thinkingLevel,
    turnsCount: conv.messages?.length || 0,
    turns: conv.messages?.map((msg) => ({
      messageId: msg.id,
      role: msg.role,
      content: includeRawText ? msg.content : "[REDACTED_FOR_RESEARCH_PRIVACY]",
      usage: msg.telemetry?.usage || null,
      contextBreakdown: msg.telemetry?.contextMetrics || null,
      compactionEvent: msg.telemetry?.compactionMetrics || null,
      feedback: msg.feedback || null,
      timestamp: msg.createdAt,
    })),
    compactionHistory: conv.compactionHistory,
  }));

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify({ exportTimestamp: Date.now(), sessionStats, conversations: exportData }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yuzee-token-lab-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const rows: string[] = [
      [
        "ConversationId",
        "TurnId",
        "Role",
        "Model",
        "Strategy",
        "ThinkingLevel",
        "InputTokens",
        "OutputTokens",
        "ThinkingTokens",
        "CachedTokens",
        "TotalTokens",
        "LatencyMs",
        "Feedback",
        "Timestamp",
      ].join(","),
    ];

    conversations.forEach((conv) => {
      conv.messages?.forEach((msg) => {
        const u = msg.telemetry?.usage;
        rows.push(
          [
            conv.id,
            msg.id,
            msg.role,
            conv.model,
            conv.strategy,
            conv.thinkingLevel,
            u?.inputTokens ?? "",
            u?.outputTokens ?? "",
            u?.thinkingTokens ?? "",
            u?.cachedTokens ?? "",
            u?.totalTokens ?? "",
            u?.latencyMs ?? "",
            msg.feedback?.type ?? "",
            msg.createdAt,
          ].join(",")
        );
      });
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yuzee-token-telemetry-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="export-data-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-800">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Export Experiment Telemetry</h2>
              <p className="text-xs text-slate-500">Download token metrics for research and analysis</p>
            </div>
          </div>

          <button
            onClick={() => setExportOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Privacy Toggle (Rule #33) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-slate-900 text-xs">Research Privacy Mode</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRawText}
                  onChange={(e) => setIncludeRawText(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              {includeRawText
                ? "Include raw dialogue transcript text in the exported files."
                : "Default: Raw dialogue text is excluded from telemetry exports for safe academic/internal sharing."}
            </p>
          </div>

          {/* Export Options */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              id="btn-export-json"
              onClick={handleDownloadJSON}
              className="p-4 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 rounded-xl text-left space-y-2 transition-all group cursor-pointer shadow-2xs"
            >
              <FileJson className="w-6 h-6 text-sky-600 group-hover:scale-105 transition-transform" />
              <div>
                <span className="font-bold text-xs text-slate-900 block">JSON Export</span>
                <span className="text-[11px] text-slate-500">Full telemetry objects & context trees</span>
              </div>
            </button>

            <button
              id="btn-export-csv"
              onClick={handleDownloadCSV}
              className="p-4 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-xl text-left space-y-2 transition-all group cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 group-hover:scale-105 transition-transform" />
              <div>
                <span className="font-bold text-xs text-slate-900 block">CSV Export</span>
                <span className="text-[11px] text-slate-500">Turn-by-turn spreadsheet rows</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={() => setExportOpen(false)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
