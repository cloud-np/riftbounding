"use client";

import { useEffect, useMemo, useState } from "react";

import { decodeDeckCode, exportDeckText, parseDeckText } from "./deck-adapter";
import { format, strings } from "./strings";
import type { DeckRulesMode, ParsedDeck } from "./types";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  deckActionButton,
  neutralButton,
  smallBlueButton,
  smallNeutralButton,
} from "@/components/ui/buttonStyles";

export interface DeckImportDialogProps {
  open: boolean;
  /** "import" (editable paste box) or "view" (read-only deck list). */
  mode?: "import" | "view";
  initialText?: string;
  /** Original lobby rule switch: signed-out paste import runs `unrestricted`. */
  deckRulesMode?: DeckRulesMode;
  onClose: () => void;
  onImport: (deck: ParsedDeck) => void;
}

export function DeckImportDialog({
  open,
  mode = "import",
  initialText = "",
  deckRulesMode = "standard",
  onClose,
  onImport,
}: DeckImportDialogProps) {
  const [raw, setRaw] = useState(initialText);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRaw(initialText);
      setCodeOpen(false);
      setCode("");
      setCodeError(null);
    }
  }, [open, initialText]);

  const parsed = useMemo(() => parseDeckText(raw, { deckRulesMode }), [raw, deckRulesMode]);
  const hasInput = raw.trim().length > 0;
  const viewOnly = mode === "view";
  const canImport = hasInput && parsed.valid;
  // The original paints the whole validation column (and the paste box) with the error
  // tint while the list is empty; only the footer status text stays neutral.
  const tone = hasInput && parsed.valid ? "success" : "error";

  const status = !hasInput
    ? strings["sim.pasteDeckToContinue"]
    : parsed.valid
      ? strings["sim.readyToImport"]
      : strings["sim.resolveBlockingDeckIssuesBeforeImporting"];
  const statusClass = !hasInput
    ? "border-[rgba(132,150,184,0.36)] bg-[rgba(10,16,26,0.65)] text-text-soft"
    : parsed.valid
      ? "border-[rgba(110,205,149,0.55)] bg-[rgba(22,68,46,0.62)] text-[#bdf2cf]"
      : "border-[rgba(242,138,138,0.48)] bg-[rgba(91,22,22,0.45)] text-[#ffd5d5]";

  const textBoxClass =
    tone === "error"
      ? "border-[rgba(242,138,138,0.36)] shadow-[inset_0_0_0_1px_rgba(255,126,126,0.08),0_0_0_1px_rgba(120,160,220,0.04)] bg-[linear-gradient(180deg,rgba(14,13,18,0.94),rgba(12,12,18,0.98))]"
      : "border-[rgba(116,239,173,0.22)] shadow-[inset_0_0_0_1px_rgba(119,231,255,0.05),0_0_0_1px_rgba(120,160,220,0.04)] bg-[linear-gradient(180deg,rgba(8,13,26,0.92),rgba(10,16,31,0.98))]";

  const panelClass =
    tone === "error"
      ? "border-[rgba(242,138,138,0.32)] bg-[linear-gradient(180deg,rgba(55,18,24,0.78),rgba(30,11,17,0.86))]"
      : "border-[rgba(116,239,173,0.22)] bg-[linear-gradient(180deg,rgba(20,54,41,0.52),rgba(11,28,21,0.72))]";

  const applyCode = () => {
    const decoded = decodeDeckCode(code);
    if ("error" in decoded) {
      setCodeError(decoded.error);
      return;
    }
    setRaw(exportDeckText(decoded));
    setCodeError(null);
    setCodeOpen(false);
    setCode("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentClassName="flex max-h-[min(90vh,52rem)] w-full max-w-5xl"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={viewOnly ? strings["sim.viewDeckList"] : strings["sim.importDeckList"]}
        className="lobby-deck-editor relative z-1 flex max-h-[min(90vh,52rem)] w-full max-w-5xl flex-col overflow-hidden border border-[rgba(148,163,184,0.28)] bg-[linear-gradient(180deg,rgba(11,18,29,0.98),rgba(7,12,22,0.98))] shadow-[0_30px_70px_rgba(0,0,0,0.36)]"
      >
        <div className="lobby-deck-editor-header flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(132,150,184,0.18)] px-5 py-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.14em] text-text-dim">
              {strings["sim.deckList"]}
            </p>
            <h2 className="mt-1 mb-0 text-[1.4rem] leading-none font-semibold">
              {viewOnly ? strings["sim.viewDeck"] : strings["sim.importDeck"]}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`lobby-deck-editor-status inline-flex min-h-9 items-center border px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${statusClass}`}
            >
              {status}
            </span>
            {viewOnly ? null : (
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center border border-[rgba(132,150,184,0.22)] bg-[rgba(10,16,26,0.68)] px-2.5 text-[0.67rem] font-semibold uppercase tracking-widest text-text-soft transition-[border-color,background-color,color] hover:border-[rgba(182,229,255,0.34)] hover:bg-[rgba(18,28,44,0.82)] hover:text-text-main"
                  aria-label={strings["sim.openDeckCodeInput"]}
                  onClick={() => {
                    setCodeOpen((value) => !value);
                    setCodeError(null);
                  }}
                >
                  {strings["sim.useDeckCode"]}
                </button>
                {codeOpen ? (
                  <div className="lobby-deck-code-popover absolute top-[calc(100%+0.65rem)] right-0 z-5 w-80 border border-[rgba(132,150,184,0.26)] bg-[linear-gradient(180deg,rgba(10,16,26,0.98),rgba(7,12,22,0.98))] p-3 shadow-[0_18px_32px_rgba(0,0,0,0.34)]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#9fdff2]">
                      {strings["sim.deckCode"]}
                    </p>
                    <p className="mt-1 text-[0.78rem] text-text-dim">
                      {strings["sim.deckCodeHelp"]}
                    </p>
                    <input
                      value={code}
                      onChange={(event) => {
                        setCode(event.currentTarget.value);
                        setCodeError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyCode();
                        }
                      }}
                      placeholder={strings["sim.pasteDeckCode"]}
                      className="mt-3 w-full border border-[rgba(132,150,184,0.24)] bg-[rgba(9,15,24,0.94)] px-3 py-2 text-[0.86rem] text-[#ebf2ff] outline-none transition-[border-color,box-shadow] focus:border-[rgba(120,196,255,0.55)] focus:shadow-[0_0_0_1px_rgba(120,196,255,0.12)]"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {codeError ? (
                      <p className="mt-2 text-[0.72rem] text-[#ffd5d5]">{codeError}</p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={smallNeutralButton}
                        onClick={() => setCodeOpen(false)}
                      >
                        {strings["sim.cancel"]}
                      </button>
                      <button
                        type="button"
                        className={smallBlueButton}
                        onClick={applyCode}
                        disabled={code.trim().length === 0}
                      >
                        {strings["sim.loadDeck"]}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[rgba(132,150,184,0.26)] bg-[rgba(10,16,26,0.68)] text-text-soft transition-[border-color,background-color,color] hover:border-[rgba(182,229,255,0.34)] hover:bg-[rgba(18,28,44,0.82)] hover:text-text-main"
              aria-label={strings["sim.closeDeckEditor"]}
              onClick={onClose}
            >
              <Icon name="close" className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </div>
        </div>

        <div className="lobby-deck-editor-body grid min-h-0 flex-1 gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-h-0">
            <div
              className={`lobby-deck-editor-text relative h-112 overflow-hidden border ${textBoxClass}`}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden" />
              <textarea
                className="mb-0 h-full min-h-0 w-full resize-none border-0 bg-transparent px-4 py-4 font-mono text-[0.95rem] leading-[1.52] text-[#ebf2ff] outline-none"
                value={raw}
                onChange={(event) => setRaw(event.currentTarget.value)}
                placeholder={strings["sim.pasteDeckExport"]}
                rows={18}
                readOnly={viewOnly}
                disabled={viewOnly}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
              />
            </div>
          </div>
          <div
            className={`lobby-deck-editor-validation min-h-0 overflow-y-auto border px-3 py-3 ${panelClass}`}
          >
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9fdff2]">
              {strings["sim.importValidation"]}
            </p>
            {!hasInput ? (
              <div className="mt-3 grid gap-2 text-[0.84rem] text-text-soft">
                <p className="text-[#d7e5f5]">{strings["sim.pasteDeckListPrimary"]}</p>
                {viewOnly ? null : (
                  <p className="text-[0.78rem] text-text-dim">
                    {strings["sim.importLockedUntilNoErrors"]}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-3 text-[0.84rem] text-text-soft">
                <div className="grid gap-2">
                  <div className="grid gap-1 text-[0.8rem] text-[#d7e5f5]">
                    <p>{format(strings["sim.countLegend"], { count: parsed.totals.legend })}</p>
                    <p>{format(strings["sim.countChampion"], { count: parsed.totals.champion })}</p>
                    <p>{format(strings["sim.countMainDeck"], { count: parsed.totals.mainDeck })}</p>
                    <p>
                      {format(strings["sim.countBattlefields"], {
                        count: parsed.totals.battlefields,
                      })}
                    </p>
                    <p>{format(strings["sim.countRunes"], { count: parsed.totals.runes })}</p>
                    <p>
                      {format(strings["sim.sideboardCount"], { count: parsed.totals.sideboard })}
                    </p>
                  </div>
                </div>
                {parsed.errors.length > 0 ? (
                  <div className="grid gap-2 border border-[rgba(242,138,138,0.34)] bg-[rgba(72,20,28,0.44)] px-3 py-3">
                    <ul className="grid gap-1 text-[0.82rem] text-[#ffe3e3]">
                      {parsed.errors.map((error) => (
                        <li key={error} className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {parsed.warnings.length > 0 ? (
                  <div className="grid gap-2 border border-[rgba(230,182,112,0.3)] bg-[rgba(68,49,18,0.34)] px-3 py-3">
                    <p className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#ffe6b9]">
                      {strings["sim.warnings"]}
                    </p>
                    <ul className="grid gap-1 text-[0.82rem] text-[#f7e7c5]">
                      {parsed.warnings.map((warning) => (
                        <li key={warning} className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="lobby-deck-editor-footer flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(132,150,184,0.18)] px-5 py-4">
          <p className="text-[0.8rem] text-text-dim">
            {viewOnly
              ? strings["sim.deckList"]
              : canImport
                ? strings["sim.importReadyLobby"]
                : !hasInput
                  ? strings["sim.pasteDeckExportContinue"]
                  : strings["sim.resolveBlockingDeckIssuesBeforeImporting"]}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={`${neutralButton} sm:w-auto! sm:min-w-0!`}
              onClick={onClose}
            >
              {viewOnly ? strings["sim.done"] : strings["sim.cancel"]}
            </button>
            {viewOnly ? null : (
              <button
                type="button"
                className={deckActionButton}
                onClick={() => onImport(parsed)}
                disabled={!canImport}
              >
                <Icon name="upload" className="h-3.5 w-3.5" strokeWidth={2.1} />
                {strings["sim.importDeck"]}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
