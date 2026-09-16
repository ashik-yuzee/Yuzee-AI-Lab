import React, { useEffect, useState } from 'react';
import { onLoadProgress, modelDevice } from '../services/MicroToolRouter';

const R = 16; // circle radius
const C = 2 * Math.PI * R; // circumference

export function ModelLoadingIndicator() {
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState('Starting…');
  const [phase, setPhase] = useState<'loading' | 'done' | 'hidden'>('loading');
  const [device, setDevice] = useState<'webgpu' | 'cpu' | null>(null);

  useEffect(() => {
    const unsub = onLoadProgress((p, l) => {
      if (p < 0) { setPhase('hidden'); return; }
      setPct(Math.min(p, 100));
      setLabel(l);
      if (p >= 100) {
        setDevice(modelDevice);
        setPhase('done');
        setTimeout(() => setPhase('hidden'), 2200);
      }
    });
    return unsub;
  }, []);

  if (phase === 'hidden') return null;

  const offset = C - (pct / 100) * C;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3 py-2 rounded-2xl shadow-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-medium"
      style={{
        animation: phase === 'done' ? 'fadeOut 0.6s ease 1.6s forwards' : 'slideIn 0.3s ease',
      }}
    >
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeOut { from { opacity:1; } to { opacity:0; pointer-events:none; } }
        @keyframes checkPop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {phase === 'loading' ? (
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
          {/* Track */}
          <circle cx="18" cy="18" r={R} fill="none" stroke="#e2e8f0" strokeWidth="3" />
          {/* Progress arc */}
          <circle
            cx="18" cy="18" r={R}
            fill="none"
            stroke="var(--accent, #7244c6)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90 18 18)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
          {/* Percentage text */}
          <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="600" fill="#64748b">
            {Math.round(pct)}%
          </text>
        </svg>
      ) : (
        <div
          style={{ animation: 'checkPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards', flexShrink: 0 }}
          className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <span className="text-slate-800 font-semibold text-[11px] leading-tight flex items-center gap-1">
          {phase === 'done' ? 'AI router ready' : 'Loading AI router'}
          {phase === 'done' && device === 'webgpu' && (
            <span className="px-1 py-0.5 rounded text-[8px] font-bold tracking-wide bg-violet-100 text-violet-600">GPU</span>
          )}
        </span>
        <span className="text-slate-400 text-[10px] leading-tight truncate max-w-[120px]">{label}</span>
      </div>
    </div>
  );
}
