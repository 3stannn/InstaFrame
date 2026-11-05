"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 max-w-[calc(100vw-2rem)] z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const duration = toast.duration !== undefined ? toast.duration : 3500;
    if (duration <= 0) return; // persistent until dismissed or updated
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.message, toast.type, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />,
    info: <Info className="h-4 w-4 text-zinc-300 shrink-0" />,
  };

  return (
    <div
      className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0a0a0c]/98 px-3.5 py-2.5 text-xs text-white shadow-2xl shadow-black/80 backdrop-blur-xl transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
    >
      {icons[toast.type]}
      <span className="font-medium tracking-tight">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="ml-2 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
