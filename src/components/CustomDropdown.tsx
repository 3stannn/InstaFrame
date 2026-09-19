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
  isPro?: boolean;
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
          style={swatchStyle}
          className={`h-4 w-4 flex-shrink-0 rounded-full ring-1 ring-white/10 shadow-sm ${swatchClass || ""}`}
        />
      );
    }
    let IconComponent = null;
    if (icon === "monitor") IconComponent = Monitor;
    else if (icon === "laptop") IconComponent = Laptop;
    else if (icon === "tablet") IconComponent = Tablet;
    else if (icon === "phone") IconComponent = Smartphone;
    else if (icon === "custom") IconComponent = Sliders;
    else if (icon === "raw") IconComponent = Square;
    else if (icon === "pro") IconComponent = Sparkles;

    if (!IconComponent) return null;

    return (
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors ${
          isSelected
            ? "bg-zinc-200 text-zinc-900"
            : "bg-zinc-800/80 text-zinc-400"
        }`}
      >
        <IconComponent className="h-3 w-3" />
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-9 w-full items-center justify-between rounded-xl border px-3 text-xs outline-none transition-all duration-150 ${
          isOpen
            ? "border-zinc-600 bg-zinc-900 shadow-sm"
            : "border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 hover:bg-zinc-900"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {renderIcon(selectedItem?.icon, selectedItem?.swatchClass, selectedItem?.swatchStyle, false)}
          <span className="truncate font-semibold text-zinc-100">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </div>

        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
          {showTriggerMeta && selectedItem?.meta && (
            <span className="rounded border border-zinc-700/40 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-400">
              {selectedItem.meta}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-zinc-200" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900 p-1.5 shadow-2xl ${
            align === "right"
              ? "right-0 w-full min-w-[210px]"
              : align === "left"
              ? "left-0 w-full min-w-[210px]"
              : "left-0 right-0 w-full"
          }`}
        >
          {sections.map((group, groupIdx) => (
            <div key={group.sectionName || `group-${groupIdx}`}>
              {group.sectionName && (
                <div
                  className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${
                    groupIdx > 0 ? "mt-1 border-t border-zinc-800/80 pt-1.5" : ""
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
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all duration-100 ${
                        isSelected
                          ? "bg-white font-semibold text-zinc-900 shadow-sm"
                          : "text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {renderIcon(item.icon, item.swatchClass, item.swatchStyle, isSelected)}
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                        {item.meta && (
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums ${
                              isSelected
                                ? "bg-zinc-200 text-zinc-800"
                                : "bg-zinc-800/80 text-zinc-400"
                            }`}
                          >
                            {item.meta}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-zinc-900 stroke-[2.5]" />
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
