"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Check, X, Crop, Move } from "lucide-react";
import { CaptureOutputOption } from "./CaptureViewportPopover";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportSelectionOverlayProps {
  deviceWidth: number;
  deviceHeight: number;
  scaleFactor: number; // Device pixel scale factor (e.g. 2 or 3)
  outputMode: CaptureOutputOption;
  onCancel: () => void;
  onConfirmCrop: (rect: SelectionRect) => void;
}

type DragMode =
  | null
  | "create"
  | "move"
  | "nw"
  | "ne"
  | "se"
  | "sw"
  | "n"
  | "s"
  | "e"
  | "w";

export function ViewportSelectionOverlay({
  deviceWidth,
  deviceHeight,
  scaleFactor,
  outputMode,
  onCancel,
  onConfirmCrop,
}: ViewportSelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Current selection rectangle in local viewport CSS pixels (0..deviceWidth, 0..deviceHeight)
  const [rect, setRect] = useState<SelectionRect | null>(() => {
    // Initial default centered rectangle: 70% width, 60% height
    const w = Math.round(deviceWidth * 0.7);
    const h = Math.round(deviceHeight * 0.6);
    return {
      x: Math.round((deviceWidth - w) / 2),
      y: Math.round((deviceHeight - h) / 2),
      width: w,
      height: h,
    };
  });

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startRect: SelectionRect;
  }>({
    clientX: 0,
    clientY: 0,
    startRect: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Calculate local coordinates accounting for workspace zoom (CSS scale transform)
  const getLocalCoords = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const bounding = containerRef.current.getBoundingClientRect();
    const effectiveScale = bounding.width / deviceWidth;
    const x = (e.clientX - bounding.left) / effectiveScale;
    const y = (e.clientY - bounding.top) / effectiveScale;
    return {
      x: Math.max(0, Math.min(deviceWidth, x)),
      y: Math.max(0, Math.min(deviceHeight, y)),
    };
  }, [deviceWidth, deviceHeight]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Mouse drag handling (supports drawing new box, moving, or resizing handles)
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const bounding = containerRef.current.getBoundingClientRect();
      const effectiveScale = bounding.width / deviceWidth;
      const currentCoords = getLocalCoords(e);

      const dx = (e.clientX - dragStartRef.current.clientX) / effectiveScale;
      const dy = (e.clientY - dragStartRef.current.clientY) / effectiveScale;
      const start = dragStartRef.current.startRect;

      if (dragMode === "create") {
        const x1 = Math.min(start.x, currentCoords.x);
        const y1 = Math.min(start.y, currentCoords.y);
        const x2 = Math.max(start.x, currentCoords.x);
        const y2 = Math.max(start.y, currentCoords.y);
        setRect({
          x: Math.round(x1),
          y: Math.round(y1),
          width: Math.round(x2 - x1),
          height: Math.round(y2 - y1),
        });
      } else if (dragMode === "move") {
        let newX = Math.round(start.x + dx);
        let newY = Math.round(start.y + dy);
        newX = Math.max(0, Math.min(deviceWidth - start.width, newX));
        newY = Math.max(0, Math.min(deviceHeight - start.height, newY));
        setRect({
          x: newX,
          y: newY,
          width: start.width,
          height: start.height,
        });
      } else {
        // Handle resizing
        let { x, y, width, height } = start;
        if (dragMode.includes("e")) {
          width = Math.max(20, Math.min(deviceWidth - x, Math.round(start.width + dx)));
        }
        if (dragMode.includes("s")) {
          height = Math.max(20, Math.min(deviceHeight - y, Math.round(start.height + dy)));
        }
        if (dragMode.includes("w")) {
          const maxLeft = start.x + start.width - 20;
          const newX = Math.max(0, Math.min(maxLeft, Math.round(start.x + dx)));
          width = start.x + start.width - newX;
          x = newX;
        }
        if (dragMode.includes("n")) {
          const maxTop = start.y + start.height - 20;
          const newY = Math.max(0, Math.min(maxTop, Math.round(start.y + dy)));
          height = start.y + start.height - newY;
          y = newY;
        }
        setRect({ x, y, width, height });
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragMode, deviceWidth, deviceHeight, getLocalCoords]);

  const handleStartCreate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const coords = getLocalCoords(e);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startRect: { x: coords.x, y: coords.y, width: 0, height: 0 },
    };
    setRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    setDragMode("create");
  };

  const handleStartMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rect) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startRect: { ...rect },
    };
    setDragMode("move");
  };

  const handleStartResize = (e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rect) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startRect: { ...rect },
    };
    setDragMode(mode);
  };

  // Dimensions in source pixels
  const outputW = rect ? Math.round(rect.width * scaleFactor) : 0;
  const outputH = rect ? Math.round(rect.height * scaleFactor) : 0;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleStartCreate}
      className="absolute inset-0 z-30 select-none cursor-crosshair overflow-hidden"
      style={{
        width: `${deviceWidth}px`,
        height: `${deviceHeight}px`,
      }}
    >
      {/* Dimmed backdrop outside selection using 4 masking divs */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <>
          {/* Top dark curtain */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/60 backdrop-blur-[1px]"
            style={{ height: `${rect.y}px` }}
          />
          {/* Bottom dark curtain */}
          <div
            className="absolute left-0 right-0 bg-black/60 backdrop-blur-[1px]"
            style={{
              top: `${rect.y + rect.height}px`,
              bottom: 0,
            }}
          />
          {/* Left dark curtain */}
          <div
            className="absolute left-0 bg-black/60 backdrop-blur-[1px]"
            style={{
              top: `${rect.y}px`,
              height: `${rect.height}px`,
              width: `${rect.x}px`,
            }}
          />
          {/* Right dark curtain */}
          <div
            className="absolute right-0 bg-black/60 backdrop-blur-[1px]"
            style={{
              top: `${rect.y}px`,
              height: `${rect.height}px`,
              left: `${rect.x + rect.width}px`,
            }}
          />

          {/* Active selection marquee window */}
          <div
            onMouseDown={handleStartMove}
            className="absolute cursor-move border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          >
            {/* Dimensions Badge */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 rounded bg-zinc-950/90 px-2 py-0.5 text-[11px] font-mono font-medium text-zinc-100 border border-zinc-700/80 shadow-lg pointer-events-none">
              <Crop className="h-3 w-3 text-white" />
              <span>
                {outputW} × {outputH} px
              </span>
            </div>

            {/* Corner Resize Handles */}
            <div
              onMouseDown={(e) => handleStartResize(e, "nw")}
              className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-zinc-950 bg-white shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "ne")}
              className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-full border-2 border-zinc-950 bg-white shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "se")}
              className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-zinc-950 bg-white shadow-md hover:scale-125 transition-transform"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "sw")}
              className="absolute -left-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-full border-2 border-zinc-950 bg-white shadow-md hover:scale-125 transition-transform"
            />

            {/* Edge Resize Handles */}
            <div
              onMouseDown={(e) => handleStartResize(e, "n")}
              className="absolute left-1/2 -top-1.5 h-2.5 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-zinc-950 bg-white shadow-sm"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "s")}
              className="absolute left-1/2 -bottom-1.5 h-2.5 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-zinc-950 bg-white shadow-sm"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "w")}
              className="absolute top-1/2 -left-1.5 h-6 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-zinc-950 bg-white shadow-sm"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, "e")}
              className="absolute top-1/2 -right-1.5 h-6 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-zinc-950 bg-white shadow-sm"
            />

            {/* Floating Action Toolbar */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/95 p-1 shadow-lg backdrop-blur-md transition-all ${
                rect.y + rect.height + 50 > deviceHeight
                  ? "bottom-3"
                  : "top-full mt-3"
              }`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                data-action="selection-cancel-btn"
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
                <span>Cancel</span>
              </button>
              <button
                data-action="selection-confirm-crop-btn"
                type="button"
                onClick={() => {
                  if (rect.width >= 10 && rect.height >= 10) {
                    onConfirmCrop(rect);
                  }
                }}
                className="flex items-center gap-1 rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-white transition-colors"
              >
                <Check className="h-3 w-3" />
                <span>
                  {outputMode === "mockup" ? "Capture to Mockup" : "Download PNG"}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Guide hint at top of overlay */}
      {(!rect || rect.width <= 0) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded border border-zinc-800 bg-zinc-950/90 px-3 py-1 text-xs text-zinc-300 shadow-md pointer-events-none">
          Click and drag to select an area (or press Escape to cancel)
        </div>
      )}
    </div>
  );
}
