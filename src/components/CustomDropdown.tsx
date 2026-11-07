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

const MENU_MAX_HEIGHT = 288;

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
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Menus near the bottom of their scroll container (or the window) open upward.
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect();
      let bottom = window.innerHeight;
      let top = 0;
      for (let el = containerRef.current.parentElement; el; el = el.parentElement) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") {
          const rect = el.getBoundingClientRect();
          bottom = Math.min(bottom, rect.bottom);
          top = Math.max(top, rect.top);
          break;
        }
      }
      const spaceBelow = bottom - trigger.bottom;
      const spaceAbove = trigger.top - top;
      setOpenUp(spaceBelow < MENU_MAX_HEIGHT + 12 && spaceAbove > spaceBelow);
    }
    setIsOpen(!isOpen);
  };

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
          className={`h-3 w-3 shrink-0 rounded-full border border-white/25 ${swatchClass || ""}`}
          style={swatchStyle}
        />
      );
    }

    const iconClasses = `h-3.5 w-3.5 flex-shrink-0 ${
      isSelected ? "text-ink" : "text-ink-secondary"
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
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="field w-full justify-between pl-2.5 pr-2 text-left text-[12.5px]"
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {renderIcon(
            selectedItem?.icon,
            selectedItem?.swatchClass,
            selectedItem?.swatchStyle,
            true
          )}
          <span className="truncate text-ink">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </div>

        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
          {showTriggerMeta && selectedItem?.meta && (
            <span className="text-[11px] tabular-nums text-ink-subtle">{selectedItem.meta}</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-ink-secondary transition-transform duration-150 ease-out ${
              isOpen ? "rotate-180 text-ink" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`menu absolute z-50 max-h-72 overflow-y-auto ${
            openUp ? "menu-up bottom-full mb-1.5" : "top-full mt-1.5"
          } ${
            align === "right"
              ? "right-0 w-full min-w-[248px]"
              : align === "left"
              ? "left-0 w-full min-w-[248px]"
              : "left-0 right-0 w-full"
          }`}
        >
          {sections.map((group, groupIdx) => (
            <div
              key={group.sectionName || `group-${groupIdx}`}
              className={!group.sectionName && groupIdx > 0 ? "menu-divider" : undefined}
            >
              {group.sectionName && (
                <div className={`menu-section ${groupIdx > 0 ? "menu-divider" : ""}`}>
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
                      className={`menu-item ${isSelected ? "font-medium" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                        {renderIcon(item.icon, item.swatchClass, item.swatchStyle, isSelected)}
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                        {item.meta && (
                          <span className="text-[11px] tabular-nums text-ink-subtle">{item.meta}</span>
                        )}
                        {isSelected && (
                          <Check aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-ink" />
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
