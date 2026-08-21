import React from "react";

interface AppleToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export const AppleToggle: React.FC<AppleToggleProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  description,
}) => {
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 cursor-pointer select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {(label || description) && (
        <div className="flex-1 min-w-0 pr-2">
          {label && <div className="text-xs font-semibold text-zinc-800">{label}</div>}
          {description && <div className="text-[11px] text-zinc-500 mt-0.5 leading-normal">{description}</div>}
        </div>
      )}

      <div className="relative inline-flex items-center shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out border ${
            checked ? "bg-emerald-500 border-emerald-600/30" : "bg-zinc-200/90 border-zinc-300/80"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out mt-[1px] ml-[1px] ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </div>
    </label>
  );
};
