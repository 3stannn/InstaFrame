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
    <header className="sticky top-0 z-40 shrink-0 border-b border-line-subtle bg-shell">
      <div className="flex h-12 items-center justify-between gap-3 px-3.5 sm:px-5">
        {/* Brand: the logo by itself, no tile behind it */}
        <div className="flex items-center gap-2">
          <Image src="/assets/icons/logo-mark.svg" alt="" width={22} height={22} className="shrink-0" unoptimized />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink max-[420px]:sr-only">InstaFrame</span>
        </div>

        <nav aria-label="Studio">
          <div className="seg">
            {TABS.map(({ id, label, Icon }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onTabChange(id)}
                  className="seg-item"
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
