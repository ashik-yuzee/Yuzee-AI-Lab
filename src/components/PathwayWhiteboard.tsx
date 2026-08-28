import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Plus, Trash2, Link2, ZoomIn, ZoomOut, Maximize2, RotateCcw, Sparkles, Network, Loader2 } from "lucide-react";
import { useTokenLab } from "../context/TokenLabContext";
import { generatePathway } from "../services/api";

type NodeType = "goal" | "step" | "option" | "milestone" | "current" | "complete" | "blocked";

interface PWNode { id: string; label: string; type: NodeType; x: number; y: number; }
interface PWEdge { id: string; from: string; to: string; }

const NW = 140, NH = 44;

const STYLES: Record<NodeType, { fill: string; stroke: string; text: string }> = {
  goal:      { fill: "#1e3a5f", stroke: "#1e3a5f", text: "#ffffff" },
  current:   { fill: "#eff6ff", stroke: "#3b82f6", text: "#1d4ed8" },
  complete:  { fill: "#f0fdf4", stroke: "#22c55e", text: "#15803d" },
  blocked:   { fill: "#fff1f2", stroke: "#f43f5e", text: "#be123c" },
  step:      { fill: "#ffffff", stroke: "#94a3b8", text: "#1e293b" },
  option:    { fill: "#f8fafc", stroke: "#cbd5e1", text: "#475569" },
  milestone: { fill: "#faf5ff", stroke: "#a855f7", text: "#7e22ce" },
};

const TYPE_LABELS: Record<NodeType, string> = {
  goal: "Goal", step: "Step", option: "Option", milestone: "Milestone",
  current: "Current", complete: "Complete", blocked: "Blocked",
};

const FLOW_TYPE_MAP: Record<string, NodeType> = {
  goal: "goal", decision: "option", ok: "complete", warn: "blocked",
};

function mkEdgePath(a: PWNode, b: PWNode): string {
  const dx = b.x - a.x;
  let x1: number, y1: number, x2: number, y2: number;
  if (Math.abs(dx) >= Math.abs(b.y - a.y)) {
    if (dx >= 0) { x1 = a.x + NW; y1 = a.y + NH / 2; x2 = b.x;      y2 = b.y + NH / 2; }
    else         { x1 = a.x;      y1 = a.y + NH / 2; x2 = b.x + NW; y2 = b.y + NH / 2; }
    const cx = (x1 + x2) / 2;
    return `M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
  }
  if (b.y >= a.y) { x1 = a.x + NW / 2; y1 = a.y + NH; x2 = b.x + NW / 2; y2 = b.y;      }
  else            { x1 = a.x + NW / 2; y1 = a.y;      x2 = b.x + NW / 2; y2 = b.y + NH; }
  const cy = (y1 + y2) / 2;
  return `M${x1} ${y1} C${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`;
}

function autoLayout(rawNodes: Omit<PWNode, "x" | "y">[], rawEdges: { from: string; to: string }[]): PWNode[] {
  const inDeg = new Map<string, number>(rawNodes.map(n => [n.id, 0]));
  const outs  = new Map<string, string[]>(rawNodes.map(n => [n.id, []]));
  rawEdges.forEach(e => { inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1); outs.get(e.from)?.push(e.to); });
  const layer = new Map<string, number>();
  const q = rawNodes.filter(n => (inDeg.get(n.id) || 0) === 0).map(n => n.id);
  q.forEach(id => layer.set(id, 0));
  for (let i = 0; i < q.length; i++) {
    const l = layer.get(q[i]) || 0;
    (outs.get(q[i]) || []).forEach(next => {
      if (!layer.has(next) || (layer.get(next) || 0) < l + 1) { layer.set(next, l + 1); q.push(next); }
    });
  }
  const byLayer = new Map<number, string[]>();
  rawNodes.forEach(n => {
    const l = layer.get(n.id) || 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  });
  const pos = new Map<string, { x: number; y: number }>();
  byLayer.forEach((ids, l) => ids.forEach((id, i) => pos.set(id, { x: 50 + l * (NW + 65), y: 40 + i * (NH + 50) })));
  return rawNodes.map(n => ({ ...n, ...(pos.get(n.id) || { x: 50, y: 50 }) } as PWNode));
}

const LS_KEY = "yuzee_whiteboard";

export const PathwayWhiteboard: React.FC = () => {
  const { isWhiteboardOpen, setWhiteboardOpen, currentConversation } = useTokenLab();

  const [nodes, setNodes] = useState<PWNode[]>([]);
  const [edges, setEdges] = useState<PWEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "connect" | "add">("select");
  const [addType, setAddType] = useState<NodeType>("step");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [mouseUser, setMouseUser] = useState({ x: 0, y: 0 });

  const dragging  = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef    = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const svgRef    = useRef<SVGSVGElement>(null);
  const nodesRef  = useRef(nodes);
  const edgesRef  = useRef(edges);
  const txRef     = useRef(tx);
  const tyRef     = useRef(ty);
  const scaleRef  = useRef(scale);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { txRef.current = tx; }, [tx]);
  useEffect(() => { tyRef.current = ty; }, [ty]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const persist = useCallback((n: PWNode[], e: PWEdge[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ nodes: n, edges: e })); } catch {}
  }, []);

  // Load saved state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const d = JSON.parse(raw); if (d.nodes) setNodes(d.nodes); if (d.edges) setEdges(d.edges); }
    } catch {}
  }, []);

  // Non-passive wheel for zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const curScale = scaleRef.current;
      const newScale = Math.max(0.2, Math.min(3, curScale * factor));
      const px = (e.clientX - r.left - txRef.current) / curScale;
      const py = (e.clientY - r.top  - tyRef.current) / curScale;
      setTx(e.clientX - r.left - px * newScale);
      setTy(e.clientY - r.top  - py * newScale);
      setScale(newScale);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard shortcuts
  const deleteSelected = useCallback(() => {
    const id = selected;
    if (!id) return;
    setNodes(prev => { const u = prev.filter(n => n.id !== id); persist(u, edgesRef.current.filter(e => e.from !== id && e.to !== id)); return u; });
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    setSelected(null);
  }, [selected, persist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && editingId === null) deleteSelected();
      if (e.key === "Escape") { setMode("select"); setConnectFrom(null); setEditingId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, editingId]);

  // Generate pathway from conversation
  const handleGenerate = async () => {
    const msgs = (currentConversation?.messages || []).map(m => ({ role: m.role, content: m.content }));
    if (msgs.length === 0) { setGenError("Start a conversation first, then generate."); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generatePathway(msgs);
      if (!result.nodes?.length) { setGenError("Couldn't extract a pathway — try sending a few more messages about your goals."); return; }
      const typed = result.nodes.map((n: any) => ({
        id: n.id, label: n.label,
        type: (FLOW_TYPE_MAP[n.node_type] || "step") as NodeType,
      }));
      const re = result.edges.map((e: any, i: number) => ({ from: e.from, to: e.to, id: `ge${i}` }));
      const laid = autoLayout(typed, re);
      setNodes(laid);
      setEdges(re);
      persist(laid, re);
      setSelected(null);
      // Fit after a short delay to let SVG render
      setTimeout(fitView, 80);
    } catch (err: any) {
      setGenError(err?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const toUser = useCallback((cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - tx) / scale, y: (cy - r.top - ty) / scale };
  }, [tx, ty, scale]);

  const handleSvgDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest(".pnode")) return;
    setSelected(null);
    if (mode === "add") {
      const { x, y } = toUser(e.clientX, e.clientY);
      const id = `n-${Date.now()}`;
      setNodes(prev => { const u = [...prev, { id, label: TYPE_LABELS[addType], type: addType, x: x - NW / 2, y: y - NH / 2 }]; persist(u, edgesRef.current); return u; });
      setMode("select");
      return;
    }
    if (mode === "connect") { setConnectFrom(null); setMode("select"); return; }
    panRef.current = { mx: e.clientX, my: e.clientY, tx, ty };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const u = toUser(e.clientX, e.clientY);
    setMouseUser(u);
    if (dragging.current) {
      const { id, ox, oy } = dragging.current;
      setNodes(prev => prev.map(n => n.id === id ? { ...n, x: u.x - ox, y: u.y - oy } : n));
    } else if (panRef.current) {
      const { mx, my, tx: stx, ty: sty } = panRef.current;
      setTx(stx + (e.clientX - mx));
      setTy(sty + (e.clientY - my));
    }
  };

  const handleMouseUp = () => {
    if (dragging.current) setNodes(prev => { persist(prev, edgesRef.current); return prev; });
    dragging.current = null;
    panRef.current = null;
  };

  const handleNodeDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === "connect") return;
    const u = toUser(e.clientX, e.clientY);
    const node = nodesRef.current.find(n => n.id === id)!;
    dragging.current = { id, ox: u.x - node.x, oy: u.y - node.y };
    setSelected(id);
  };

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === "connect") {
      if (!connectFrom) { setConnectFrom(id); return; }
      if (connectFrom !== id) {
        const eid = `e-${Date.now()}`;
        setEdges(prev => { const u = [...prev, { id: eid, from: connectFrom!, to: id }]; persist(nodesRef.current, u); return u; });
      }
      setConnectFrom(null);
      setMode("select");
      return;
    }
    setSelected(id);
  };

  const handleNodeDbl = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === id)!;
    setEditingId(id); setEditText(node.label);
  };

  const commitEdit = (id: string) => {
    const t = editText.trim();
    if (t) setNodes(prev => { const u = prev.map(n => n.id === id ? { ...n, label: t } : n); persist(u, edgesRef.current); return u; });
    setEditingId(null);
  };

  const deleteEdge = (eid: string) => {
    setEdges(prev => { const u = prev.filter(e => e.id !== eid); persist(nodesRef.current, u); return u; });
  };

  const fitView = () => {
    const cur = nodesRef.current;
    if (cur.length === 0) return;
    const pad = 36;
    const x0 = Math.min(...cur.map(n => n.x)) - pad;
    const y0 = Math.min(...cur.map(n => n.y)) - pad;
    const x1 = Math.max(...cur.map(n => n.x + NW)) + pad;
    const y1 = Math.max(...cur.map(n => n.y + NH)) + pad;
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 2.5);
    setScale(z); setTx(-x0 * z); setTy(-y0 * z);
  };

  if (!isWhiteboardOpen) return null;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connSrc = connectFrom ? nodeMap.get(connectFrom) : null;
  const hasChat = (currentConversation?.messages?.length || 0) > 0;

  return (
    <aside className="w-[380px] shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
            <Network className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Pathway</span>
          <span className="text-[10px] text-slate-400">{nodes.length > 0 ? `${nodes.length} nodes` : ""}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={fitView} title="Fit to view" disabled={nodes.length === 0} className="p-1 text-slate-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors cursor-pointer disabled:opacity-30">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setNodes([]); setEdges([]); setSelected(null); persist([], []); setGenError(null); }}
            title="Clear whiteboard" disabled={nodes.length === 0}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setWhiteboardOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors cursor-pointer ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Generate button */}
      <div className="px-3 py-2.5 border-b border-slate-100 bg-white shrink-0">
        <button
          onClick={handleGenerate}
          disabled={generating || !hasChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title={!hasChat ? "Start a conversation first" : "Generate pathway from your chat"}
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="w-4 h-4" />Generate Pathway</>
          )}
        </button>
        {genError && <p className="text-[10px] text-rose-500 mt-1.5 leading-tight">{genError}</p>}
        {!hasChat && !genError && (
          <p className="text-[10px] text-slate-400 mt-1.5">Chat with Oala first, then generate your pathway.</p>
        )}
      </div>

      {/* Edit toolbar — only when nodes exist */}
      {nodes.length > 0 && (
        <div className="px-2.5 py-1.5 border-b border-slate-100 bg-white flex items-center gap-1 shrink-0">
          {/* Add */}
          <div className="flex rounded-md border border-slate-200 overflow-hidden">
            <button
              onClick={() => setMode(mode === "add" ? "select" : "add")}
              title="Add node"
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${mode === "add" ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <Plus className="w-2.5 h-2.5" />Add
            </button>
            <div className="w-px bg-slate-200" />
            <select value={addType} onChange={e => setAddType(e.target.value as NodeType)} className="text-[11px] px-1.5 py-1 bg-white text-slate-600 border-none outline-none cursor-pointer">
              {(Object.keys(TYPE_LABELS) as NodeType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          {/* Connect */}
          <button
            onClick={() => { setMode(mode === "connect" ? "select" : "connect"); setConnectFrom(null); }}
            title="Connect two nodes"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${mode === "connect" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:border-sky-200"}`}
          >
            <Link2 className="w-2.5 h-2.5" />{connectFrom ? "→ Target" : "Connect"}
          </button>
          {/* Delete */}
          <button
            onClick={deleteSelected} disabled={!selected}
            title="Delete selected (Del)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />Delete
          </button>
          {/* Zoom */}
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => setScale(s => Math.min(3, s * 1.2))} title="Zoom in" className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer"><ZoomIn className="w-3 h-3" /></button>
            <span className="text-[9px] text-slate-400 w-7 text-center font-mono">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.max(0.2, s / 1.2))} title="Zoom out" className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer"><ZoomOut className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      {/* Mode hint */}
      {(mode === "add" || mode === "connect") && (
        <div className="px-3 py-1 bg-amber-50 border-b border-amber-100 text-[10px] text-amber-700 shrink-0">
          {mode === "add" ? `Click canvas to place "${TYPE_LABELS[addType]}" · Esc to cancel`
            : connectFrom ? "Click target node · Esc to cancel" : "Click source node to start edge"}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#f9fafb]">
        {nodes.length === 0 && !generating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Network className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs font-semibold text-slate-400">No pathway yet</p>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Chat with Oala, then click <strong className="text-slate-400">Generate Pathway</strong> above.
            </p>
          </div>
        )}
        {generating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-2" />
            <p className="text-xs text-slate-400">Building your pathway…</p>
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%" height="100%"
          className="block select-none"
          style={{ cursor: mode !== "select" ? "crosshair" : "default" }}
          onMouseDown={handleSvgDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="wb-dots" width="20" height="20" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${((tx % 20) + 20) % 20} ${((ty % 20) + 20) % 20})`}
            >
              <circle cx="10" cy="10" r="0.8" fill="#d1d5db" />
            </pattern>
            <marker id="wb-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
            <marker id="wb-arr-hi" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" />
            </marker>
            <marker id="wb-arr-gh" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" opacity="0.5" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#wb-dots)" />
          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
            {/* Edges */}
            {edges.map(e => {
              const src = nodeMap.get(e.from), tgt = nodeMap.get(e.to);
              if (!src || !tgt) return null;
              const hi = selected === e.from || selected === e.to;
              const d = mkEdgePath(src, tgt);
              return (
                <g key={e.id}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={10} style={{ cursor: "pointer" }} onClick={() => deleteEdge(e.id)} />
                  <path d={d} fill="none" stroke={hi ? "#0ea5e9" : "#94a3b8"} strokeWidth={hi ? 2 : 1.5}
                    markerEnd={`url(#wb-arr${hi ? "-hi" : ""})`} opacity={hi ? 1 : 0.8} pointerEvents="none" />
                </g>
              );
            })}
            {/* Ghost edge while connecting */}
            {connSrc && (
              <line x1={connSrc.x + NW / 2} y1={connSrc.y + NH / 2} x2={mouseUser.x} y2={mouseUser.y}
                stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="5 4"
                markerEnd="url(#wb-arr-gh)" opacity={0.6} pointerEvents="none" />
            )}
            {/* Nodes */}
            {nodes.map(n => {
              const s = STYLES[n.type];
              const isSel  = selected === n.id;
              const isConn = connectFrom === n.id;
              const hasBadge = n.type !== "step";
              return (
                <g key={n.id} className="pnode" transform={`translate(${n.x}, ${n.y})`}
                  onMouseDown={ev => handleNodeDown(ev, n.id)}
                  onClick={ev => handleNodeClick(ev, n.id)}
                  onDoubleClick={ev => handleNodeDbl(ev, n.id)}
                  style={{ cursor: mode === "connect" ? "crosshair" : "grab" }}
                >
                  <rect width={NW} height={NH} rx={8} fill={s.fill}
                    stroke={isSel || isConn ? "#0ea5e9" : s.stroke}
                    strokeWidth={isSel || isConn ? 2.5 : 1.5}
                    style={{ filter: isSel ? "drop-shadow(0 2px 8px rgba(14,165,233,0.28))" : "none" }}
                  />
                  {hasBadge && (
                    <text x={5} y={10} fontSize={7} fontWeight={700} fill={s.text} opacity={0.45}
                      style={{ userSelect: "none" }} pointerEvents="none">
                      {n.type.toUpperCase()}
                    </text>
                  )}
                  {editingId === n.id ? (
                    <foreignObject x={5} y={hasBadge ? 16 : 12} width={NW - 10} height={20}>
                      <input autoFocus value={editText}
                        onChange={ev => setEditText(ev.target.value)}
                        onBlur={() => commitEdit(n.id)}
                        onKeyDown={ev => { if (ev.key === "Enter") commitEdit(n.id); if (ev.key === "Escape") setEditingId(null); }}
                        style={{ width: "100%", height: "100%", border: "none", background: "transparent", outline: "none", fontSize: 11, fontWeight: 600, color: s.text, textAlign: "center", padding: 0 }}
                      />
                    </foreignObject>
                  ) : (
                    <text x={NW / 2} y={hasBadge ? NH / 2 + 7 : NH / 2 + 4}
                      textAnchor="middle" fontSize={11} fontWeight={n.type === "goal" ? 700 : 600}
                      fill={s.text} pointerEvents="none" style={{ userSelect: "none" }}
                    >
                      {n.label.length > 19 ? n.label.slice(0, 18) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
        <span className="text-[9px] text-slate-400">Drag pan · Scroll zoom · Dbl-click edit · Click edge removes</span>
        {selected && <span className="text-[9px] text-sky-600 font-medium truncate max-w-[100px]">{nodes.find(n => n.id === selected)?.label}</span>}
      </div>
    </aside>
  );
};
