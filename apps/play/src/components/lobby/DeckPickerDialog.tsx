"use client";

import { strings } from "./strings";
import type { SavedDeck } from "./types";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { deckActionButton, smallNeutralButton } from "@/components/ui/buttonStyles";

export interface DeckPickerDialogProps {
  open: boolean;
  decks: SavedDeck[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onChoose: (deck: SavedDeck) => void;
  onEdit: (deck: SavedDeck) => void;
  onDelete: (deck: SavedDeck) => void;
  onRefresh: () => void;
  onImport: () => void;
}

export function DeckPickerDialog({
  open,
  decks,
  loading = false,
  error = null,
  onClose,
  onChoose,
  onEdit,
  onDelete,
  onRefresh,
  onImport,
}: DeckPickerDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      contentClassName="flex max-h-[min(88vh,44rem)] w-full max-w-3xl"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings["sim.savedDecks"]}
        className="relative z-1 flex max-h-[min(88vh,44rem)] w-full max-w-3xl flex-col overflow-hidden border border-[rgba(148,163,184,0.28)] bg-[linear-gradient(180deg,rgba(11,18,29,0.98),rgba(7,12,22,0.98))] shadow-[0_30px_70px_rgba(0,0,0,0.36)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(132,150,184,0.18)] px-5 py-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.14em] text-text-dim">
              {strings["sim.deckLibraryEyebrow"]}
            </p>
            <h2 className="heading-serif mt-1 mb-0 text-[1.4rem] leading-none">
              {strings["sim.savedDecks"]}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={deckActionButton} onClick={onRefresh}>
              {strings["sim.refresh"]}
            </button>
            <button type="button" className={deckActionButton} onClick={onImport}>
              <Icon name="upload" className="h-3.5 w-3.5" strokeWidth={2.1} />
              {strings["sim.importDeck"]}
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[rgba(132,150,184,0.26)] bg-[rgba(10,16,26,0.68)] text-text-soft transition-[border-color,background-color,color] hover:border-[rgba(182,229,255,0.34)] hover:bg-[rgba(18,28,44,0.82)] hover:text-text-main"
              aria-label={strings["sim.closeSavedDecks"]}
              onClick={onClose}
            >
              <Icon name="close" className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p
              role="alert"
              className="mb-3 border border-[rgba(248,113,113,0.35)] bg-[rgba(69,10,10,0.35)] px-4 py-3 text-[0.86rem] text-[#fecaca]"
            >
              {error}
            </p>
          ) : null}
          {loading && decks.length === 0 ? (
            <p className="border border-[rgba(132,150,184,0.22)] bg-[rgba(10,16,26,0.5)] px-4 py-8 text-center text-[0.86rem] text-text-dim">
              {strings["sim.loading"]}
            </p>
          ) : decks.length === 0 ? (
            <p className="border border-[rgba(132,150,184,0.22)] bg-[rgba(10,16,26,0.5)] px-4 py-8 text-center text-[0.86rem] text-text-dim">
              {strings["sim.noSavedDecks"]}
            </p>
          ) : (
            <ul className="grid gap-2">
              {decks.map((deck) => {
                const ready = deck.status === "ready";
                return (
                  <li
                    key={deck.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-[rgba(132,150,184,0.2)] bg-[rgba(10,16,26,0.55)] px-4 py-3 transition-colors hover:border-[rgba(160,198,232,0.4)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.98rem] font-semibold text-text-main">
                        {deck.name}
                      </p>
                      {deck.identity ? (
                        <p className="mt-0.5 truncate text-[0.78rem] text-text-soft">
                          {deck.identity}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[0.72rem] uppercase tracking-[0.1em] text-text-dim">
                        <span
                          className={
                            ready ? "text-[#7bdeb7]" : "text-[#f6c177]"
                          }
                        >
                          {ready
                            ? strings["sim.readyStatus"]
                            : strings["sim.needsUpdate"]}
                        </span>
                        {" · "}
                        Updated {new Date(deck.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`${smallNeutralButton} min-h-9`}
                        aria-label={`${strings["sim.editDeck"]}: ${deck.name}`}
                        onClick={() => onEdit(deck)}
                      >
                        {strings["sim.editDeck"]}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center border border-[rgba(116,239,255,0.34)] bg-[rgba(13,29,46,0.72)] px-4 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#d7eaff] transition-colors hover:border-[rgba(159,223,242,0.52)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                        onClick={() => onChoose(deck)}
                      >
                        {strings["sim.loadDeck"]}
                      </button>
                      <button
                        type="button"
                        className={`${smallNeutralButton} min-h-9`}
                        aria-label={`${strings["sim.deleteDeck"]}: ${deck.name}`}
                        onClick={() => onDelete(deck)}
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
