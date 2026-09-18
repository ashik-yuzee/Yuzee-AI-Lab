import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useTokenLab } from '../context/TokenLabContext';
const SESSION_KEY = 'yuzee_location_prompted';
export const LocationPromptModal: React.FC = () => {
  const { userLocation, setUserLocation } = useTokenLab();
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!userLocation && !sessionStorage.getItem(SESSION_KEY) && !localStorage.getItem(SESSION_KEY)) setVisible(true); }, []);
  useEffect(() => { if (visible) inputRef.current?.focus(); }, [visible]);
  const close = () => { sessionStorage.setItem(SESSION_KEY, '1'); try { localStorage.setItem(SESSION_KEY, '1'); } catch {} setVisible(false); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) { setError('Type a town, city or postcode, or choose Skip for now.'); inputRef.current?.focus(); return; }
    setUserLocation(input.trim());
    try { localStorage.setItem('yuzee_user_location', input.trim()); } catch {}
    close();
  };
  if (!visible) return null;
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input,button')); if (e.shiftKey && document.activeElement === els[0]) {e.preventDefault();els.at(-1)?.focus();} else if (!e.shiftKey && document.activeElement === els.at(-1)) {e.preventDefault();els[0]?.focus();} } }}>
    <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="location-title" className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
      <MapPin className="w-6 h-6 text-sky-700"/>
      <h2 id="location-title" className="text-lg font-semibold">Where are you located?</h2>
      <p className="text-sm text-slate-600">Type your town, city or postcode to make guidance more relevant. You can skip this and add it later. No street address needed.</p>
      <label htmlFor="initial-location" className="block font-medium">Your location</label>
      <input id="initial-location" ref={inputRef} type="text" value={input} maxLength={500} autoComplete="address-level2" onChange={e => {setInput(e.target.value);setError('');}} placeholder="For example, Geelong, VIC" aria-invalid={!!error} aria-describedby={error ? 'location-error' : undefined} className="w-full rounded-xl border border-slate-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-600"/>
      {error && <p id="location-error" role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2"><button type="submit" className="rounded-xl bg-sky-800 text-white font-semibold px-4 py-3">Use this location</button><button type="button" onClick={close} className="rounded-xl text-slate-600 px-3 py-3">Skip for now</button></div>
    </form>
  </div>;
};
