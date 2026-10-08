"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, RefreshCw, ArrowLeft } from "lucide-react";
import { PreviewBridgeController, type LiveFrameState } from "@/lib/preview-bridge-controller";

interface Props {
  url: string;
  width: number;
  height: number;
  zoom?: number;
  pageZoom?: number;
  onStateChange: (state: LiveFrameState) => void;
}

export function LiveWebsitePreview({ url, width, height, zoom = 1, pageZoom = 100, onStateChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const directCleanupRef = useRef<(() => void) | null>(null);
  const controllerRef = useRef<PreviewBridgeController | null>(null);
  const pageZoomRef = useRef(pageZoom);
  pageZoomRef.current = pageZoom;
  const callbackRef = useRef(onStateChange);
  callbackRef.current = onStateChange;
  const [scale, setScale] = useState(1);
  const [entryUrl, setEntryUrl] = useState(url);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [direct, setDirect] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setEntryUrl(url);
    setCurrentUrl(url);
    setLoading(true);
    setConnected(false);
    callbackRef.current({ url, scrollX: 0, scrollY: 0, connected: false });
  }, [url]);

  useEffect(() => {
    const controller = new PreviewBridgeController({
      syncScroll: false,
      onStatusChange: (_, connected) => {
        if (connected) iframeRef.current?.contentWindow?.postMessage({ type: "INSTAFRAME_PAGE_ZOOM", zoom: pageZoomRef.current }, "*");
      },
      onStateChange: (_, state) => {
        if (state.url) setCurrentUrl(state.url);
        setConnected(state.connected);
        callbackRef.current(state);
      },
    });
    controllerRef.current = controller;
    setConnected(false);
    callbackRef.current({ url: entryUrl, scrollX: 0, scrollY: 0, connected: false });
    return () => { directCleanupRef.current?.(); controller.destroy(); controllerRef.current = null; };
  }, [entryUrl, direct, reload]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const availableWidth = Math.max(100, container.clientWidth - 32);
      const availableHeight = Math.max(100, container.clientHeight - 32);
      setScale(Math.min(1, availableWidth / width, availableHeight / height));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  useEffect(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    try {
      if (direct && frameWindow) frameWindow.document.documentElement.style.zoom = String(pageZoom / 100);
      else frameWindow?.postMessage({ type: "INSTAFRAME_PAGE_ZOOM", zoom: pageZoom }, "*");
    } catch { frameWindow?.postMessage({ type: "INSTAFRAME_PAGE_ZOOM", zoom: pageZoom }, "*"); }
  }, [pageZoom, direct]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    requestAnimationFrame(() => {
      if (iframeRef.current) controllerRef.current?.registerFrame("studio-live", iframeRef.current, entryUrl);
    });
    directCleanupRef.current?.();
    try {
      const frameWindow = iframeRef.current?.contentWindow;
      if (frameWindow && direct) {
        const report = () => {
          const state = { url: frameWindow.location.href, scrollX: frameWindow.scrollX, scrollY: frameWindow.scrollY, connected: true };
          setCurrentUrl(state.url);
          setConnected(true);
          callbackRef.current(state);
        };
        frameWindow.document.documentElement.style.zoom = String(pageZoomRef.current / 100);
        report();
        frameWindow.addEventListener("scroll", report, { passive: true });
        frameWindow.addEventListener("hashchange", report);
        frameWindow.addEventListener("popstate", report);
        directCleanupRef.current = () => {
          frameWindow.removeEventListener("scroll", report);
          frameWindow.removeEventListener("hashchange", report);
          frameWindow.removeEventListener("popstate", report);
        };
      }
    } catch { /* Cross-origin websites use the bridge to report their current page. */ }
  }, [entryUrl, direct]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950" data-testid="live-website-preview">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
        <button type="button" title="Go back in website" disabled={currentUrl === entryUrl} onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: "INSTAFRAME_HISTORY_BACK" }, "*")} className="rounded p-1 hover:bg-zinc-800 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
        <button type="button" title="Reload live website" onClick={() => { setEntryUrl(currentUrl); setReload((value) => value + 1); setLoading(true); }} className="rounded p-1 hover:bg-zinc-800"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={currentUrl}>{currentUrl}</span>
        <span className="shrink-0 text-[10px]">{loading ? "Loading…" : connected ? "Live · ready to snap" : "Live"}</span>
        <button type="button" onClick={() => { setEntryUrl(currentUrl); setDirect((value) => !value); setLoading(true); }} className="shrink-0 rounded border border-zinc-700 px-2 py-1" title="Try direct loading if this website does not work in the interactive preview">{direct ? "Direct" : "Interactive"}</button>
      </div>
      <div ref={containerRef} className="studio-grid-bg flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div className="relative shrink-0" style={{ width: width * scale * zoom, height: height * scale * zoom }}>
          <iframe
            key={`${entryUrl}-${direct}-${reload}`}
            ref={iframeRef}
            name="instaframe-live-preview"
            title="Live website — scroll and navigate before snapping"
            src={direct ? entryUrl : `/api/proxy?url=${encodeURIComponent(entryUrl)}`}
            sandbox={direct ? "allow-scripts allow-forms allow-popups allow-same-origin" : "allow-scripts allow-forms allow-popups"}
            onLoad={handleLoad}
            className="absolute left-0 top-0 origin-top-left rounded border border-zinc-700 bg-white"
            style={{ width, height, transform: `scale(${scale * zoom})` }}
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-400">Scroll or follow links to choose your shot, then click Snap view.</div>
    </div>
  );
}
