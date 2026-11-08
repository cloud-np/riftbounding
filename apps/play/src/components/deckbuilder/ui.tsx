"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { domainIcon } from "./catalog";
import { BuilderIcon } from "./BuilderIcon";

export const iconButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/78 font-semibold text-foreground/82 transition-colors hover:border-foreground/18 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-55";

export const labeledButton =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/78 px-2.5 text-[13px] font-semibold text-foreground/82 transition-colors hover:border-foreground/18 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-55";

export const subtleButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/95 px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55";

export function DomainIcon({
  domain,
  className = "size-3.5",
}: {
  domain: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      title={domain}
      src={domainIcon(domain)}
      className={`inline-block object-contain ${className}`}
    />
  );
}

export function DomainChip({ domains }: { domains: readonly string[] }) {
  const visible = domains.filter((domain) => domain && domain !== "Unknown");
  if (visible.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {visible.map((domain) => (
        <DomainIcon key={domain} domain={domain} className="size-3.5" />
      ))}
    </span>
  );
}

export function useOnClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const listener = (event: MouseEvent | TouchEvent) => {
      const element = ref.current;
      if (!element || element.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [active, handler, ref]);
}

export interface AnchorPopoverProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  labelledBy?: string;
  id?: string;
  role?: "dialog" | "menu";
}

/** Positioned popover anchored to its relatively-positioned trigger container. */
export function AnchorPopover({
  open,
  onClose,
  children,
  className = "",
  ariaLabel,
  labelledBy,
  id,
  role = "dialog",
}: AnchorPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onClose, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      id={id}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      data-catalog-overlay="filters"
      className={`absolute right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-lg border border-border/70 bg-[#fcfcfc] text-popover-foreground shadow-[0_18px_44px_rgba(9,10,19,0.18)] ${className}`}
    >
      {children}
    </div>
  );
}

export interface BuilderModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  labelledBy?: string;
  dark?: boolean;
  /** Clicking the backdrop closes; some dialogs disable it. */
  dismissable?: boolean;
}

export function BuilderModal({
  open,
  onClose,
  children,
  className = "",
  ariaLabel,
  labelledBy,
  dark = false,
  dismissable = true,
}: BuilderModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div
      className="db-modal-backdrop"
      onMouseDown={(event) => {
        if (dismissable && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        className={`relative z-1 flex w-full flex-col overflow-hidden rounded-xl ${
          dark
            ? "db-dark-dialog"
            : "border border-border/70 bg-background text-foreground shadow-[0_30px_80px_rgba(0,0,0,0.32)]"
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CountBadge({
  children,
  complete,
  amber,
  srLabel,
  compact = false,
}: {
  children: ReactNode;
  complete: boolean;
  amber?: boolean;
  srLabel: string;
  compact?: boolean;
}) {
  const tone =
    amber && !complete
      ? "border-amber-500/40 bg-amber-50 text-amber-800"
      : "border-border/70 bg-background/55 text-foreground";
  return (
    <>
      <span
        aria-hidden="true"
        className={`inline-flex min-w-[3.8rem] items-center justify-center rounded-md border px-2 font-semibold tabular-nums ${tone} ${
          compact ? "h-6 text-[13px]" : "h-7 text-[15px]"
        }`}
      >
        {children}
      </span>
      <span className="sr-only">{srLabel}</span>
    </>
  );
}

export function ToastStack({
  toasts,
}: {
  toasts: { id: number; message: string; tone: "info" | "success" | "error" }[];
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[300] flex max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${
            toast.tone === "error"
              ? "border-red-500/40 bg-[#3a1016] text-red-50"
              : toast.tone === "success"
                ? "border-emerald-500/40 bg-[#0c2a20] text-emerald-50"
                : "border-slate-600/50 bg-[#101827] text-slate-100"
          }`}
        >
          {toast.tone === "error" ? (
            <BuilderIcon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          ) : toast.tone === "success" ? (
            <BuilderIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
          ) : null}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/80 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`inline-flex h-7 items-center justify-center rounded px-2.5 text-[12px] font-semibold transition-colors ${
            option.value === value
              ? "bg-foreground text-background shadow-sm"
              : "text-foreground/75 hover:bg-secondary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
