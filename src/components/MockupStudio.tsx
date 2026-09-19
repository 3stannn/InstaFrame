"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Camera,
  Upload,
  Copy,
  Download,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Sparkles,
  Sliders,
  RefreshCw,
  X,
  Minus,
  Plus,
  RotateCcw,
  Maximize2
} from "lucide-react";
import {
  DEVICE_PRESETS,
  DEVICE_CATEGORIES,
  FRAME_OPTIONS,
  BACKDROP_OPTIONS,
  ZOOM_OPTIONS
} from "@/lib/devices";
import { renderMockup, FitMode } from "@/lib/compositor";
import { loadSettings, saveSettings } from "@/lib/storage";
import { CustomDropdown, DropdownItem } from "@/components/CustomDropdown";
import { executeScreenshotCapture } from "@/lib/capture-client";

interface MockupStudioProps {
  isPro: boolean;
  onOpenLicense: () => void;
  onShowToast: (
    message: string,
    type?: "success" | "error" | "info",
    options?: { id?: string; duration?: number }
  ) => string | void;
  isActive?: boolean;
  initialConfig?: {
    url?: string;
    presetKey?: string;
    frameId?: string;
    autoCapture?: boolean;
    imageDataUrl?: string;
  };
}

export function MockupStudio({ isPro, onOpenLicense, onShowToast, isActive, initialConfig }: MockupStudioProps) {
  const [urlInput, setUrlInput] = useState("");
  const [capturedUrl, setCapturedUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("macbook-air-13");
  const [customW, setCustomW] = useState(1440);
  const [customH, setCustomH] = useState(900);
  const [selectedFrame, setSelectedFrame] = useState("none");
  const [selectedBackdrop, setSelectedBackdrop] = useState("studio-dark");
  const [selectedZoom, setSelectedZoom] = useState("100");
  const [fullPage, setFullPage] = useState(false);
  const [autoNotch, setAutoNotch] = useState(true);
  const [notchColor, setNotchColor] = useState("#000000");
  const [fitMode, setFitMode] = useState<FitMode>("smart");
  const [captureSource, setCaptureSource] = useState<"url" | "screen" | "upload" | null>(null);
  const [capturedPreset, setCapturedPreset] = useState<string | null>(null);

  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCompositing, setIsCompositing] = useState(false);
  const [compositeDims, setCompositeDims] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Canvas Zoom & Pan State (for preview area)
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCaptureAbortRef = useRef<AbortController | null>(null);

  // Restore saved preferences
  useEffect(() => {
    const saved = loadSettings();
    if (saved.targetUrl && saved.targetUrl !== "https://schedy-sepia.vercel.app/" && saved.targetUrl !== "https://yourwebsite.com") {
      setUrlInput(saved.targetUrl);
      setCapturedUrl(saved.targetUrl);
    }
    if (saved.preset && (DEVICE_PRESETS[saved.preset] || saved.preset === "custom")) {
      setSelectedPreset(saved.preset);
    }
    if (saved.customW) setCustomW(saved.customW);
    // Hardware frame is never pre-selected from saved settings on open; defaults to "none" (Raw)
    setSelectedFrame("none");
    if (saved.background) setSelectedBackdrop(saved.background);
    if (saved.zoom) setSelectedZoom(saved.zoom);
    if (typeof saved.fullPage === "boolean") setFullPage(saved.fullPage);
    if (saved.notchColor) setNotchColor(saved.notchColor);
    if (typeof saved.autoNotch === "boolean") setAutoNotch(saved.autoNotch);
    if (saved.fitMode) setFitMode(saved.fitMode);
  }, []);

  // Initialize placeholder preview canvas on mount (clearly labeled as not yet captured)
  useEffect(() => {
    if (!screenshotDataUrl && !isCapturing) {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 832;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Dark studio background
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, 1280, 832);

        // Inner browser preview card
        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = "#27272a";
        ctx.lineWidth = 1.5;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(140, 100, 1000, 632, 16);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(140, 100, 1000, 632);
          ctx.strokeRect(140, 100, 1000, 632);
        }

        // Window controls
        ctx.fillStyle = "#ef4444";
        ctx.beginPath(); ctx.arc(175, 135, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#eab308";
        ctx.beginPath(); ctx.arc(195, 135, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath(); ctx.arc(215, 135, 6, 0, Math.PI * 2); ctx.fill();

        // Address bar
        ctx.fillStyle = "#27272a";
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(240, 123, 440, 24, 6);
          ctx.fill();
        } else {
          ctx.fillRect(240, 123, 440, 24);
        }
        ctx.fillStyle = "#71717a";
        ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("Enter URL above to capture", 256, 139);

        // Content
        ctx.fillStyle = "#f4f4f5";
        ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("Not Yet Captured", 200, 280);

        ctx.fillStyle = "#a1a1aa";
        ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("Enter a website URL above and click Capture to generate a responsive preview.", 200, 325);

        // Action CTA pill
        ctx.fillStyle = "#27272a";
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(200, 380, 180, 42, 8);
          ctx.fill();
        } else {
          ctx.fillRect(200, 380, 180, 42);
        }

        ctx.fillStyle = "#a1a1aa";
        ctx.font = "bold 13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("Awaiting Capture", 240, 406);

        const initialData = canvas.toDataURL("image/png");
        setScreenshotDataUrl(initialData);
        setCaptureSource("url");
      }
    }
  }, [screenshotDataUrl, isCapturing]);

  // Memoized dropdown item configs (zero duplicates, matched to extension aesthetic)
  const viewportItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = [];
    DEVICE_CATEGORIES.forEach((cat) => {
      Object.entries(DEVICE_PRESETS)
        .filter(([_, p]) => p.category === cat)
        .forEach(([key, p]) => {
          let icon: DropdownItem["icon"] = "monitor";
          if (cat === "Desktop & Laptops") {
            icon = key.includes("macbook") || key.includes("laptop") ? "laptop" : "monitor";
          } else if (cat === "Tablets") {
            icon = "tablet";
          } else if (cat === "Mobile Devices") {
            icon = "phone";
          }
          items.push({
            value: key,
            label: p.name,
            meta: `${p.width} × ${p.height}`,
            section: cat,
            icon,
          });
        });
    });
    items.push({
      value: "custom",
      label: "Custom Size",
      meta: "W × H",
      section: "Custom",
      icon: "custom",
    });
    return items;
  }, []);

  const frameItems: DropdownItem[] = useMemo(() => {
    return FRAME_OPTIONS.map((f) => ({
      value: f.id,
      label: f.name,
      meta: f.isPro && !isPro ? "Pro" : f.meta,
      section: f.section,
      icon: f.icon,
      isPro: f.isPro,
    }));
  }, [isPro]);

  const backdropItems: DropdownItem[] = useMemo(() => {
    return BACKDROP_OPTIONS.map((b) => ({
      value: b.id,
      label: b.name,
      section: b.section,
      swatchClass: b.swatchClass,
      swatchStyle: b.swatchStyle,
    }));
  }, []);

  const zoomItems: DropdownItem[] = useMemo(() => {
    return ZOOM_OPTIONS.map((z) => ({
      value: z.value,
      label: z.label,
      meta: z.meta,
      section: z.section,
    }));
  }, []);

  const handlePresetChange = (val: string) => {
    setSelectedPreset(val);
    saveSettings({ preset: val });
    if (captureSource === "url" && urlInput.trim()) {
      handleCaptureUrl(undefined, urlInput, val, selectedFrame);
    }
  };

  const handleBackdropChange = (val: string) => {
    setSelectedBackdrop(val);
    saveSettings({ background: val });
  };

  const handleZoomChange = (val: string) => {
    setSelectedZoom(val);
    saveSettings({ zoom: val });
    const target = (capturedUrl || urlInput || "").trim();
    if (captureSource === "url" && target && target !== "https://yourwebsite.com") {
      handleCaptureUrl(undefined, target, selectedPreset, selectedFrame, val);
    }
  };

  // Primary Action: Capture & Mockup from Target URL (Responsive to selected size)
  const handleCaptureUrl = async (
    e?: React.FormEvent,
    overrideUrl?: string,
    overridePreset?: string,
    overrideFrame?: string,
    overrideZoom?: string
  ) => {
    if (e) e.preventDefault();
    let target = (overrideUrl !== undefined ? overrideUrl : urlInput).trim();
    if (!target) {
      onShowToast("Please enter a website URL.", "error");
      return;
    }
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
      setUrlInput(target);
    }
    setCapturedUrl(target);

    const presetToUse = overridePreset || selectedPreset;
    const frameToUse = overrideFrame !== undefined ? overrideFrame : selectedFrame;
    const zoomToUse = overrideZoom !== undefined ? overrideZoom : selectedZoom;

    saveSettings({ targetUrl: target, preset: presetToUse, frame: frameToUse, zoom: zoomToUse });

    // Cancel in-flight capture to avoid stale responses
    if (activeCaptureAbortRef.current) {
      activeCaptureAbortRef.current.abort();
    }
    const abortController = new AbortController();
    activeCaptureAbortRef.current = abortController;

    setIsCapturing(true);
    const progressId = onShowToast(
      `Emulating ${presetToUse} viewport at ${zoomToUse}% zoom...`,
      "info",
      { duration: 0 }
    );

    try {
      const result = await executeScreenshotCapture({
        url: target,
        presetKey: presetToUse,
        customW,
        customH,
        frameId: frameToUse,
        zoomLevel: parseInt(zoomToUse, 10) || 100,
        captureFullPage: fullPage,
        captureQuality: "preview",
        settleDelay: 1000,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return; // Request was superseded
      }

      if (result.success && result.data) {
        setScreenshotDataUrl(result.data.screenshotBase64);
        setCaptureSource("url");
        setCapturedPreset(presetToUse);
        const kb = Math.round(result.payloadSizeBytes / 1024);
        onShowToast(
          `Rendered responsive ${result.data.width} × ${result.data.height} layout (${kb} KB in ${result.transferTimeMs}ms)${result.fromCache ? " [cached]" : ""}!`,
          "success",
          progressId ? { id: progressId } : undefined
        );
      } else {
        onShowToast(
          `Capture failed: ${result.error || "Unknown error"}`,
          "error",
          progressId ? { id: progressId } : undefined
        );
      }
    } catch (err: unknown) {
      console.error("Capture failed:", err);
      const msg = err instanceof Error ? err.message : "Network error";
      onShowToast(`Capture failed: ${msg}`, "error", progressId ? { id: progressId } : undefined);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle incoming preloaded configuration from Responsive Studio
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.url) {
        setUrlInput(initialConfig.url);
        setCapturedUrl(initialConfig.url);
      }
      if (initialConfig.presetKey && DEVICE_PRESETS[initialConfig.presetKey]) {
        setSelectedPreset(initialConfig.presetKey);
      }
      if (initialConfig.frameId) setSelectedFrame(initialConfig.frameId);
      if (initialConfig.imageDataUrl) {
        setScreenshotDataUrl(initialConfig.imageDataUrl);
        setCaptureSource("screen");
        setCapturedPreset(initialConfig.presetKey || null);
        setFitMode("contain");
      } else if (initialConfig.autoCapture && initialConfig.url) {
        handleCaptureUrl(
          undefined,
          initialConfig.url,
          initialConfig.presetKey,
          initialConfig.frameId
        );
      }
    }
  }, [initialConfig]);

  // Whenever user navigates to the Mockup Studio tab without an explicit frameId, reset frame to "none" (Raw)
  useEffect(() => {
    if (isActive && !initialConfig?.frameId) {
      setSelectedFrame("none");
    }
  }, [isActive, initialConfig]);

  // Re-run composite whenever options, frame, backdrop, or screenshot changes
  // Note: Decoupled from urlInput keystrokes to ensure smooth typing with zero lag
  const runComposite = useCallback(async () => {
    if (!screenshotDataUrl) return;

    if (selectedFrame !== "none" && !isPro) {
      setCompositeDataUrl(screenshotDataUrl);
      const img = new Image();
      img.onload = () => setCompositeDims(`${img.naturalWidth} × ${img.naturalHeight} px`);
      img.src = screenshotDataUrl;
      return;
    }

    setIsCompositing(true);
    try {
      const result = await renderMockup({
        rawScreenshotBase64: screenshotDataUrl,
        frameId: selectedFrame,
        backgroundStyle: selectedBackdrop,
        pageUrl: capturedUrl,
        autoNotch: autoNotch,
        notchColor: notchColor,
        fitMode: fitMode,
        zoomLevel: parseInt(selectedZoom, 10) || 100,
      });
      setCompositeDataUrl(result);
      const img = new Image();
      img.onload = () => setCompositeDims(`${img.naturalWidth} × ${img.naturalHeight} px`);
      img.src = result;
    } catch (err: unknown) {
      console.error("Composite failed:", err);
      const msg = err instanceof Error ? err.message : "Compositing failed";
      onShowToast(`Failed: ${msg}`, "error");
    } finally {
      setIsCompositing(false);
    }
  }, [screenshotDataUrl, selectedFrame, selectedBackdrop, autoNotch, notchColor, capturedUrl, fitMode, isPro, onShowToast, selectedZoom]);

  useEffect(() => {
    runComposite();
  }, [runComposite]);

  // Screen / Tab Capture Web API
  const handleCaptureScreen = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        onShowToast("Screen capture API not supported in this browser.", "error");
        return;
      }

      onShowToast("Select a tab or window to capture...", "info");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      type WindowWithImageCapture = Window & {
        ImageCapture?: new (track: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> };
      };
      const ImageCapConstructor = (window as unknown as WindowWithImageCapture).ImageCapture;
      
      let dataUrl: string | null = null;
      if (ImageCapConstructor) {
        const imageCapture = new ImageCapConstructor(videoTrack);
        const bitmap = await imageCapture.grabFrame();
        videoTrack.stop();

        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          dataUrl = canvas.toDataURL("image/png");
        }
      } else {
        // Fallback using video element if ImageCapture unsupported
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          dataUrl = canvas.toDataURL("image/png");
        }
        videoTrack.stop();
      }

      if (dataUrl) {
        setScreenshotDataUrl(dataUrl);
        setCaptureSource("screen");
        setCapturedPreset(null);
        setCapturedUrl("");
        onShowToast("Captured frame successfully!", "success");
      }
    } catch (err: unknown) {
      const isNotAllowed = err instanceof Error && err.name === "NotAllowedError";
      if (!isNotAllowed) {
        const msg = err instanceof Error ? err.message : "Capture cancelled";
        onShowToast(`Capture cancelled or failed: ${msg}`, "error");
      }
    }
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      if (dataUrl) {
        setScreenshotDataUrl(dataUrl);
        setCaptureSource("upload");
        setCapturedPreset(null);
        onShowToast("Loaded image!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // Clipboard Paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              const dataUrl = loadEvt.target?.result as string;
              if (dataUrl) {
                setScreenshotDataUrl(dataUrl);
                setCaptureSource("upload");
                setCapturedPreset(null);
                onShowToast("Pasted image from clipboard!", "success");
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onShowToast]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!compositeDataUrl) return;
    try {
      const res = await fetch(compositeDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      setCopySuccess(true);
      onShowToast("Copied mockup to clipboard!", "success");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Browser permission denied";
      onShowToast(`Copy failed: ${msg}`, "error");
    }
  };

  // Download PNG
  const handleDownload = () => {
    if (!compositeDataUrl) return;
    const a = document.createElement("a");
    a.href = compositeDataUrl;
    a.download = `instaframe-${selectedFrame}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowToast("Downloaded PNG mockup", "success");
  };

  const handleFrameSelect = (frameId: string) => {
    const opt = FRAME_OPTIONS.find((f) => f.id === frameId);
    if (opt?.isPro && !isPro) {
      onShowToast("Mockup frames require a Pro license.", "error");
      onOpenLicense();
      setSelectedFrame("none");
      saveSettings({ frame: "none" });
      return;
    }
    setSelectedFrame(frameId);
    saveSettings({ frame: frameId });

    // Sync matching preset so layout renders responsively
    let matchingPresetKey: string | null = null;
    if (frameId === "iphone-15" && selectedPreset !== "iphone-15") {
      matchingPresetKey = "iphone-15";
    } else if (frameId === "macbook-air-13" && selectedPreset !== "macbook-air-13") {
      matchingPresetKey = "macbook-air-13";
    } else if (frameId === "ipad-pro" && !selectedPreset.startsWith("ipad")) {
      matchingPresetKey = "ipad-pro-13";
    } else if (frameId === "pixel-8" && selectedPreset !== "pixel-8") {
      matchingPresetKey = "pixel-8";
    } else if (frameId === "s24" && selectedPreset !== "samsung-s24-ultra") {
      matchingPresetKey = "samsung-s24-ultra";
    } else if (frameId === "pro-display-xdr" && selectedPreset !== "pro-display-xdr") {
      matchingPresetKey = "pro-display-xdr";
    }

    if (matchingPresetKey) {
      setSelectedPreset(matchingPresetKey);
      saveSettings({ preset: matchingPresetKey });
      if (captureSource === "url" && urlInput.trim()) {
        handleCaptureUrl(undefined, urlInput, matchingPresetKey, frameId);
      }
    }
  };

  // Canvas Zoom & Pan Handlers (Scales the responsive preview smoothly from 50% to 300%)
  const handleZoomIn = () => {
    setCanvasZoom((prev) => Math.min(3.0, Math.round((prev + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setCanvasZoom((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.15) * 100) / 100);
      if (next <= 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoomFit = () => {
    setCanvasZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Zoom on Ctrl/Cmd + wheel or trackpad pinch
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setCanvasZoom((prev) => {
        const next = Math.min(3.0, Math.max(0.5, Math.round((prev + delta) * 100) / 100));
        if (next <= 1.0) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragOrigin({
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragOrigin) return;
    const dx = e.clientX - dragOrigin.x;
    const dy = e.clientY - dragOrigin.y;
    setPan({
      x: dragOrigin.panX + dx,
      y: dragOrigin.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragOrigin(null);
  };

  const handleDoubleClick = () => {
    handleZoomFit();
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row overflow-hidden bg-zinc-950">
      {/* Settings & Controls Sidebar */}
      <div className="w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-900/40 p-5 overflow-y-auto space-y-5">
        {/* Section 1: Website URL & Capture */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              1. Website URL
            </span>
            <span className="text-[10px] text-zinc-500">Live responsive capture</span>
          </div>

          <form onSubmit={handleCaptureUrl} className="space-y-2.5">
            <div className="relative flex items-center">
              <Globe className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-9 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-700"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput("")}
                  className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                  title="Clear input"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isCapturing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-900 shadow-sm transition-all hover:bg-white active:scale-[0.98] disabled:opacity-50"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-900" />
                  <span>Emulating Device Viewport...</span>
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5 text-zinc-900" />
                  <span>Capture &amp; Mockup</span>
                </>
              )}
            </button>
          </form>

          {/* Alternative Ingestion Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCaptureScreen}
              className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 py-1.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors text-center"
            >
              Capture Screen
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 py-1.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors text-center"
            >
              Upload / Paste
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        <div className="h-px bg-zinc-800/60" />

        {/* Section 2: Viewport Preset */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              2. Device Viewport
            </span>
          </div>

          <CustomDropdown
            value={selectedPreset}
            onChange={handlePresetChange}
            items={viewportItems}
          />

          {/* Custom Size Fields */}
          {selectedPreset === "custom" && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex flex-1 items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs">
                <span className="mr-2 text-zinc-500">W</span>
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(parseInt(e.target.value, 10) || 1440)}
                  className="w-full bg-transparent text-zinc-100 outline-none tabular-nums"
                />
                <span className="text-[10px] text-zinc-500">PX</span>
              </div>
              <span className="text-zinc-600">×</span>
              <div className="flex flex-1 items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs">
                <span className="mr-2 text-zinc-500">H</span>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(parseInt(e.target.value, 10) || 900)}
                  className="w-full bg-transparent text-zinc-100 outline-none tabular-nums"
                />
                <span className="text-[10px] text-zinc-500">PX</span>
              </div>
            </div>
          )}

          {/* Full Page Capture Toggle */}
          <div className="flex items-center justify-between py-1 px-1">
            <div>
              <span className="block text-xs font-medium text-zinc-300">Full Page Capture</span>
              <span className="block text-[10px] text-zinc-500">Auto-scrolls entire page length</span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => {
                  setFullPage(e.target.checked);
                  saveSettings({ fullPage: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        <div className="h-px bg-zinc-800/60" />

        {/* Section 3: Studio Mockup Frame & Styling */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              3. Device Frame &amp; Backdrop
            </span>
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300">
              PRO
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Frame Select */}
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Hardware Frame</label>
              <CustomDropdown
                value={selectedFrame}
                onChange={handleFrameSelect}
                items={frameItems}
                align="left"
                showTriggerMeta={false}
              />
            </div>

            {/* Backdrop Select */}
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Backdrop Style</label>
              <CustomDropdown
                value={selectedBackdrop}
                onChange={handleBackdropChange}
                items={backdropItems}
                align="right"
                showTriggerMeta={false}
              />
            </div>
          </div>

          {/* Canvas Fit Mode */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-medium text-zinc-400">Canvas Screen Fitting</label>
              <span className="text-[10px] text-zinc-500">Aspect-ratio preserved</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => {
                  setFitMode("smart");
                  saveSettings({ fitMode: "smart" });
                }}
                className={`rounded-lg py-1.5 text-center text-xs font-medium transition-colors ${
                  fitMode === "smart" || fitMode === "cover"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Responsive Fill
              </button>
              <button
                type="button"
                onClick={() => {
                  setFitMode("contain");
                  saveSettings({ fitMode: "contain" });
                }}
                className={`rounded-lg py-1.5 text-center text-xs font-medium transition-colors ${
                  fitMode === "contain"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Fit Whole Page
              </button>
            </div>
          </div>

          {/* Page Zoom Select */}
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">Page Zoom Level</label>
            <CustomDropdown
              value={selectedZoom}
              onChange={handleZoomChange}
              items={zoomItems}
            />
          </div>

          {/* iPhone Notch settings */}
          {selectedFrame.toLowerCase().includes("iphone") && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-2">
              <span className="text-[10px] font-medium text-zinc-400">iPhone Dynamic Island / Notch</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={notchColor}
                  onChange={(e) => {
                    setNotchColor(e.target.value);
                    setAutoNotch(false);
                    saveSettings({ notchColor: e.target.value, autoNotch: false });
                  }}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                  title="Pick Header Color"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={autoNotch}
                    onChange={(e) => {
                      setAutoNotch(e.target.checked);
                      saveSettings({ autoNotch: e.target.checked });
                    }}
                    className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0"
                  />
                  <span>Auto-detect Header Theme</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Mockup Preview Surface */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Preview Topbar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-5 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-300">Mockup Preview</span>
            {compositeDims && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono tabular-nums text-zinc-400">
                {compositeDims}
              </span>
            )}
            {capturedPreset && capturedPreset !== selectedPreset && (
              <button
                type="button"
                onClick={() => handleCaptureUrl(undefined, urlInput, selectedPreset, selectedFrame)}
                className="flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span>Re-render responsive for {DEVICE_PRESETS[selectedPreset]?.name || selectedPreset}</span>
              </button>
            )}
          </div>

          {/* Center: Canvas Zoom & Pan Controls */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={canvasZoom <= 0.5}
              title="Zoom Out (Ctrl + Wheel Down)"
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={handleZoomFit}
              title="Click to reset to Fit"
              className="h-6 px-2 text-[11px] font-mono font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition-colors tabular-nums"
            >
              {Math.round(canvasZoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={canvasZoom >= 3.0}
              title="Zoom In (Ctrl + Wheel Up)"
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>

            <div className="h-3.5 w-px bg-zinc-800" />

            <button
              type="button"
              onClick={handleZoomFit}
              className={`h-6 px-2 text-[10px] font-medium rounded transition-colors ${
                canvasZoom === 1 && pan.x === 0 && pan.y === 0
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Fit mockup to viewport"
            >
              Fit
            </button>

            {(pan.x !== 0 || pan.y !== 0 || canvasZoom !== 1) && (
              <button
                type="button"
                onClick={handleZoomFit}
                title="Reset zoom and pan"
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!compositeDataUrl || isCompositing}
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1 text-xs font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:text-white active:scale-95 disabled:opacity-40"
            >
              {copySuccess ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copySuccess ? "Copied!" : "Copy"}</span>
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!compositeDataUrl || isCompositing}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1 text-xs font-semibold text-zinc-900 shadow-sm transition-all hover:bg-white active:scale-95 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>

        {/* Live Canvas Viewport */}
        <div
          ref={canvasContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className={`studio-grid-bg relative flex flex-1 items-center justify-center overflow-hidden p-8 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* Non-blocking update indicator when re-compositing or capturing */}
          {(isCompositing || isCapturing) && compositeDataUrl && (
            <div className="absolute top-4 z-20 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 shadow-xl backdrop-blur-md text-xs text-zinc-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>{isCapturing ? "Emulating device viewport..." : "Updating mockup..."}</span>
            </div>
          )}

          {compositeDataUrl ? (
            <div
              className={`relative flex items-center justify-center pointer-events-none transition-opacity duration-150 ${
                isCompositing || isCapturing ? "opacity-70" : "opacity-100"
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${canvasZoom})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 120ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compositeDataUrl}
                alt="Device Mockup"
                draggable={false}
                className="max-h-[78vh] max-w-[85%] object-contain rounded-lg shadow-2xl"
              />
            </div>
          ) : isCompositing || isCapturing ? (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
              <span className="text-xs text-zinc-400">
                {isCapturing ? "Emulating responsive device viewport..." : "Compositing realistic device frame..."}
              </span>
            </div>
          ) : (
            <div className="text-center text-zinc-500 text-xs pointer-events-none">
              Enter a website URL and click &ldquo;Capture &amp; Mockup&rdquo; to render your mockup.
            </div>
          )}

          {/* Floating Zoom & Pan Pill */}
          {compositeDataUrl && (
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/90 px-3 py-1.5 shadow-xl backdrop-blur-md text-xs text-zinc-400">
              <span className="font-mono text-[11px] tabular-nums text-zinc-300">
                {Math.round(canvasZoom * 100)}%
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[10px] text-zinc-500">
                Ctrl + Wheel or Drag
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
