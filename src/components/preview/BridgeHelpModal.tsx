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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a0a0c]/[0.98] backdrop-blur-xl p-6 shadow-2xl text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white">
              <Wifi className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-[-0.015em] text-white">
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
            className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
          {/* Section 1: Server Framing Permission */}
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold text-white mb-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-white" />
              1. Authorize InstaFrame in your server headers
            </h4>
            <p className="text-zinc-400 mb-1.5 text-[11.5px]">
              By default, browsers block embedding pages with{" "}
              <code className="text-zinc-300">X-Frame-Options: DENY</code> or restrictive CSP.
              Configure your server to allow this specific viewer origin:
            </p>
            <div className="relative rounded-lg border border-white/10 bg-black p-3 font-mono text-[11px] text-zinc-300">
              <button
                type="button"
                onClick={() => handleCopy(cspHeader, setCopiedCsp)}
                className="absolute right-2 top-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10 hover:text-white active:scale-[0.98] transition flex items-center gap-1"
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
            <h4 className="flex items-center gap-1.5 font-semibold text-white mb-1 text-xs">
              <Code2 className="h-3.5 w-3.5 text-white" />
              2. Add the bridge script to your website
            </h4>
            <p className="text-zinc-400 mb-1.5 text-[11.5px]">
              Add this lightweight script to your target site. It automatically negotiates capabilities and synchronizes scrolling:
            </p>
            <div className="relative rounded-lg border border-white/10 bg-black p-3 font-mono text-[11px] text-zinc-300">
              <button
                type="button"
                onClick={() => handleCopy(scriptTag, setCopiedScript)}
                className="absolute right-2 top-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10 hover:text-white active:scale-[0.98] transition flex items-center gap-1"
              >
                {copiedScript ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                <span>{copiedScript ? "Copied" : "Copy"}</span>
              </button>
              <pre className="overflow-x-auto pr-16">{scriptTag}</pre>
            </div>
          </div>

          {/* Section 3: Security Boundaries */}
          <div className="border-t border-white/10 pt-3">
            <h5 className="font-semibold text-zinc-200 mb-1 text-xs">Security &amp; Privacy Boundaries:</h5>
            <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-[11px]">
              <li>The bridge requires explicit origin validation and will reject untrusted parent windows.</li>
              <li>Passwords, credit cards, file inputs, and form submissions are strictly excluded from replay.</li>
              <li>When navigating away to an external website without the bridge, synchronization gracefully disconnects.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-white/10 pt-3 mt-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-[0.98] transition shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
