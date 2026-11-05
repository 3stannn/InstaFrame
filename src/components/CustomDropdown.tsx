"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Check,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Sliders,
  Square,
  Sparkles,
} from "lucide-react";

export interface DropdownItem {
  value: string;
  label: string;
  meta?: string;
  section?: string;
  icon?: "monitor" | "laptop" | "tablet" | "phone" | "custom" | "raw" | "pro";
  swatchClass?: string;
  swatchStyle?: React.CSSProperties;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  items: DropdownItem[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  showTriggerMeta?: boolean;
}

export function CustomDropdown({
  value,
  onChange,
  items,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  align,
  showTriggerMeta = true,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item.value === value) || items[0];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Group items by section
  const sections: { sectionName: string; items: DropdownItem[] }[] = [];
  let currentSec = "";
  items.forEach((item) => {
    const sec = item.section || "";
    if (sec !== currentSec || sections.length === 0) {
      currentSec = sec;
      sections.push({ sectionName: sec, items: [item] });
    } else {
      sections[sections.length - 1].items.push(item);
    }
  });

  const renderIcon = (
    icon?: string,
    swatchClass?: string,
    swatchStyle?: React.CSSProperties,
    isSelected = false
  ) => {
    if (swatchClass || swatchStyle) {
      return (
        <span
          className={`h-3 w-3 shrink-0 rounded-full border border-white/20 ${swatchClass || ""}`}
          style={swatchStyle}
        />
      );
    }

    const iconClasses = `h-3.5 w-3.5 flex-shrink-0 ${
      isSelected ? "text-white" : "text-zinc-400"
    }`;

    switch (icon) {
      case "monitor":
        return <Monitor className={iconClasses} />;
      case "laptop":
        return <Laptop className={iconClasses} />;
      case "tablet":
        return <Tablet className={iconClasses} />;
      case "phone":
        return <Smartphone className={iconClasses} />;
      case "custom":
        return <Sliders className={iconClasses} />;
      case "raw":
        return <Square className={iconClasses} />;
      case "pro":
        return <Sparkles className={iconClasses} />;
      default:
        return null;
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-9 w-full items-center justify-between rounded-full border border-white/10 bg-[#0a0a0c] px-3.5 text-left text-xs text-white transition-all duration-150 ease-out hover:border-white/20 hover:bg-[#141417] active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? "border-white/25 ring-1 ring-white/20 bg-[#141417]" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {renderIcon(
            selectedItem?.icon,
            selectedItem?.swatchClass,
            selectedItem?.swatchStyle,
            true
          )}
          <span className="truncate font-medium text-white">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </div>

        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
          {showTriggerMeta && selectedItem?.meta && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] tabular-nums text-zinc-400">
              {selectedItem.meta}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 ease-out ${
              isOpen ? "rotate-180 text-white" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a0c]/98 backdrop-blur-xl p-1.5 shadow-2xl ${
            align === "right"
              ? "right-0 w-full min-w-[220px]"
              : align === "left"
              ? "left-0 w-full min-w-[220px]"
              : "left-0 right-0 w-full"
          }`}
        >
          {sections.map((group, groupIdx) => (
            <div key={group.sectionName || `group-${groupIdx}`}>
              {group.sectionName && (
                <div
                  className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${
                    groupIdx > 0 ? "mt-1 border-t border-white/5 pt-1.5" : ""
                  }`}
                >
                  {group.sectionName}
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isSelected = item.value === value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(item.value);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors duration-120 active:scale-[0.98] ${
                        isSelected
                          ? "bg-white/10 font-semibold text-white border border-white/15"
                          : "text-zinc-300 hover:bg-[#141417] hover:text-white border border-transparent"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                        {renderIcon(item.icon, item.swatchClass, item.swatchStyle, isSelected)}
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                        {item.meta && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] tabular-nums border ${
                              isSelected
                                ? "border-white/20 bg-white/10 text-white"
                                : "border-white/10 bg-white/5 text-zinc-400"
                            }`}
                          >
                            {item.meta}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-white stroke-[2.5]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
