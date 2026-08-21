import React from "react";

interface AppleSliderProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  formatValue?: (val: number) => string;
  minLabel?: string;
  maxLabel?: string;
  helperText?: string;
}

export const AppleSlider: React.FC<AppleSliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  formatValue,
  minLabel,
  maxLabel,
  helperText,
}) => {
  const displayValue = formatValue ? formatValue(value) : `${value.toLocaleString()}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-zinc-700">
          {label}
        </label>
        <span className="font-mono font-semibold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md text-[11px] border border-blue-200/50">
          {displayValue}
        </span>
      </div>

      <div className="relative flex items-center">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
        />
      </div>

      {(minLabel || maxLabel || helperText) && (
        <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono">
          <span>{minLabel || `${min}${unit}`}</span>
          {helperText && <span className="text-zinc-600 font-sans">{helperText}</span>}
          <span>{maxLabel || `${max}${unit}`}</span>
        </div>
      )}
    </div>
  );
};
