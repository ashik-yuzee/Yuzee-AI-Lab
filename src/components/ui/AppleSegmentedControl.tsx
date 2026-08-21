import React from "react";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface AppleSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const AppleSegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = "",
}: AppleSegmentedControlProps<T>) => {
  return (
    <div
      role="tablist"
      className={`inline-flex p-1 bg-zinc-200/70 rounded-xl border border-zinc-300/40 select-none ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.id === value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer ${
              size === 'sm' ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            } ${
              isSelected
                ? "bg-white text-zinc-900 shadow-xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-white/40"
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-zinc-500"}`} />}
            <span>{opt.label}</span>
            {opt.badge && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
                isSelected ? "bg-zinc-100 text-zinc-600" : "bg-zinc-300/60 text-zinc-600"
              }`}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
