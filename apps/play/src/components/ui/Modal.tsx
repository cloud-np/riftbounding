"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra class names for the fixed overlay (backdrop + positioning). */
  overlayClassName?: string;
  /** Extra class names for the content wrapper. */
  contentClassName?: string;
  /** Accessible label; if omitted the child must provide its own role/label. */
  ariaLabel?: string;
  /** Close when clicking the dark backdrop (default true). */
  dismissOnBackdrop?: boolean;
}

/**
 * Portalled overlay used by the deck editor and other lobby dialogs. Mirrors the
 * original markup: a fixed dark/blur backdrop plus a centred content surface.
 */
export function Modal({
  open,
  onClose,
  children,
  overlayClassName,
  contentClassName,
  ariaLabel,
  dismissOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={
        overlayClassName ??
        "fixed inset-0 z-176 flex items-center justify-center bg-[rgba(3,8,17,0.76)] px-3 py-6 backdrop-blur-sm"
      }
      role="presentation"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <div className={`relative z-1 ${contentClassName ?? ""}`}>{children}</div>
    </div>,
    document.body,
  );
}
