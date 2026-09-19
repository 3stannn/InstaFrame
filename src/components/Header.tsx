"use client";

import React from "react";
import Image from "next/image";
import { Monitor, Smartphone, Sparkles, ExternalLink } from "lucide-react";

interface HeaderProps {
  currentTab: "responsive" | "mockup";
  onTabChange: (tab: "responsive" | "mockup") => void;
  isPro: boolean;
  onOpenLicense: () => void;
}

export function Header({ currentTab, onTabChange, isPro, onOpenLicense }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/assets/icons/icon48.png"
            alt="InstaFrame"
            width={24}
            height={24}
            className="rounded-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">InstaFrame</span>
              <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                Web
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Uncarded, flat navigation) */}
        <nav className="ml-6 flex items-center gap-5">
          <button
            type="button"
            onClick={() => onTabChange("responsive")}
            className={`flex items-center gap-1.5 py-1.5 text-xs font-medium transition-all duration-150 border-b-2 ${
              currentTab === "responsive"
                ? "border-indigo-500 text-zinc-100 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Responsive Studio</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("mockup")}
            className={`flex items-center gap-1.5 py-1.5 text-xs font-medium transition-all duration-150 border-b-2 ${
              currentTab === "mockup"
                ? "border-indigo-500 text-zinc-100 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Device Mockups</span>
          </button>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Pro Status Badge Pill */}
        <button
          type="button"
          onClick={onOpenLicense}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
            isPro
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300 hover:border-emerald-500/50"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          }`}
          title={isPro ? "Pro License Active" : "Upgrade to Pro License"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isPro ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-zinc-500"
            }`}
          />
          <span>{isPro ? "Pro Active" : "Free Tier"}</span>
        </button>

        <a
          href="https://buy.polar.sh/polar_cl_GO2Tqbj7O7zh6FIir82m37Du7ppIdpW101SWF3L8MwZ"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200 sm:inline-flex"
        >
          <span>Get License</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  );
}
