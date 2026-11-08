"use client";

import { useEffect, useId, useRef, useState } from "react";

import { strings } from "@/components/lobby/strings";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

export interface SearchCardResult {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface CardSearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Optional card source; when absent the palette renders the empty states. */
  searchCards?: (query: string) => SearchCardResult[];
  onSelectCard?: (card: SearchCardResult) => void;
}

/**
 * Ctrl/⌘+K quick card search palette. The original fetches its card index lazily;
 * phase 1 accepts an optional `searchCards` source and otherwise shows the same
 * minimum-query / no-matches states.
 */
export function CardSearchDialog({
  open,
  onClose,
  searchCards,
  onSelectCard,
}: CardSearchDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const results = normalized.length >= 2 && searchCards ? searchCards(normalized) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-[200] flex items-start justify-center bg-[rgba(3,8,17,0.72)] px-3 pb-3 pt-[min(16vh,9rem)] backdrop-blur-sm sm:px-5"
      contentClassName="w-full max-w-2xl"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="global-card-search-dialog"
        className="flex max-h-[min(72dvh,36rem)] w-full flex-col overflow-hidden rounded-2xl border border-[rgba(193,164,103,0.34)] bg-[#0b1322] shadow-[0_32px_90px_rgba(0,0,0,0.5)] outline-none"
      >
        <h2 id={titleId} className="sr-only">
          {strings["sim.cardSearch.title"]}
        </h2>
        <div className="flex min-h-16 items-center gap-2 border-b border-[rgba(193,164,103,0.28)] px-3 sm:px-4">
          <Icon name="search" className="h-5 w-5 shrink-0 text-[#9fdff2]" />
          <label htmlFor={`${titleId}-input`} className="sr-only">
            {strings["sim.cardSearch.title"]}
          </label>
          <input
            id={`${titleId}-input`}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                onSelectCard?.(results[0]);
              }
            }}
            placeholder={strings["sim.cardSearch.placeholder"]}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-haspopup="listbox"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="search"
            spellCheck={false}
            className="h-14 min-w-0 flex-1 bg-transparent px-1 text-base text-[#eef3ff] outline-none placeholder:text-[#94a3b8]/75 sm:text-lg"
          />
          <kbd className="hidden shrink-0 rounded-md border border-[rgba(193,164,103,0.34)] bg-[rgba(34,26,47,0.72)] px-2 py-1 font-mono text-[0.68rem] font-medium text-[#94a3b8] sm:inline-flex">
            Ctrl K
          </kbd>
          <button
            type="button"
            aria-label={strings["sim.cardSearch.close"]}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[rgba(34,26,47,0.72)] hover:text-[#eef3ff]"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <span className="sr-only">{strings["sim.cardSearch.instructions"]}</span>
        {results.length > 0 ? (
          <div
            role="listbox"
            aria-label={strings["sim.cardSearch.suggestions"]}
            className="min-h-0 flex-1 overflow-y-auto py-1.5"
            style={{ scrollbarGutter: "stable" }}
          >
            {results.map((card) => (
              <button
                key={card.id}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => onSelectCard?.(card)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-[#eef3ff] hover:bg-[rgba(34,26,47,0.6)]"
              >
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.imageUrl} alt="" className="h-8 w-6 object-cover" />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{card.name}</span>
                <span className="font-mono text-[0.68rem] text-[#94a3b8]">{card.id}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center px-5 py-8 text-center text-sm text-[#94a3b8]">
            {normalized.length < 2
              ? strings["sim.cardSearch.minimumQuery"]
              : strings["sim.cardSearch.noMatches"]}
          </div>
        )}
        <div className="flex min-h-9 items-center justify-between gap-3 border-t border-[rgba(193,164,103,0.28)] px-3 py-1.5 text-[0.65rem] text-[#94a3b8] sm:px-4">
          <span role="status" aria-live="polite">
            {normalized.length < 2
              ? strings["sim.cardSearch.minimumQuery"]
              : strings["sim.cardSearch.fuzzy"]}
          </span>
          <span aria-hidden="true" className="hidden items-center gap-3 sm:flex">
            <span>{strings["sim.cardSearch.navigateHint"]}</span>
            <span>{strings["sim.cardSearch.openHint"]}</span>
            <span>{strings["sim.cardSearch.closeHint"]}</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
