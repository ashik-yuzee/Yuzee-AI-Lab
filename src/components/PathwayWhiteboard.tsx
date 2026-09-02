import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  X, Trash2, Sparkles, Network, Loader2, BookOpen, Code2, FileText,
  Send, Lightbulb, Trophy, Target, AlertCircle, Zap, Plus, Tag,
  Volume2, VolumeX, Clock, Flame, Feather, Layers,
  CheckCircle, Wand2, GripVertical, ChevronRight, Star, MessageSquare,
  CornerDownRight, GripHorizontal,
} from "lucide-react";
import { useTokenLab } from "../context/TokenLabContext";
import { generatePathway, recommendPathwayNodes, explainPathwayNode, fetchWhiteboardStats } from "../services/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeType =
  | "goal" | "phase" | "course" | "skill" | "project"
  | "resume" | "apply" | "milestone" | "step"
  | "current" | "complete" | "blocked" | "option";
type PathwayStyleId = "structured" | "project-driven" | "fast-track" | "self-paced";

interface PWNode {
  id: string; label: string; subtitle?: string; description?: string;
  prerequisites?: string[]; type: NodeType;
}

// ── Questions ─────────────────────────────────────────────────────────────────
interface Question { id: string; label: string; options: { value: string; icon?: string }[]; }
const ALL_QUESTIONS: Question[] = [
  {
    id: "Experience level",
    label: "What's your current experience in this area?",
    options: [
      { value: "Complete beginner", icon: "🌱" },
      { value: "Some knowledge",    icon: "📖" },
      { value: "Career changer",    icon: "🔄" },
      { value: "Already in field",  icon: "💼" },
    ],
  },
  {
    id: "Weekly commitment",
    label: "How much time can you dedicate each week?",
    options: [
      { value: "1-5 hrs/wk",   icon: "☕" },
      { value: "5-10 hrs/wk",  icon: "⏳" },
      { value: "10-20 hrs/wk", icon: "🔥" },
      { value: "20+ hrs/wk",   icon: "🚀" },
    ],
  },
  {
    id: "Main priority",
    label: "What matters most to you right now?",
    options: [
      { value: "Get hired fast",         icon: "⚡" },
      { value: "Build solid foundation", icon: "🏗️" },
      { value: "Keep costs low",         icon: "💰" },
      { value: "Stay flexible",          icon: "🌊" },
    ],
  },
  {
    id: "Learning style",
    label: "How do you learn best?",
    options: [
      { value: "Video courses",     icon: "🎬" },
      { value: "Hands-on projects", icon: "🛠️" },
      { value: "Reading docs",      icon: "📄" },
      { value: "Mix of everything", icon: "🎯" },
    ],
  },
];

// Detect answers from existing chat messages so we skip already-answered questions
function detectAnswersFromChat(messages: { role: string; content: string }[]): Record<string, string> {
  const txt = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const d: Record<string, string> = {};
  if (/beginner|no experience|starting out|brand new|never (worked|studied|coded)/i.test(txt))
    d["Experience level"] = "Complete beginner";
  else if (/career change|switchi|coming from|transition|different field/i.test(txt))
    d["Experience level"] = "Career changer";
  else if (/some (experience|knowledge)|familiar|basic|worked a bit/i.test(txt))
    d["Experience level"] = "Some knowledge";
  if (/full.?time|all day|20\+|40 hour|full time/i.test(txt))
    d["Weekly commitment"] = "20+ hrs/wk";
  else if (/part.?time|evenings|weekends|10.{0,3}20/i.test(txt))
    d["Weekly commitment"] = "10-20 hrs/wk";
  if (/get (?:a )?job|hire|land (?:a )?role|salary|employment/i.test(txt))
    d["Main priority"] = "Get hired fast";
  else if (/free|budget|cheap|no money|low cost/i.test(txt))
    d["Main priority"] = "Keep costs low";
  if (/video|youtube|udemy|coursera|watch/i.test(txt))
    d["Learning style"] = "Video courses";
  else if (/project|build|practice|hands.?on/i.test(txt))
    d["Learning style"] = "Hands-on projects";
  return d;
}

// ── Node meta ─────────────────────────────────────────────────────────────────
interface NodeMeta {
  badge: string; icon: React.FC<{ className?: string }>;
  shape: "hero" | "phase" | "milestone" | "card";
  statusColor: string;
}
const NODE_META: Record<NodeType, NodeMeta> = {
  goal:      { badge:"Goal",        icon:Target,       shape:"hero",      statusColor:"#6d28d9" },
  phase:     { badge:"Phase",       icon:Layers,       shape:"phase",     statusColor:"#78716c" },
  milestone: { badge:"Checkpoint",  icon:Trophy,       shape:"milestone", statusColor:"#d97706" },
  course:    { badge:"Course",      icon:BookOpen,     shape:"card",      statusColor:"#2563eb" },
  skill:     { badge:"Skill",       icon:Lightbulb,    shape:"card",      statusColor:"#7c3aed" },
  project:   { badge:"Project",     icon:Code2,        shape:"card",      statusColor:"#059669" },
  resume:    { badge:"Resume",      icon:FileText,     shape:"card",      statusColor:"#0284c7" },
  apply:     { badge:"Apply",       icon:Send,         shape:"card",      statusColor:"#d97706" },
  step:      { badge:"Step",        icon:ChevronRight, shape:"card",      statusColor:"#64748b" },
  current:   { badge:"In Progress", icon:Zap,          shape:"card",      statusColor:"#2563eb" },
  complete:  { badge:"Complete",    icon:CheckCircle,  shape:"card",      statusColor:"#16a34a" },
  blocked:   { badge:"Blocked",     icon:AlertCircle,  shape:"card",      statusColor:"#dc2626" },
  option:    { badge:"Option",      icon:Star,         shape:"card",      statusColor:"#71717a" },
};

const STATUS_CYCLE: Partial<Record<NodeType, NodeType>> = {
  step:"current", current:"complete", complete:"step",
  course:"current", skill:"current", project:"current", resume:"current", apply:"current", option:"current",
};
const STATUS_LABELS: Partial<Record<NodeType, string>> = {
  step:"To do", current:"Doing", complete:"Done",
  course:"To do", skill:"To do", project:"To do", resume:"To do", apply:"To do",
};

const FLOW_TYPE_MAP: Record<string, NodeType> = {
  goal:"goal", phase:"phase", course:"course", skill:"skill", project:"project",
  resume:"resume", apply:"apply", milestone:"milestone", step:"step",
  decision:"option", ok:"complete", warn:"blocked",
};

const TYPE_LABELS: Record<NodeType, string> = {
  goal:"Goal", phase:"Phase", course:"Course", skill:"Skill", project:"Project",
  resume:"Resume", apply:"Apply", milestone:"Milestone", step:"Step",
  current:"In Progress", complete:"Complete", blocked:"Blocked", option:"Option",
};

// Palette node types for the toolbar
const PALETTE: { type: NodeType; icon: React.FC<{ className?: string }> }[] = [
  { type:"step",      icon: ChevronRight },
  { type:"course",    icon: BookOpen },
  { type:"skill",     icon: Lightbulb },
  { type:"project",   icon: Code2 },
  { type:"resume",    icon: FileText },
  { type:"apply",     icon: Send },
  { type:"phase",     icon: Layers },
  { type:"milestone", icon: Trophy },
];

// ── Styles ────────────────────────────────────────────────────────────────────
interface PathwayStyle {
  id: PathwayStyleId; label: string; description: string;
  popularity: number; duration: string; color: string;
  icon: React.FC<{ className?: string }>;
}
const PATHWAY_STYLES: PathwayStyle[] = [
  { id:"structured",    label:"Structured",    description:"Courses → certs → projects",   popularity:62, duration:"5-6 mo", color:"#2563eb", icon:BookOpen },
  { id:"project-driven",label:"Project-Driven",description:"Build from day 1",            popularity:23, duration:"4-5 mo", color:"#059669", icon:Code2 },
  { id:"fast-track",    label:"Fast Track",    description:"Free resources, max speed",    popularity:10, duration:"2-3 mo", color:"#d97706", icon:Flame },
  { id:"self-paced",    label:"Self-Paced",    description:"Flexible, sustainable rhythm", popularity:5,  duration:"6-12 mo",color:"#7c3aed", icon:Feather },
];

const GEN_STEPS = [
  "Analysing your goal…",
  "Designing phase structure…",
  "Selecting courses & resources…",
  "Building portfolio projects…",
  "Finalising your pathway…",
];

const LS_KEY = "yuzee_pathway_v3";
const LS_WIDTH_KEY = "yuzee_whiteboard_width";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 380;
const MAX_WIDTH = 860;
const STREAM_DELAY_MS = 260; // slower, more visible animation

// ── TTS only (mic moved to Composer) ─────────────────────────────────────────
function useTts(enabled: boolean) {
  const synth = useRef<SpeechSynthesis | null>(
    typeof window !== "undefined" ? window.speechSynthesis : null
  );
  const [speaking, setSpeaking] = useState(false);
  const speakRef = useRef<(text: string) => void>(() => {});

  const speak = useCallback((text: string) => {
    if (!enabled || !synth.current) return;
    synth.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const doIt = () => {
      const voices = synth.current!.getVoices();
      const v = voices.find(v => v.name.includes("Google") && v.lang === "en-US")
             || voices.find(v => !v.localService && v.lang.startsWith("en"))
             || voices.find(v => v.lang.startsWith("en"));
      if (v) utter.voice = v;
      utter.rate = 0.93; utter.pitch = 1.05;
      utter.onstart = () => setSpeaking(true);
      utter.onend   = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      synth.current!.speak(utter);
    };
    synth.current.getVoices().length === 0
      ? synth.current.addEventListener("voiceschanged", doIt, { once: true })
      : doIt();
  }, [enabled]);

  const stop = useCallback(() => { synth.current?.cancel(); setSpeaking(false); }, []);
  speakRef.current = speak;
  return { speak, stop, speaking, speakRef };
}

// ── Main component ────────────────────────────────────────────────────────────
export const PathwayWhiteboard: React.FC = () => {
  const {
    isWhiteboardOpen, setWhiteboardOpen, currentConversation,
    whiteboardGenerateTick, setSidebarOpen,
  } = useTokenLab();

  const [panelWidth, setPanelWidth] = useState(() => {
    try { const v = localStorage.getItem(LS_WIDTH_KEY); return v ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, +v)) : DEFAULT_WIDTH; } catch { return DEFAULT_WIDTH; }
  });

  // Pathway
  const [nodes, setNodes] = useState<PWNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Pre-gen
  const [selectedStyle, setSelectedStyle] = useState<PathwayStyleId | null>(null);
  const [answers, setAnswers]   = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ]   = useState(0);
  const [isTyping, setIsTyping]   = useState(false);
  const [typedLabel, setTypedLabel] = useState("");
  const [showOpts, setShowOpts]    = useState(false);
  const activeQuestions = useRef<Question[]>([]);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTick  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generation
  const [wbTokens, setWbTokens] = useState<{ calls: number; inputTokens: number; outputTokens: number } | null>(null);
  const [fetching,  setFetching]  = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [genError,  setGenError]  = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [streamCount, setStreamCount] = useState(0);

  // Detail panel
  const [editLabel, setEditLabel]           = useState("");
  const [editDesc,  setEditDesc]            = useState("");
  const [nodeQuestion, setNodeQuestion]     = useState("");
  const [nodeAnswer,   setNodeAnswer]       = useState<string | null>(null);
  const [nodeAnswering, setNodeAnswering]   = useState(false);

  // TTS
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const tts = useTts(ttsEnabled);

  // Socket drag state
  const [connecting, setConnecting] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 });
  const [hoveredInput, setHoveredInput] = useState<string | null>(null);

  // Palette drag
  const [paletteDragType, setPaletteDragType] = useState<NodeType | null>(null);
  const [dropTargetIdx,   setDropTargetIdx]   = useState<number | null>(null);

  // Reorder drag
  const reorderDragId = useRef<string | null>(null);
  const [reorderOverId, setReorderOverId] = useState<string | null>(null);

  // Refs
  const nodesRef    = useRef<PWNode[]>(nodes);
  const streamId    = useRef(0);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const generateFn  = useRef<(() => Promise<void>) | undefined>(undefined);
  const resizeRef   = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { try { localStorage.setItem(LS_WIDTH_KEY, String(panelWidth)); } catch {} }, [panelWidth]);
  useEffect(() => { if (isWhiteboardOpen) setSidebarOpen(false); }, [isWhiteboardOpen, setSidebarOpen]);

  // Load from localStorage
  useEffect(() => {
    if (!isWhiteboardOpen) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { nodes: PWNode[]; style?: PathwayStyleId; answers?: Record<string, string> };
      if (d.nodes?.length) {
        setNodes(d.nodes);
        if (d.style)   setSelectedStyle(d.style);
        if (d.answers) setAnswers(d.answers);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWhiteboardOpen]);

  const persist = useCallback((n: PWNode[], s?: PathwayStyleId | null, a?: Record<string, string>) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ nodes: n, style: s ?? undefined, answers: a ?? {} })); } catch {}
  }, []);

  // Ref-safe animation: works correctly under React Strict Mode double-invoke
  const startTypingAnim = useCallback((label: string) => {
    if (animTimer.current) { clearTimeout(animTimer.current); animTimer.current = null; }
    if (animTick.current)  { clearInterval(animTick.current);  animTick.current  = null; }
    setTypedLabel(""); setShowOpts(false); setIsTyping(true);
    animTimer.current = setTimeout(() => {
      animTimer.current = null;
      setIsTyping(false);
      let i = 0;
      animTick.current = setInterval(() => {
        i++;
        setTypedLabel(label.slice(0, i));
        if (i >= label.length) {
          clearInterval(animTick.current!); animTick.current = null;
          setShowOpts(true);
        }
      }, 26);
    }, 650);
  }, []);

  const stopAnim = useCallback(() => {
    if (animTimer.current) { clearTimeout(animTimer.current); animTimer.current = null; }
    if (animTick.current)  { clearInterval(animTick.current);  animTick.current  = null; }
  }, []);

  // Build active questions from chat context, then start first question animation
  useEffect(() => {
    if (!isWhiteboardOpen || nodes.length > 0) return;
    const msgs = currentConversation?.messages ?? [];
    const detected = detectAnswersFromChat(msgs);
    setAnswers(prev => ({ ...detected, ...prev }));
    const missing = ALL_QUESTIONS.filter(q => !detected[q.id]);
    activeQuestions.current = missing;
    setCurrentQ(0);
    setTypedLabel("");
    setShowOpts(false);
    if (missing.length > 0) {
      startTypingAnim(missing[0].label);
    } else {
      setIsTyping(false);
    }
    return stopAnim;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWhiteboardOpen, currentConversation?.id]);

  // Animate subsequent questions when user answers one
  useEffect(() => {
    if (currentQ === 0) return; // first question handled by isWhiteboardOpen effect
    const qs = activeQuestions.current;
    if (currentQ >= qs.length || nodes.length > 0 || fetching || streaming) return;
    startTypingAnim(qs[currentQ].label);
    return stopAnim;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ]);

  // Populate detail panel on select
  useEffect(() => {
    if (!selected) return;
    const n = nodesRef.current.find(n => n.id === selected);
    if (!n) return;
    setEditLabel(n.label);
    setEditDesc(n.description ?? "");
    setNodeQuestion("");
    setNodeAnswer(null);
  }, [selected]);

  // Auto-save edits with debounce
  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => {
      setNodes(prev => {
        const u = prev.map(n => n.id !== selected ? n : {
          ...n,
          label: editLabel.trim() || n.label,
          description: editDesc.trim() || undefined,
        });
        persist(u, selectedStyle, answers); return u;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [editLabel, editDesc, selected, persist, selectedStyle, answers]);

  // TTS on select
  useEffect(() => {
    if (!ttsEnabled || !selected) return;
    const n = nodesRef.current.find(n => n.id === selected);
    if (n) tts.speak(`${n.label}${n.description ? ". " + n.description : ""}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ttsEnabled]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isWhiteboardOpen) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) deleteSelected();
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, isWhiteboardOpen]);

  // Panel resize
  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeRef.current) return;
    setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeRef.current.startW + resizeRef.current.startX - e.clientX)));
  }, []);
  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [onResizeMove]);
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: panelWidth };
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [panelWidth, onResizeMove, onResizeEnd]);

  // Socket drag (output → input reorder)
  useEffect(() => {
    if (!connecting) return;
    const onMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const r = panelRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onUp = () => setConnecting(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [connecting]);

  const startConnect = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!panelRef.current) return;
    const r = panelRef.current.getBoundingClientRect();
    const cr = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setConnecting({ fromId: nodeId, x: cr.left + cr.width / 2 - r.left, y: cr.top + cr.height / 2 - r.top });
    setMousePos({ x: cr.left + cr.width / 2 - r.left, y: cr.top + cr.height / 2 - r.top });
  }, []);

  const finishConnect = useCallback((targetId: string) => {
    if (!connecting || connecting.fromId === targetId) { setConnecting(null); return; }
    setNodes(prev => {
      const a = [...prev];
      const fi = a.findIndex(n => n.id === connecting.fromId);
      const ti = a.findIndex(n => n.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [moved] = a.splice(fi, 1);
      a.splice(ti > fi ? ti - 1 : ti, 0, moved);
      persist(a, selectedStyle, answers); return a;
    });
    setConnecting(null);
  }, [connecting, persist, selectedStyle, answers]);

  // Palette drag + click
  const onPaletteDragStart = (type: NodeType) => setPaletteDragType(type);
  const onPaletteDragEnd   = () => { setPaletteDragType(null); setDropTargetIdx(null); };
  const addNodeAtEnd = useCallback((type: NodeType) => {
    const id = `n-${Date.now()}`;
    setNodes(prev => {
      const u = [...prev, { id, label: TYPE_LABELS[type], type }];
      persist(u, selectedStyle, answers); return u;
    });
    setSelected(id);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, [persist, selectedStyle, answers]);

  const onDropZoneDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); setDropTargetIdx(idx);
  };
  const onDropZoneDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const type = (e.dataTransfer.getData("nodeType") || paletteDragType) as NodeType;
    if (!type) return;
    const id = `n-${Date.now()}`;
    setNodes(prev => {
      const u = [...prev]; u.splice(idx, 0, { id, label: TYPE_LABELS[type], type });
      persist(u, selectedStyle, answers); return u;
    });
    setSelected(id); setPaletteDragType(null); setDropTargetIdx(null);
  };

  // Reorder via drag handle
  const onReorderDragStart = (id: string) => { reorderDragId.current = id; };
  const onReorderDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setReorderOverId(id); };
  const onReorderDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault(); setReorderOverId(null);
    const srcId = reorderDragId.current; reorderDragId.current = null;
    if (!srcId || srcId === targetId) return;
    setNodes(prev => {
      const a = [...prev];
      const fi = a.findIndex(n => n.id === srcId);
      const ti = a.findIndex(n => n.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [m] = a.splice(fi, 1); a.splice(ti, 0, m);
      persist(a, selectedStyle, answers); return a;
    });
  };

  // Node ops
  const cycleStatus = useCallback((id: string) => {
    setNodes(prev => {
      const u = prev.map(n => n.id !== id ? n : { ...n, type: STATUS_CYCLE[n.type] ?? n.type });
      persist(u, selectedStyle, answers); return u;
    });
  }, [persist, selectedStyle, answers]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setNodes(prev => { const u = prev.filter(n => n.id !== selected); persist(u, selectedStyle, answers); return u; });
    setSelected(null);
  }, [selected, persist, selectedStyle, answers]);

  // Node question
  const askNodeQuestion = useCallback(async () => {
    if (!nodeQuestion.trim() || !selected) return;
    const n = nodesRef.current.find(n => n.id === selected);
    if (!n) return;
    setNodeAnswering(true); setNodeAnswer(null);
    const ctx = currentConversation?.messages?.find(m => m.role === "user")?.content?.slice(0, 300) ?? "";
    const { answer } = await explainPathwayNode({
      nodeLabel: n.label,
      nodeSubtitle: n.subtitle ?? "",
      question: nodeQuestion.trim(),
      goalContext: ctx,
    });
    setNodeAnswer(answer); setNodeAnswering(false);
  }, [nodeQuestion, selected, currentConversation]);

  // Derived
  const hasPathway    = nodes.length > 0;
  const isBusy        = fetching || streaming;
  const showPreGen    = !hasPathway && !isBusy;
  const selectedNode  = selected ? nodes.find(n => n.id === selected) ?? null : null;
  const hasChat       = (currentConversation?.messages?.length ?? 0) > 0;
  const qs            = activeQuestions.current;
  const allAnswered   = currentQ >= qs.length;
  const answeredCount = Object.values(answers).filter(Boolean).length;

  const phaseNumbers = useMemo(() => {
    const map = new Map<string, number>(); let c = 0;
    nodes.forEach(n => { if (n.type === "phase") { c++; map.set(n.id, c); } });
    return map;
  }, [nodes]);

  const actionNodeCount = useMemo(() =>
    nodes.filter(n => !["goal","phase","milestone"].includes(n.type)).length,
  [nodes]);

  // Generation
  const handleGenerate = useCallback(async () => {
    if (!currentConversation) return;
    const msgs = (currentConversation.messages ?? []).map(m => ({ role: m.role, content: m.content }));
    if (!msgs.length) return;

    const myId = ++streamId.current;
    setFetching(true); setStreaming(false); setGenError(null);
    setGenProgress(0); setStreamCount(0); setLoadingStep(0);
    setNodes([]); setSelected(null);

    const stepTimer = setInterval(() => setLoadingStep(p => Math.min(p + 1, GEN_STEPS.length - 1)), 1900);

    try {
      const result = await generatePathway(msgs, selectedStyle ?? "structured", answers);
      clearInterval(stepTimer);
      if (streamId.current !== myId) return;
      if (!result.nodes?.length) { setGenError("No pathway generated. Describe your goal more specifically."); setFetching(false); return; }

      const seen = new Set<string>();
      const typed: PWNode[] = result.nodes.map((n: any, idx: number) => {
        let id = String(n.id ?? idx); if (seen.has(id)) id = `${id}_${idx}`; seen.add(id);
        return { id, label: n.label, subtitle: n.subtitle ?? undefined, description: n.description ?? undefined, type: (FLOW_TYPE_MAP[n.node_type] ?? "step") as NodeType };
      });

      setFetching(false); setStreaming(true);

      for (let i = 0; i < typed.length; i++) {
        if (streamId.current !== myId) return;
        setGenProgress(Math.round((i / typed.length) * 100));
        await new Promise(r => setTimeout(r, STREAM_DELAY_MS));
        if (streamId.current !== myId) return;
        setNodes(prev => {
          const updated = [...prev, typed[i]];
          if (i % 4 === 0 || i === typed.length - 1) persist(updated, selectedStyle, answers);
          return updated;
        });
        setStreamCount(i + 1);
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:"smooth" }));
      }

      if (streamId.current !== myId) return;
      persist(typed, selectedStyle, answers);
      setGenProgress(100); setStreaming(false);
      fetchWhiteboardStats().then(setWbTokens).catch(() => {});
      if (ttsEnabled) tts.speak("Your pathway is ready.");
    } catch (err: any) {
      clearInterval(stepTimer);
      if (streamId.current === myId) { setGenError(err?.message ?? "Generation failed"); setFetching(false); setStreaming(false); }
    }
  }, [currentConversation, selectedStyle, answers, persist, ttsEnabled, tts]);

  generateFn.current = handleGenerate;

  useEffect(() => {
    if (whiteboardGenerateTick === 0) return;
    handleGenerate();
  }, [whiteboardGenerateTick, handleGenerate]);

  if (!isWhiteboardOpen) return null;

  // ── CSS ─────────────────────────────────────────────────────────────────────
  const css = `
    @keyframes wb-in { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
    .wb-in { animation: wb-in 0.3s cubic-bezier(.34,1.3,.64,1) both; }
    @keyframes wb-fade { from{opacity:0}to{opacity:1} }
    .wb-fade { animation: wb-fade 0.2s ease both; }
    @keyframes wb-shimmer { from{background-position:-200% 0}to{background-position:200% 0} }
    .wb-shimmer { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:wb-shimmer 1.4s ease-in-out infinite;border-radius:6px; }
    @keyframes wb-dot { 0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1} }
    @keyframes wb-cursor { 0%,100%{opacity:1}50%{opacity:0} }
    @keyframes wb-spin { to{transform:rotate(360deg)} }
    .wb-spin { animation:wb-spin 0.9s linear infinite; }
    .wb-socket { transition: transform 0.15s, box-shadow 0.15s; }
    .wb-socket:hover { transform: scale(1.5); box-shadow: 0 0 0 3px #7c3aed44; }
    .drop-zone { transition: height 0.15s, opacity 0.15s; }
    .drop-zone-active { height: 40px !important; opacity: 1 !important; background: #f5f3ff; border: 2px dashed #7c3aed44; border-radius: 10px; }
  `;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderDropZone = (idx: number) => (
    <div key={`dz-${idx}`}
      className={`drop-zone mx-1 rounded-lg flex items-center justify-center text-[9px] font-bold text-violet-400 ${dropTargetIdx === idx ? "drop-zone-active" : "opacity-0 h-1"}`}
      onDragOver={e => onDropZoneDragOver(e, idx)}
      onDragLeave={() => setDropTargetIdx(null)}
      onDrop={e => onDropZoneDrop(e, idx)}>
      {dropTargetIdx === idx && "Drop here"}
    </div>
  );

  const renderSocket = (nodeId: string, side: "top" | "bottom") => {
    const isHovered = hoveredInput === nodeId && side === "top";
    const isConnecting = connecting && side === "bottom";
    return (
      <div
        className={`wb-socket absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 z-10 cursor-crosshair
          ${side === "top" ? "-top-1.5" : "-bottom-1.5"}
          ${isHovered ? "border-violet-500 bg-violet-200" : "border-slate-300 bg-white"}
          ${isConnecting ? "border-violet-500 bg-violet-100" : ""}
        `}
        onMouseDown={side === "bottom" ? (e) => startConnect(nodeId, e) : undefined}
        onMouseEnter={() => { if (side === "top" && connecting) setHoveredInput(nodeId); }}
        onMouseLeave={() => setHoveredInput(null)}
        onMouseUp={() => { if (side === "top" && connecting) finishConnect(nodeId); }}
        title={side === "top" ? "Input — drop connection here" : "Output — drag to connect"}
      />
    );
  };

  const renderCard = (node: PWNode, idx: number) => {
    const meta = NODE_META[node.type];
    const Icon = meta.icon;
    const isSel = selected === node.id;
    const isOver = reorderOverId === node.id;
    const tags = node.subtitle?.split("·").map(t => t.trim()).filter(Boolean) ?? [];
    const statusLabel = STATUS_LABELS[node.type];
    const cycleable = !!STATUS_CYCLE[node.type];

    if (meta.shape === "hero") return (
      <div key={node.id} className="relative">
        {renderSocket(node.id, "top")}
        <div onClick={() => setSelected(s => s === node.id ? null : node.id)}
          className={`rounded-xl overflow-hidden cursor-pointer transition-all duration-150 wb-in ${isSel ? "ring-2 ring-violet-400 ring-offset-1" : "hover:shadow-md"}`}
          style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#2d1b69 100%)" }}
          draggable onDragStart={() => onReorderDragStart(node.id)} onDragEnd={() => setReorderOverId(null)}
          onDragOver={e => onReorderDragOver(e, node.id)} onDrop={e => onReorderDrop(e, node.id)}>
          <div className="px-4 py-3.5">
            <div className="text-[8.5px] font-bold tracking-[0.2em] text-indigo-300/50 uppercase mb-1.5 flex items-center gap-1">
              <Target className="w-2.5 h-2.5" />Career Goal
            </div>
            <h1 className="text-lg font-black text-white leading-tight">{node.label}</h1>
            {node.description && <p className="text-[10.5px] text-white/40 mt-1">{node.description}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((t,i) => <span key={i} className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60">{t}</span>)}
              </div>
            )}
          </div>
        </div>
        {renderSocket(node.id, "bottom")}
      </div>
    );

    if (meta.shape === "phase") return (
      <div key={node.id} className="relative">
        {renderSocket(node.id, "top")}
        <div onClick={() => setSelected(s => s === node.id ? null : node.id)}
          className={`cursor-pointer py-0.5 wb-in ${isSel ? "opacity-80" : ""}`}
          draggable onDragStart={() => onReorderDragStart(node.id)} onDragEnd={() => setReorderOverId(null)}
          onDragOver={e => onReorderDragOver(e, node.id)} onDrop={e => onReorderDrop(e, node.id)}>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full border border-slate-200 bg-slate-50">
              <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-black text-white">{phaseNumbers.get(node.id)}</span>
              <span className="text-[11px] font-semibold text-slate-600">{node.label}</span>
            </div>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
        {renderSocket(node.id, "bottom")}
      </div>
    );

    if (meta.shape === "milestone") return (
      <div key={node.id} className="relative flex justify-center">
        {renderSocket(node.id, "top")}
        <div onClick={() => setSelected(s => s === node.id ? null : node.id)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border cursor-pointer transition-all wb-in ${isSel ? "border-amber-400 shadow-sm" : "border-amber-200 hover:border-amber-300"}`}
          style={{ background:"linear-gradient(135deg,#fefce8,#fef9c3)" }}
          draggable onDragStart={() => onReorderDragStart(node.id)} onDragEnd={() => setReorderOverId(null)}
          onDragOver={e => onReorderDragOver(e, node.id)} onDrop={e => onReorderDrop(e, node.id)}>
          <span className="text-amber-400 text-xs">◆</span>
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">{node.label}</span>
          {node.description && <span className="text-[9px] text-amber-600/70">{node.description}</span>}
          <span className="text-amber-400 text-xs">◆</span>
        </div>
        {renderSocket(node.id, "bottom")}
      </div>
    );

    // Regular card
    return (
      <div key={node.id} className="relative">
        {renderSocket(node.id, "top")}
        <div
          onClick={() => setSelected(s => s === node.id ? null : node.id)}
          onDragOver={e => onReorderDragOver(e, node.id)}
          onDrop={e => onReorderDrop(e, node.id)}
          className={`bg-white rounded-xl border cursor-pointer transition-all duration-150 wb-in
            ${isSel ? "border-violet-300 shadow-md ring-2 ring-violet-100" : isOver ? "border-violet-200" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
          <div className="px-3.5 py-3 flex items-start gap-2.5">
            {/* Drag handle */}
            <div className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-slate-200 hover:text-slate-400 transition-colors"
              draggable onDragStart={() => onReorderDragStart(node.id)} onDragEnd={() => setReorderOverId(null)}
              onClick={e => e.stopPropagation()}>
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Badge row */}
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-1">
                  <Icon className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{meta.badge}</span>
                </div>
                {cycleable && statusLabel && (
                  <button onClick={e => { e.stopPropagation(); cycleStatus(node.id); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                      background: node.type === "current" ? "#2563eb" : node.type === "complete" ? "#16a34a" : node.type === "blocked" ? "#dc2626" : "#d1d5db",
                    }} />
                    <span className="text-[9px] font-medium text-slate-500">{statusLabel}</span>
                  </button>
                )}
              </div>

              {/* Title */}
              <p className="text-[13px] font-semibold text-slate-800 leading-snug">{node.label}</p>

              {/* Description */}
              {node.description && <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{node.description}</p>}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t,i) => (
                    <span key={i} className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t}</span>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
        {renderSocket(node.id, "bottom")}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <aside ref={panelRef} style={{ width: panelWidth }} className="shrink-0 flex relative bg-slate-50 border-l border-slate-200 overflow-hidden">
      <style>{css}</style>

      {/* Resize handle */}
      <div onMouseDown={onResizeStart} className="absolute left-0 top-0 bottom-0 w-1.5 z-20 group cursor-col-resize">
        <div className="absolute inset-y-0 left-0 w-px bg-slate-200 group-hover:bg-violet-400 transition-colors" />
      </div>

      {/* ── Left palette toolbar ─────────────────────────────────────────────── */}
      <div className="shrink-0 w-9 flex flex-col items-center gap-1 py-2 bg-white border-r border-slate-100 z-10 mt-10">
        {PALETTE.map(({ type, icon: Icon }) => {
          const meta = NODE_META[type];
          return (
            <div key={type}
              draggable
              onDragStart={e => { e.dataTransfer.setData("nodeType", type); onPaletteDragStart(type); }}
              onDragEnd={onPaletteDragEnd}
              onClick={() => addNodeAtEnd(type)}
              title={`${TYPE_LABELS[type]} — click to add, drag to place`}
              className="group relative w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
              style={{ color: meta.statusColor }}>
              <Icon className="w-3.5 h-3.5" />
              <div className="absolute left-9 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 z-50 pointer-events-none">
                <div className="w-1.5 h-1.5 bg-slate-800 rotate-45" />
                <div className="bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap">{TYPE_LABELS[type]}</div>
              </div>
            </div>
          );
        })}
        <div className="w-5 h-px bg-slate-200 my-1" />
        <div title="Drag nodes above onto the pathway" className="w-7 h-7 flex items-center justify-center">
          <GripHorizontal className="w-3 h-3 text-slate-300" />
        </div>
      </div>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <Network className="w-3 h-3 text-white" />
          </div>
          <span className="text-[12px] font-bold text-slate-800">Career Pathway</span>
          {actionNodeCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{actionNodeCount} steps</span>
          )}
          {wbTokens && wbTokens.calls > 0 && (
            <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 font-mono" title="Pathway AI tokens used this session">
              {((wbTokens.inputTokens + wbTokens.outputTokens) / 1000).toFixed(1)}k tok
            </span>
          )}

          <div className="flex items-center gap-0.5 ml-auto">
            <button onClick={() => { setTtsEnabled(v => !v); tts.stop(); }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${ttsEnabled ? "bg-violet-100 text-violet-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
              {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </button>
            <button onClick={() => {
              streamId.current++; setNodes([]); setSelected(null);
              persist([], null, answers); setGenError(null); setStreaming(false); setFetching(false);
            }} disabled={!hasPathway && !genError}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-25">
              <Trash2 className="w-3 h-3" />
            </button>
            <button onClick={() => setWhiteboardOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {genError && (
          <div className="mx-2 mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 shrink-0 wb-fade">
            <AlertCircle className="w-3 h-3 shrink-0" />{genError}
          </div>
        )}

        {/* ── Scrollable ─────────────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* SVG overlay for socket connections */}
          {connecting && (
            <svg className="absolute inset-0 pointer-events-none z-30" style={{ width:"100%", height:"100%" }}>
              <path
                d={`M ${connecting.x} ${connecting.y} C ${connecting.x} ${(connecting.y + mousePos.y) / 2}, ${mousePos.x} ${(connecting.y + mousePos.y) / 2}, ${mousePos.x} ${mousePos.y}`}
                fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"
              />
              <circle cx={mousePos.x} cy={mousePos.y} r="4" fill="#7c3aed" opacity="0.6" />
            </svg>
          )}

          {/* ── Pre-gen interview ─────────────────────────────────────────── */}
          {showPreGen && (
            <div className="p-3 space-y-3">
              {/* Intro bubble */}
              <div className="flex items-end gap-2 wb-in">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm max-w-[88%]">
                  <p className="text-[11.5px] font-medium text-slate-700 leading-relaxed">
                    Hi! I'll build your personalised career pathway.{qs.length > 0 ? ` Let me ask you ${qs.length > 2 ? "a few" : "a couple of"} quick questions first. 👋` : " I found enough from our chat — choose a style below! 🎯"}
                  </p>
                </div>
              </div>

              {/* Completed Q&A */}
              {qs.slice(0, currentQ).map((q, qi) => (
                <div key={q.id} className="space-y-1.5 wb-in">
                  <div className="flex items-end gap-2">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Sparkles className="w-2 h-2 text-violet-500" />
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl rounded-bl-sm px-2.5 py-1.5 shadow-sm max-w-[88%]">
                      <p className="text-[10.5px] text-slate-500">{q.label}</p>
                    </div>
                  </div>
                  {answers[q.id] && (
                    <div className="flex justify-end">
                      <div className="rounded-xl rounded-br-sm px-3 py-1.5 max-w-[72%]"
                        style={{ background:"linear-gradient(135deg,#6d28d9,#4f46e5)" }}>
                        <p className="text-[11px] font-semibold text-white">
                          {qs[qi].options.find(o => o.value === answers[q.id])?.icon} {answers[q.id]}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Active question */}
              {currentQ < qs.length && (
                <div className="space-y-2">
                  <div className="flex items-end gap-2 wb-in">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm max-w-[88%] min-w-[50px]">
                      {isTyping ? (
                        <div className="flex items-center gap-1 py-0.5">
                          {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300" style={{ animation:`wb-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                        </div>
                      ) : (
                        <p className="text-[12px] font-semibold text-slate-800 leading-snug">
                          {typedLabel}
                          <span className="inline-block w-0.5 h-3 bg-violet-500 ml-0.5 align-middle"
                            style={{ opacity: typedLabel === qs[currentQ]?.label ? 0 : 1, animation: "wb-cursor 0.8s step-end infinite" }} />
                        </p>
                      )}
                    </div>
                  </div>

                  {showOpts && (
                    <div className="grid grid-cols-2 gap-1.5 pl-8 wb-in">
                      {qs[currentQ].options.map((opt, oi) => (
                        <button key={opt.value}
                          onClick={() => {
                            setAnswers(prev => ({ ...prev, [qs[currentQ].id]: opt.value }));
                            setTimeout(() => {
                              setCurrentQ(q => q + 1);
                              setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:"smooth" }), 50);
                            }, 300);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border-2 border-slate-200 bg-white text-[10.5px] font-medium text-slate-700 text-left cursor-pointer hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 active:scale-95 transition-all wb-in"
                          style={{ animationDelay:`${oi * 0.05}s` }}>
                          <span className="text-base leading-none shrink-0">{opt.icon}</span>
                          <span>{opt.value}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All answered → style + generate */}
              {allAnswered && (
                <div className="space-y-3 wb-in">
                  <div className="flex items-end gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                      <p className="text-[12px] font-semibold text-slate-800">
                        {qs.length > 0 ? "Got it! One last thing — pick a learning style:" : "Pick a learning style to get started:"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pl-8">
                    {PATHWAY_STYLES.map((s, si) => {
                      const isActive = selectedStyle === s.id;
                      return (
                        <button key={s.id} onClick={() => setSelectedStyle(isActive ? null : s.id)}
                          className="flex flex-col gap-0.5 p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all active:scale-95 wb-in hover:shadow-sm"
                          style={{ borderColor: isActive ? s.color : "#e2e8f0", background: isActive ? s.color + "0e" : "#fff", animationDelay: `${si * 0.05}s` }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span style={{ color: s.color }}><s.icon className="w-3 h-3" /></span>
                              <span className="text-[10px] font-bold" style={{ color: isActive ? s.color : "#334155" }}>{s.label}</span>
                            </div>
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded-full" style={{ background: s.color + "18", color: s.color }}>{s.popularity}%</span>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-snug">{s.description}</p>
                          <p className="text-[8.5px] text-slate-400 flex items-center gap-0.5"><Clock className="w-2 h-2" />{s.duration}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pl-8">
                    {!hasChat && <p className="text-[9.5px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-1.5">Have a conversation about your goal first, then generate.</p>}
                    <button onClick={() => hasChat && generateFn.current?.()}
                      disabled={!hasChat}
                      className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-[12px] font-bold text-white transition-all cursor-pointer disabled:opacity-40 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                      style={{ background: selectedStyle ? PATHWAY_STYLES.find(s=>s.id===selectedStyle)?.color ?? "#7c3aed" : "#7c3aed" }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      {selectedStyle ? `Generate ${PATHWAY_STYLES.find(s=>s.id===selectedStyle)?.label} Pathway` : "Generate My Pathway"}
                    </button>
                    {answeredCount > 0 && (
                      <p className="text-[8.5px] text-slate-400 text-center mt-1">{answeredCount} profile answer{answeredCount>1?"s":""} will personalise your pathway</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Generation loading ────────────────────────────────────────── */}
          {isBusy && (
            <div className="p-3">
              <div className="rounded-xl overflow-hidden" style={{ background:"#0f172a" }}>
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                      {fetching ? <Loader2 className="w-4 h-4 text-violet-300 wb-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-white">{fetching ? "Building your pathway…" : "Streaming cards…"}</div>
                      <div className="text-[8.5px] text-slate-500 mt-0.5">Gemini 3.7 Flash · {selectedStyle ?? "structured"}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {GEN_STEPS.map((step, i) => {
                      const done   = i < loadingStep;
                      const active = i === loadingStep && fetching;
                      return (
                        <div key={i} className={`flex items-center gap-2 transition-opacity ${i > loadingStep && !streaming ? "opacity-20" : "opacity-100"}`}>
                          <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                            {done && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            {active && <Loader2 className="w-3 h-3 text-violet-400 wb-spin" />}
                            {!done && !active && <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />}
                          </div>
                          <span className={`text-[10px] ${done?"text-emerald-400 line-through":active?"text-white font-semibold":"text-slate-600"}`}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                  {streaming && (
                    <>
                      <div className="h-0.5 rounded-full overflow-hidden bg-white/10 mb-1">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width:`${genProgress}%`, background:"linear-gradient(90deg,#7c3aed,#06b6d4)" }} />
                      </div>
                      <div className="text-[8.5px] text-slate-600 text-right">{streamCount} cards</div>
                    </>
                  )}
                </div>
              </div>
              {nodes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {nodes.slice(-4).map((n, i) => <div key={n.id}>{renderCard(n, nodes.length - 4 + i)}</div>)}
                </div>
              )}
            </div>
          )}

          {/* ── Pathway cards ────────────────────────────────────────────── */}
          {hasPathway && !isBusy && (
            <div className="p-3 space-y-1.5">
              {renderDropZone(0)}
              {nodes.map((node, idx) => (
                <React.Fragment key={node.id}>
                  {renderCard(node, idx)}
                  {idx < nodes.length - 1 && (
                    <div className="flex flex-col items-center gap-0">
                      <div className="w-px h-3 bg-slate-200" />
                      {renderDropZone(idx + 1)}
                      <div className="w-px h-1 bg-slate-200" />
                    </div>
                  )}
                </React.Fragment>
              ))}
              {renderDropZone(nodes.length)}

              {hasChat && (
                <button onClick={() => generateFn.current?.()}
                  className="w-full flex items-center justify-center gap-1 py-2 mt-1 rounded-xl border border-dashed border-slate-300 text-[10px] font-semibold text-slate-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 cursor-pointer transition-all">
                  <Sparkles className="w-3 h-3" />Regenerate Pathway
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Detail panel (selected node) — overlays pathway from bottom ─── */}
        {selectedNode && (
          <div className="absolute bottom-0 left-9 right-0 z-20 bg-white border-t-2 border-violet-200 shadow-2xl wb-fade" style={{ maxHeight: "55%" }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: NODE_META[selectedNode.type].statusColor }} />
                <span className="text-[10px] font-bold text-slate-600">{TYPE_LABELS[selectedNode.type]}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={deleteSelected}
                  className="flex items-center gap-0.5 text-[9px] text-rose-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
                  <Trash2 className="w-2.5 h-2.5" />Delete
                </button>
                <button onClick={() => setSelected(null)}
                  className="p-1 text-slate-300 hover:text-slate-600 cursor-pointer rounded hover:bg-slate-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="px-3 py-2 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(55vh - 40px)" }}>
              {/* Label */}
              <div>
                <label className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Label</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="w-full text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-violet-400 focus:bg-white text-slate-800 transition-colors" />
              </div>

              {/* Description */}
              <div>
                <label className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                  placeholder="Add notes, resources, or details…"
                  className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-violet-400 focus:bg-white text-slate-700 resize-none transition-colors" />
              </div>

              {/* Prerequisites (auto-filled, read-only) */}
              {selectedNode.prerequisites?.length ? (
                <div>
                  <label className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5 flex items-center gap-1">
                    <Tag className="w-2 h-2" />Prerequisites (auto-filled)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.prerequisites.map((p,i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{p}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Ask about this step */}
              <div>
                <label className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5 flex items-center gap-1">
                  <MessageSquare className="w-2 h-2" />Ask about this step
                </label>
                <div className="flex gap-1.5">
                  <input value={nodeQuestion} onChange={e => setNodeQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askNodeQuestion(); }}}
                    placeholder="e.g. How long does this take? Best free resources?"
                    className="flex-1 text-[10.5px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-violet-400 text-slate-700 transition-colors" />
                  <button onClick={askNodeQuestion} disabled={!nodeQuestion.trim() || nodeAnswering}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-violet-600 hover:bg-violet-700 text-white cursor-pointer disabled:opacity-40 transition-colors flex items-center gap-1">
                    {nodeAnswering ? <Loader2 className="w-3 h-3 wb-spin" /> : <CornerDownRight className="w-3 h-3" />}
                  </button>
                </div>
                {nodeAnswering && <p className="text-[9.5px] text-violet-500 mt-1.5 flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 wb-spin" />Thinking…</p>}
                {nodeAnswer && (
                  <div className="mt-1.5 p-2 bg-violet-50 border border-violet-100 rounded-lg">
                    <p className="text-[10px] text-violet-800 leading-relaxed whitespace-pre-wrap">{nodeAnswer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

