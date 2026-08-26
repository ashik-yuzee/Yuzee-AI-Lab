import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { X, User, MapPin, Plus, Trash2, Pencil, Check } from "lucide-react";

export const UserProfileModal: React.FC = () => {
  const { isProfileOpen, setProfileOpen, userProfile, setUserProfile, userLocation, setUserLocation } = useTokenLab();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newFact, setNewFact] = useState("");
  const [locationDraft, setLocationDraft] = useState(userLocation);

  if (!isProfileOpen) return null;

  const saveFacts = (facts: typeof userProfile) => {
    setUserProfile(facts);
    try { localStorage.setItem("yuzee_user_profile", JSON.stringify(facts)); } catch {}
  };

  const addFact = () => {
    const text = newFact.trim();
    if (!text) return;
    saveFacts([...userProfile, { id: `fact-${Date.now()}`, text, addedAt: Date.now() }]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Profile</h2>
              <p className="text-[11px] text-slate-500">Facts Oala learns about you to give better advice</p>
            </div>
          </div>
          <button onClick={() => setProfileOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
              />
              <button
                onClick={saveLocation}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Injected into each message so responses use local context (jobs, salaries, certifications).</p>
          </div>

          {/* Facts */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Learned Facts <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-normal">{userProfile.length}</span>
            </label>

            {userProfile.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3">No facts yet — Oala learns from your conversations automatically, or add one manually below.</p>
            ) : (
              <div className="space-y-1.5">
                {userProfile.map(fact => (
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
                        <span className="flex-1 text-xs text-slate-800">{fact.text}</span>
                        <button onClick={() => { setEditingId(fact.id); setEditingText(fact.text); }} className="p-1 text-slate-400 hover:text-sky-600 rounded opacity-0 group-hover:opacity-100 cursor-pointer"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => deleteFact(fact.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add manually */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newFact}
                onChange={e => setNewFact(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFact()}
                placeholder="Add a fact manually…"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
              <button
                onClick={addFact}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {userProfile.length > 0 && (
            <button
              onClick={() => saveFacts([])}
              className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              Clear all facts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
