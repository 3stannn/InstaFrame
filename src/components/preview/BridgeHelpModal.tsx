"use client";

import React, { useState } from "react";
import { X, Copy, Check, ExternalLink, ShieldCheck, Wifi, Code2 } from "lucide-react";

interface BridgeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewerOrigin: string;
}

export function BridgeHelpModal({ isOpen, onClose, viewerOrigin }: BridgeHelpModalProps) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCsp, setCopiedCsp] = useState(false);

  if (!isOpen) return null;

  const scriptTag = `<script src="${viewerOrigin}/preview-bridge.js" data-allowed-origins="${viewerOrigin}"></script>`;
  const cspHeader = `Content-Security-Policy: frame-ancestors 'self' ${viewerOrigin};`;

  const handleCopy = (text: string, setCopied: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 p-5 shadow-xl text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-zinc-800 bg-zinc-900 text-zinc-200">
              <Wifi className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Cooperative Preview Bridge (Mode B)
              </h3>
              <p className="text-xs text-zinc-400">
                Enable synchronized scrolling and navigation for websites you control
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
          {/* Section 1: Server Framing Permission */}
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold text-zinc-200 mb-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-100" />
              1. Authorize InstaFrame in your server headers
            </h4>
            <p className="text-zinc-400 mb-1.5 text-[11.5px]">
              By default, browsers block embedding pages with{" "}
              <code className="text-zinc-300">X-Frame-Options: DENY</code> or restrictive CSP.
              Configure your server to allow this specific viewer origin:
            </p>
            <div className="relative rounded-md border border-zinc-800 bg-zinc-900 p-2.5 font-mono text-[11px] text-zinc-300">
              <button
                type="button"
                onClick={() => handleCopy(cspHeader, setCopiedCsp)}
                className="absolute right-2 top-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1"
              >
                {copiedCsp ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCsp ? "Copied" : "Copy"}</span>
              </button>
              <pre className="overflow-x-auto pr-16">{cspHeader}</pre>
            </div>
            <p className="text-[10.5px] text-zinc-500 mt-1">
              Note: Avoid setting <code className="text-zinc-400">X-Frame-Options</code> on these pages, as it does not support multiple origins.
            </p>
          </div>

          {/* Section 2: Install Target Bridge Script */}
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold text-zinc-200 mb-1 text-xs">
              <Code2 className="h-3.5 w-3.5 text-zinc-100" />
              2. Add the bridge script to your website
            </h4>
            <p className="text-zinc-400 mb-1.5 text-[11.5px]">
              Add this lightweight script to your target site. It automatically negotiates capabilities and synchronizes scrolling:
            </p>
            <div className="relative rounded-md border border-zinc-800 bg-zinc-900 p-2.5 font-mono text-[11px] text-zinc-300">
              <button
                type="button"
                onClick={() => handleCopy(scriptTag, setCopiedScript)}
                className="absolute right-2 top-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1"
              >
                {copiedScript ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                <span>{copiedScript ? "Copied" : "Copy"}</span>
              </button>
              <pre className="overflow-x-auto pr-16">{scriptTag}</pre>
            </div>
          </div>

          {/* Section 3: Security Boundaries */}
          <div className="border-t border-zinc-800 pt-3">
            <h5 className="font-semibold text-zinc-300 mb-1 text-xs">Security & Privacy Boundaries:</h5>
            <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-[11px]">
              <li>The bridge requires explicit origin validation and will reject untrusted parent windows.</li>
              <li>Passwords, credit cards, file inputs, and form submissions are strictly excluded from replay.</li>
              <li>When navigating away to an external website without the bridge, synchronization gracefully disconnects.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-zinc-800 pt-3 mt-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
