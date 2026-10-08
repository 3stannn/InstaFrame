"use client";

import React, { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { ResponsiveStudio } from "@/components/ResponsiveStudio";
import { MockupStudio } from "@/components/MockupStudio";
import { ToastContainer, ToastMessage } from "@/components/Toast";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<"responsive" | "mockup">("responsive");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mockupConfig, setMockupConfig] = useState<{
    url?: string;
    presetKey?: string;
    frameId?: string;
    autoCapture?: boolean;
    imageDataUrl?: string;
  } | undefined>(undefined);

  const handleSendToMockup = (
    url: string,
    presetKey: string,
    frameId: string,
    imageDataUrl?: string
  ) => {
    setMockupConfig({
      url,
      presetKey,
      frameId,
      autoCapture: !imageDataUrl,
      imageDataUrl,
    });
    setCurrentTab("mockup");
  };


  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      options?: { id?: string; duration?: number }
    ): string => {
      const id = options?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const duration = options?.duration;

      setToasts((prev) => {
        // Dismiss in-flight info/progress toasts when error or success is shown
        let filtered = prev;
        if (type === "error" || type === "success") {
          filtered = prev.filter((t) => t.type !== "info" && t.id !== id);
        } else {
          filtered = prev.filter((t) => t.id !== id);
        }
        return [...filtered, { id, message, type, duration }];
      });

      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-zinc-950 font-sans">
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === "mockup") {
            setMockupConfig(undefined);
          }
          setCurrentTab(tab);
        }}
      />

      {/* Main Studio View */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={`min-h-0 flex-1 flex-col ${currentTab === "responsive" ? "flex" : "hidden"}`}>
          <ResponsiveStudio
            onShowToast={showToast}
            onSendToMockup={handleSendToMockup}
          />
        </div>
        <div className={`min-h-0 flex-1 flex-col ${currentTab === "mockup" ? "flex" : "hidden"}`}>
          <MockupStudio
            isActive={currentTab === "mockup"}
            onShowToast={showToast}
            initialConfig={mockupConfig}
          />
        </div>
      </main>

      {/* Status Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
