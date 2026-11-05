"use client";

import React from "react";
import Image from "next/image";
import { Monitor, Smartphone } from "lucide-react";

interface HeaderProps {
  currentTab: "responsive" | "mockup";
  onTabChange: (tab: "responsive" | "mockup") => void;
}

export function Header({ currentTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-black/95 backdrop-blur-md">
      <div className="flex h-12 items-center justify-between px-3.5 sm:px-5">
        {/* Brand & Editorial Meta */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/assets/icons/icon48.png"
              alt="InstaFrame"
              width={20}
              height={20}
              className="opacity-95 shrink-0"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-[-0.015em] text-white">
                InstaFrame
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-zinc-400">
                2.6
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Floating Pill Segmented Controls) */}
        <nav className="flex items-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-[#0a0a0c] p-1 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => onTabChange("responsive")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs transition-all duration-150 ease-out active:scale-[0.98] ${
                currentTab === "responsive"
                  ? "bg-white font-semibold text-black shadow-sm"
                  : "font-medium text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Responsive Studio</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("mockup")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs transition-all duration-150 ease-out active:scale-[0.98] ${
                currentTab === "mockup"
                  ? "bg-white font-semibold text-black shadow-sm"
                  : "font-medium text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Device Mockups</span>
            </button>
          </div>
        </nav>

        {/* Right Status / Badge */}
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0c] px-3 py-1 text-[11px] font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
            <span>Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
