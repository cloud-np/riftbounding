"use client";

import { useId } from "react";

import { Icon } from "@/components/ui/Icon";
import { NativeDialog } from "@/components/ui/NativeDialog";

export interface MembershipDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Lightweight membership surface. The original loads a Metafy-hosted tier dialog;
 * phase 1 keeps the shell visual and links out to the real membership page.
 */
export function MembershipDialog({ open, onClose }: MembershipDialogProps) {
  const titleId = useId();
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy={titleId}
      attributes={{ "data-metafy-membership-dialog": "true", "data-membership-provider": "metafy" }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0c1525] p-4 text-[#e8f3ff] shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)] sm:p-6 backdrop:bg-black/60 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#ffe7b7]">
            Rift Atlas membership
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold">
            Choose a membership
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-[#94a3b8] hover:bg-white/5 hover:text-white"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/riftbound/static/membership/rift-atlas-membership.webp"
        alt=""
        className="mt-4 w-full rounded-lg border border-white/10"
      />
      <p className="mt-4 text-sm leading-relaxed text-[#b9c7da]">
        Support Rift Atlas and unlock animated emotes, sleeves, playmats, nameplates and account
        badges.
      </p>
      <div className="mt-4 grid gap-2">
        <a
          href="https://riftatlas.com/membership"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[rgba(255,231,183,0.42)] bg-[linear-gradient(180deg,rgba(255,231,183,0.18),rgba(255,231,183,0.08))] px-3 text-sm font-semibold text-[#fff3d6] transition hover:border-[rgba(255,231,183,0.7)]"
        >
          Become a member
        </a>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-white/10 px-3 text-sm text-[#b9c7da] hover:bg-white/5"
        >
          Maybe later
        </button>
      </div>
    </NativeDialog>
  );
}
