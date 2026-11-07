"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  X,
  Plus,
  Globe,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
} from "lucide-react";
import { DEVICE_PRESETS, DEVICE_CATEGORIES, CATEGORY_LABELS } from "@/lib/devices";
import { computeFitScale } from "@/lib/studio-layout";
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
  targetUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  reloadKey: number;
}

function snapshotKey(device: DeviceFrameDevice, url: string) {
  return `${url}|${device.width}x${device.height}|${device.reloadKey}`;
}

function isSnapshotCurrent(snapshot: DeviceSnapshot | undefined | null, device: DeviceFrameDevice, url: string) {
  return Boolean(
    snapshot?.dataUrl &&
      snapshot.targetUrl === url &&
      snapshot.viewportWidth === device.width &&
      snapshot.viewportHeight === device.height &&
      snapshot.reloadKey === device.reloadKey
  );
}

function persistedDevices(devices: DeviceFrameDevice[]) {
  return devices.map(({ id, presetKey, name, width, height, rotated }) => ({ id, presetKey, name, width, height, rotated }));
}

const SNAPSHOT_CONCURRENCY = 2;

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
  const snapshotBatchRef = useRef(0);
  const snapshotControllersRef = useRef(new Map<string, AbortController>());
  const snapshotKeysRef = useRef(new Map<string, string>());
  const embedControllerRef = useRef<AbortController | null>(null);
  const scrollPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const settingsReadyRef = useRef(false);
  const iframeElementsRef = useRef<Map<string, HTMLIFrameElement>>(new Map());


  // Initialize saved settings on mount
  useEffect(() => {
    const saved = loadSettings();
    settingsReadyRef.current = true;
    if (saved.responsive) {
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
    iframeElementsRef.current.forEach((el, deviceId) => controller.registerFrame(deviceId, el, activeUrlRef.current));

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

  const activeDevicesRef = useRef(activeDevices);
  activeDevicesRef.current = activeDevices;

  useEffect(() => {
    if (settingsReadyRef.current) {
      saveSettings({ responsive: { activeDevices: persistedDevices(activeDevices) } });
    }
    // Cancel only the captures this change made stale; others keep running.
    const stale: string[] = [];
    for (const [id, controller] of snapshotControllersRef.current) {
      const device = activeDevices.find((item) => item.id === id);
      if (device && snapshotKeysRef.current.get(id) === snapshotKey(device, activeUrl)) continue;
      controller.abort();
      snapshotControllersRef.current.delete(id);
      snapshotKeysRef.current.delete(id);
      stale.push(id);
    }
    if (stale.length) {
      setSnapshotLoading((prev) => {
        const next = { ...prev };
        stale.forEach((id) => delete next[id]);
        return next;
      });
    }
    setSnapshots((previous) => {
      const kept = Object.entries(previous).filter(([id, snap]) => {
        const device = activeDevices.find((item) => item.id === id);
        return device && isSnapshotCurrent(snap, device, activeUrl);
      });
      return kept.length === Object.keys(previous).length ? previous : Object.fromEntries(kept);
    });
  }, [activeUrl, activeDevices]);

  useEffect(() => {
    if (settingsReadyRef.current) saveSettings({ responsive: { scale: currentScale } });
  }, [currentScale]);

  useEffect(() => () => {
    snapshotControllersRef.current.forEach((controller) => controller.abort());
    embedControllerRef.current?.abort();
  }, []);

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
    embedControllerRef.current?.abort();
    if (!target) return;
    const controller = new AbortController();
    embedControllerRef.current = controller;
    setEmbedStatus({
      checked: false,
      canEmbed: true,
      isRestricted: false,
    });
    try {
      const res = await fetch(`/api/check-embed?url=${encodeURIComponent(target)}`, { signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted || activeUrlRef.current !== target) return;
      if (!res.ok) throw new Error(data.error || "Could not check framing");
      setEmbedStatus({
        checked: true,
        canEmbed: data.canEmbed !== false,
        isRestricted: Boolean(data.isRestricted),
        reason: data.reason,
      });
    } catch {
      if (controller.signal.aborted || activeUrlRef.current !== target) return;
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
    async (device: DeviceFrameDevice, target: string, force = false): Promise<DeviceSnapshot | null> => {
      if (!target) return null;
      snapshotControllersRef.current.get(device.id)?.abort();
      const controller = new AbortController();
      snapshotControllersRef.current.set(device.id, controller);
      snapshotKeysRef.current.set(device.id, snapshotKey(device, target));
      setSnapshotLoading((prev) => ({ ...prev, [device.id]: true }));
      try {
        const result = await executeScreenshotCapture({
          url: target,
          presetKey: device.presetKey,
          customW: device.width,
          customH: device.height,
          useCustomDimensions: true,
          signal: controller.signal,
          captureFullPage: true,
          captureQuality: "preview",
          settleDelay: 1000,
        }, { skipCache: force });
        const currentDevice = activeDevicesRef.current.find((item) => item.id === device.id);
        if (controller.signal.aborted || target !== activeUrlRef.current || !currentDevice || currentDevice.width !== device.width || currentDevice.height !== device.height || currentDevice.reloadKey !== device.reloadKey) return null;

        if (result.success && result.data) {
          const snap: DeviceSnapshot = {
            dataUrl: result.data.screenshotBase64,
            width: result.data.width,
            height: result.data.height,
            fullHeight: result.data.fullHeight,
            targetUrl: target,
            viewportWidth: device.width,
            viewportHeight: device.height,
            reloadKey: device.reloadKey,
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
        if (snapshotControllersRef.current.get(device.id) === controller) {
          snapshotControllersRef.current.delete(device.id);
          snapshotKeysRef.current.delete(device.id);
          setSnapshotLoading((prev) => ({ ...prev, [device.id]: false }));
        }
      }
    },
    [onShowToast]
  );

  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  // Capture only viewports without a current snapshot, a few at a time.
  // Unchanged viewports reuse their snapshot; reloaded ones bypass the cache.
  const captureMissingSnapshots = useCallback(
    async (target: string, devices: DeviceFrameDevice[]) => {
      if (!target) return;
      const batch = ++snapshotBatchRef.current;
      const queue = devices.filter(
        (device) =>
          !isSnapshotCurrent(snapshotsRef.current[device.id], device, target) &&
          !snapshotControllersRef.current.has(device.id)
      );
      const worker = async () => {
        while (queue.length) {
          if (batch !== snapshotBatchRef.current || target !== activeUrlRef.current) return;
          const device = queue.shift()!;
          await captureDeviceSnapshot(device, target, device.reloadKey > 1);
        }
      };
      await Promise.all(Array.from({ length: Math.min(SNAPSHOT_CONCURRENCY, queue.length) }, worker));
    },
    [captureDeviceSnapshot]
  );

  useEffect(() => {
    if (previewMode === "preview" && activeUrl) captureMissingSnapshots(activeUrl, activeDevices);
  }, [previewMode, activeUrl, activeDevices, captureMissingSnapshots]);

  // On activeUrl change
  useEffect(() => {
    checkEmbedCapability(activeUrl);
    scrollPositionsRef.current.clear();
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
      id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      presetKey,
      name: preset.name,
      width: preset.width,
      height: preset.height,
      rotated: false,
      reloadKey: 1,
    };
    // Settings are persisted by the activeDevices effect.
    setActiveDevices((prev) => [...prev, newDevice]);
    setAddMenuOpen(false);
  };

  // Remove device viewport (the last one stays; its close button is disabled)
  const handleRemoveDevice = (id: string) => {
    if (activeDevices.length <= 1) return;
    bridgeControllerRef.current?.unregisterFrame(id);
    setActiveDevices((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
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
  };

  // Reload all viewports
  const handleReloadAll = () => {
    setActiveDevices((prev) =>
      prev.map((d) => ({ ...d, reloadKey: d.reloadKey + 1 }))
    );
    onShowToast("Reloaded all viewports", "info");
  };

  // Dynamic Fit Scale Calculation
  // Fit: the largest scale at which all wrapped rows fit on screen (min 25%, then scroll).
  const recalculateScale = useCallback(() => {
    if (currentScale !== "auto") {
      setComputedScale(currentScale);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasW = canvas.clientWidth - 48; // p-6 on both sides
    const canvasH = canvas.clientHeight - 48;
    if (canvasW <= 0 || canvasH <= 0 || activeDevices.length === 0) return;
    setComputedScale(computeFitScale(activeDevices, canvasW, canvasH));
  }, [activeDevices, currentScale]);

  useEffect(() => {
    recalculateScale();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(recalculateScale);
    observer.observe(canvas);
    return () => observer.disconnect();
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

    if (previewMode === "live") {
      const reported = bridgeControllerRef.current?.getFrameState(deviceId);
      let target = reported?.url || activeUrl;
      let position = reported?.connected ? { x: reported.scrollX, y: reported.scrollY } : undefined;
      try {
        const frameWindow = iframeElementsRef.current.get(deviceId)?.contentWindow;
        if (frameWindow) {
          target = frameWindow.location.href;
          position = { x: frameWindow.scrollX, y: frameWindow.scrollY };
        }
      } catch { /* Interactive previews report their location through the bridge. */ }
      const validation = sanitizeAndValidateUrl(target);
      if (!validation.isValid || !position) {
        onShowToast("Switch this viewport to Interactive mode to snap the page at its current position.", "info");
        return;
      }
      snapshotControllersRef.current.get(deviceId)?.abort();
      const controller = new AbortController();
      snapshotControllersRef.current.set(deviceId, controller);
      setSnapshotLoading((prev) => ({ ...prev, [deviceId]: true }));
      try {
        const result = await executeScreenshotCapture({
          url: validation.normalizedUrl,
          presetKey: device.presetKey,
          customW: device.width,
          customH: device.height,
          useCustomDimensions: true,
          captureFullPage: false,
          scrollX: position.x,
          scrollY: position.y,
          captureQuality: "preview",
          signal: controller.signal,
        }, { skipCache: true });
        if (controller.signal.aborted) return;
        if (!result.success || !result.data) {
          onShowToast(result.error || "Could not snap this page.", "error");
          return;
        }
        if (outputMode === "mockup") {
          onSendToMockup?.(validation.normalizedUrl, selectedPreset, selectedFrame, result.data.screenshotBase64);
        } else {
          downloadPng(result.data.screenshotBase64, `instaframe-${device.presetKey}-${Date.now()}.png`);
        }
        onShowToast("Snapped the current page and scroll position.", "success");
      } finally {
        if (snapshotControllersRef.current.get(deviceId) === controller) {
          snapshotControllersRef.current.delete(deviceId);
          setSnapshotLoading((prev) => ({ ...prev, [deviceId]: false }));
        }
      }
      return;
    }

    const targetAtCapture = activeUrl;
    let snapshot: DeviceSnapshot | undefined | null = snapshots[deviceId];
    if (!snapshot?.dataUrl || snapshot.targetUrl !== activeUrl || snapshot.viewportWidth !== device.width || snapshot.viewportHeight !== device.height || snapshot.reloadKey !== device.reloadKey) {
      onShowToast("Generating capture snapshot. Please wait...", "info");
      snapshot = await captureDeviceSnapshot(device, activeUrl, true);
    }

    if (!snapshot?.dataUrl || targetAtCapture !== activeUrlRef.current) {
      return;
    }

    const position = scrollPositionsRef.current.get(deviceId);
    try {
      const croppedDataUrl = await cropViewportImage({
        sourceDataUrl: snapshot.dataUrl,
        deviceWidth: device.width,
        deviceHeight: device.height,
        scrollTop: position?.y || 0,
        scrollLeft: position?.x || 0,
      });

      if (outputMode === "mockup") {
        if (onSendToMockup) {
          onSendToMockup(targetAtCapture, selectedPreset, selectedFrame, croppedDataUrl);
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

  const segmentButton = (active: boolean) =>
    `h-[26px] rounded-full px-3 text-xs transition-colors duration-150 ${
      active ? "bg-white/[0.12] font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

  const zoomSteps: { label: string; value: "auto" | number }[] = [
    { label: "Fit", value: "auto" },
    { label: "100%", value: 1 },
    { label: "75%", value: 0.75 },
    { label: "50%", value: 0.5 },
  ];

  return (
    <div className="flex min-h-0 h-full flex-col bg-black text-zinc-100">
      {/* Studio toolbar */}
      <div className="relative z-30 shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* URL bar: one 32px pill, reload and Go inside as 26px buttons */}
          <form
            onSubmit={handleNavigate}
            className="flex h-8 min-w-0 max-w-xl flex-1 items-center rounded-full border border-white/10 bg-black pl-3 pr-[2px] transition-colors duration-150 focus-within:border-white/30"
          >
            <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://yourwebsite.com"
              aria-label="Website URL"
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-white placeholder-zinc-500 outline-none"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => setUrlInput("")}
                aria-label="Clear URL"
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors duration-150 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleReloadAll}
              title="Reload all viewports"
              aria-label="Reload all viewports"
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="submit"
              className="ml-[2px] h-[26px] shrink-0 rounded-full bg-white/[0.12] px-3.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/20"
            >
              Go
            </button>
          </form>

          {/* Add viewport: the only white button */}
          <div ref={addMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAddMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-black transition-colors duration-150 hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add viewport</span>
            </button>

            {addMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1.5 max-h-[380px] w-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a0c]/[0.98] p-1.5 shadow-2xl backdrop-blur-xl"
              >
                {DEVICE_CATEGORIES.map((category, catIdx) => {
                  const items = Object.entries(DEVICE_PRESETS).filter(([, preset]) => preset.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className={catIdx > 0 ? "mt-1 border-t border-white/5 pt-1.5" : ""}>
                      <div className="px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                        {CATEGORY_LABELS[category]}
                      </div>
                      <div className="space-y-0.5">
                        {items.map(([key, preset]) => {
                          const IconComp =
                            category === "Desktop & Laptops"
                              ? /book|laptop/i.test(preset.name)
                                ? Laptop
                                : Monitor
                              : category === "Tablets"
                              ? Tablet
                              : Smartphone;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="menuitem"
                              onClick={() => handleAddDevice(key)}
                              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 transition-colors duration-100 hover:bg-white/[0.06] hover:text-white"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <IconComp className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                                <span className="truncate">{preset.name}</span>
                              </span>
                              <span className="ml-2 shrink-0 text-[11px] tabular-nums text-zinc-500">
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {/* Preview mode */}
          <div role="group" aria-label="Preview mode" className="inline-flex h-8 items-center gap-0.5 rounded-full border border-white/10 bg-[#0a0a0c] p-[2px]">
            <button type="button" aria-pressed={previewMode === "live"} onClick={() => setPreviewMode("live")} className={segmentButton(previewMode === "live")}>
              Live
            </button>
            <button type="button" aria-pressed={previewMode === "preview"} onClick={() => setPreviewMode("preview")} className={segmentButton(previewMode === "preview")}>
              Snapshot
            </button>
          </div>

          {/* Sync scroll */}
          <label className="flex cursor-pointer select-none items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={syncScroll}
              aria-label="Sync scroll"
              onClick={() => setSyncScroll(!syncScroll)}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out ${
                syncScroll ? "border-white/30 bg-white" : "border-white/15 bg-white/10 hover:border-white/25"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full transition-transform duration-150 ease-out ${
                  syncScroll ? "translate-x-3.5 bg-black" : "translate-x-0.5 bg-zinc-400"
                }`}
              />
            </button>
            <span className="text-xs font-medium text-zinc-300">Sync scroll</span>
          </label>

          {/* Zoom */}
          <div role="group" aria-label="Zoom" className="inline-flex h-8 items-center gap-0.5 rounded-full border border-white/10 bg-[#0a0a0c] p-[2px]">
            {zoomSteps.map((step) => (
              <button
                key={step.label}
                type="button"
                aria-pressed={currentScale === step.value}
                onClick={() => setCurrentScale(step.value)}
                className={segmentButton(currentScale === step.value)}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas: viewports wrap into centered rows; overflow only goes right/down */}
      <div ref={canvasRef} className="studio-canvas-bg relative min-h-0 flex-1 overflow-auto bg-black p-6">
        <div className="studio-rows flex flex-wrap items-start gap-8">
          {activeDevices.map((device) => (
            <DeviceFrame
              key={device.id}
              device={device}
              url={activeUrl}
              scale={computedScale}
              previewMode={previewMode}
              snapshotDataUrl={snapshots[device.id]?.dataUrl}
              isSnapshotLoading={Boolean(snapshotLoading[device.id])}
              embedStatus={embedStatus}
              isMixedContent={isMixedContent}
              bridgeConnected={Boolean(bridgeConnectedDevices[device.id])}
              canRemove={activeDevices.length > 1}
              onRotate={handleRotateDevice}
              onReload={handleReloadDevice}
              onRemove={handleRemoveDevice}
              onUpdateDimensions={handleUpdateDimensions}
              onCaptureVisible={handleCaptureVisible}
              onOpenBridgeHelp={() => setBridgeHelpOpen(true)}
              iframeRefCallback={handleIframeRef}
              onSnapshotScroll={(id, x, y) => scrollPositionsRef.current.set(id, { x, y })}
            />
          ))}
        </div>
      </div>

      <BridgeHelpModal isOpen={bridgeHelpOpen} onClose={() => setBridgeHelpOpen(false)} viewerOrigin={viewerOrigin} />
    </div>
  );
}
