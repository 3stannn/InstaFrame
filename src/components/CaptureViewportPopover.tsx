"use client";

import React, { useState, useEffect, useRef } from "react";
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

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Capture Viewport Options"
      className="absolute right-0 top-full mt-2 z-50 w-[310px] rounded-xl border border-zinc-700/80 bg-zinc-900 p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none text-zinc-200"
      style={{
        boxShadow: "0 14px 40px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Camera className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-100 leading-none">Capture Viewport</h4>
            <span className="text-[10px] text-zinc-400">{deviceName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Section 1: Capture Area */}
      <div className="mb-3.5">
        <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
          Capture Area
        </label>
        <div className="flex w-full items-start gap-2.5 rounded-lg border border-indigo-500/50 bg-indigo-500/10 p-2 text-left">
          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-indigo-400">
            <div className="h-2 w-2 rounded-full bg-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium leading-none text-zinc-200">Current visible area</div>
            <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
              Capture exactly what is visible at current scroll position
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Output */}
      <div className="mb-3.5">
        <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
          Output
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            data-action="output-mockup-option"
            type="button"
            onClick={() => handleOutputModeChange("mockup")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-all ${
              outputMode === "mockup"
                ? "border-indigo-500/60 bg-indigo-500/15 text-white"
                : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-medium leading-tight">With mockup</span>
          </button>

          <button
            data-action="output-clean-option"
            type="button"
            onClick={() => handleOutputModeChange("clean")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-all ${
              outputMode === "clean"
                ? "border-indigo-500/60 bg-indigo-500/15 text-white"
                : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Download className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-[11px] font-medium leading-tight">Without mockup</span>
          </button>
        </div>
      </div>

      {/* Section 3: Device selector (if "With device mockup" is selected) */}
      {outputMode === "mockup" && (
        <div className="mb-4">
          <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
            Target Mockup Frame
          </label>
          <div className="relative">
            <select
              value={selectedDevicePreset}
              onChange={(e) => {
                const presetKey = e.target.value;
                setSelectedDevicePreset(presetKey);
                const frame = DEVICE_PRESETS[presetKey]?.defaultFrame || "none";
                setSelectedFrame(frame);
              }}
              className="w-full appearance-none rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-600 focus:border-indigo-500 focus:outline-none"
            >
              <optgroup label="Desktop & Laptops">
                <option value="macbook-air-13">MacBook Air 13&quot;</option>
                <option value="macbook-pro-14">MacBook Pro 14&quot;</option>
                <option value="macbook-pro-16">MacBook Pro 16&quot;</option>
                <option value="pro-display-xdr">Apple Pro Display XDR</option>
              </optgroup>
              <optgroup label="Mobile Devices">
                <option value="iphone-15">iPhone 15</option>
                <option value="iphone-15-pro-max">iPhone 15 Pro Max</option>
                <option value="pixel-8">Google Pixel 8</option>
                <option value="s24-ultra">Samsung Galaxy S24 Ultra</option>
              </optgroup>
              <optgroup label="Tablets">
                <option value="ipad-pro-11">iPad Pro 11&quot;</option>
                <option value="ipad-pro-13">iPad Pro 13&quot;</option>
              </optgroup>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-3">
        <button
          data-action="capture-cancel-btn"
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          Cancel
        </button>
        <button
          data-action="capture-submit-btn"
          type="button"
          onClick={handleAction}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Capture</span>
        </button>
      </div>
    </div>
  );
}
