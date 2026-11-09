"use client";

import { useMemo } from "react";

import { createTranslator } from "@rift/i18n";
import type { WireAction } from "@rift/protocol";

import { smallBlueButton } from "@/components/ui/buttonStyles";

import type { BoardSlotProps } from "../slot-types";
import { StrictPromptDialog } from "./StrictPromptDialog";
import { promptHasBoardTargets } from "./strict-interaction";
import { isStrictRoom, promptForClient } from "./strict-model";

const t = createTranslator("en");

export type StrictPromptHostProps = Pick<
  BoardSlotProps,
  "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "dispatchAs"
>;

/**
 * Always-rendered strict prompt/manual surface (production included).
 *
 * Board-object prompts are answered by clicking the board, so no dialog is shown for them; the
 * dialog remains for prompts that have no board target (yes/no, numbers, modes, order, damage
 * assignment, choose-cost). The §6.4 manual window's Done button also lives here, outside the
 * developer-only `StrictRulesPanel`.
 */
export function StrictPromptHost({
  state: room,
  viewerId,
  controlledPlayerIds,
  dispatch,
  dispatchAs,
}: StrictPromptHostProps) {
  const controlled = useMemo(
    () => (controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerId]),
    [controlledPlayerIds, viewerId],
  );
  if (!isStrictRoom(room)) return null;
  const prompt = promptForClient(room, controlled);
  const promptOnBoard = !!prompt && promptHasBoardTargets(room, prompt);
  const manual = room.rules?.manual ?? null;
  const manualMine = !!manual && controlled.includes(manual.player);
  const send = (intent: WireAction, as: string) => {
    if (as !== viewerId && dispatchAs) dispatchAs(as, intent);
    else dispatch(intent);
  };

  return (
    <>
      {manualMine ? (
        <div
          className="pointer-events-none fixed bottom-[calc(var(--player-band-size,9rem)+0.9rem)] left-1/2 z-[151] -translate-x-1/2"
          data-testid="strict-manual-host"
        >
          <button
            type="button"
            className={`${smallBlueButton} pointer-events-auto`}
            data-testid="strict-manual-done"
            onClick={() => send({ type: "rules_manual_done" }, manual.player)}
          >
            {t("rules.ui.done") ?? "Done"}
          </button>
        </div>
      ) : null}
      {prompt && !promptOnBoard ? (
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
