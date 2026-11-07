"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  X,
  Layers,
  Download,
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  AlertCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { DEVICE_PRESETS, FRAME_OPTIONS } from "@/lib/devices";

export type CaptureOutputOption = "mockup" | "clean";

const POPOVER_WIDTH = 320;

interface CaptureViewportPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureVisible: (output: CaptureOutputOption, selectedPreset: string, selectedFrame: string) => void;
  currentPresetKey: string;
  deviceName: string;
  previewMode: "preview" | "live";
  onSwitchToPreview?: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function CaptureViewportPopover({
  isOpen,
  onClose,
  onCaptureVisible,
  currentPresetKey,
  deviceName,
  previewMode,
  onSwitchToPreview,
  triggerRef,
}: CaptureViewportPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  // The trigger sits inside a scaled, overflow-hidden viewport card. Render the
  // popover in a portal at full size, anchored below the trigger's right edge.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = popoverRef.current?.offsetWidth || POPOVER_WIDTH;
      const height = popoverRef.current?.offsetHeight || 0;
      const left = Math.min(Math.max(8, trigger.right - width), window.innerWidth - width - 8);
      let top = trigger.bottom + 8;
      if (height && top + height > window.innerHeight - 8) top = Math.max(8, trigger.top - height - 8);
      setPosition({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, triggerRef]);

  // Output preference (persisted)
  const [outputMode, setOutputMode] = useState<CaptureOutputOption>("mockup");

  // Device / Frame selection
  const defaultFrame = DEVICE_PRESETS[currentPresetKey]?.defaultFrame || "macbook-air-13";
  const [selectedDevicePreset, setSelectedDevicePreset] = useState(currentPresetKey);
  const [selectedFrame, setSelectedFrame] = useState(defaultFrame);

  // Load saved output preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("instaframe_capture_output");
      if (saved === "mockup" || saved === "clean") {
        setOutputMode(saved);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Update selection when currentPresetKey changes
  useEffect(() => {
    setSelectedDevicePreset(currentPresetKey);
    const frame = DEVICE_PRESETS[currentPresetKey]?.defaultFrame || "none";
    setSelectedFrame(frame);
  }, [currentPresetKey]);

  // Handle output mode change and persist
  const handleOutputModeChange = (mode: CaptureOutputOption) => {
    setOutputMode(mode);
    try {
      localStorage.setItem("instaframe_capture_output", mode);
    } catch {
      // Ignore
    }
  };

  // Keyboard navigation & outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const handleAction = () => {
    onCaptureVisible(outputMode, selectedDevicePreset, selectedFrame);
    onClose();
  };

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Capture viewport"
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className="surface-modal menu fixed z-[60] w-[320px] max-w-[calc(100vw-16px)] !p-0 select-none text-ink"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">Capture viewport</h4>
          <p className="mt-0.5 truncate text-xs text-ink-secondary">{deviceName}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          className="icon-btn -mr-1.5 -mt-0.5"
          aria-label="Close dialog"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3.5 px-4 pb-4 pt-2.5">
        {/* Section 1: Capture Area */}
        <div>
          <div className="section-label">Area</div>
          <div className="radio-card is-selected">
            <div className="min-w-0 flex-1">
              <div className="radio-card-title">Current visible area</div>
              <div className="radio-card-desc">What is visible at the current scroll position</div>
            </div>
            <span className="radio-dot" aria-hidden="true" />
          </div>
        </div>

        {/* Section 2: Output */}
        <div>
          <div className="section-label" id="capture-output-label">Output</div>
          <div role="radiogroup" aria-labelledby="capture-output-label" className="grid grid-cols-1 gap-2">
            {([
              { value: "mockup", title: "With mockup", desc: "Open it in the device mockup studio", Icon: Layers, action: "output-mockup-option" },
              { value: "clean", title: "Without mockup", desc: "Download the plain screenshot as PNG", Icon: Download, action: "output-clean-option" },
            ] as const).map(({ value, title, desc, Icon, action }) => (
              <button
                key={value}
                data-action={action}
                type="button"
                role="radio"
                aria-checked={outputMode === value}
                onClick={() => handleOutputModeChange(value)}
                className="radio-card"
              >
                <Icon className="radio-card-icon" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="radio-card-title block">{title}</span>
                  <span className="radio-card-desc block">{desc}</span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Device selector (if "With device mockup" is selected) */}
        {outputMode === "mockup" && (
          <div>
            <label htmlFor="capture-mockup-frame" className="section-label block">
              Mockup frame
            </label>
            <div className="relative">
              <select
                id="capture-mockup-frame"
                value={selectedDevicePreset}
                onChange={(e) => {
                  const presetKey = e.target.value;
                  setSelectedDevicePreset(presetKey);
                  const frame = DEVICE_PRESETS[presetKey]?.defaultFrame || "none";
                  setSelectedFrame(frame);
                }}
                className="field w-full cursor-pointer appearance-none pl-3 pr-8 text-[12.5px] outline-none hover:bg-control-hover focus:border-line-focus"
              >
                <optgroup label="Desktops and laptops">
                  <option value="macbook-air-13">MacBook Air 13&quot;</option>
                  <option value="macbook-pro-14">MacBook Pro 14&quot;</option>
                  <option value="macbook-pro-16">MacBook Pro 16&quot;</option>
                  <option value="pro-display-xdr">Apple Pro Display XDR</option>
                </optgroup>
                <optgroup label="Phones">
                  <option value="iphone-15">iPhone 15</option>
                  <option value="iphone-16-pro-max">iPhone 16 Pro Max</option>
                  <option value="pixel-8">Google Pixel 8</option>
                  <option value="samsung-s24-ultra">Samsung Galaxy S24 Ultra</option>
                </optgroup>
                <optgroup label="Tablets">
                  <option value="ipad-pro-11">iPad Pro 11&quot;</option>
                  <option value="ipad-pro-13">iPad Pro 13&quot;</option>
                </optgroup>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary" />
            </div>
          </div>
        )}
      </div>

      {/* Pinned footer: secondary left, gradient primary fills the rest */}
      <div className="modal-footer rounded-b-card">
        <button
          data-action="capture-cancel-btn"
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          className="btn btn-secondary btn-lg"
        >
          Cancel
        </button>
        <button
          data-action="capture-submit-btn"
          type="button"
          onClick={handleAction}
          className="btn btn-primary btn-lg"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Capture</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
