"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number; // auto-dismiss
};

export type ToastContextValue = {
  show: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider missing in tree");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: Toast = { id, variant: "info", durationMs: 4000, ...toast };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), item.durationMs);
    }
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto w-full max-w-md rounded border shadow bg-white px-4 py-3 text-sm " +
              (t.variant === "success" ? "border-green-300" :
               t.variant === "warning" ? "border-yellow-300" :
               t.variant === "error" ? "border-red-300" : "border-neutral-200")
            }
            role="status"
            aria-live="polite"
          >
            {t.title ? <div className="font-medium mb-0.5">{t.title}</div> : null}
            <div className="text-neutral-700">{t.message}</div>
            <div className="mt-2 flex justify-end">
              <button
                className="text-xs px-2 py-1 rounded border hover:bg-neutral-100"
                onClick={() => dismiss(t.id)}
              >Close</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
