"use client";

import React from "react";
import Image from "next/image";
import { Monitor, Smartphone } from "lucide-react";

interface HeaderProps {
  currentTab: "responsive" | "mockup";
  onTabChange: (tab: "responsive" | "mockup") => void;
}

const TABS = [
  { id: "responsive", label: "Responsive studio", Icon: Monitor },
  { id: "mockup", label: "Device mockups", Icon: Smartphone },
] as const;

export function Header({ currentTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-black/95 backdrop-blur-md">
      <div className="flex h-12 items-center justify-between gap-3 px-3.5 sm:px-5">
        {/* Brand: logo and name only */}
        <div className="flex items-center gap-2.5">
          <Image src="/assets/icons/icon48.png" alt="" width={20} height={20} className="shrink-0 opacity-95" />
          <span className="text-sm font-semibold tracking-[-0.015em] text-white">InstaFrame</span>
        </div>

        <nav aria-label="Studio">
          <div className="inline-flex h-8 items-center gap-0.5 rounded-full border border-white/10 bg-[#0a0a0c] p-[2px] text-xs">
            {TABS.map(({ id, label, Icon }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onTabChange(id)}
                  className={`flex h-[26px] items-center gap-1.5 rounded-full px-3 text-xs transition-colors duration-150 ease-out ${
                    active ? "bg-white/[0.12] font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Keeps the tabs centered */}
        <div className="hidden w-[92px] sm:block" aria-hidden="true" />
      </div>
    </header>
  );
}
