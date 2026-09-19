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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
  }, [toast.id, toast.duration, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-white" />,
    error: <AlertCircle className="h-4 w-4 text-white" />,
    info: <Info className="h-4 w-4 text-zinc-300" />,
  };

  const borders = {
    success: "border-zinc-700 bg-zinc-900/95 text-zinc-100",
    error: "border-zinc-600 bg-zinc-900/95 text-zinc-100",
    info: "border-zinc-800 bg-zinc-900/95 text-zinc-100",
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs shadow-lg shadow-black/40 backdrop-blur-md transition-all duration-150 animate-in fade-in slide-in-from-bottom-2 ${borders[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-zinc-500 hover:text-zinc-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
