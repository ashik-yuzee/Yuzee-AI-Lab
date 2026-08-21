import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface AppleConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AppleConfirmDialog: React.FC<AppleConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  const dialogText = description || message || "";
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus safe cancel button by default
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="apple-confirm-title"
        aria-describedby="apple-confirm-desc"
        className="w-full max-w-sm rounded-2xl bg-white/95 apple-glass apple-dialog-shadow border border-zinc-200/90 p-5 animate-in zoom-in-95 duration-150 flex flex-col text-center"
      >
        <div className="mx-auto w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
          <AlertTriangle className={`w-5 h-5 ${isDestructive ? "text-red-500" : "text-amber-500"}`} />
        </div>

        <h3 id="apple-confirm-title" className="text-base font-semibold text-zinc-900 tracking-tight">
          {title}
        </h3>

        <p id="apple-confirm-desc" className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
          {dialogText}
        </p>

        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="w-full py-2 px-3 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-300 rounded-xl transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full py-2 px-3 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer shadow-xs ${
              isDestructive
                ? "bg-red-500 hover:bg-red-600 active:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
