"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Copy, Check, ShieldCheck, Code2 } from "lucide-react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,19,0.82)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bridge-help-title"
        className="surface-modal menu relative flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col !p-0 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: logo, title, one-line subtitle, close in the corner */}
        <div className="relative flex shrink-0 flex-col items-center px-6 pb-4 pt-5 text-center">
          <Image src="/assets/icons/logo-mark.svg" alt="" width={32} height={32} unoptimized />
          <h3 id="bridge-help-title" className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Cooperative Preview Bridge (Mode B)
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Enable synchronized scrolling and navigation for websites you control
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-btn absolute right-3 top-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5 text-[13px] leading-relaxed">
          {/* Section 1: Server Framing Permission */}
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <ShieldCheck className="h-3.5 w-3.5 text-ink-secondary" />
              1. Authorize InstaFrame in your server headers
            </h4>
            <p className="mb-2 text-xs text-ink-secondary">
              By default, browsers block embedding pages with{" "}
              <code className="text-ink">X-Frame-Options: DENY</code> or restrictive CSP.
              Configure your server to allow this specific viewer origin:
            </p>
            <div className="relative rounded-control border border-line bg-canvas p-3 font-mono text-[11px] text-ink">
              <button
                type="button"
                onClick={() => handleCopy(cspHeader, setCopiedCsp)}
                className="btn btn-neutral absolute right-2 top-2 !h-[26px] !gap-1 !rounded-inner !px-2.5 !text-[11px]"
              >
                {copiedCsp ? <Check className="h-3 w-3 text-ink" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCsp ? "Copied" : "Copy"}</span>
              </button>
              <pre className="overflow-x-auto pr-20">{cspHeader}</pre>
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-subtle">
              Note: Avoid setting <code className="text-ink-secondary">X-Frame-Options</code> on these pages, as it does not support multiple origins.
            </p>
          </div>

          {/* Section 2: Install Target Bridge Script */}
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Code2 className="h-3.5 w-3.5 text-ink-secondary" />
              2. Add the bridge script to your website
            </h4>
            <p className="mb-2 text-xs text-ink-secondary">
              Add this lightweight script to your target site. It automatically negotiates capabilities and synchronizes scrolling:
            </p>
            <div className="relative rounded-control border border-line bg-canvas p-3 font-mono text-[11px] text-ink">
              <button
                type="button"
                onClick={() => handleCopy(scriptTag, setCopiedScript)}
                className="btn btn-neutral absolute right-2 top-2 !h-[26px] !gap-1 !rounded-inner !px-2.5 !text-[11px]"
              >
                {copiedScript ? <Check className="h-3 w-3 text-ink" /> : <Copy className="h-3 w-3" />}
                <span>{copiedScript ? "Copied" : "Copy"}</span>
              </button>
              <pre className="overflow-x-auto pr-20">{scriptTag}</pre>
            </div>
          </div>

          {/* Section 3: Security Boundaries */}
          <div className="card px-4 py-3">
            <h5 className="mb-1 text-[13px] font-medium text-ink">Security &amp; Privacy Boundaries:</h5>
            <ul className="list-disc space-y-1 pl-4 text-xs text-ink-secondary">
              <li>The bridge requires explicit origin validation and will reject untrusted parent windows.</li>
              <li>Passwords, credit cards, file inputs, and form submissions are strictly excluded from replay.</li>
              <li>When navigating away to an external website without the bridge, synchronization gracefully disconnects.</li>
            </ul>
          </div>
        </div>

        {/* Pinned footer */}
        <div className="modal-footer shrink-0 justify-end rounded-b-card">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
