"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

interface ToastContextValue {
  showToast: (text: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback((text: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, text }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          let icon = <Info className="w-4 h-4 text-info shrink-0" />;
          let borderClass = "border-border";
          if (toast.type === "success") {
            icon = <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />;
            borderClass = "border-accent/40";
          } else if (toast.type === "error") {
            icon = <AlertCircle className="w-4 h-4 text-danger shrink-0" />;
            borderClass = "border-danger/40";
          }

          return (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-bg-surface border ${borderClass} shadow-lg pointer-events-auto text-xs text-text-primary animate-slideUp`}
            >
              {icon}
              <span className="flex-1 leading-snug">{toast.text}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-text-secondary hover:text-text-primary p-0.5"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
