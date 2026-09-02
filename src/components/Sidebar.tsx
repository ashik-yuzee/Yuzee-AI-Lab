import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import * as api from "../services/api";
import { calcTurnCost, formatCost } from "../data/models";
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
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
    updateCurrentConversationSettings,
    sessionStats,
    resetSessionStats,
    isSidebarOpen,
    setSidebarOpen,
    setAdvancedLabOpen,
    setActiveLabTab,
  } = useTokenLab();

  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handleOpenLab = (tab = "context") => {
    setActiveLabTab(tab);
    setAdvancedLabOpen(true);
    setSidebarOpen(false);
  };

  const savedTokens = sessionStats?.tokensSaved || 0;
  const grossInputTokens = sessionStats?.totalModelInputTokens ?? 0;
  const cachedTokens = sessionStats?.totalCachedTokens ?? 0;
  const outputTokens = sessionStats?.totalModelOutputTokens || 0;
  // Show only new uncached tokens — cached reads are a separate (cheaper) cost
  const inputTokens = sessionStats?.totalUncachedInputTokens
    ?? Math.max(0, grossInputTokens - cachedTokens);

  // Session total cost from all assistant messages across all conversations
  const sessionTotalCost = conversations.reduce((sum, conv) => {
    return sum + (conv.messages || []).reduce((s, m) => {
      if (m.role !== "assistant" || !m.telemetry?.usage || !m.telemetry?.model) return s;
      const c = calcTurnCost(m.telemetry.model, m.telemetry.usage);
      return s + (c ?? 0);
    }, 0);
  }, 0);

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
        className={`fixed lg:relative top-0 bottom-0 left-0 z-50 shrink-0 overflow-hidden transition-all duration-200 ease-in-out ${
          isSidebarOpen ? "w-72" : "w-0"
        }`}
      >
      <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
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
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
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
                  <div className="flex items-center gap-2 min-w-0 pr-14">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-sky-600" : "text-slate-400"}`} />
                    <div className="truncate min-w-0 flex-1">
                      {editingId === conv.id ? (
                        <input
                          className="w-full text-xs font-medium bg-white border border-sky-400 rounded px-1 py-0.5 outline-none"
                          value={editingTitle}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => {
                            const trimmed = editingTitle.trim();
                            if (trimmed) {
                              if (isSelected) updateCurrentConversationSettings({ title: trimmed });
                              else api.updateConversation(conv.id, { title: trimmed });
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const trimmed = editingTitle.trim();
                              if (trimmed) {
                                if (isSelected) updateCurrentConversationSettings({ title: trimmed });
                                else api.updateConversation(conv.id, { title: trimmed });
                              }
                              setEditingId(null);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span className="truncate block font-medium">{conv.title || "Career Exploration"}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {conv.model?.replace("gemini-", "") || "3.6-flash"} · {conv.thinkingLevel || "adaptive"} · {Math.floor(msgCount / 2)} exchanges
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditingTitle(conv.title || "Career Exploration");
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Rename Conversation"
                      aria-label="Rename Conversation"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
            <span className="text-[11px] font-semibold uppercase text-slate-600" title="Token counts reset when you click Reset. Cost covers all conversations in this browser session.">Session Telemetry</span>
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
            <span title="New uncached tokens — billed at full input rate">In <strong>{inputTokens > 1000 ? `${(inputTokens/1000).toFixed(1)}k` : inputTokens}</strong></span>
            {cachedTokens > 0 && (
              <span className="text-emerald-700" title={`Cumulative cache reads across all turns this session (≈${Math.round(cachedTokens / Math.max(1, sessionStats?.userFacingChatCalls ?? 1)).toLocaleString()} tokens/turn from cached system prompt) — billed at ~4× lower rate`}>⚡ <strong>{cachedTokens > 1000 ? `${(cachedTokens/1000).toFixed(1)}k` : cachedTokens}</strong> reads</span>
            )}
            <span title="Text output tokens — excludes thinking tokens (counted separately in Session Total)">Out <strong>{outputTokens > 1000 ? `${(outputTokens/1000).toFixed(1)}k` : outputTokens}</strong></span>
            {!cachedTokens && <span className="text-emerald-700">Saved <strong>{savedTokens > 1000 ? `${(savedTokens/1000).toFixed(1)}k` : savedTokens}</strong></span>}
          </div>
          {sessionTotalCost > 0 && (
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
              <span title="Sum of all conversations in this browser session. Unlike token counts above, this does not reset with the Reset button.">All chats cost</span>
              <span className="text-emerald-700 font-semibold">{formatCost(sessionTotalCost)}</span>
            </div>
          )}
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
