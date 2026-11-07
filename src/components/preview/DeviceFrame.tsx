"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  RotateCcw,
  RefreshCw,
  ExternalLink,
  X,
  Camera,
  Layers,
  AlertCircle,
  Wifi,
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
  /** False for the last remaining viewport: its close button is disabled. */
  canRemove?: boolean;
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
  onSnapshotScroll?: (id: string, x: number, y: number) => void;
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
  canRemove = true,
  onRotate,
  onReload,
  onRemove,
  onUpdateDimensions,
  onCaptureVisible,
  onOpenBridgeHelp,
  iframeRefCallback,
  onSnapshotScroll,
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

  // Handle iframe load
  const handleIframeLoad = () => {
    setIframeLoading(false);
    iframeRefCallback?.(device.id, localIframeRef.current);
  };

  // Trigger reload on reloadKey change
  useEffect(() => {
    setIframeLoading(true);
  }, [device.reloadKey, url]);

  // Scaled layout math:
  // Card unscaled total dimensions (including toolbar and borders)
  const unscaledWidth = device.width + BORDER_WIDTH * 2;
  const unscaledHeight = device.height + TOOLBAR_HEIGHT + BORDER_WIDTH * 2;
  const compactToolbar = device.width < 560;

  // Scaled footprint allocated in the parent layout
  const scaledFootprintWidth = Math.round(unscaledWidth * scale);
  const scaledFootprintHeight = Math.round(unscaledHeight * scale);

  const [manualProxy, setManualProxy] = useState<boolean | null>(null);

  // Reset manual proxy override when target URL changes
  useEffect(() => {
    setManualProxy(null);
  }, [url]);

  const isRestricted = Boolean(embedStatus?.checked && embedStatus?.isRestricted);
  let sameOrigin = false;
  try { sameOrigin = new URL(url).origin === window.location.origin; } catch {}
  const defaultInteractive = Boolean(url) && (!sameOrigin || isRestricted);
  const isProxied = manualProxy !== null ? manualProxy : defaultInteractive;
  useEffect(() => { setIframeLoading(Boolean(url)); }, [isProxied, previewMode, url]);

  const iframeSrc = isProxied ? `/api/proxy?url=${encodeURIComponent(url)}` : url;

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    localIframeRef.current = el;
    iframeRefCallback?.(device.id, el);
  }, [device.id, iframeRefCallback]);

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
      {/* Visual scaled container: charcoal card, 14px radius, hairline border */}
      <div
        className="device-frame-card viewport-card absolute top-0 left-0 flex flex-col origin-top-left overflow-hidden"
        style={{
          width: `${unscaledWidth}px`,
          height: `${unscaledHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Frame Toolbar */}
        <div className="viewport-toolbar flex h-[36px] shrink-0 items-center justify-between gap-2 border-b border-line-subtle bg-card pl-3 pr-[5px] select-none">
          {/* Left: Device Name, Dimensions Badge, Bridge Status */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {/* Status dot: only while the viewport is loading */}
            {((previewMode === "live" && iframeLoading && Boolean(url)) || (previewMode === "preview" && isSnapshotLoading)) && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-ink-secondary animate-pulse"
                title="Loading"
                aria-label="Loading"
              />
            )}

            {/* Viewport Name */}
            <span className="min-w-0 truncate text-[12.5px] font-semibold tracking-[-0.01em] text-ink" title={device.name}>
              {device.name}
            </span>

            {/* Dimensions Badge / Quick Dimension Editor Trigger */}
            <button
              type="button"
              onClick={() => setEditDimensionsOpen((prev) => !prev)}
              title="Edit dimensions"
              aria-label={`Edit dimensions, ${device.width} by ${device.height}`}
              className="card-dims shrink-0 whitespace-nowrap rounded-[5px] px-1 text-[11px] tabular-nums text-ink-subtle transition-colors duration-150 hover:bg-control-hover hover:text-ink"
            >
              {device.width} × {device.height}
            </button>

            {/* Mode B: Cooperative Bridge Status Badge */}
            {previewMode === "live" && bridgeConnected && (
              <span
                className="card-secondary badge"
                title={`Bridge Connected: Sync scroll ${bridgeCapabilities?.scroll ? "active" : "disabled"}`}
              >
                <Wifi className="h-2.5 w-2.5 text-ink animate-pulse" />
                <span className={compactToolbar ? "sr-only" : undefined}>Bridge active</span>
              </span>
            )}

            {/* Proxy / Direct Mode Toggle Button */}
            {previewMode === "live" && (
              <button
                type="button"
                onClick={() => setManualProxy((prev) => (prev !== null ? !prev : !defaultInteractive))}
                aria-label={`${isProxied ? "Interactive" : "Direct"} preview. Switch to ${isProxied ? "direct" : "interactive"} loading`}
                title={
                  isProxied
                    ? "Interactive preview with page and scroll tracking. Click to try direct loading."
                    : "Direct website preview. Click to enable interactive page and scroll tracking."
                }
                className={`card-secondary flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-inner border px-2 text-[10px] font-medium transition-colors duration-150 ease-out ${
                  isProxied
                    ? "border-line-hover bg-control-active text-ink hover:bg-[#3e3e45]"
                    : "border-line bg-control text-ink-secondary hover:bg-control-hover hover:text-ink"
                }`}
              >
                <Shield className="h-2.5 w-2.5" />
                <span className={compactToolbar ? "sr-only" : undefined}>{isProxied ? "Interactive" : "Direct"}</span>
              </button>
            )}
          </div>

          {/* Right: Actions (Rotate, Reload, Capture, Open Original, Remove) */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Rotate / Orientation Swap */}
            <button
              type="button"
              onClick={() => onRotate(device.id)}
              title={`Rotate to ${device.rotated ? "portrait" : "landscape"} (${device.height} × ${device.width})`}
              aria-label="Rotate viewport"
              aria-pressed={device.rotated}
              className="icon-btn"
            >
              <RotateCcw className="h-3 w-3" />
            </button>

            {/* Reload Viewport */}
            <button
              type="button"
              onClick={() => onReload(device.id)}
              title="Reload viewport"
              aria-label="Reload viewport"
              className="icon-btn"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  iframeLoading || isSnapshotLoading ? "animate-spin text-ink" : ""
                }`}
              />
            </button>

            {/* Capture Viewport */}
            <div className="relative">
              <button
                ref={cameraBtnRef}
                type="button"
                onClick={() => setCapturePopoverOpen((prev) => !prev)}
                title="Capture viewport"
                aria-label="Capture viewport"
                aria-expanded={capturePopoverOpen}
                className="icon-btn"
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
                title="Preview bridge setup"
                aria-label="Preview bridge setup"
                className="card-secondary icon-btn"
              >
                <Wifi className="h-3 w-3" />
              </button>
            )}

            {/* Open Original in New Tab */}
            <button
              type="button"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              title="Open in new tab"
              aria-label="Open in new tab"
              className="card-secondary icon-btn"
            >
              <ExternalLink className="h-3 w-3" />
            </button>

            {/* Close / Remove Frame */}
            <button
              type="button"
              onClick={() => onRemove(device.id)}
              disabled={!canRemove}
              title={canRemove ? "Close viewport" : "The last viewport can't be closed"}
              aria-label="Close viewport"
              className="icon-btn"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Inline Dimensions Editor Popover */}
        {editDimensionsOpen && (
          <div className="menu absolute top-[40px] left-2.5 z-30 w-64 !p-3">
            <form onSubmit={handleApplyDimensions} className="space-y-2">
              <div className="text-[12.5px] font-medium text-ink">Custom dimensions</div>
              <div className="flex items-center gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-ink-secondary">Width</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    min={100}
                    max={7680}
                    className="field w-20 px-2.5 text-xs tabular-nums outline-none"
                  />
                </div>
                <span className="mt-4 text-ink-subtle">×</span>
                <div>
                  <label className="mb-1 block text-[11px] text-ink-secondary">Height</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    min={100}
                    max={7680}
                    className="field w-20 px-2.5 text-xs tabular-nums outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-neutral mt-4 w-8 !px-0"
                  title="Apply dimensions"
                  aria-label="Apply dimensions"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Viewport Display Area (Exact CSS Pixel Width & Height) */}
        <div
          className="relative shrink-0 overflow-hidden bg-canvas"
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
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-card px-3 py-1.5 text-[11px] text-ink-secondary">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertCircle className="h-3.5 w-3.5 text-ink shrink-0" />
                    <span className="truncate">
                      Mixed Content: HTTPS viewers cannot load HTTP targets directly.
                    </span>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 underline hover:text-ink"
                  >
                    Open
                  </a>
                </div>
              )}

              {url ? (
                <iframe
                  key={`${device.id}-${device.reloadKey}-${isProxied ? "proxied" : "direct"}`}
                  ref={setIframeRef}
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
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-ink-subtle select-none">
                  <Globe className="h-6 w-6 mb-2 opacity-40 text-ink-secondary" />
                  <p className="text-[13px] font-medium text-ink-secondary">No URL entered</p>
                  <p className="text-xs text-ink-subtle mt-1">Enter a website URL above to preview this device.</p>
                </div>
              )}
            </>
          )}

          {/* Mode 2: High-Fidelity Snapshot Fallback */}
          {previewMode === "preview" && (
            <div onScroll={(e) => onSnapshotScroll?.(device.id, e.currentTarget.scrollLeft, e.currentTarget.scrollTop)} className="h-full w-full overflow-y-auto overflow-x-hidden select-none bg-canvas">
              {snapshotDataUrl ? (
                // Snapshots are local data URLs and must preserve the captured pixel dimensions.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshotDataUrl}
                  alt={`${device.name} Snapshot`}
                  className="w-full h-auto block pointer-events-none"
                  style={{ width: `${device.width}px` }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-ink-secondary">
                  <Layers className="h-8 w-8 mb-2 opacity-50 text-ink-subtle animate-pulse" />
                  <p className="text-[13px] font-medium text-ink-secondary">
                    {isSnapshotLoading
                      ? "Rendering snapshot…"
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
