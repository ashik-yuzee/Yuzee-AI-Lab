import React, { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { useTokenLab } from "../context/TokenLabContext";

const SESSION_KEY = "yuzee_location_prompted";

export const LocationPromptModal: React.FC = () => {
  const { userLocation, setUserLocation } = useTokenLab();
  const [visible, setVisible] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedLabel, setDetectedLabel] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userLocation && !sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true);
      attemptGeolocation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep input in sync if geolocation resolves
  const attemptGeolocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.suburb ||
            data.address?.village ||
            data.address?.state ||
            "";
          const country = data.address?.country || "";
          const loc = [city, country].filter(Boolean).join(", ");
          const fallback = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
          const resolved = loc || fallback;
          setDetectedLabel(resolved);
          setInput(resolved);
        } catch {
          // Nominatim failed — user can type manually
        }
        setDetecting(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      () => {
        setDetecting(false);
        setError("Location access was denied — please type your location below.");
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const save = () => {
    const loc = input.trim();
    if (!loc) {
      setError("Please enter your location to continue.");
      inputRef.current?.focus();
      return;
    }
    setUserLocation(loc);
    try { localStorage.setItem("yuzee_user_location", loc); } catch {}
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  const skip = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">

        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 leading-tight">Where are you located?</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Yuzee uses your location to give relevant course options, job markets, and career guidance for your region.
            </p>
          </div>
        </div>

        {/* Detecting state */}
        {detecting ? (
          <div className="flex items-center gap-2.5 py-3 text-sm text-slate-500 border border-slate-100 rounded-lg px-3 bg-slate-50">
            <Loader2 className="w-4 h-4 animate-spin text-sky-500 shrink-0" />
            <span>Detecting your location…</span>
          </div>
        ) : (
          <>
            {/* Detected label */}
            {detectedLabel && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-2">
                <Navigation className="w-3 h-3 shrink-0" />
                <span>Detected: <strong>{detectedLabel}</strong> — edit below if needed.</span>
              </div>
            )}

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && save()}
              placeholder="e.g. Sydney, Australia"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
            />

            {/* Error */}
            {error && (
              <p className="text-xs text-rose-500 mt-1.5">{error}</p>
            )}

            {/* Retry geolocation if not detected */}
            {!detectedLabel && !error && (
              <button
                onClick={() => { setError(""); attemptGeolocation(); }}
                className="mt-2 text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                Try detecting automatically
              </button>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={save}
            disabled={detecting}
            className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            Confirm location
          </button>
          <button
            onClick={skip}
            className="text-xs text-slate-400 hover:text-slate-600 px-3 py-2.5 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};
