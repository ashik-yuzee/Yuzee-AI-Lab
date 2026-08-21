import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import {
  Plus,
  MessageSquare,
  Trash2,
  RotateCcw,
  X,
  PlayCircle,
} from "lucide-react";
import { AppleConfirmDialog } from "./ui/AppleConfirmDialog";

export const Sidebar: React.FC = () => {
  const {
    conversations,
    currentConversation,
    selectConversation,
    startNewConversation,
    loadDemoConversation,
    removeConversation,
    sessionStats,
    resetSessionStats,
    isSidebarOpen,
    setSidebarOpen,
    setAdvancedLabOpen,
    setActiveLabTab,
  } = useTokenLab();

  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null);

  const handleOpenLab = (tab = "context") => {
    setActiveLabTab(tab);
    setAdvancedLabOpen(true);
    setSidebarOpen(false);
  };

  const savedTokens = sessionStats?.tokensSaved || 0;
  const inputTokens = sessionStats?.totalModelInputTokens || 0;
  const outputTokens = sessionStats?.totalModelOutputTokens || 0;

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header / Action Buttons */}
        <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <button
              id="btn-new-chat"
              onClick={() => {
                startNewConversation();
                setSidebarOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>

            <button
              id="btn-close-sidebar"
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md lg:hidden"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            id="btn-load-demo"
            onClick={() => {
              loadDemoConversation();
              setSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Load sample Cybersecurity Analyst pathway with prefilled structured memory"
          >
            <PlayCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>Load Demo Pathway</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Conversations
          </div>

          {conversations.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8 px-4 space-y-2">
              <p className="font-medium text-slate-600">No active conversations</p>
              <p className="text-[11px] text-slate-400">
                Click &quot;New Conversation&quot; or load the demo pathway to begin exploring.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = currentConversation?.id === conv.id;
              const msgCount = conv.messages?.length || 0;
              return (
                <div
                  key={conv.id}
                  id={`conv-item-${conv.id}`}
                  onClick={() => {
                    selectConversation(conv.id);
                    setSidebarOpen(false);
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "bg-white text-sky-900 font-medium shadow-xs border border-slate-200"
                      : "text-slate-700 hover:bg-slate-200/50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-6">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-sky-600" : "text-slate-400"}`} />
                    <div className="truncate">
                      <span className="truncate block font-medium">{conv.title || "Career Exploration"}</span>
                      <span className="text-[10px] text-slate-500 block">
                        {conv.model?.replace("gemini-", "") || "3.6-flash"} · {msgCount} turns
                      </span>
                    </div>
                  </div>

                  <button
                    id={`btn-delete-conv-${conv.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversationToDelete({ id: conv.id, title: conv.title || "Career Exploration" });
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                    title="Delete Conversation"
                    aria-label="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Compact Session Usage Footer */}
        <div
          onClick={() => handleOpenLab("analytics")}
          className="p-3 border-t border-slate-200 bg-slate-100/90 hover:bg-slate-200/60 transition-colors cursor-pointer"
          title="Click to view detailed session analytics and token attribution charts"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase text-slate-600">Session Telemetry</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetSessionStats();
              }}
              className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
              title="Reset Session Counters"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-700 flex items-center justify-between">
            <span>In <strong>{inputTokens > 1000 ? `${(inputTokens/1000).toFixed(1)}k` : inputTokens}</strong></span>
            <span>Out <strong>{outputTokens > 1000 ? `${(outputTokens/1000).toFixed(1)}k` : outputTokens}</strong></span>
            <span className="text-emerald-700">Saved <strong>{savedTokens > 1000 ? `${(savedTokens/1000).toFixed(1)}k` : savedTokens}</strong></span>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      <AppleConfirmDialog
        isOpen={!!conversationToDelete}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${conversationToDelete?.title}"? All turns and associated memory compaction history will be removed.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (conversationToDelete) {
            removeConversation(conversationToDelete.id);
            setConversationToDelete(null);
          }
        }}
        onCancel={() => setConversationToDelete(null)}
      />
    </>
  );
};
