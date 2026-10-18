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
    <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-800 bg-zinc-950">
      <div className="editorial-label flex h-7 items-center justify-between bg-zinc-100 px-4 text-zinc-950">
        <span>● INSTAFRAME LIVE · WEB STUDIO</span>
        <span className="hidden sm:inline">RESPONSIVE CAPTURE · DEVICE MOCKUPS · PNG EXPORT</span>
      </div>
      <div className="flex min-h-14 items-center justify-between px-4">
      <div className="flex w-full flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 border-r border-zinc-800 pr-5">
          <Image
            src="/assets/icons/icon48.png"
            alt="InstaFrame"
            width={24}
            height={24}
            className="grayscale"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-[-0.025em] text-zinc-100">InstaFrame</span>
              <span className="editorial-label border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400">
                Web
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Uncarded, flat navigation) */}
        <nav className="sm:ml-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTabChange("responsive")}
            className={`flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors ${
              currentTab === "responsive"
                ? "border-zinc-100 bg-zinc-100 text-zinc-950 font-semibold"
                : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Responsive Studio</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("mockup")}
            className={`flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors ${
              currentTab === "mockup"
                ? "border-zinc-100 bg-zinc-100 text-zinc-950 font-semibold"
                : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Device Mockups</span>
          </button>
        </nav>
      </div>
      </div>
    </header>
  );
}
