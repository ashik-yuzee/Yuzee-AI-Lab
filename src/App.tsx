import React, { useState, useEffect } from "react";
import { TokenLabProvider } from "./context/TokenLabContext";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { TokenInspector } from "./components/TokenInspector";
import { ContextInspectorModal } from "./components/ContextInspectorModal";
import { CareerContextModal } from "./components/CareerContextModal";
import { MemoryTimelineModal } from "./components/MemoryTimelineModal";
import { BenchmarkModal } from "./components/BenchmarkModal";
import { AnalyticsDashboardModal } from "./components/AnalyticsDashboardModal";
import { ExportModal } from "./components/ExportModal";
import { SettingsModal } from "./components/SettingsModal";
import { AdvancedLabModal } from "./components/AdvancedLabModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { ClarificationQuestionsModal } from "./components/ClarificationQuestionsModal";
import { LocationPromptModal } from "./components/LocationPromptModal";
import { PathwayWhiteboard } from "./components/PathwayWhiteboard";

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (!r.ok) { setErr('Invalid credentials'); setLoading(false); return; }
      const { token } = await r.json();
      localStorage.setItem('yuzee_auth', token);
      onLogin();
    } catch { setErr('Connection error'); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/favicon.svg" alt="Oala" className="w-8 h-8 rounded-lg shadow-xs" />
          <div>
            <p className="font-semibold text-slate-900 text-sm">Oala AI Lab</p>
            <p className="text-[11px] text-slate-500">Admin Access</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={u}
            onChange={e => setU(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-sky-400 transition-colors"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={p}
            onChange={e => setP(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-sky-400 transition-colors"
            required
            autoComplete="current-password"
          />
          {err && <p className="text-red-600 text-xs">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('yuzee_auth') || '';
    if (!token) { setAuthed(false); return; }
    fetch('/api/auth/check', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { authenticated: boolean }) => setAuthed(d.authenticated === true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">Loading…</div>;
  }
  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <TokenLabProvider>
      <div id="yuzee-token-lab-root" className="flex flex-col h-screen w-screen bg-[#F9FAFB] text-slate-900 font-sans overflow-hidden antialiased selection:bg-sky-100 selection:text-sky-900">
        {/* Top App Header & Model/Preset Toolbar */}
        <Navbar />

        {/* Main Application Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Navigation Sidebar */}
          <Sidebar />

          {/* Center Chat Viewport with Live Pre-Flight Forecaster & Turns List */}
          <main className="flex-1 flex flex-col min-w-0 bg-white relative">
            <ChatArea />
          </main>

          {/* Right Telemetry & Context Diagnostics Drawer */}
          <TokenInspector />
          {/* Pathway Whiteboard Side Panel */}
          <PathwayWhiteboard />
        </div>

        {/* Global Modals & Dialogs */}
        <AdvancedLabModal />
        <UserProfileModal />
        <ContextInspectorModal />
        <CareerContextModal />
        <MemoryTimelineModal />
        <BenchmarkModal />
        <AnalyticsDashboardModal />
        <ExportModal />
        <SettingsModal />
        <ClarificationQuestionsModal />
        <LocationPromptModal />
      </div>
    </TokenLabProvider>
  );
}
