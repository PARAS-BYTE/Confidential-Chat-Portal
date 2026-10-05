"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Card } from "./Card";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md",
}: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-bg-surface border-border p-6 shadow-xl rounded-xl">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div>
              <h2 id="modal-title" className="text-base font-medium text-text-primary">
                {title}
              </h2>
              {description && (
                <p className="text-xs text-text-secondary mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-bg-hover transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mt-4">{children}</div>
        </Card>
      </div>
    </div>
  );
}
