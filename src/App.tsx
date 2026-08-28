import React from "react";
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

export default function App() {
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
