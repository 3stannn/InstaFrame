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
    <header className="sticky top-0 z-40 shrink-0 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 backdrop-blur-md">
      {/* Brand */}
      <div className="flex w-full flex-wrap items-center gap-3">
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
        <nav className="sm:ml-6 flex items-center gap-5">
          <button
            type="button"
            onClick={() => onTabChange("responsive")}
            className={`flex items-center gap-1.5 py-1.5 text-xs font-medium transition-all duration-150 border-b-2 ${
              currentTab === "responsive"
                ? "border-white text-white font-semibold"
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
                ? "border-white text-white font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Device Mockups</span>
          </button>
        </nav>
      </div>

    </header>
  );
}
