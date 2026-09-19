"use client";

import React, { useState, useEffect } from "react";
import { initTargetBridge } from "@/lib/preview-bridge";

export default function TestTargetPage() {
  const [bridgeActive, setBridgeActive] = useState(false);
  const [bridgeLog, setBridgeLog] = useState<string[]>([]);
  const [textVal, setTextVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (bridgeActive) {
      cleanup = initTargetBridge({
        enableScroll: true,
        enableNavigation: true,
        enableClick: false,
        enableInput: false,
      });
      setBridgeLog((prev) => [...prev, `Bridge activated at ${new Date().toLocaleTimeString()}`]);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [bridgeActive]);

  return (
    <div className="min-h-[2500px] bg-white text-zinc-900 font-sans p-6">
      {/* Responsive Breakpoint Indicator Header */}
      <div className="sticky top-0 z-30 mb-6 rounded-xl border p-4 shadow-md backdrop-blur-md bg-white/90">
        <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
          Active Layout Breakpoint
        </div>

        {/* Media Query Responsive Labels */}
        <div className="block sm:hidden p-3 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 text-center font-bold text-sm">
          📱 Mobile Viewport Breakpoint (&lt; 640px)
        </div>
        <div className="hidden sm:block lg:hidden p-3 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-center font-bold text-sm">
          📟 Tablet Viewport Breakpoint (640px – 1024px)
        </div>
        <div className="hidden lg:block p-3 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 text-center font-bold text-sm">
          🖥️ Desktop Viewport Breakpoint (&gt; 1024px)
        </div>
      </div>

      {/* Grid Layout Testing */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-2">CSS Grid Breakpoint Test</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-zinc-100 border border-zinc-200 text-center">
            Column 1
          </div>
          <div className="p-4 rounded-lg bg-zinc-100 border border-zinc-200 text-center">
            Column 2
          </div>
          <div className="p-4 rounded-lg bg-zinc-100 border border-zinc-200 text-center">
            Column 3
          </div>
          <div className="p-4 rounded-lg bg-zinc-100 border border-zinc-200 text-center">
            Column 4
          </div>
        </div>
      </div>

      {/* Mode B: Cooperative Bridge Toggle */}
      <div className="mb-8 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
        <h3 className="font-bold text-indigo-950 text-sm mb-1">
          Mode B: Cooperative Bridge Simulation
        </h3>
        <p className="text-xs text-indigo-700 mb-3 leading-relaxed">
          Toggle the bridge to test synchronized scrolling and capability negotiation with the InstaFrame viewer.
        </p>
        <button
          type="button"
          onClick={() => setBridgeActive((prev) => !prev)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            bridgeActive
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-indigo-600 text-white hover:bg-indigo-500"
          }`}
        >
          {bridgeActive ? "✓ Bridge Active (Click to Disable)" : "Activate Preview Bridge"}
        </button>
        {bridgeLog.length > 0 && (
          <div className="mt-2 text-[11px] font-mono text-indigo-900">
            {bridgeLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* Form Test Section (Testing Sensitive Field Exclusion) */}
      <div className="mb-8 p-4 rounded-xl border border-zinc-200 bg-zinc-50 max-w-md">
        <h3 className="font-bold text-zinc-900 text-sm mb-2">Interaction & Form Sync Test</h3>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-600 mb-1">Standard Text Field (Syncable):</label>
            <input
              type="text"
              data-preview-id="test-username"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              placeholder="Type public text..."
              className="w-full rounded border border-zinc-300 p-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-zinc-600 mb-1">Password Field (Strictly Excluded):</label>
            <input
              type="password"
              data-preview-id="test-password"
              value={passwordVal}
              onChange={(e) => setPasswordVal(e.target.value)}
              placeholder="Secret password..."
              className="w-full rounded border border-zinc-300 p-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-zinc-600 mb-1">File Upload (Strictly Excluded):</label>
            <input type="file" className="w-full text-xs" />
          </div>
        </div>
      </div>

      {/* Scrollable Progress Markers */}
      <div className="space-y-48 text-xs font-mono text-zinc-400">
        <div className="p-4 bg-zinc-100 rounded border border-zinc-200 text-center font-bold text-zinc-700">
          📍 Scroll Position: 25%
        </div>
        <div className="p-4 bg-zinc-100 rounded border border-zinc-200 text-center font-bold text-zinc-700">
          📍 Scroll Position: 50%
        </div>
        <div className="p-4 bg-zinc-100 rounded border border-zinc-200 text-center font-bold text-zinc-700">
          📍 Scroll Position: 75%
        </div>
        <div className="p-4 bg-zinc-100 rounded border border-zinc-200 text-center font-bold text-zinc-700">
          🏁 Scroll Position: 100% (End of Document)
        </div>
      </div>
    </div>
  );
}
