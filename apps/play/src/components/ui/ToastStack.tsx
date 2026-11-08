"use client";

import { Icon } from "@/components/ui/Icon";

export interface ToastEntry {
  id: number;
  message: string;
  tone?: "info" | "success" | "error";
}

export function ToastStack({ toasts }: { toasts: ToastEntry[] }) {
  return (
    <div className="contents hub-theme">
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-180 flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 border px-3 py-2.5 text-[0.82rem] shadow-[0_18px_44px_rgba(0,0,0,0.4)] backdrop-blur ${
              toast.tone === "error"
                ? "border-[rgba(242,138,138,0.54)] bg-[rgba(45,16,20,0.94)] text-[#ffd5d5]"
                : toast.tone === "success"
                  ? "border-[rgba(120,221,183,0.4)] bg-[rgba(12,35,29,0.94)] text-[#d4ffea]"
                  : "border-[rgba(116,239,255,0.28)] bg-[rgba(9,18,30,0.94)] text-[#d7eaff]"
            }`}
          >
            <Icon
              name={toast.tone === "error" ? "close" : "check"}
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <span className="min-w-0">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
