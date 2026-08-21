import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, Info } from "lucide-react";

export interface AppleSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate';
  group?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface AppleSelectProps {
  id?: string;
  label?: string;
  value: string;
  options: AppleSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  leadingIcon?: React.ComponentType<{ className?: string }>;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;
  footerNote?: React.ReactNode;
  showSearchThreshold?: number;
}

export const AppleSelect: React.FC<AppleSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  leadingIcon: LeadingIcon,
  compact = false,
  disabled = false,
  className = "",
  popoverWidth = "w-84 sm:w-96",
  footerNote,
  showSearchThreshold = 7,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q)) ||
      (opt.group && opt.group.toLowerCase().includes(q))
    );
  });

  // Group options by their category group
  const groupedOptions: { groupName: string; items: AppleSelectOption[] }[] = [];
  filteredOptions.forEach((opt) => {
    const groupName = opt.group || "";
    let g = groupedOptions.find((item) => item.groupName === groupName);
    if (!g) {
      g = { groupName, items: [] };
      groupedOptions.push(g);
    }
    g.items.push(opt);
  });

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && options.length >= showSearchThreshold) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, options.length, showSearchThreshold]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
      triggerButtonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const selectable = filteredOptions.filter((o) => !o.disabled);
      if (selectable.length === 0) return;
      setFocusedIndex((prev) => (prev + 1) % selectable.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const selectable = filteredOptions.filter((o) => !o.disabled);
      if (selectable.length === 0) return;
      setFocusedIndex((prev) => (prev - 1 + selectable.length) % selectable.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectable = filteredOptions.filter((o) => !o.disabled);
      if (focusedIndex >= 0 && focusedIndex < selectable.length) {
        onChange(selectable[focusedIndex].value);
        setIsOpen(false);
        setSearchQuery("");
        triggerButtonRef.current?.focus();
      }
    }
  };

  const getBadgeClass = (color?: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      case "slate":
        return "bg-zinc-100 text-zinc-500 border-zinc-200";
      case "blue":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200/80";
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      {label && <label className="block text-xs font-semibold text-zinc-700 mb-1">{label}</label>}

      {/* Trigger Button */}
      <button
        ref={triggerButtonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || selectedOption?.label || placeholder}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 rounded-xl transition-all duration-150 border ${
          disabled ? "opacity-50 cursor-not-allowed bg-zinc-100 border-zinc-200 text-zinc-500" : "cursor-pointer"
        } ${
          compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
        } ${
          isOpen
            ? "bg-white border-blue-500 ring-2 ring-blue-500/15 shadow-xs text-zinc-900"
            : !disabled ? "bg-zinc-100/80 hover:bg-white border-zinc-200/90 text-zinc-800 hover:border-zinc-300 shadow-2xs" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {LeadingIcon && <LeadingIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
          <span className="font-medium truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-600" : ""}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={label || "Options"}
          className={`absolute left-0 top-full mt-1.5 z-50 ${popoverWidth} rounded-2xl bg-white shadow-xl border border-slate-200 p-1.5 animate-in fade-in zoom-in-95 duration-150 max-h-[420px] flex flex-col`}
        >
          {/* Optional Search Box */}
          {options.length >= showSearchThreshold && (
            <div className="p-1 pb-2 border-b border-slate-100 mb-1">
              <div className="relative flex items-center bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto space-y-2 flex-1 pr-0.5">
            {groupedOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-400">No matching options</div>
            ) : (
              groupedOptions.map((g, gIdx) => (
                <div key={gIdx} className="space-y-0.5">
                  {g.groupName && (
                    <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 select-none">
                      {g.groupName}
                    </div>
                  )}

                  {g.items.map((opt) => {
                    const isSelected = opt.value === value;
                    const isDisabled = !!opt.disabled;
                    const OptIcon = opt.icon;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) {
                            onChange(opt.value);
                            setIsOpen(false);
                            setSearchQuery("");
                            triggerButtonRef.current?.focus();
                          }
                        }}
                        className={`w-full flex items-start justify-between gap-3 px-2.5 py-2 rounded-xl text-left transition-all ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed bg-transparent"
                            : isSelected
                            ? "bg-blue-50/80 text-blue-950 shadow-2xs font-medium cursor-pointer"
                            : "hover:bg-zinc-100/70 text-zinc-800 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {OptIcon && <OptIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-blue-600" : "text-zinc-400"}`} />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs ${isSelected ? "font-semibold text-zinc-900" : "font-medium text-zinc-900"}`}>
                                {opt.label}
                              </span>
                              {opt.badge && (
                                <span className={`px-1.5 py-0.2 text-[9px] font-semibold border rounded-full ${getBadgeClass(opt.badgeColor)}`}>
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            {opt.description && (
                              <p className="text-[11px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">
                                {opt.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer Note (e.g. 3.6 Flash-Lite informative disclaimer) */}
          {footerNote && (
            <div className="mt-1 pt-2 border-t border-zinc-100 px-2 text-[11px] text-zinc-500">
              {footerNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
