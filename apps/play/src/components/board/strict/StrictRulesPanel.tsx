"use client";

import { useMemo, useRef, useState } from "react";

import { rewindAllowedForRoom, strictExplainIllegal, strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import { createTranslator, promptTitle, rulesReasonText } from "@rift/i18n";
import type { StrictReproFile, WireAction } from "@rift/protocol";

import { smallNeutralButton } from "@/components/ui/buttonStyles";
import { getAuthToken } from "@/runtime/auth";
import { loadRepro } from "@/runtime/roomApi";

import type { BoardSlotProps } from "../slot-types";
import { STRICT_SHELL_CLASS } from "./StrictPromptDialog";
import {
  isStrictRoom,
  strictActorFor,
  strictRulesPanelEnabled,
  strictStatus,
} from "./strict-model";

const t = createTranslator("en");

export type StrictRulesPanelProps = Pick<
  BoardSlotProps,
  "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "dispatchAs"
>;

/**
 * Strict-rules controls (R2-int). Rendered only in strict in-game rooms; sandbox rooms get
 * `null`, so the original board is unchanged.
 *
 * - legal plays / activations ("Activate (manual)" for unscripted `manual:<n>` abilities, §6.4),
 *   moves, Pass and End turn come from `legalIntents`;
 * - Pass / End turn stay visible while illegal, with the `explainIllegal` reason as tooltip;
 * - the §6.4 manual window shows Done; Concede (649–652) asks for confirmation;
 * - a pending prompt for one of this client's seats opens `StrictPromptDialog`.
 */
export function StrictRulesPanel({
  state: room,
  viewerId,
  controlledPlayerIds,
  dispatch,
  dispatchAs,
}: StrictRulesPanelProps) {
  const controlled = useMemo(
    () => (controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerId]),
    [controlledPlayerIds, viewerId],
  );
  const who = useMemo(() => strictWhoMayAct(room), [room]);
  const actor = strictActorFor(who, viewerId, controlled);
  const legal = useMemo(() => strictLegalIntents(room, actor), [room, actor]);
  // §5: why Pass / End turn are unavailable (the same Verdicts as the write path).
  const explanations = useMemo(() => {
    if (!isStrictRoom(room)) return { pass: undefined, endTurn: undefined };
    const explain = (intent: WireAction): string | undefined => {
      const verdict = strictExplainIllegal(room, actor, intent);
      return verdict.ok ? undefined : rulesReasonText(t, verdict.code, verdict.rule);
    };
    return {
      pass: legal?.canPass ? undefined : explain({ type: "rules_pass" }),
      endTurn: legal?.canEndTurn ? undefined : explain({ type: "rules_end_turn" }),
    };
  }, [room, actor, legal]);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [reproStep, setReproStep] = useState("");
  const [reproBusy, setReproBusy] = useState(false);
  const [reproError, setReproError] = useState<string | null>(null);
  const reproFileRef = useRef<HTMLInputElement | null>(null);
  const reproAvailable =
    isStrictRoom(room) && rewindAllowedForRoom(room) && !room.gameOutcome;

  if (!strictRulesPanelEnabled() || !isStrictRoom(room)) return null;

  const loadReproFile = async () => {
    const file = reproFileRef.current?.files?.[0];
    if (!file || reproBusy) return;
    setReproBusy(true);
    setReproError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("The file is not a repro JSON object.");
      }
      const authToken = await getAuthToken();
      if (!authToken) throw new Error(t("rules.ui.reproSignIn") ?? "Sign in to load a repro.");
      const trimmed = reproStep.trim();
      const step = trimmed === "" ? undefined : Math.max(0, Math.trunc(Number(trimmed)));
      if (step !== undefined && !Number.isFinite(step)) throw new Error("Invalid step.");
      await loadRepro({
        roomCode: room.roomCode,
        authToken,
        repro: parsed as StrictReproFile,
        ...(step !== undefined ? { step } : {}),
      });
    } catch (error) {
      setReproError(error instanceof Error ? error.message : String(error));
    } finally {
      setReproBusy(false);
    }
  };

  const send = (intent: WireAction, as: string = actor) => {
    if (as !== viewerId && dispatchAs) dispatchAs(as, intent);
    else dispatch(intent);
  };

  const pending = room.rules?.prompt ?? null;
  const status = strictStatus(room, who, controlled, t, pending ? promptTitle(t, pending) : null);

  return (
    <>
      <div
        className="pointer-events-none absolute left-[0.6rem] z-[151] w-[min(19rem,calc(100%-1rem))]"
        style={{ bottom: "calc(var(--player-band-size, 9rem) + 0.9rem)" }}
        data-testid="strict-rules-panel"
        data-strict-actor={actor}
      >
        <div className={STRICT_SHELL_CLASS}>
          <p className="m-0 text-[0.56rem] font-semibold uppercase leading-none tracking-[0.1em] text-[#c5d6ee]">
            {t("rules.ui.strictBadge") ?? "Strict rules"}
          </p>
          {status ? (
            <p
              className="m-0 mt-[0.18rem] text-[0.7rem] font-semibold leading-[1.2] text-[#eef5ff]"
              data-testid="strict-status"
            >
              {status}
            </p>
          ) : null}
          <div className="mt-[0.3rem] flex flex-wrap gap-[0.24rem]">
            <button
              type="button"
              className={smallNeutralButton}
              disabled={!legal?.canPass}
              title={explanations.pass}
              onClick={() => send({ type: "rules_pass" })}
            >
              {t("rules.ui.pass") ?? "Pass"}
            </button>
            <button
              type="button"
              className={smallNeutralButton}
              disabled={!legal?.canEndTurn}
              title={explanations.endTurn}
              onClick={() => send({ type: "rules_end_turn" })}
            >
              {t("rules.ui.endTurn") ?? "End turn"}
            </button>
            {confirmConcede ? (
              <button
                type="button"
                className={smallNeutralButton}
                data-testid="strict-concede-confirm"
                onClick={() => {
                  setConfirmConcede(false);
                  send({ type: "rules_concede" }, viewerId);
                }}
              >
                {t("rules.ui.concedeConfirm") ?? "Concede the game?"}
              </button>
            ) : (
              <button
                type="button"
                className={smallNeutralButton}
                data-testid="strict-concede"
                onClick={() => setConfirmConcede(true)}
              >
                {t("rules.ui.concede") ?? "Concede"}
              </button>
            )}
          </div>
          {reproAvailable ? (
            <div
              className="mt-[0.3rem] flex flex-wrap items-center gap-[0.24rem] border-t border-[rgba(172,199,230,0.16)] pt-[0.28rem]"
              data-testid="repro-import"
            >
              <input
                ref={reproFileRef}
                type="file"
                accept="application/json,.json"
                data-testid="repro-file"
                className="max-w-[9rem] text-[0.56rem] text-[#c5d6ee] file:mr-[0.24rem] file:rounded-[0.16rem] file:border file:border-[rgba(172,199,230,0.24)] file:bg-[rgba(20,35,58,0.9)] file:px-[0.24rem] file:py-[0.12rem] file:text-[0.56rem] file:text-[#dbe8f8]"
              />
              <input
                type="number"
                min={0}
                value={reproStep}
                onChange={(event) => setReproStep(event.target.value)}
                placeholder={t("rules.ui.reproStep") ?? "Step"}
                aria-label={t("rules.ui.reproStep") ?? "Step"}
                data-testid="repro-step"
                className="w-[4.2rem] rounded-[0.16rem] border border-[rgba(172,199,230,0.24)] bg-[rgba(8,17,30,0.8)] px-[0.24rem] py-[0.14rem] text-[0.56rem] text-[#eef5ff]"
              />
              <button
                type="button"
                className={smallNeutralButton}
                data-testid="load-repro"
                disabled={reproBusy}
                onClick={() => void loadReproFile()}
              >
                {t("rules.ui.loadRepro") ?? "Load repro"}
              </button>
              {reproError ? (
                <span role="alert" className="text-[0.54rem] text-[#ffb4b4]">
                  {reproError}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
