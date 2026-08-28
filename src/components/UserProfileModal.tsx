import React, { useState, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { X, User, MapPin, Plus, Trash2, Pencil, Check, Heart, ThumbsDown, AlertTriangle } from "lucide-react";

type Category = "general" | "like" | "dislike";

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  general: { label: "Facts", color: "emerald", dot: "bg-emerald-500", icon: <User className="w-3.5 h-3.5 text-emerald-600" /> },
  like: { label: "Likes", color: "sky", dot: "bg-sky-500", icon: <Heart className="w-3.5 h-3.5 text-sky-600" /> },
  dislike: { label: "Dislikes", color: "rose", dot: "bg-rose-500", icon: <ThumbsDown className="w-3.5 h-3.5 text-rose-600" /> },
};

export const UserProfileModal: React.FC = () => {
  const {
    isProfileOpen, setProfileOpen,
    userProfile, setUserProfile,
    userLocation, setUserLocation,
    userContradictions, setUserContradictions,
  } = useTokenLab();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("general");
  const [locationDraft, setLocationDraft] = useState(userLocation);
  // Keep draft in sync when location is set externally (e.g. LocationPromptModal on first load)
  useEffect(() => { setLocationDraft(userLocation); }, [userLocation]);
  const [activeTab, setActiveTab] = useState<"profile" | "contradictions">("profile");

  if (!isProfileOpen) return null;

  const saveFacts = (facts: typeof userProfile) => {
    setUserProfile(facts);
    try { localStorage.setItem("yuzee_user_profile", JSON.stringify(facts)); } catch {}
  };

  const addFact = () => {
    const text = newFact.trim();
    if (!text) return;
    saveFacts([...userProfile, { id: `fact-${Date.now()}`, text, category: newCategory, addedAt: Date.now() }]);
    setNewFact("");
  };

  const deleteFact = (id: string) => saveFacts(userProfile.filter(f => f.id !== id));

  const saveEdit = () => {
    const text = editingText.trim();
    if (!text || !editingId) { setEditingId(null); return; }
    saveFacts(userProfile.map(f => f.id === editingId ? { ...f, text } : f));
    setEditingId(null);
  };

  const saveLocation = () => {
    setUserLocation(locationDraft);
    try { localStorage.setItem("yuzee_user_location", locationDraft); } catch {}
  };

  const resolveContradiction = (id: string) => {
    const updated = userContradictions.map(c => c.id === id ? { ...c, resolved: true } : c);
    setUserContradictions(updated);
    try { localStorage.setItem("yuzee_contradictions", JSON.stringify(updated)); } catch {}
  };

  const dismissContradiction = (id: string) => {
    const updated = userContradictions.filter(c => c.id !== id);
    setUserContradictions(updated);
    try { localStorage.setItem("yuzee_contradictions", JSON.stringify(updated)); } catch {}
  };

  const factionsByCategory = (cat: Category) => userProfile.filter(f => (f.category || "general") === cat);
  const unresolvedContra = userContradictions.filter(c => !c.resolved);

  const FactList: React.FC<{ cat: Category }> = ({ cat }) => {
    const facts = factionsByCategory(cat);
    const cfg = CATEGORY_CONFIG[cat];
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          {cfg.icon}
          {cfg.label} <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-normal">{facts.length}</span>
        </label>
        {facts.length === 0 && (
          <p className="text-[11px] text-slate-400 py-2">None yet — learned automatically from conversations.</p>
        )}
        {facts.map(fact => (
          <div key={fact.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 group">
            {editingId === fact.id ? (
              <>
                <input
                  autoFocus
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 text-xs px-2 py-1 rounded border border-sky-400 focus:ring-1 focus:ring-sky-200 outline-none"
                />
                <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="flex-1 text-xs text-slate-800">{fact.text}</span>
                <button onClick={() => { setEditingId(fact.id); setEditingText(fact.text); }} className="p-1 text-slate-400 hover:text-sky-600 rounded opacity-0 group-hover:opacity-100 cursor-pointer"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => deleteFact(fact.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Profile</h2>
              <p className="text-[11px] text-slate-500">What Oala has learned about you</p>
            </div>
          </div>
          <button onClick={() => setProfileOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0">
          {[
            { key: "profile", label: "Profile" },
            { key: "contradictions", label: `Contradictions${unresolvedContra.length > 0 ? ` (${unresolvedContra.length})` : ""}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === tab.key ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "profile" ? (
            <>
              {/* Location */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  Your Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={locationDraft}
                    onChange={e => setLocationDraft(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveLocation()}
                    placeholder="e.g. London, UK"
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                  <button onClick={saveLocation} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer">Save</button>
                </div>
                <p className="text-[11px] text-slate-400">Injected into each message for local context.</p>
              </div>

              {/* Facts grouped by category */}
              {(["general", "like", "dislike"] as Category[]).map(cat => (
                <FactList key={cat} cat={cat} />
              ))}

              {/* Add manually */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-600">Add manually</label>
                <div className="flex gap-2">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as Category)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-slate-300 focus:border-sky-400 outline-none bg-white cursor-pointer"
                  >
                    <option value="general">Fact</option>
                    <option value="like">Like</option>
                    <option value="dislike">Dislike</option>
                  </select>
                  <input
                    type="text"
                    value={newFact}
                    onChange={e => setNewFact(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addFact()}
                    placeholder="Add a fact, like, or dislike…"
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
                  />
                  <button onClick={addFact} className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {userProfile.length > 0 && (
                <button onClick={() => saveFacts([])} className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer">
                  Clear all facts
                </button>
              )}
            </>
          ) : (
            /* Contradictions tab */
            <div className="space-y-3">
              {userContradictions.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-4 text-center">No contradictions detected yet.</p>
              ) : (
                <>
                  {unresolvedContra.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Oala detected conflicts between what you said and stored facts. Resolve to keep your profile accurate.</span>
                    </div>
                  )}
                  {userContradictions.map(c => (
                    <div key={c.id} className={`p-3 rounded-xl border space-y-2 ${c.resolved ? "opacity-50 bg-slate-50 border-slate-200" : "bg-rose-50 border-rose-200"}`}>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Stored fact</p>
                        <p className="text-xs text-slate-800">{c.fact}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide">You said</p>
                        <p className="text-xs text-slate-800">{c.contradiction}</p>
                      </div>
                      {!c.resolved && (
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => resolveContradiction(c.id)} className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 text-white rounded-lg cursor-pointer hover:bg-slate-700">
                            Mark resolved
                          </button>
                          <button onClick={() => dismissContradiction(c.id)} className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
                            Dismiss
                          </button>
                        </div>
                      )}
                      {c.resolved && <p className="text-[10px] text-slate-400">Resolved</p>}
                    </div>
                  ))}
                  {userContradictions.some(c => c.resolved) && (
                    <button
                      onClick={() => {
                        const updated = userContradictions.filter(c => !c.resolved);
                        setUserContradictions(updated);
                        try { localStorage.setItem("yuzee_contradictions", JSON.stringify(updated)); } catch {}
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear resolved
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
