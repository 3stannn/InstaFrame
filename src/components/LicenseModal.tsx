"use client";

import React, { useState } from "react";
import { X, CheckCircle2, ShieldCheck, Sparkles, ExternalLink } from "lucide-react";
import { activateLicense, deactivateLicense, getStoredLicense } from "@/lib/licensing";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  onStatusChange: (isPro: boolean) => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export function LicenseModal({
  isOpen,
  onClose,
  isPro,
  onStatusChange,
  onShowToast,
}: LicenseModalProps) {
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  if (!isOpen) return null;

  const licenseData = getStoredLicense();
  const maskedKey = licenseData.licenseKey
    ? `${licenseData.licenseKey.slice(0, 8)}...${licenseData.licenseKey.slice(-4)}`
    : "Active";

  const handleActivate = async () => {
    if (!keyInput.trim()) {
      onShowToast("Please enter a license key.", "error");
      return;
    }

    setLoading(true);
    try {
      await activateLicense(keyInput.trim());
      onShowToast("Pro features unlocked!", "success");
      onStatusChange(true);
      setKeyInput("");
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to activate license.";
      onShowToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await deactivateLicense();
      onStatusChange(false);
      onShowToast("License deactivated.", "info");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deactivate license.";
      onShowToast(message, "error");
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Studio Pro</h3>
            <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
              PRO
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Unlock realistic Apple hardware frames (Pro Display XDR, MacBook Air 13&quot;, iPad Pro, iPhone 15, Galaxy S24, Pixel 8) with studio backdrops and drop shadows.
        </p>

        <div className="mt-4">
          {isPro ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 border-y border-zinc-800 py-3">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-zinc-100" />
                <div>
                  <h4 className="text-xs font-semibold text-zinc-100">Pro License Active</h4>
                  <p className="text-[11px] font-mono text-zinc-400">{maskedKey}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
              >
                {deactivating ? "Deactivating..." : "Deactivate License"}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label htmlFor="polar-key-input" className="block text-[11px] font-medium text-zinc-400">
                  Polar.sh License Key
                </label>
                <input
                  id="polar-key-input"
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="POLAR_XXXXX-XXXXX..."
                  className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-500"
                />
              </div>

              <button
                type="button"
                onClick={handleActivate}
                disabled={loading}
                className="w-full rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
              >
                {loading ? "Validating..." : "Activate License"}
              </button>

              <div className="text-center">
                <a
                  href="https://buy.polar.sh/polar_cl_GO2Tqbj7O7zh6FIir82m37Du7ppIdpW101SWF3L8MwZ"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white underline"
                >
                  <span>Need a license? Get Pro</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
