"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ResponsiveStudio } from "@/components/ResponsiveStudio";
import { MockupStudio } from "@/components/MockupStudio";
import { LicenseModal } from "@/components/LicenseModal";
import { ToastContainer, ToastMessage } from "@/components/Toast";
import { checkProStatus } from "@/lib/licensing";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<"responsive" | "mockup">("responsive");
  const [isPro, setIsPro] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
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

  // Check Pro licensing status on mount
  useEffect(() => {
    checkProStatus().then((active) => {
      setIsPro(active);
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans">
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === "mockup") {
            setMockupConfig(undefined);
          }
          setCurrentTab(tab);
        }}
        isPro={isPro}
        onOpenLicense={() => setLicenseModalOpen(true)}
      />

      {/* Main Studio View */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className={`flex-1 flex-col ${currentTab === "responsive" ? "flex" : "hidden"}`}>
          <ResponsiveStudio
            onShowToast={showToast}
            onSendToMockup={handleSendToMockup}
          />
        </div>
        <div className={`flex-1 flex-col ${currentTab === "mockup" ? "flex" : "hidden"}`}>
          <MockupStudio
            isActive={currentTab === "mockup"}
            isPro={isPro}
            onOpenLicense={() => setLicenseModalOpen(true)}
            onShowToast={showToast}
            initialConfig={mockupConfig}
          />
        </div>
      </main>

      {/* Pro License Dialog */}
      <LicenseModal
        isOpen={licenseModalOpen}
        onClose={() => setLicenseModalOpen(false)}
        isPro={isPro}
        onStatusChange={setIsPro}
        onShowToast={showToast}
      />

      {/* Status Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
