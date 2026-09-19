"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  RotateCcw,
  RefreshCw,
  X,
  Plus,
  Globe,
  ChevronDown,
  Camera,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Layers,
  ArrowLeft,
  Columns,
  LayoutGrid,
} from "lucide-react";
import { DEVICE_PRESETS, DEVICE_CATEGORIES } from "@/lib/devices";
import { CaptureOutputOption } from "./CaptureViewportPopover";
import { cropViewportImage, downloadPng } from "@/lib/viewport-capture";
import { DeviceFrame, DeviceFrameDevice } from "./preview/DeviceFrame";
import { PreviewBridgeController } from "@/lib/preview-bridge-controller";
import { BridgeHelpModal } from "./preview/BridgeHelpModal";
import { sanitizeAndValidateUrl } from "@/lib/url-validation";
import { loadSettings, saveSettings } from "@/lib/storage";

interface DeviceSnapshot {
  dataUrl: string;
  width: number;
  height: number;
  fullHeight?: number;
}

import { executeScreenshotCapture } from "@/lib/capture-client";

interface ResponsiveStudioProps {
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
  onShowToast: (
    message: string,
    type?: "success" | "error" | "info",
    options?: { id?: string; duration?: number }
  ) => string | void;
  onSendToMockup?: (
    url: string,
    presetKey: string,
    frameId: string,
    imageDataUrl?: string
  ) => void;
  onExitToPage?: () => void;
}

export function ResponsiveStudio({
  initialUrl = "",
  onUrlChange,
  onShowToast,
  onSendToMockup,
  onExitToPage,
}: ResponsiveStudioProps) {
  // Load saved preferences on initialization
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [isMixedContent, setIsMixedContent] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const [scrollMode, setScrollMode] = useState<"ratio" | "pixels">("ratio");
  const [currentScale, setCurrentScale] = useState<"auto" | number>("auto");
  const [computedScale, setComputedScale] = useState(1);
  const [layoutMode, setLayoutMode] = useState<"wrap" | "row">("row");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [bridgeHelpOpen, setBridgeHelpOpen] = useState(false);

  // Default to Mode A: Direct interactive iframe preview
  const [previewMode, setPreviewMode] = useState<"live" | "preview">("live");

  // Embed capability status from /api/check-embed
  const [embedStatus, setEmbedStatus] = useState<{
    checked: boolean;
    canEmbed: boolean;
    isRestricted?: boolean;
    reason?: string;
  }>({
    checked: false,
    canEmbed: true,
    isRestricted: false,
  });

  // Default viewports on open: iPhone 15 and MacBook Air
  const [activeDevices, setActiveDevices] = useState<DeviceFrameDevice[]>([
    {
      id: "dev-iphone",
      presetKey: "iphone-15",
      name: "iPhone 15",
      width: 393,
      height: 852,
      rotated: false,
      reloadKey: 1,
    },
    {
      id: "dev-macbook",
      presetKey: "macbook-air-13",
      name: "MacBook Air",
      width: 1280,
      height: 832,
      rotated: false,
      reloadKey: 1,
    },
  ]);

  // Mode B: Bridge connection state per device
  const [bridgeConnectedDevices, setBridgeConnectedDevices] = useState<Record<string, boolean>>({});

  // Cached high-fidelity snapshots for each active device (for capture and snapshot mode)
  const [snapshots, setSnapshots] = useState<Record<string, DeviceSnapshot>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<Record<string, boolean>>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const bridgeControllerRef = useRef<PreviewBridgeController | null>(null);
  const iframeElementsRef = useRef<Map<string, HTMLIFrameElement>>(new Map());


  // Initialize saved settings on mount
  useEffect(() => {
    const saved = loadSettings();
    if (saved.responsive) {
      if (saved.responsive.layoutMode) setLayoutMode(saved.responsive.layoutMode);
      if (saved.responsive.syncScroll !== undefined) setSyncScroll(saved.responsive.syncScroll);
      if (saved.responsive.scrollMode) setScrollMode(saved.responsive.scrollMode);
      if (saved.responsive.scale) setCurrentScale(saved.responsive.scale);
      if (saved.responsive.activeDevices && saved.responsive.activeDevices.length > 0) {
        setActiveDevices(
          saved.responsive.activeDevices.map((d) => ({
            ...d,
            reloadKey: 1,
          }))
        );
      }
    }
    if (saved.targetUrl && saved.targetUrl !== "https://schedy-sepia.vercel.app/" && saved.targetUrl !== "https://yourwebsite.com") {
      const val = sanitizeAndValidateUrl(saved.targetUrl);
      if (val.isValid) {
        setUrlInput(val.normalizedUrl);
        setActiveUrl(val.normalizedUrl);
        setIsMixedContent(Boolean(val.isMixedContent));
      }
    }
  }, []);

  // Initialize Bridge Controller (Mode B)
  useEffect(() => {
    const controller = new PreviewBridgeController({
      syncScroll,
      scrollMode,
      onStatusChange: (deviceId, connected) => {
        setBridgeConnectedDevices((prev) => {
          if (prev[deviceId] === connected) return prev;
          return {
            ...prev,
            [deviceId]: connected,
          };
        });
      },
    });

    bridgeControllerRef.current = controller;

    return () => {
      controller.destroy();
    };
  }, []);

  // Sync scroll setting to controller
  useEffect(() => {
    if (bridgeControllerRef.current) {
      bridgeControllerRef.current.setSyncScroll(syncScroll);
      bridgeControllerRef.current.setScrollMode(scrollMode);
    }
  }, [syncScroll, scrollMode]);

  // Stable ref for activeUrl
  const activeUrlRef = useRef(activeUrl);
  activeUrlRef.current = activeUrl;

  // Iframe registration callback (stable across renders)
  const handleIframeRef = useCallback((deviceId: string, el: HTMLIFrameElement | null) => {
    if (el) {
      iframeElementsRef.current.set(deviceId, el);
      if (bridgeControllerRef.current) {
        bridgeControllerRef.current.registerFrame(deviceId, el, activeUrlRef.current);
      }
    } else {
      iframeElementsRef.current.delete(deviceId);
      if (bridgeControllerRef.current) {
        bridgeControllerRef.current.unregisterFrame(deviceId);
      }
    }
  }, []);

  // Check framing permissions on target URL
  const checkEmbedCapability = useCallback(async (target: string) => {
    if (!target) return;
    setEmbedStatus({
      checked: false,
      canEmbed: true,
      isRestricted: false,
    });
    try {
      const res = await fetch(`/api/check-embed?url=${encodeURIComponent(target)}`);
      const data = await res.json();
      setEmbedStatus({
        checked: true,
        canEmbed: data.canEmbed !== false,
        isRestricted: Boolean(data.isRestricted),
        reason: data.reason,
      });
    } catch {
      setEmbedStatus({
        checked: true,
        canEmbed: true, // Allow direct iframe attempt even if probe endpoint fails
        isRestricted: false,
        reason: "Could not verify iframe framing headers",
      });
    }
  }, []);

  // Fetch isolated snapshot for a single device (for capture or snapshot fallback)
  const captureDeviceSnapshot = useCallback(
    async (device: DeviceFrameDevice, target: string): Promise<DeviceSnapshot | null> => {
      if (!target) return null;
      setSnapshotLoading((prev) => ({ ...prev, [device.id]: true }));
      try {
        const result = await executeScreenshotCapture({
          url: target,
          presetKey: device.presetKey,
          customW: device.width,
          customH: device.height,
          captureFullPage: true,
          captureQuality: "preview",
          settleDelay: 1000,
        });

        if (result.success && result.data) {
          const snap: DeviceSnapshot = {
            dataUrl: result.data.screenshotBase64,
            width: result.data.width,
            height: result.data.height,
            fullHeight: result.data.fullHeight,
          };
          setSnapshots((prev) => ({
            ...prev,
            [device.id]: snap,
          }));
          return snap;
        } else {
          onShowToast(`Capture failed: ${result.error || "Server error"}`, "error");
          return null;
        }
      } catch (err: unknown) {
        console.warn("Snapshot error:", err);
        const msg = err instanceof Error ? err.message : "Capture failed";
        onShowToast(`Capture failed: ${msg}`, "error");
        return null;
      } finally {
        setSnapshotLoading((prev) => ({ ...prev, [device.id]: false }));
      }
    },
    [onShowToast]
  );

  // Capture snapshots for all active devices sequentially to avoid overwhelming browser
  const captureAllSnapshots = useCallback(
    async (target: string, devicesToCapture = activeDevices) => {
      if (!target) return;
      for (const device of devicesToCapture) {
        await captureDeviceSnapshot(device, target);
      }
    },
    [activeDevices, captureDeviceSnapshot]
  );

  // On activeUrl change
  useEffect(() => {
    if (activeUrl) {
      checkEmbedCapability(activeUrl);
    }
    // Re-register iframes in bridge controller
    iframeElementsRef.current.forEach((el, deviceId) => {
      if (bridgeControllerRef.current) {
        bridgeControllerRef.current.registerFrame(deviceId, el, activeUrl);
      }
    });
  }, [activeUrl, checkEmbedCapability]);

  // Navigate to URL with validation
  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) {
      setUrlInput("");
      setActiveUrl("");
      saveSettings({ targetUrl: "" });
      onShowToast("Please enter a website URL.", "error");
      return;
    }
    const validation = sanitizeAndValidateUrl(urlInput);

    if (!validation.isValid) {
      onShowToast(validation.error || "Invalid URL", "error");
      return;
    }

    setUrlInput(validation.normalizedUrl);
    setActiveUrl(validation.normalizedUrl);
    setIsMixedContent(Boolean(validation.isMixedContent));

    // Save non-sensitive settings
    saveSettings({
      targetUrl: validation.sanitizedForStorage,
    });

    if (onUrlChange) onUrlChange(validation.normalizedUrl);
    onShowToast(`Loaded ${validation.normalizedUrl}`, "info");

    if (validation.isMixedContent) {
      onShowToast(
        "Mixed Content Warning: Browsers block HTTP embeds within HTTPS dashboards.",
        "error"
      );
    }
  };

  // Add device viewport
  const handleAddDevice = (presetKey: string) => {
    const preset = DEVICE_PRESETS[presetKey];
    if (!preset) return;
    const newDevice: DeviceFrameDevice = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      presetKey,
      name: preset.name,
      width: preset.width,
      height: preset.height,
      rotated: false,
      reloadKey: 1,
    };
    setActiveDevices((prev) => {
      const updated = [...prev, newDevice];
      saveSettings({
        responsive: {
          activeDevices: updated.map(({ id, presetKey, name, width, height, rotated }) => ({
            id,
            presetKey,
            name,
            width,
            height,
            rotated,
          })),
        },
      });
      return updated;
    });
    setAddMenuOpen(false);
    if (currentScale === "auto" && canvasRef.current) {
      canvasRef.current.scrollLeft = 0;
    }
  };

  // Remove device viewport
  const handleRemoveDevice = (id: string) => {
    if (activeDevices.length <= 1) {
      onShowToast("At least one viewport must remain visible.", "error");
      return;
    }

    if (bridgeControllerRef.current) {
      bridgeControllerRef.current.unregisterFrame(id);
    }

    setActiveDevices((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveSettings({
        responsive: {
          activeDevices: updated.map(({ id, presetKey, name, width, height, rotated }) => ({
            id,
            presetKey,
            name,
            width,
            height,
            rotated,
          })),
        },
      });
      return updated;
    });
    if (currentScale === "auto" && canvasRef.current) {
      canvasRef.current.scrollLeft = 0;
    }
  };

  // Rotate device viewport (swaps width and height without remounting iframe)
  const handleRotateDevice = (id: string) => {
    setActiveDevices((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          rotated: !d.rotated,
          width: d.height,
          height: d.width,
        };
      })
    );
  };

  // Update custom dimensions
  const handleUpdateDimensions = (id: string, width: number, height: number) => {
    setActiveDevices((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          width,
          height,
        };
      })
    );
  };

  // Reload single device viewport
  const handleReloadDevice = (id: string) => {
    setActiveDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, reloadKey: d.reloadKey + 1 } : d))
    );
    const targetDev = activeDevices.find((d) => d.id === id);
    if (targetDev && previewMode === "preview") {
      captureDeviceSnapshot(targetDev, activeUrl);
    }
  };

  // Reload all viewports
  const handleReloadAll = () => {
    setActiveDevices((prev) =>
      prev.map((d) => ({ ...d, reloadKey: d.reloadKey + 1 }))
    );
    if (previewMode === "preview") {
      captureAllSnapshots(activeUrl);
    }
    onShowToast("Reloaded all viewports", "info");
  };

  // Dynamic Fit Scale Calculation
  const recalculateScale = useCallback(() => {
    if (!canvasRef.current) return;
    const canvasW = canvasRef.current.clientWidth - 48;
    const canvasH = canvasRef.current.clientHeight - 48;

    if (canvasW <= 0 || canvasH <= 0 || activeDevices.length === 0) return;

    if (currentScale === "auto") {
      if (layoutMode === "row") {
        // In single-row mode:
        // Subtract all inter-device gaps (32px each) from available canvas width
        // before dividing by total unscaled device widths, so rendered footprint + gaps <= canvasW
        const totalDeviceWidth = activeDevices.reduce((sum, d) => sum + d.width + 2, 0);
        const totalGaps = Math.max(0, activeDevices.length - 1) * 32;
        const availableW = Math.max(80, canvasW - totalGaps);
        const maxHeight = activeDevices.reduce((max, d) => Math.max(max, d.height + 38), 0);

        const scaleX = availableW / totalDeviceWidth;
        const scaleY = canvasH / maxHeight;
        // Clamp fit scale so it fits both width and height cleanly without overflow
        const fit = Math.min(1.0, Math.max(0.12, Math.min(scaleX, scaleY)));
        setComputedScale(fit);
      } else {
        // In grid/wrap mode:
        // Calculate scale so devices wrap into a clean, readable multi-row layout
        const numDevices = activeDevices.length;
        const maxHeight = activeDevices.reduce((max, d) => Math.max(max, d.height + 38), 0);
        const totalDeviceWidth = activeDevices.reduce((sum, d) => sum + d.width + 2, 0);

        const cols = numDevices <= 2 ? numDevices : Math.min(numDevices, Math.max(2, Math.round(Math.sqrt(numDevices * (canvasW / canvasH)))));
        const rows = Math.ceil(numDevices / cols);

        const avgWidth = totalDeviceWidth / numDevices;
        const gridW = cols * avgWidth + (cols - 1) * 32;
        const gridH = rows * maxHeight + (rows - 1) * 32;

        const scaleX = canvasW / gridW;
        const scaleY = canvasH / gridH;
        const fit = Math.min(1.0, Math.max(0.2, Math.min(scaleX, scaleY)));
        setComputedScale(fit);
      }

      // Ensure canvas scroll is reset to origin so the first device is never cut off
      if (canvasRef.current) {
        canvasRef.current.scrollLeft = 0;
      }
    } else {
      setComputedScale(currentScale);
    }
  }, [activeDevices, currentScale, layoutMode]);

  useEffect(() => {
    recalculateScale();
    window.addEventListener("resize", recalculateScale);
    return () => window.removeEventListener("resize", recalculateScale);
  }, [recalculateScale]);

  // Handle visible capture
  const handleCaptureVisible = async (
    deviceId: string,
    outputMode: CaptureOutputOption,
    selectedPreset: string,
    selectedFrame: string
  ) => {
    const device = activeDevices.find((d) => d.id === deviceId);
    if (!device) return;

    if (!activeUrl) {
      onShowToast("Please enter a website URL first.", "error");
      return;
    }

    let snapshot: DeviceSnapshot | undefined | null = snapshots[deviceId];
    if (!snapshot?.dataUrl) {
      onShowToast("Generating capture snapshot. Please wait...", "info");
      snapshot = await captureDeviceSnapshot(device, activeUrl);
    }

    if (!snapshot?.dataUrl) {
      return;
    }

    try {
      const croppedDataUrl = await cropViewportImage({
        sourceDataUrl: snapshot.dataUrl,
        deviceWidth: device.width,
        deviceHeight: device.height,
        scrollTop: 0,
        scrollLeft: 0,
      });

      if (outputMode === "mockup") {
        if (onSendToMockup) {
          onSendToMockup(activeUrl, selectedPreset, selectedFrame, croppedDataUrl);
          onShowToast(`Captured visible area sent to Mockup Studio (${selectedPreset})`, "success");
        }
      } else {
        const filename = `instaframe-${device.presetKey}-${Date.now()}.png`;
        downloadPng(croppedDataUrl, filename);
        onShowToast(`Downloaded visible area PNG (${device.name})`, "success");
      }
    } catch (err) {
      console.error("Capture visible failed:", err);
      onShowToast("Capture failed", "error");
    }
  };

  // Exit to page action
  const handleExitToPage = () => {
    if (onExitToPage) {
      onExitToPage();
    } else if (activeUrl) {
      window.open(activeUrl, "_blank");
    }
  };

  // Click outside add menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    if (addMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuOpen]);

  const viewerOrigin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Studio Toolbar Header */}
      <div className="relative z-30 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-3.5 py-2">
        {/* Left Side: URL Form */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* URL Input Form */}
          <form onSubmit={handleNavigate} className="flex items-center gap-2 flex-1 max-w-xl min-w-0">
            <div className="relative flex-1 min-w-0">
              <Globe className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/80 py-1.5 pl-8 pr-7 text-xs font-medium text-indigo-400 placeholder-zinc-500 transition-colors focus:border-zinc-700 focus:outline-none"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Add Viewport Dropdown - Positioned next to input */}
            <div ref={addMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAddMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Viewport</span>
              </button>

              {addMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 max-h-[380px] w-72 overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900 p-1.5 shadow-2xl">
                  {DEVICE_CATEGORIES.map((category, catIdx) => {
                    const items = Object.entries(DEVICE_PRESETS).filter(
                      ([_, preset]) => preset.category === category
                    );
                    if (items.length === 0) return null;
                    return (
                      <div
                        key={category}
                        className={catIdx > 0 ? "mt-1.5 border-t border-zinc-800/80 pt-1.5" : ""}
                      >
                        <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                          {category}
                        </div>
                        <div className="space-y-0.5">
                          {items.map(([key, preset]) => {
                            const IconComp =
                              category === "Desktop & Laptops"
                                ? preset.name.includes("Book") || preset.name.includes("Laptop")
                                  ? Laptop
                                  : Monitor
                                : category === "Tablets"
                                ? Tablet
                                : Smartphone;

                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleAddDevice(key)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-zinc-800/80 text-zinc-400">
                                    <IconComp className="h-3 w-3" />
                                  </span>
                                  <span className="truncate">{preset.name}</span>
                                </div>
                                <span className="ml-2 flex-shrink-0 rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums text-zinc-400">
                                  {preset.width} × {preset.height}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="flex items-center rounded-md bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-zinc-100 active:scale-95 shadow-sm shrink-0"
            >
              <span>Go</span>
            </button>
            <button
              type="button"
              onClick={handleReloadAll}
              title="Reload all viewports"
              className="flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Right Side Controls: Layout Mode Toggle + Sync Scroll + Zoom Segmented Control */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Layout Mode (Row vs Grid) */}
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900/90 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setLayoutMode("row");
                saveSettings({ responsive: { layoutMode: "row" } });
              }}
              title="Row: viewports in a single horizontal row"
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-all ${
                layoutMode === "row"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              <Columns className="h-3 w-3" />
              <span>Row</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode("wrap");
                saveSettings({ responsive: { layoutMode: "wrap" } });
              }}
              title="Grid: wrap viewports into a responsive multi-row grid"
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-all ${
                layoutMode === "wrap"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              <span>Grid</span>
            </button>
          </div>

          {/* Sync Scroll Toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300 select-none">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="sr-only peer"
              />
              <div className="h-4 w-7 rounded-full bg-zinc-800 border border-zinc-700 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
            </div>
            <span className="text-xs text-zinc-300 font-medium">Sync Scroll</span>
          </label>

          {/* Scale Buttons (Segmented Control) */}
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900/90 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentScale("auto");
                recalculateScale();
                if (canvasRef.current) {
                  canvasRef.current.scrollLeft = 0;
                }
              }}
              className={`rounded px-2.5 py-1 text-xs transition-all ${
                currentScale === "auto"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setCurrentScale(1)}
              className={`rounded px-2.5 py-1 text-xs transition-all ${
                currentScale === 1
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setCurrentScale(0.75)}
              className={`rounded px-2.5 py-1 text-xs transition-all ${
                currentScale === 0.75
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setCurrentScale(0.5)}
              className={`rounded px-2.5 py-1 text-xs transition-all ${
                currentScale === 0.5
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 font-medium"
              }`}
            >
              50%
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Canvas */}
      <div
        ref={canvasRef}
        className="studio-grid-bg relative flex-1 overflow-auto p-6 min-h-[500px]"
      >
        <div
          className={`flex gap-8 items-start pb-6 ${
            layoutMode === "wrap"
              ? "flex-wrap justify-center"
              : "flex-row min-w-fit"
          }`}
        >
          {activeDevices.map((device) => {
            const snapshot = snapshots[device.id];
            const isBridgeConnected = Boolean(bridgeConnectedDevices[device.id]);

            return (
              <DeviceFrame
                key={device.id}
                device={device}
                url={activeUrl}
                scale={computedScale}
                previewMode={previewMode}
                snapshotDataUrl={snapshot?.dataUrl}
                isSnapshotLoading={Boolean(snapshotLoading[device.id])}
                embedStatus={embedStatus}
                isMixedContent={isMixedContent}
                bridgeConnected={isBridgeConnected}
                onRotate={handleRotateDevice}
                onReload={handleReloadDevice}
                onRemove={handleRemoveDevice}
                onUpdateDimensions={handleUpdateDimensions}
                onCaptureVisible={handleCaptureVisible}
                onOpenBridgeHelp={() => setBridgeHelpOpen(true)}
                iframeRefCallback={handleIframeRef}
              />
            );
          })}
        </div>
      </div>

      {/* Bridge Setup Documentation Modal */}
      <BridgeHelpModal
        isOpen={bridgeHelpOpen}
        onClose={() => setBridgeHelpOpen(false)}
        viewerOrigin={viewerOrigin}
      />
    </div>
  );
}
