"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  decodeDeckCodeToDecklist,
  parseDeckText,
  type DeckSections,
  type ParsedDeck,
} from "@rift/cards";

import { BuilderIcon } from "./BuilderIcon";
import { T } from "./strings";
import { BuilderModal } from "./ui";

export interface DeckImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (sections: DeckSections) => void;
  onNotice?: (message: string) => void;
}

function emptyCounts(parsed: ParsedDeck) {
  return [
    { key: "legend", label: "legend", value: parsed.totals.legend, required: 1 },
    { key: "champion", label: "champion", value: parsed.totals.champion, required: 1 },
    { key: "mainDeck", label: "main deck", value: parsed.totals.mainDeck, required: 39 },
    { key: "battlefields", label: "battlefields", value: parsed.totals.battlefields, required: 3 },
    { key: "runes", label: "runes", value: parsed.totals.runes, required: 12 },
    { key: "sideboard", label: "sideboard cards", value: parsed.totals.sideboard, required: 10 },
  ];
}

export function DeckImportDialog({ open, onClose, onImport, onNotice }: DeckImportDialogProps) {
  const [raw, setRaw] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setRaw("");
    setCodeOpen(false);
    setCode("");
    setCodeError(null);
  }, [open]);

  useEffect(() => {
    if (!codeOpen) return;
    const onDown = (event: MouseEvent) => {
      if (codeRef.current && !codeRef.current.contains(event.target as Node)) setCodeOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [codeOpen]);

  const parsed = useMemo(
    () => parseDeckText(raw, { validateCatalog: true, deckRulesMode: "standard" }),
    [raw],
  );
  const hasInput = raw.trim().length > 0;
  const hasErrors = parsed.errors.length > 0;
  const hasWarnings = parsed.warnings.length > 0;
  const tone = !hasInput ? "error" : hasErrors ? "error" : hasWarnings ? "warning" : "success";
  const status = !hasInput
    ? T.parserErrors
    : hasErrors
      ? T.parserErrors
      : hasWarnings
        ? T.warnings
        : T.readyToImport;

  const loadCode = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError(T.couldNotDecodeDeckCode);
      return;
    }
    try {
      const decoded = decodeDeckCodeToDecklist(trimmed);
      setRaw(decoded.decklistRaw);
      setCodeError(null);
      setCodeOpen(false);
      setCode("");
      onNotice?.(T.deckLoadedFromCode);
    } catch {
      setCodeError(T.couldNotDecodeDeckCode);
    }
  };

  const importNow = () => {
    if (!hasInput) return;
    onImport(parsed.sections);
    onClose();
  };

  const statusClass =
    tone === "success"
      ? "border-[rgba(110,205,149,0.55)] bg-[rgba(22,68,46,0.62)] text-[#bdf2cf]"
      : tone === "warning"
        ? "border-amber-400/50 bg-amber-950/50 text-amber-100"
        : "border-[rgba(242,138,138,0.48)] bg-[rgba(91,22,22,0.45)] text-[#ffd5d5]";

  return (
    <BuilderModal
      open={open}
      onClose={onClose}
      ariaLabel={T.importDeck}
      dark
      className="max-h-[min(90vh,52rem)] max-w-5xl rounded-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(132,150,184,0.18)] px-5 py-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.14em] text-slate-400">
            {T.importDeckList}
          </p>
          <h2 className="mt-1 text-[1.4rem] font-semibold leading-none">{T.importDeck}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2" ref={codeRef}>
          <span
            className={`inline-flex min-h-9 items-center border px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${statusClass}`}
          >
            {status}
          </span>
          <div className="relative">
            <button
              type="button"
              aria-expanded={codeOpen}
              onClick={() => setCodeOpen((current) => !current)}
              className="inline-flex h-9 items-center border border-[rgba(148,163,184,0.35)] bg-[rgba(13,21,34,0.78)] px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-200 transition-colors hover:border-[rgba(180,200,230,0.5)] hover:bg-[rgba(20,32,50,0.9)]"
            >
              {T.useDeckCode}
            </button>
            {codeOpen ? (
              <div
                id="deck-code-input-panel"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(20rem,calc(100vw-3rem))] rounded-md border border-[rgba(132,150,184,0.32)] bg-[linear-gradient(180deg,rgba(11,18,29,0.99),rgba(7,12,22,0.99))] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {T.deckCode}
                </p>
                <p className="mt-1 text-[0.72rem] text-slate-400">{T.deckCodeHelp}</p>
                <input
                  autoFocus
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setCodeError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadCode();
                  }}
                  placeholder={T.pasteDeckCode}
                  className="mt-2 h-9 w-full rounded border border-[rgba(96,165,250,0.5)] bg-[rgba(8,13,26,0.92)] px-2 text-sm outline-none focus:border-[rgba(147,197,253,0.8)]"
                />
                {codeError ? <p className="mt-1 text-[0.7rem] text-red-300">{codeError}</p> : null}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCodeOpen(false)}
                    className="inline-flex h-8 items-center border border-[rgba(148,163,184,0.35)] px-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-slate-200 hover:bg-white/5"
                  >
                    {T.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={loadCode}
                    className="inline-flex h-8 items-center bg-[#0b5fa5] px-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#0d6fbe]"
                  >
                    {T.loadDeck}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close deck import"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center border border-[rgba(148,163,184,0.35)] text-slate-300 hover:bg-white/5"
          >
            <BuilderIcon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <textarea
          id="deck-import-textarea"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder={T.pasteDeckExport}
          data-tone={tone === "success" ? "ok" : "error"}
          className="db-import-textarea db-thin-scrollbar h-[min(52vh,30rem)] w-full rounded-md p-3 outline-none focus:border-[rgba(96,165,250,0.65)]"
        />

        <div
          className={`db-thin-scrollbar flex h-[min(52vh,30rem)] flex-col overflow-y-auto rounded-md border p-3 text-sm ${
            !hasInput
              ? "border-[rgba(242,138,138,0.32)] bg-[linear-gradient(180deg,rgba(55,18,24,0.78),rgba(30,11,17,0.86))]"
              : tone === "success"
                ? "border-[rgba(116,239,173,0.22)] bg-[linear-gradient(180deg,rgba(20,54,41,0.52),rgba(11,28,21,0.72))]"
                : tone === "warning"
                  ? "border-amber-400/30 bg-[linear-gradient(180deg,rgba(63,46,12,0.6),rgba(35,25,8,0.75))]"
                  : "border-[rgba(242,138,138,0.32)] bg-[linear-gradient(180deg,rgba(55,18,24,0.78),rgba(30,11,17,0.86))]"
          }`}
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            {hasErrors || !hasInput
              ? "Import Validation"
              : hasWarnings
                ? T.warnings
                : T.importValidation}
          </p>
          {!hasInput ? (
            <>
              <p className="mt-2 text-[0.78rem] text-slate-300">{T.pasteDeckListPrimary}</p>
              <p className="mt-2 text-[0.72rem] text-slate-400">{T.pasteDeckListSecondary}</p>
            </>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-[0.78rem] text-slate-200">
                {emptyCounts(parsed).map((row) => (
                  <li key={row.key}>
                    {row.key === "sideboard"
                      ? `${row.value}/${row.required} ${row.label}`
                      : `${row.value}/${row.required} ${row.label}`}
                  </li>
                ))}
              </ul>
              {hasErrors ? (
                <div className="mt-3 rounded border border-[rgba(242,138,138,0.45)] bg-[rgba(60,15,20,0.55)] p-2">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-red-200">
                    Errors
                  </p>
                  <ul className="mt-1 space-y-1 text-[0.72rem] leading-snug text-red-50/90">
                    {parsed.errors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : hasWarnings ? (
                <div className="mt-3 rounded border border-amber-300/35 bg-amber-950/30 p-2">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-100">
                    {T.warnings}
                  </p>
                  <ul className="mt-1 space-y-1 text-[0.72rem] leading-snug text-amber-50/90">
                    {parsed.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(132,150,184,0.18)] px-5 py-3">
        <p className="text-[0.72rem] text-slate-400">
          {!hasInput
            ? T.pasteDeckExportContinue
            : hasErrors
              ? T.importWithErrors
              : hasWarnings
                ? T.importWithWarnings
                : T.importReady}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 min-w-24 items-center justify-center rounded bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            {T.cancel}
          </button>
          <button
            type="button"
            onClick={importNow}
            disabled={!hasInput}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded bg-[#0b70c9] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0d82e6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BuilderIcon name="import" className="h-4 w-4" />
            {T.importDeck}
          </button>
        </div>
      </div>
    </BuilderModal>
  );
}
