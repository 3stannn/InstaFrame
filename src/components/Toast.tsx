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
    info: <Info className="h-4 w-4 text-ink-secondary shrink-0" />,
  };

  return (
    <div
      className="menu menu-up pointer-events-auto flex items-center gap-2.5 !rounded-card !py-2 !pl-3.5 !pr-2 text-[12.5px] text-ink"
    >
      {icons[toast.type]}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="icon-btn ml-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
