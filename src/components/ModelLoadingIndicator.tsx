import React, { useEffect, useState } from 'react';
import { getRouterStatus, onRouterStatus, startWarmup, type RouterStatus } from '../services/MicroToolRouter';

export function ModelLoadingIndicator() {
  const [status, setStatus] = useState<RouterStatus>(getRouterStatus);

  useEffect(() => {
    const unsub = onRouterStatus(setStatus);
    startWarmup();
    return unsub;
  }, []);

  if (status === 'idle' || status === 'ready') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3 py-2 rounded-2xl shadow-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-medium">
      {status === 'loading' ? (
        <span className="text-slate-500">Preparing Oala assist…</span>
      ) : (
        <span className="text-slate-400">Oala can still answer</span>
      )}
    </div>
  );
}
