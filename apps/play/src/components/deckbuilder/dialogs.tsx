"use client";

import type { Card, ParsedDeckEntry } from "@rift/cards";

import { CardArt } from "./CardArt";
import { BuilderIcon } from "./BuilderIcon";
import { printVariants } from "./catalog";
import { T } from "./strings";
import { BuilderModal } from "./ui";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ExportMenu({
  onCopyDecklist,
  onCopyDeckCode,
  onClose,
}: {
  onCopyDecklist: () => void;
  onCopyDeckCode: () => void;
  onClose: () => void;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {T.chooseExportFormat}
      </p>
      <button
        type="button"
        onClick={() => {
          onCopyDecklist();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground/82 hover:bg-secondary"
      >
        <BuilderIcon name="copy" className="h-3.5 w-3.5" />
        {T.copyDecklist}
      </button>
      <button
        type="button"
        onClick={() => {
          onCopyDeckCode();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground/82 hover:bg-secondary"
      >
        <BuilderIcon name="copy" className="h-3.5 w-3.5" />
        {T.copyDeckCode}
      </button>
    </div>
  );
}

export function DiscardDialog({
  open,
  onClose,
  onDiscard,
  hasSavedDeck,
}: {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  hasSavedDeck: boolean;
}) {
  return (
    <BuilderModal
      open={open}
      onClose={onClose}
      ariaLabel={T.discardDraftTitle}
      dark
      className="max-w-lg rounded-lg"
    >
      <div className="px-6 py-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">
          Confirm action
        </p>
        <h2 className="mt-1 text-xl font-semibold">{T.discardDraftTitle}</h2>
        <p className="mt-2 text-sm text-slate-300">
          {T.discardDraftDescription}
          {hasSavedDeck ? " Your saved deck stays in your library." : ""}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 min-w-24 items-center justify-center rounded bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            {T.cancel}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex h-9 min-w-24 items-center justify-center rounded bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
          >
            {T.discard}
          </button>
        </div>
      </div>
    </BuilderModal>
  );
}

export function ArtPicker({
  open,
  entry,
  card,
  onClose,
  onSelect,
}: {
  open: boolean;
  entry: ParsedDeckEntry | null;
  card: Card | null;
  onClose: () => void;
  onSelect: (print: Card) => void;
}) {
  const prints = card ? printVariants(card) : [];
  return (
    <BuilderModal
      open={open}
      onClose={onClose}
      ariaLabel={entry ? `Choose art for ${entry.name}` : T.chooseArt}
      className="max-h-[min(90vh,44rem)] max-w-3xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {T.chooseArt}
          </p>
          <h2 className="mt-0.5 text-base font-semibold">{entry?.name ?? T.chooseArt}</h2>
        </div>
        <button
          type="button"
          aria-label={T.closeArtPicker}
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <BuilderIcon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="db-thin-scrollbar grid max-h-[calc(90vh-8rem)] grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
        {prints.map((print) => {
          const selected =
            entry?.cardCode === print.id || (!entry?.cardCode && entry?.name === print.name);
          return (
            <button
              key={print.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(print);
                onClose();
              }}
              className={`group overflow-hidden rounded-lg border text-left transition-colors ${
                selected
                  ? "border-foreground ring-2 ring-foreground/25"
                  : "border-border/70 hover:border-foreground/30"
              }`}
            >
              <div className="relative aspect-[488/680] overflow-hidden bg-secondary">
                <CardArt
                  card={print}
                  sizes="(max-width:640px) 45vw, 180px"
                  className="h-full w-full object-cover"
                />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                    <BuilderIcon name="check" className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                <span className="font-semibold">{print.id}</span>
                <span className="text-muted-foreground">{print.set}</span>
              </div>
            </button>
          );
        })}
      </div>
    </BuilderModal>
  );
}
