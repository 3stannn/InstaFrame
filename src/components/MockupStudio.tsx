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
  Maximize2,
  ArrowRight,
  Monitor,
  MoveHorizontal,
  Shrink,
} from "lucide-react";
import {
  DEVICE_PRESETS,
  DEVICE_CATEGORIES,
  CATEGORY_LABELS,
  FRAME_OPTIONS,
  BACKDROP_OPTIONS,
  ZOOM_OPTIONS
} from "@/lib/devices";
import { renderMockup, FitMode } from "@/lib/compositor";
import { loadSettings, saveSettings } from "@/lib/storage";
import { CustomDropdown, DropdownItem } from "@/components/CustomDropdown";
import { sanitizeAndValidateUrl } from "@/lib/url-validation";
import { LiveWebsitePreview } from "@/components/LiveWebsitePreview";
import { type LiveFrameState } from "@/lib/preview-bridge-controller";
import { getFrameContentHeight } from "@/lib/frame-layout";
import FRAME_METAS from "../../public/assets/frames/frame-meta.json";
import { executeScreenshotCapture } from "@/lib/capture-client";

// Grouped settings cards: label on the left, control on the right.
const ROW = "settings-row";
const ROW_LABEL = "settings-label";
const ROW_CONTROL = "w-[min(176px,60%)] shrink-0";

interface MockupStudioProps {
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

export function MockupStudio({ onShowToast, isActive, initialConfig }: MockupStudioProps) {
  const [liveNavigationKey, setLiveNavigationKey] = useState(0);
  const [liveUrl, setLiveUrl] = useState("");
  const [previewStage, setPreviewStage] = useState<"live" | "mockup">("live");
  const [liveReady, setLiveReady] = useState(false);
  const capturedLiveViewRef = useRef<LiveFrameState | undefined>(undefined);
  const liveStateRef = useRef<LiveFrameState>({ url: "", scrollX: 0, scrollY: 0, connected: false });
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
  const imageImportGenerationRef = useRef(0);
  const activeCaptureAbortRef = useRef<AbortController | null>(null);

  // Restore saved preferences
  useEffect(() => {
    const saved = loadSettings();
    if (saved.targetUrl && saved.targetUrl !== "https://schedy-sepia.vercel.app/" && saved.targetUrl !== "https://yourwebsite.com") {
      setUrlInput(saved.targetUrl);
      setLiveUrl(saved.targetUrl);
      setCapturedUrl(saved.targetUrl);
    }
    if (saved.preset && (DEVICE_PRESETS[saved.preset] || saved.preset === "custom")) {
      setSelectedPreset(saved.preset);
    }
    if (saved.customW) setCustomW(saved.customW);
    if (saved.customH) setCustomH(saved.customH);
    // Hardware frame is never pre-selected from saved settings on open; defaults to "none" (Raw)
    setSelectedFrame("none");
    if (saved.background) setSelectedBackdrop(saved.background);
    if (saved.zoom) setSelectedZoom(saved.zoom);
    if (typeof saved.fullPage === "boolean") setFullPage(saved.fullPage);
    if (saved.notchColor) setNotchColor(saved.notchColor);
    if (typeof saved.autoNotch === "boolean") setAutoNotch(saved.autoNotch);
    if (saved.fitMode) setFitMode(saved.fitMode);
  }, []);

  // Memoized dropdown item configs (zero duplicates, matched to design system)
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
            section: CATEGORY_LABELS[cat],
            icon,
          });
        });
    });
    items.push({
      value: "custom",
      label: "Custom size",
      section: "",
      icon: "custom",
    });
    return items;
  }, []);

  const frameItems: DropdownItem[] = useMemo(() => {
    return FRAME_OPTIONS.map((f) => ({
      value: f.id,
      label: f.name,
      meta: f.meta,
      section: f.section,
      icon: f.icon,
    }));
  }, []);

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
    if (previewStage === "mockup" && captureSource === "url" && urlInput.trim()) {
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
    if (previewStage === "mockup" && captureSource === "url" && target && target !== "https://yourwebsite.com") {
      handleCaptureUrl(undefined, target, selectedPreset, selectedFrame, val);
    }
  };

  // Primary Action: Capture & Mockup from Target URL (Responsive to selected size)
  const handleCaptureUrl = async (
    e?: React.FormEvent,
    overrideUrl?: string,
    overridePreset?: string,
    overrideFrame?: string,
    overrideZoom?: string,
    liveView?: LiveFrameState
  ) => {
    if (e) e.preventDefault();
    let target = (overrideUrl !== undefined ? overrideUrl : urlInput).trim();
    if (!target) {
      onShowToast("Please enter a website URL.", "error");
      return;
    }
    const validated = sanitizeAndValidateUrl(target);
    if (!validated.isValid) {
      onShowToast(validated.error || "Invalid URL", "error");
      return;
    }
    target = validated.normalizedUrl;
    setUrlInput(target);

    const presetToUse = overridePreset || selectedPreset;
    const frameToUse = overrideFrame !== undefined ? overrideFrame : selectedFrame;
    const zoomToUse = overrideZoom !== undefined ? overrideZoom : selectedZoom;
    const capturePosition = liveView || (capturedLiveViewRef.current?.url === target ? capturedLiveViewRef.current : undefined);

    saveSettings({ targetUrl: target, preset: presetToUse, frame: frameToUse, zoom: zoomToUse, customW, customH });

    // Cancel in-flight capture to avoid stale responses
    if (activeCaptureAbortRef.current) {
      activeCaptureAbortRef.current.abort();
    }
    const abortController = new AbortController();
    activeCaptureAbortRef.current = abortController;

    setIsCapturing(true);
    const progressId = onShowToast(
      `Capturing ${DEVICE_PRESETS[presetToUse]?.name || "custom size"} at ${zoomToUse}% zoom…`,
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
        scrollX: capturePosition?.scrollX || 0,
        scrollY: capturePosition?.scrollY || 0,
        zoomLevel: parseInt(zoomToUse, 10) || 100,
        captureFullPage: fullPage,
        captureQuality: "preview",
        settleDelay: 1000,
        signal: abortController.signal,
      }, { skipCache: Boolean(capturePosition) || !overridePreset && overrideFrame === undefined && overrideZoom === undefined });

      if (abortController.signal.aborted) {
        return; // Request was superseded
      }

      if (result.success && result.data) {
        capturedLiveViewRef.current = capturePosition;
        setPreviewStage("mockup");
        setCapturedUrl(target);
        setScreenshotDataUrl(result.data.screenshotBase64);
        setCaptureSource("url");
        setCapturedPreset(presetToUse);
        const kb = Math.round(result.payloadSizeBytes / 1024);
        onShowToast(
          `Captured ${result.data.width} × ${result.data.height} (${kb} KB${result.fromCache ? ", cached" : `, ${result.transferTimeMs} ms`})`,
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
      if (activeCaptureAbortRef.current === abortController) {
        setIsCapturing(false);
        activeCaptureAbortRef.current = null;
      }
    }
  };

  const handleOpenLive = (event?: React.FormEvent) => {
    event?.preventDefault();
    const validation = sanitizeAndValidateUrl(urlInput);
    if (!validation.isValid) {
      onShowToast(validation.error || "Enter a valid website URL.", "error");
      return;
    }
    activeCaptureAbortRef.current?.abort();
    activeCaptureAbortRef.current = null;
    setIsCapturing(false);
    setUrlInput(validation.normalizedUrl);
    setLiveReady(false);
    setLiveNavigationKey((value) => value + 1);
    setLiveUrl(validation.normalizedUrl);
    setPreviewStage("live");
    saveSettings({ targetUrl: validation.normalizedUrl });
  };

  const handleLiveState = useCallback((state: LiveFrameState) => {
    const previousUrl = liveStateRef.current.url;
    liveStateRef.current = state;
    setLiveReady(state.connected);
    if (state.url && state.url !== previousUrl) setUrlInput(state.url);
  }, []);

  const handleSnapLive = () => {
    const state = liveStateRef.current;
    if (!state.connected) {
      onShowToast("Wait for the interactive preview to load, or use Capture screen for this website.", "info");
      return;
    }
    handleCaptureUrl(undefined, state.url || liveUrl, undefined, undefined, undefined, { ...state });
  };

  const viewportWidth = selectedPreset === "custom" ? Math.max(100, Math.min(7680, customW)) : DEVICE_PRESETS[selectedPreset]?.width || 1280;
  const frameMeta = FRAME_METAS[selectedFrame as keyof typeof FRAME_METAS];
  const viewportHeight = frameMeta ? getFrameContentHeight(frameMeta, viewportWidth) : selectedPreset === "custom" ? Math.max(100, Math.min(7680, customH)) : DEVICE_PRESETS[selectedPreset]?.height || 832;

  const captureUrlRef = useRef(handleCaptureUrl);
  captureUrlRef.current = handleCaptureUrl;

  // Handle incoming preloaded configuration from Responsive Studio
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.url) {
        setLiveUrl(initialConfig.url);
        setUrlInput(initialConfig.url);
        setCapturedUrl(initialConfig.url);
      }
      if (initialConfig.presetKey && DEVICE_PRESETS[initialConfig.presetKey]) {
        setSelectedPreset(initialConfig.presetKey);
      }
      if (initialConfig.frameId) setSelectedFrame(initialConfig.frameId);
      if (initialConfig.imageDataUrl) {
        setPreviewStage("mockup");
        setScreenshotDataUrl(initialConfig.imageDataUrl);
        capturedLiveViewRef.current = undefined;
        setCaptureSource("screen");
        setCapturedPreset(initialConfig.presetKey || null);
        setFitMode("contain");
      } else if (initialConfig.autoCapture && initialConfig.url) {
        captureUrlRef.current(
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

  // Blob URLs from the compositor must be released when they are replaced.
  const objectUrlRef = useRef<string | null>(null);
  const showComposite = useCallback((url: string | null, isObjectUrl = false) => {
    if (objectUrlRef.current && objectUrlRef.current !== url) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = isObjectUrl ? url : null;
    setCompositeDataUrl(url);
  }, []);
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  // Re-run composite whenever options, frame, backdrop, or screenshot changes
  const runComposite = useCallback(async (isCurrent: () => boolean) => {
    if (!screenshotDataUrl) return;
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
        zoomLevel: captureSource === "url" ? 100 : parseInt(selectedZoom, 10) || 100,
      });
      if (!isCurrent()) {
        if (result.isObjectUrl) URL.revokeObjectURL(result.url);
        return;
      }
      showComposite(result.url, result.isObjectUrl);
      setCompositeDims(`${result.width} × ${result.height} px`);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      showComposite(null);
      console.error("Composite failed:", err);
      const msg = err instanceof Error ? err.message : "Compositing failed";
      onShowToast(`Failed: ${msg}`, "error");
    } finally {
      if (isCurrent()) setIsCompositing(false);
    }
  }, [screenshotDataUrl, selectedFrame, selectedBackdrop, autoNotch, notchColor, capturedUrl, fitMode, onShowToast, selectedZoom, captureSource, showComposite]);

  useEffect(() => {
    let active = true;
    runComposite(() => active);
    return () => { active = false; };
  }, [runComposite]);

  useEffect(() => () => { activeCaptureAbortRef.current?.abort(); }, []);

  // Screen / Tab Capture Web API
  const handleCaptureScreen = async () => {
    let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        onShowToast("Screen capture API not supported in this browser.", "error");
        return;
      }

      onShowToast("Select a tab or window to capture...", "info");

      stream = await navigator.mediaDevices.getDisplayMedia({
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
          bitmap.close();
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
        activeCaptureAbortRef.current?.abort();
        activeCaptureAbortRef.current = null;
        setIsCapturing(false);
        setPreviewStage("mockup");
        setScreenshotDataUrl(dataUrl);
        capturedLiveViewRef.current = undefined;
        setCaptureSource("screen");
        setCapturedPreset(null);
        setCapturedUrl("");
        onShowToast("Captured your screen", "success");
      }
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === "NotAllowedError")) {
        onShowToast(`Capture cancelled or failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const importImage = useCallback((dataUrl: string, successMessage: string) => {
    const generation = ++imageImportGenerationRef.current;
    const image = new Image();
    image.onload = () => {
      if (generation !== imageImportGenerationRef.current) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) throw new Error("Invalid image dimensions");
        context.drawImage(image, 0, 0);
        const png = canvas.toDataURL("image/png");
        activeCaptureAbortRef.current?.abort();
        activeCaptureAbortRef.current = null;
        setIsCapturing(false);
        setPreviewStage("mockup");
        setScreenshotDataUrl(png);
        capturedLiveViewRef.current = undefined;
        setCaptureSource("upload");
        setCapturedPreset(null);
        setCapturedUrl("");
        onShowToast(successMessage, "success");
      } catch {
        onShowToast("Could not import this image. Try a PNG or JPEG file.", "error");
      }
    };
    image.onerror = () => onShowToast("Could not read this image. Try a PNG or JPEG file.", "error");
    image.src = dataUrl;
  }, [onShowToast]);

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") importImage(reader.result, "Image loaded");
    };
    reader.onerror = () => onShowToast("Could not read image file.", "error");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Clipboard Paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isActive) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              const dataUrl = loadEvt.target?.result as string;
              if (dataUrl) importImage(dataUrl, "Pasted image from clipboard");
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onShowToast, isActive, importImage]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!compositeDataUrl || isCompositing || isCapturing) return;
    try {
      const res = await fetch(compositeDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      setCopySuccess(true);
      onShowToast("Copied mockup to clipboard", "success");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Browser permission denied";
      onShowToast(`Copy failed: ${msg}`, "error");
    }
  };

  // Download PNG
  const handleDownload = () => {
    if (!compositeDataUrl || isCompositing || isCapturing) return;
    const a = document.createElement("a");
    a.href = compositeDataUrl;
    a.download = `instaframe-${selectedFrame}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowToast("Downloaded PNG", "success");
  };

  const handleFrameSelect = (frameId: string) => {
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
      if (previewStage === "mockup" && captureSource === "url" && urlInput.trim()) {
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

  // Zoom on Ctrl/Cmd + wheel or trackpad pinch. React's onWheel is passive, so
  // preventDefault there cannot stop the browser from zooming the whole page.
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setCanvasZoom((prev) => Math.min(3.0, Math.max(0.5, Math.round((prev + delta) * 100) / 100)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Zooming back to 100% or less recenters the mockup.
  useEffect(() => {
    if (canvasZoom <= 1) setPan((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }, [canvasZoom]);

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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-auto lg:overflow-hidden bg-canvas">
      {/* Settings sidebar: grouped setting cards */}
      <aside className="w-full flex-shrink-0 space-y-5 overflow-y-auto border-b border-line-subtle bg-shell p-4 lg:w-80 lg:border-b-0 lg:border-r">
        {/* Source */}
        <section aria-labelledby="mockup-source">
          <h2 id="mockup-source" className="section-label">Source</h2>

          <div className="space-y-2">
            <form aria-label="Open live website" onSubmit={handleOpenLive}>
              <div className="field pl-2.5 pr-[2px]">
                <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  aria-label="Website URL"
                  className="min-w-0 flex-1 bg-transparent px-2 text-[12.5px] text-ink outline-none"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput("")}
                    aria-label="Clear URL"
                    className="icon-btn"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isCapturing}
                  aria-label="Open website"
                  title="Open website"
                  className="icon-btn ml-[2px] bg-control-active text-ink hover:!bg-[#3e3e45]"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            {/* Snap view is the main action while the live website is showing */}
            <button
              type="button"
              onClick={handleSnapLive}
              disabled={!liveUrl || !liveReady || isCapturing}
              className={`btn w-full ${previewStage === "live" ? "btn-primary" : "btn-neutral"}`}
            >
              {isCapturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              <span>{isCapturing ? "Capturing…" : "Snap view"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleCaptureScreen} className="btn btn-secondary !px-2">
                <Monitor className="h-3.5 w-3.5 text-ink-secondary" />
                <span>Capture screen</span>
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary !px-2">
                <Upload className="h-3.5 w-3.5 text-ink-secondary" />
                <span>Upload image</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>

            <p className="px-0.5 text-xs leading-relaxed text-ink-secondary">
              {liveUrl && !liveReady && !isCapturing
                ? "Loading the website…"
                : "Open a website, scroll to the shot you want, then snap it. You can also paste an image."}
            </p>
          </div>
        </section>

        {/* Capture: settings that change the captured page */}
        <section aria-labelledby="mockup-capture">
          <h2 id="mockup-capture" className="section-label">Capture</h2>

          <div className="card">
            <div className={ROW}>
              <span className={ROW_LABEL}>Viewport</span>
              <CustomDropdown value={selectedPreset} onChange={handlePresetChange} items={viewportItems} align="right" showTriggerMeta={false} className={ROW_CONTROL} />
            </div>

            {selectedPreset === "custom" && (
              <div className={ROW}>
                <span className={ROW_LABEL}>Size</span>
                <div className={`flex min-w-0 items-center gap-1.5 ${ROW_CONTROL}`}>
                  <label className="field min-w-0 flex-1 px-2.5 text-xs">
                    <span className="mr-1.5 text-ink-subtle">W</span>
                    <input
                      type="number"
                      value={customW}
                      onChange={(e) => setCustomW(parseInt(e.target.value, 10) || 1440)}
                      aria-label="Custom width"
                      className="w-full min-w-0 bg-transparent text-ink outline-none tabular-nums"
                    />
                  </label>
                  <label className="field min-w-0 flex-1 px-2.5 text-xs">
                    <span className="mr-1.5 text-ink-subtle">H</span>
                    <input
                      type="number"
                      value={customH}
                      onChange={(e) => setCustomH(parseInt(e.target.value, 10) || 900)}
                      aria-label="Custom height"
                      className="w-full min-w-0 bg-transparent text-ink outline-none tabular-nums"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className={ROW}>
              <span className={ROW_LABEL}>Zoom</span>
              <CustomDropdown value={selectedZoom} onChange={handleZoomChange} items={zoomItems} align="right" className={ROW_CONTROL} />
            </div>

            <div className={ROW}>
              <span className={ROW_LABEL}>Full page</span>
              <button
                type="button"
                role="switch"
                aria-checked={fullPage}
                aria-label="Full page"
                onClick={() => {
                  const next = !fullPage;
                  setFullPage(next);
                  saveSettings({ fullPage: next });
                }}
                className="switch"
              />
            </div>
          </div>
        </section>

        {/* Mockup: presentation only, no new capture needed */}
        <section aria-labelledby="mockup-presentation">
          <h2 id="mockup-presentation" className="section-label">Mockup</h2>

          <div className="card">
            <div className={ROW}>
              <span className={ROW_LABEL}>Frame</span>
              <CustomDropdown value={selectedFrame} onChange={handleFrameSelect} items={frameItems} align="right" showTriggerMeta={false} className={ROW_CONTROL} />
            </div>

            <div className={ROW}>
              <span className={ROW_LABEL}>Backdrop</span>
              <CustomDropdown value={selectedBackdrop} onChange={handleBackdropChange} items={backdropItems} align="right" showTriggerMeta={false} className={ROW_CONTROL} />
            </div>

            {selectedFrame.toLowerCase().includes("iphone") && (
              <div className={ROW}>
                <span className={ROW_LABEL}>Status bar</span>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
                    <input
                      type="checkbox"
                      checked={autoNotch}
                      onChange={(e) => {
                        setAutoNotch(e.target.checked);
                        saveSettings({ autoNotch: e.target.checked });
                      }}
                      className="checkbox"
                    />
                    <span>Match page</span>
                  </label>
                  <input
                    type="color"
                    value={notchColor}
                    onChange={(e) => {
                      setNotchColor(e.target.value);
                      setAutoNotch(false);
                      saveSettings({ notchColor: e.target.value, autoNotch: false });
                    }}
                    aria-label="Status bar color"
                    title="Status bar color"
                    className="status-color-dot h-5 w-5 cursor-pointer rounded-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Screen fit: two radio choice cards */}
          <div className="mt-4">
            <div id="mockup-fit" className="section-label">Fit</div>
            <div role="radiogroup" aria-labelledby="mockup-fit" className="grid grid-cols-2 gap-2">
              {([
                { label: "Fill screen", desc: "Fills the whole screen", value: "smart", Icon: MoveHorizontal },
                { label: "Whole page", desc: "Fits the full capture", value: "contain", Icon: Shrink },
              ] as const).map((option) => {
                const active = option.value === "contain" ? fitMode === "contain" : fitMode !== "contain";
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setFitMode(option.value);
                      saveSettings({ fitMode: option.value });
                    }}
                    className="radio-card flex-col !gap-2"
                  >
                    <span className="flex w-full items-center justify-between">
                      <option.Icon className="radio-card-icon !mt-0" aria-hidden="true" />
                      <span className="radio-dot !mt-0" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="radio-card-title block">{option.label}</span>
                      <span className="radio-card-desc block">{option.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </aside>

      {/* Canvas Mockup Preview Surface */}
      <div className="flex min-h-[420px] lg:min-h-0 flex-1 flex-col overflow-hidden">
        {/* Preview Topbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle bg-shell px-4 py-2.5">
          <div className="seg">
            <button
              type="button"
              onClick={() => setPreviewStage("live")}
              disabled={!liveUrl}
              aria-pressed={previewStage === "live"}
              className="seg-item"
            >
              Live website
            </button>
            <button
              type="button"
              onClick={() => setPreviewStage("mockup")}
              aria-pressed={previewStage === "mockup"}
              className="seg-item"
            >
              Mockup
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
              {previewStage === "live" ? "Live preview" : "Mockup preview"}
            </span>
            {compositeDims && (
              <span className="badge font-mono tabular-nums">
                {compositeDims}
              </span>
            )}
            {capturedPreset && capturedPreset !== selectedPreset && (
              <button
                type="button"
                onClick={() => handleCaptureUrl(undefined, urlInput, selectedPreset, selectedFrame)}
                className="btn btn-neutral !h-[26px] !gap-1 !rounded-inner !px-2.5 !text-[11px]"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span>Recapture at {DEVICE_PRESETS[selectedPreset]?.name || "custom size"}</span>
              </button>
            )}
          </div>

          {/* Center: Canvas Zoom & Pan Controls (Floating Segmented Control) */}
          <div className="seg">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={canvasZoom <= 0.5}
              title="Zoom Out (Ctrl + Wheel Down)"
              aria-label="Zoom out"
              className="seg-item !w-[26px] !px-0"
            >
              <Minus className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={handleZoomFit}
              title="Click to reset to Fit"
              className="seg-item !px-2 font-mono !text-[11px] tabular-nums"
            >
              {Math.round(canvasZoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={canvasZoom >= 3.0}
              title="Zoom In (Ctrl + Wheel Up)"
              aria-label="Zoom in"
              className="seg-item !w-[26px] !px-0"
            >
              <Plus className="h-3 w-3" />
            </button>

            <div className="mx-0.5 h-3.5 w-px bg-line" />

            <button
              type="button"
              onClick={handleZoomFit}
              aria-pressed={canvasZoom === 1 && pan.x === 0 && pan.y === 0}
              className="seg-item"
              title="Fit mockup to viewport"
            >
              Fit
            </button>

            {(pan.x !== 0 || pan.y !== 0 || canvasZoom !== 1) && (
              <button
                type="button"
                onClick={handleZoomFit}
                title="Reset zoom and pan"
                aria-label="Reset zoom and pan"
                className="seg-item !w-[26px] !px-0"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!compositeDataUrl || isCompositing || isCapturing}
              className="btn btn-secondary"
            >
              {copySuccess ? <Check className="h-3.5 w-3.5 text-ink" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copySuccess ? "Copied" : "Copy"}</span>
            </button>

            {/* Download: the main action once a mockup is showing */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!compositeDataUrl || isCompositing || isCapturing}
              className={`btn ${previewStage === "mockup" ? "btn-primary" : "btn-neutral"}`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 flex-col ${previewStage === "live" && liveUrl ? "flex" : "hidden"}`}>
          {liveUrl && <LiveWebsitePreview key={liveNavigationKey} url={liveUrl} width={viewportWidth} height={viewportHeight} zoom={canvasZoom} pageZoom={parseInt(selectedZoom, 10) || 100} onStateChange={handleLiveState} />}
        </div>

        {/* Live Canvas Viewport */}
        <div
          ref={canvasContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className={`studio-canvas-bg relative ${previewStage === "live" && liveUrl ? "hidden" : "flex"} flex-1 items-center justify-center overflow-hidden p-6 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* Non-blocking update indicator when re-compositing or capturing */}
          {(isCompositing || isCapturing) && compositeDataUrl && (
            <div className="absolute top-4 z-20 flex items-center gap-2 rounded-full border border-line bg-[rgba(24,24,27,0.92)] px-3 py-1 text-xs text-ink-secondary shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-ink" />
              <span>{isCapturing ? "Capturing…" : "Updating mockup…"}</span>
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
                className="max-h-[78vh] max-w-[85%] object-contain rounded-card border border-line shadow-[0_16px_36px_-10px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.4)]"
              />
            </div>
          ) : isCompositing || isCapturing ? (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Loader2 className="h-7 w-7 animate-spin text-ink" />
              <span className="text-xs text-ink-secondary">
                {isCapturing ? "Capturing…" : "Building mockup…"}
              </span>
            </div>
          ) : (
            <div className="max-w-xs text-center text-[13px] text-ink-secondary pointer-events-none">
              Open a website, scroll or follow links, then click Snap view to create your mockup.
            </div>
          )}

          {/* Floating Zoom & Pan Pill */}
          {compositeDataUrl && (
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-line bg-[rgba(24,24,27,0.92)] px-3 py-1 text-xs text-ink-secondary shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <span className="font-mono text-[11px] tabular-nums text-ink">
                {Math.round(canvasZoom * 100)}%
              </span>
              <span className="text-ink-subtle">•</span>
              <span className="text-[10px] text-ink-subtle">
                Ctrl + Wheel or Drag
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
