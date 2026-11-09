"use client";

import { useMemo, useState } from "react";

import { strictExplainIllegal, strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import { createTranslator, promptTitle, rulesReasonText } from "@rift/i18n";
import type { WireAction } from "@rift/protocol";

import { smallBlueButton, smallNeutralButton } from "@/components/ui/buttonStyles";

import type { BoardSlotProps } from "../slot-types";
import { STRICT_SHELL_CLASS, StrictPromptDialog } from "./StrictPromptDialog";
import {
  isStrictRoom,
  promptForClient,
  strictActionButtons,
  strictActorFor,
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

  if (!isStrictRoom(room)) return null;

  const send = (intent: WireAction, as: string = actor) => {
    if (as !== viewerId && dispatchAs) dispatchAs(as, intent);
    else dispatch(intent);
  };

  const pending = room.rules?.prompt ?? null;
  const prompt = promptForClient(room, controlled);
  const status = strictStatus(room, who, controlled, t, pending ? promptTitle(t, pending) : null);
  const actions = strictActionButtons(room, legal, t).filter(
    (button) => button.key !== "pass" && button.key !== "end-turn",
  );
  const manual = room.rules?.manual ?? null;
  const manualMine = !!manual && controlled.includes(manual.player);

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
          {actions.length > 0 ? (
            <div
              className="mt-[0.3rem] grid max-h-[9.5rem] gap-[0.24rem] overflow-y-auto"
              aria-label={t("rules.ui.legalActions") ?? "Legal actions"}
              data-testid="strict-actions"
            >
              {actions.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  className={`${button.tone === "primary" ? smallBlueButton : smallNeutralButton} justify-start truncate normal-case tracking-normal`}
                  onClick={() => send(button.intent)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-[0.3rem] flex flex-wrap gap-[0.24rem]">
            {manualMine ? (
              <button
                type="button"
                className={smallBlueButton}
                data-testid="strict-manual-done"
                onClick={() => send({ type: "rules_manual_done" }, manual.player)}
              >
                {t("rules.ui.done") ?? "Done"}
              </button>
            ) : null}
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
        </div>
      </div>
      {prompt ? (
        <StrictPromptDialog
          key={prompt.id}
          room={room}
          prompt={prompt}
          t={t}
          onAnswer={(intent) => send(intent, prompt.playerId)}
        />
      ) : null}
    </>
  );
}
