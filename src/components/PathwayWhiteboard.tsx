import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Plus, Trash2, Link2, ZoomIn, ZoomOut, Maximize2, RotateCcw, Sparkles, Network } from "lucide-react";
import { useTokenLab } from "../context/TokenLabContext";

type NodeType = "goal" | "step" | "option" | "milestone" | "current" | "complete" | "blocked";

interface PWNode { id: string; label: string; type: NodeType; x: number; y: number; }
interface PWEdge { id: string; from: string; to: string; }

const NW = 144, NH = 46;

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
  byLayer.forEach((ids, l) => ids.forEach((id, i) => pos.set(id, { x: 50 + l * (NW + 68), y: 40 + i * (NH + 52) })));
  return rawNodes.map(n => ({ ...n, ...(pos.get(n.id) || { x: 50, y: 50 }) } as PWNode));
}

const LS_KEY = "yuzee_whiteboard";
const FLOW_TYPE_MAP: Record<string, NodeType> = { goal: "goal", decision: "option", ok: "complete", warn: "blocked" };

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
  const [banner, setBanner] = useState<string | null>(null);
  const [mouseUser, setMouseUser] = useState({ x: 0, y: 0 });

  const dragging  = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef    = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const svgRef    = useRef<SVGSVGElement>(null);
  const lastAiId  = useRef("");
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

  // Non-passive wheel listener for zoom
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

  // Auto-import from last AI message
  useEffect(() => {
    const msgs = currentConversation?.messages || [];
    const last = [...msgs].reverse().find(m => m.role === "assistant");
    if (!last?.structuredResponse?.content_blocks) return;
    const msgId = String(last.id || "");
    if (!msgId || msgId === lastAiId.current) return;

    const blocks: any[] = last.structuredResponse.content_blocks;
    const fb = blocks.find(b => b.type === "flow"        && b.data?.nodes?.length > 0);
    const pb = blocks.find(b => b.type === "pathway_map" && b.data?.lanes?.length > 0);
    const tb = blocks.find(b => b.type === "timeline"    && b.data?.milestones?.length > 0);
    if (!fb && !pb && !tb) return;

    lastAiId.current = msgId;
    let newNodes: PWNode[] = [];
    let newEdges: PWEdge[] = [];

    if (fb) {
      const rn = (fb.data.nodes || []).map((n: any) => ({
        id: `ai-${n.id}`, label: n.label || n.id,
        type: (FLOW_TYPE_MAP[n.node_type] || "step") as NodeType,
      }));
      const re = (fb.data.edges || []).map((e: any, i: number) => ({ from: `ai-${e.from}`, to: `ai-${e.to}`, id: `ae${i}` }));
      newNodes = autoLayout(rn, re);
      newEdges = re;
    } else if (pb) {
      let y = 40;
      pb.data.lanes.forEach((lane: any, li: number) => {
        let x = 50;
        (lane.steps || []).forEach((step: any, si: number) => {
          newNodes.push({ id: `ai-l${li}s${si}`, label: step.label, type: "step", x, y });
          if (si > 0) newEdges.push({ id: `ae-l${li}s${si}`, from: `ai-l${li}s${si - 1}`, to: `ai-l${li}s${si}` });
          x += NW + 62;
        });
        y += NH + 52;
      });
    } else if (tb) {
      const sMap: Record<string, NodeType> = { complete: "complete", current: "current", upcoming: "step" };
      tb.data.milestones.forEach((ms: any, i: number) => {
        newNodes.push({ id: `ai-ms${i}`, label: ms.label, type: sMap[ms.status] || "milestone", x: 50 + i * (NW + 62), y: 60 });
        if (i > 0) newEdges.push({ id: `ae-ms${i}`, from: `ai-ms${i - 1}`, to: `ai-ms${i}` });
      });
    }

    if (newNodes.length === 0) return;
    const curNodes = nodesRef.current;
    const xOff = curNodes.length > 0 ? Math.max(...curNodes.map(n => n.x + NW)) + 80 : 0;
    const placed = newNodes.map(n => ({ ...n, x: n.x + xOff }));
    setNodes(prev => { const u = [...prev, ...placed]; persist(u, [...edgesRef.current, ...newEdges]); return u; });
    setEdges(prev => [...prev, ...newEdges]);
    setBanner(`Imported ${placed.length} node${placed.length > 1 ? "s" : ""} from AI`);
    setTimeout(() => setBanner(null), 4500);
    setWhiteboardOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.messages?.length]);

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
    setEditingId(id);
    setEditText(node.label);
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
    if (nodes.length === 0) return;
    const pad = 44;
    const x0 = Math.min(...nodes.map(n => n.x)) - pad;
    const y0 = Math.min(...nodes.map(n => n.y)) - pad;
    const x1 = Math.max(...nodes.map(n => n.x + NW)) + pad;
    const y1 = Math.max(...nodes.map(n => n.y + NH)) + pad;
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 2.5);
    setScale(z);
    setTx(-x0 * z);
    setTy(-y0 * z);
  };

  if (!isWhiteboardOpen) return null;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connSrc = connectFrom ? nodeMap.get(connectFrom) : null;

  return (
    <aside className="fixed right-0 top-14 bottom-0 z-40 w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Network className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Pathway Whiteboard</h2>
            <p className="text-[10px] text-slate-500 leading-tight">{nodes.length} nodes · {edges.length} edges</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={fitView} title="Fit to view" className="p-1.5 text-slate-400 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setNodes([]); setEdges([]); setSelected(null); persist([], []); }}
            title="Clear whiteboard"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setWhiteboardOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 shrink-0 flex-wrap">
        {/* Add node */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setMode(mode === "add" ? "select" : "add")}
            title="Add node (click canvas to place)"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === "add" ? "bg-violet-600 text-white" : "bg-white text-slate-700 hover:bg-violet-50 hover:text-violet-700"
            }`}
          >
            <Plus className="w-3 h-3" />Add
          </button>
          <div className="w-px bg-slate-200" />
          <select
            value={addType}
            onChange={e => setAddType(e.target.value as NodeType)}
            className="text-xs px-2 py-1.5 bg-white text-slate-600 border-none outline-none cursor-pointer"
          >
            {(Object.keys(TYPE_LABELS) as NodeType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Connect */}
        <button
          onClick={() => { setMode(mode === "connect" ? "select" : "connect"); setConnectFrom(null); }}
          title="Connect two nodes with an edge"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            mode === "connect"
              ? "bg-sky-600 text-white border-sky-600"
              : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200"
          }`}
        >
          <Link2 className="w-3 h-3" />
          {connectFrom ? "→ Pick target" : "Connect"}
        </button>

        {/* Delete */}
        <button
          onClick={deleteSelected}
          disabled={!selected}
          title="Delete selected node and its edges (Del)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />Delete
        </button>

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => setScale(s => Math.min(3, s * 1.2))} title="Zoom in" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 w-9 text-center font-mono">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.2, s / 1.2))} title="Zoom out" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Import banner */}
      {banner && (
        <div className="px-3 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2 text-xs text-violet-800 font-medium shrink-0">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-500" />
          {banner}
        </div>
      )}

      {/* Mode hint */}
      {(mode === "add" || mode === "connect") && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 shrink-0">
          {mode === "add"
            ? `Click canvas to place a "${TYPE_LABELS[addType]}" node · Esc to cancel`
            : connectFrom ? "Click the target node to connect · Esc to cancel" : "Click the source node to start an edge"}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#f9fafb]">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Network className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">No pathway yet</p>
            <p className="text-xs text-slate-300 mt-1 max-w-[220px] text-center leading-relaxed">
              Add nodes via the toolbar, or chat — AI pathway blocks appear here automatically.
            </p>
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
              <circle cx="10" cy="10" r="0.9" fill="#d1d5db" />
            </pattern>
            <marker id="wb-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
            <marker id="wb-arr-hi" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" />
            </marker>
            <marker id="wb-arr-gh" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" opacity="0.55" />
            </marker>
          </defs>

          {/* Background dot grid */}
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
                  {/* Wide transparent hit area for click-to-delete */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "pointer" }}
                    onClick={() => deleteEdge(e.id)} />
                  <path d={d} fill="none"
                    stroke={hi ? "#0ea5e9" : "#94a3b8"}
                    strokeWidth={hi ? 2 : 1.5}
                    markerEnd={`url(#wb-arr${hi ? "-hi" : ""})`}
                    opacity={hi ? 1 : 0.8}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Ghost edge while in connect mode */}
            {connSrc && (
              <line
                x1={connSrc.x + NW / 2} y1={connSrc.y + NH / 2}
                x2={mouseUser.x} y2={mouseUser.y}
                stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="5 4"
                markerEnd="url(#wb-arr-gh)" opacity={0.65} pointerEvents="none"
              />
            )}

            {/* Nodes */}
            {nodes.map(n => {
              const s = STYLES[n.type];
              const isSel  = selected === n.id;
              const isConn = connectFrom === n.id;
              const accentStroke = isSel || isConn ? "#0ea5e9" : s.stroke;
              const hasTypeBadge = n.type !== "step";
              const labelY = hasTypeBadge ? NH / 2 + 7 : NH / 2 + 4;

              return (
                <g key={n.id} className="pnode"
                  transform={`translate(${n.x}, ${n.y})`}
                  onMouseDown={ev => handleNodeDown(ev, n.id)}
                  onClick={ev => handleNodeClick(ev, n.id)}
                  onDoubleClick={ev => handleNodeDbl(ev, n.id)}
                  style={{ cursor: mode === "connect" ? "crosshair" : "grab" }}
                >
                  <rect
                    width={NW} height={NH} rx={9}
                    fill={s.fill}
                    stroke={accentStroke}
                    strokeWidth={isSel || isConn ? 2.5 : 1.5}
                    style={{ filter: isSel ? "drop-shadow(0 2px 10px rgba(14,165,233,0.3))" : "none" }}
                  />
                  {/* Type label badge */}
                  {hasTypeBadge && (
                    <text x={6} y={11} fontSize={7} fontWeight={700}
                      fill={s.text} opacity={0.45}
                      style={{ userSelect: "none", textTransform: "uppercase", letterSpacing: "0.04em" }}
                      pointerEvents="none"
                    >
                      {n.type}
                    </text>
                  )}
                  {/* Editable label */}
                  {editingId === n.id ? (
                    <foreignObject x={5} y={labelY - 10} width={NW - 10} height={22}>
                      <input
                        autoFocus
                        value={editText}
                        onChange={ev => setEditText(ev.target.value)}
                        onBlur={() => commitEdit(n.id)}
                        onKeyDown={ev => { if (ev.key === "Enter") commitEdit(n.id); if (ev.key === "Escape") setEditingId(null); }}
                        style={{
                          width: "100%", height: "100%", border: "none", background: "transparent",
                          outline: "none", fontSize: 11, fontWeight: 600, color: s.text,
                          textAlign: "center", padding: 0,
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <text x={NW / 2} y={labelY}
                      textAnchor="middle" fontSize={11} fontWeight={n.type === "goal" ? 700 : 600}
                      fill={s.text} pointerEvents="none"
                      style={{ userSelect: "none" }}
                    >
                      {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
        <span className="text-[10px] text-slate-400">Drag pan · Scroll zoom · Dbl-click edit · Click edge removes it</span>
        {selected && (
          <span className="text-[10px] text-sky-600 font-medium truncate max-w-[130px]">
            {nodes.find(n => n.id === selected)?.label}
          </span>
        )}
      </div>
    </aside>
  );
};
