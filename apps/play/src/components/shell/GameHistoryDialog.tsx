"use client";

import { useId } from "react";

import { strings } from "@/components/lobby/strings";
import { Icon } from "@/components/ui/Icon";
import { NativeDialog } from "@/components/ui/NativeDialog";

export interface GameHistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Game history placeholder: original chrome + empty state (history is phase 2). */
export function GameHistoryDialog({ open, onClose }: GameHistoryDialogProps) {
  const titleId = useId();
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg scroll-pt-44 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0c1525] p-4 text-[#e8f3ff] shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)] sm:p-6 backdrop:bg-black/60 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#9fdff2]">
            Results, matchups, and the decks you played.
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold">
            {strings["gameHistory.title"]}
          </h2>
        </div>
        <button
          type="button"
          aria-label={strings["gameHistory.close"]}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-[#94a3b8] hover:bg-white/5 hover:text-white"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid place-items-center gap-3 border border-[rgba(132,150,184,0.2)] bg-[rgba(10,18,31,0.6)] px-6 py-10 text-center">
        <Icon name="history" className="h-8 w-8 text-[#9fdff2]/70" />
        <p className="max-w-sm text-sm leading-relaxed text-[#b9c7da]">
          {strings["gameHistory.empty"]}
        </p>
      </div>
    </NativeDialog>
  );
}
