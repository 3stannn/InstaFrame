"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  RotateCcw,
  RefreshCw,
  ExternalLink,
  X,
  Camera,
  Layers,
  AlertCircle,
  Wifi,
  Sliders,
  Check,
  Shield,
  Globe,
} from "lucide-react";
import { DEVICE_PRESETS } from "@/lib/devices";
import { BridgeCapabilities } from "@/lib/preview-bridge";
import {
  CaptureViewportPopover,
  CaptureOutputOption,
} from "../CaptureViewportPopover";

export interface DeviceFrameDevice {
  id: string;
  presetKey: string;
  name: string;
  width: number;
  height: number;
  rotated: boolean;
  reloadKey: number;
}

export interface DeviceFrameProps {
  device: DeviceFrameDevice;
  url: string;
  scale: number;
  previewMode: "live" | "preview";
  snapshotDataUrl?: string;
  isSnapshotLoading?: boolean;
  embedStatus?: {
    checked: boolean;
    canEmbed: boolean;
    isRestricted?: boolean;
    reason?: string;
  };
  isMixedContent?: boolean;
  bridgeConnected?: boolean;
  bridgeCapabilities?: BridgeCapabilities;
  onRotate: (id: string) => void;
  onReload: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateDimensions: (id: string, width: number, height: number) => void;
  onCaptureVisible: (
    deviceId: string,
    output: CaptureOutputOption,
    preset: string,
    frame: string
  ) => void;
  onOpenBridgeHelp?: () => void;
  iframeRefCallback?: (id: string, el: HTMLIFrameElement | null) => void;
}

const TOOLBAR_HEIGHT = 36;
const BORDER_WIDTH = 1; // 1px border on each side

export function DeviceFrame({
  device,
  url,
  scale,
  previewMode,
  snapshotDataUrl,
  isSnapshotLoading,
  embedStatus,
  isMixedContent,
  bridgeConnected,
  bridgeCapabilities,
  onRotate,
  onReload,
  onRemove,
  onUpdateDimensions,
  onCaptureVisible,
  onOpenBridgeHelp,
  iframeRefCallback,
}: DeviceFrameProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [editDimensionsOpen, setEditDimensionsOpen] = useState(false);
  const [capturePopoverOpen, setCapturePopoverOpen] = useState(false);
  const [customW, setCustomW] = useState(String(device.width));
  const [customH, setCustomH] = useState(String(device.height));
  const cameraBtnRef = useRef<HTMLButtonElement>(null);
  const localIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync dimensions state when device dimensions change
  useEffect(() => {
    setCustomW(String(device.width));
    setCustomH(String(device.height));
  }, [device.width, device.height]);

  // Notify parent of iframe element lifecycle safely via effect
  useEffect(() => {
    const el = localIframeRef.current;
    if (iframeRefCallback && el) {
      iframeRefCallback(device.id, el);
    }
    return () => {
      if (iframeRefCallback) {
        iframeRefCallback(device.id, null);
      }
    };
  }, [device.id, device.reloadKey, iframeRefCallback]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIframeLoading(false);
  };

  // Trigger reload on reloadKey change
  useEffect(() => {
    setIframeLoading(true);
  }, [device.reloadKey, url]);

  // Scaled layout math:
  // Card unscaled total dimensions (including toolbar and borders)
  const unscaledWidth = device.width + BORDER_WIDTH * 2;
  const unscaledHeight = device.height + TOOLBAR_HEIGHT + BORDER_WIDTH * 2;

  // Scaled footprint allocated in the parent layout
  const scaledFootprintWidth = Math.round(unscaledWidth * scale);
  const scaledFootprintHeight = Math.round(unscaledHeight * scale);

  const [manualProxy, setManualProxy] = useState<boolean | null>(null);

  // Reset manual proxy override when target URL changes
  useEffect(() => {
    setManualProxy(null);
  }, [url]);

  const isRestricted = Boolean(embedStatus?.checked && embedStatus?.isRestricted);
  const isProxied = manualProxy !== null ? manualProxy : isRestricted;
  const iframeSrc = isProxied ? `/api/proxy?url=${encodeURIComponent(url)}` : url;

  const handleApplyDimensions = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Math.max(100, Math.min(7680, parseInt(customW, 10) || device.width));
    const h = Math.max(100, Math.min(7680, parseInt(customH, 10) || device.height));
    onUpdateDimensions(device.id, w, h);
    setEditDimensionsOpen(false);
  };

  return (
    <div
      className="device-frame-footprint relative flex-shrink-0 transition-[width,height] duration-150"
      style={{
        width: `${scaledFootprintWidth}px`,
        height: `${scaledFootprintHeight}px`,
      }}
    >
      {/* Visual scaled container with top-left origin */}
      <div
        className="device-frame-card absolute top-0 left-0 flex flex-col rounded-md border border-zinc-800 bg-zinc-950 shadow-md origin-top-left"
        style={{
          width: `${unscaledWidth}px`,
          height: `${unscaledHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Frame Toolbar */}
        <div className="flex h-[34px] items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-2.5 select-none">
          {/* Left: Device Name, Dimensions Badge, Bridge Status */}
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Loading / Active Status Dot */}
            <span
              className={`h-2 w-2 rounded-full flex-shrink-0 transition-colors ${
                previewMode === "live" && iframeLoading
                  ? "bg-zinc-400 animate-pulse"
                  : previewMode === "preview" && isSnapshotLoading
                  ? "bg-zinc-400 animate-pulse"
                  : "bg-white"
              }`}
              title={
                previewMode === "live" && iframeLoading
                  ? "Iframe loading..."
                  : "Viewport active"
              }
            />

            {/* Viewport Name */}
            <span className="truncate text-xs font-semibold text-zinc-200" title={device.name}>
              {device.name}
            </span>

            {/* Dimensions Badge / Quick Dimension Editor Trigger */}
            <button
              type="button"
              onClick={() => setEditDimensionsOpen((prev) => !prev)}
              title="Click to edit custom dimensions"
              className="flex items-center gap-1 rounded bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-300 hover:bg-zinc-700/80 transition-colors"
            >
              <span>
                {device.width} × {device.height}
              </span>
              <Sliders className="h-2.5 w-2.5 opacity-60" />
            </button>

            {/* Mode B: Cooperative Bridge Status Badge */}
            {previewMode === "live" && bridgeConnected && (
              <span
                className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-200 border border-zinc-700"
                title={`Bridge Connected: Sync scroll ${bridgeCapabilities?.scroll ? "active" : "disabled"}`}
              >
                <Wifi className="h-2.5 w-2.5 text-white animate-pulse" />
                <span>Bridge Active</span>
              </span>
            )}

            {/* Proxy / Direct Mode Toggle Button */}
            {previewMode === "live" && (
              <button
                type="button"
                onClick={() => setManualProxy((prev) => (prev !== null ? !prev : !isRestricted))}
                title={
                  isProxied
                    ? "Viewing via Proxy Engine (Bypassing X-Frame-Options & CSP). Click to switch to Direct."
                    : "Viewing directly in iframe. Click to route via Proxy Engine."
                }
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium transition-colors ${
                  isProxied
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700"
                    : "text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800"
                }`}
              >
                <Shield className="h-2.5 w-2.5" />
                <span>{isProxied ? "Proxied" : "Direct"}</span>
              </button>
            )}
          </div>

          {/* Right: Actions (Rotate, Reload, Capture, Open Original, Remove) */}
          <div className="flex items-center gap-1">
            {/* Rotate / Orientation Swap */}
            <button
              type="button"
              onClick={() => onRotate(device.id)}
              title={`Rotate to ${device.rotated ? "Portrait" : "Landscape"} (${device.height} × ${device.width})`}
              className={`rounded p-1 transition-colors ${
                device.rotated
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
            </button>

            {/* Reload Viewport */}
            <button
              type="button"
              onClick={() => onReload(device.id)}
              title="Reload viewport"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  iframeLoading || isSnapshotLoading ? "animate-spin text-zinc-300" : ""
                }`}
              />
            </button>

            {/* Capture Viewport */}
            <div className="relative">
              <button
                ref={cameraBtnRef}
                type="button"
                onClick={() => setCapturePopoverOpen((prev) => !prev)}
                title="Capture Viewport (Send to Mockup Studio or Download PNG)"
                className={`rounded p-1 transition-colors ${
                  capturePopoverOpen
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <Camera className="h-3 w-3" />
              </button>

              <CaptureViewportPopover
                isOpen={capturePopoverOpen}
                onClose={() => setCapturePopoverOpen(false)}
                onCaptureVisible={(output, preset, frame) => {
                  setCapturePopoverOpen(false);
                  onCaptureVisible(device.id, output, preset, frame);
                }}
                currentPresetKey={device.presetKey}
                deviceName={device.name}
                previewMode={previewMode}
                triggerRef={cameraBtnRef}
              />
            </div>

            {/* Bridge Setup Guide */}
            {onOpenBridgeHelp && (
              <button
                type="button"
                onClick={onOpenBridgeHelp}
                title="Cooperative Bridge Setup Guide"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                <Wifi className="h-3 w-3" />
              </button>
            )}

            {/* Open Original in New Tab */}
            <button
              type="button"
              onClick={() => window.open(url, "_blank")}
              title="Open website in new browser tab"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </button>

            {/* Close / Remove Frame */}
            <button
              type="button"
              onClick={() => onRemove(device.id)}
              title="Close viewport"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Inline Dimensions Editor Popover */}
        {editDimensionsOpen && (
          <div className="absolute top-[36px] left-2.5 z-30 w-60 rounded-md border border-zinc-800 bg-zinc-950 p-2 shadow-lg">
            <form onSubmit={handleApplyDimensions} className="space-y-2">
              <div className="text-[11px] font-semibold text-zinc-200">Custom Dimensions</div>
              <div className="flex items-center gap-2">
                <div>
                  <label className="text-[9.5px] uppercase text-zinc-400 block mb-0.5">Width</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    min={100}
                    max={7680}
                    className="w-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <span className="text-zinc-500 mt-3.5">×</span>
                <div>
                  <label className="text-[9.5px] uppercase text-zinc-400 block mb-0.5">Height</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    min={100}
                    max={7680}
                    className="w-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-3.5 flex items-center justify-center rounded bg-white p-1.5 text-zinc-950 hover:bg-zinc-200 transition-colors font-semibold"
                  title="Apply dimensions"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Viewport Display Area (Exact CSS Pixel Width & Height) */}
        <div
          className="relative bg-zinc-950 overflow-hidden flex-1"
          style={{
            width: `${device.width}px`,
            height: `${device.height}px`,
          }}
        >
          {/* Mode 1: Live Interactive Iframe (Default) */}
          {previewMode === "live" && (
            <>
              {/* Mixed Content Warning Banner */}
              {isMixedContent && (
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 border-b border-zinc-700 bg-zinc-800/95 px-3 py-1.5 text-[11px] text-zinc-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertCircle className="h-3.5 w-3.5 text-white shrink-0" />
                    <span className="truncate">
                      Mixed Content: HTTPS viewers cannot load HTTP targets directly.
                    </span>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 underline hover:text-white"
                  >
                    Open
                  </a>
                </div>
              )}

              {url ? (
                <iframe
                  key={`${device.id}-${device.reloadKey}-${isProxied ? "proxied" : "direct"}`}
                  ref={localIframeRef}
                  src={iframeSrc}
                  data-device-id={device.id}
                  title={`${device.name} Viewport`}
                  className="w-full h-full border-0 block bg-white"
                  style={{
                    width: `${device.width}px`,
                    height: `${device.height}px`,
                  }}
                  sandbox={
                    isProxied
                      ? "allow-scripts allow-forms allow-popups"
                      : "allow-scripts allow-forms allow-popups allow-same-origin"
                  }
                  onLoad={handleIframeLoad}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-zinc-500 select-none">
                  <Globe className="h-6 w-6 mb-2 opacity-30 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-400">No URL entered</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Enter a website URL above to preview this device.</p>
                </div>
              )}
            </>
          )}

          {/* Mode 2: High-Fidelity Snapshot Fallback */}
          {previewMode === "preview" && (
            <div className="h-full w-full overflow-y-auto overflow-x-hidden select-none bg-zinc-950">
              {snapshotDataUrl ? (
                <img
                  src={snapshotDataUrl}
                  alt={`${device.name} Snapshot`}
                  className="w-full h-auto block pointer-events-none"
                  style={{ width: `${device.width}px` }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-zinc-400">
                  <Layers className="h-8 w-8 mb-2 opacity-40 text-zinc-500 animate-pulse" />
                  <p className="text-xs font-medium text-zinc-300">
                    {isSnapshotLoading
                      ? "Rendering high-fidelity preview..."
                      : url
                      ? "Snapshot not available"
                      : "Enter a website URL above to generate a snapshot"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
