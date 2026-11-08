"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface NativeDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /** Extra data-* attributes preserved from the original markup. */
  attributes?: Record<string, string>;
}

/**
 * Thin wrapper around the native <dialog> element so the account/membership
 * dialogs keep the original element semantics and ::backdrop styling.
 */
export function NativeDialog({
  open,
  onClose,
  children,
  className,
  ariaLabelledBy,
  ariaDescribedBy,
  attributes,
}: NativeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      {...attributes}
      className={className}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
