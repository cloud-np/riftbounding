"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createTranslator } from "@rift/i18n";

import type { BoardSlotProps } from "../../slot-types";
import { InitiativeDiceStage } from "../../three/InitiativeDiceStage";
import {
  initiativeChooserId,
  initiativePendingPlayers,
  initiativePlayers,
  initiativeRolls,
} from "./setup-state";
import { relationForPlayer, teamLabelFor } from "../../three/types";

const t = createTranslator("en");

interface InitiativeOverlayProps
  extends Pick<BoardSlotProps, "state" | "viewerId" | "controlledPlayerIds" | "dispatch" | "mode"> {
  /**
   * When the dice stage started (the original mounts it when the roll result event
   * arrives and keeps it for 4000 ms). The parent owns the hand-off timing.
   */
  animationStartedAt?: number | null;
}

const DECISION_REVEAL_MS = 1450;

export function InitiativeOverlay({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  mode,
  animationStartedAt = null,
}: InitiativeOverlayProps) {
  const [now, setNow] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));
  const [attemptTick, setAttemptTick] = useState(0);
  const inFlightRef = useRef<string | null>(null);
  const controlled = useMemo(() => new Set(controlledPlayerIds), [controlledPlayerIds]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(typeof performance !== "undefined" ? performance.now() : Date.now());
    }, 100);
    return () => window.clearInterval(tick);
  }, []);

  const chooserId = initiativeChooserId(state);

  // Auto-roll every controlled seat that still needs a d20.
  useEffect(() => {
    if (state.phase !== "initiative_roll") {
      inFlightRef.current = null;
      return;
    }
    const pending = initiativePendingPlayers(state).filter((player) => controlled.has(player.id));
    const next = pending[0];
    if (!next) {
      inFlightRef.current = null;
      return;
    }
    if (inFlightRef.current === next.id) return;
    inFlightRef.current = next.id;
    dispatch({ type: "roll_initiative" });
    const timer = window.setTimeout(() => {
      if (inFlightRef.current === next.id) {
        inFlightRef.current = null;
        setAttemptTick((value) => value + 1);
      }
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [attemptTick, controlled, dispatch, state, state.initiativeRolls, state.phase]);

  const elapsed = animationStartedAt !== null ? Math.max(0, now - animationStartedAt) : 0;

  const players = useMemo(() => {
    const rolls = initiativeRolls(state);
    return initiativePlayers(state).map((player) => ({
      id: player.id,
      name: player.name,
      relation: relationForPlayer(viewerId, player.id, state.teamIdByPlayerId),
      teamLabel: teamLabelFor(viewerId, player.id, state.teamIdByPlayerId),
      value: rolls[player.id],
      rolling: state.phase === "initiative_roll" && typeof rolls[player.id] !== "number",
    }));
  }, [state, viewerId]);

  const revealChooser = chooserId && elapsed >= DECISION_REVEAL_MS ? chooserId : null;
  const pendingControlled = initiativePendingPlayers(state).some((player) =>
    controlled.has(player.id),
  );
  const showRollButton =
    state.phase === "initiative_roll" && pendingControlled && elapsed > 1800;

  if (players.length < 2) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-95"
      data-testid="initiative-overlay"
      data-initiative-round={state.initiativeRound ?? 0}
      data-initiative-elapsed={Math.round(elapsed)}
    >
      <InitiativeDiceStage
        players={players}
        meId={viewerId}
        chooserId={revealChooser}
        animationStartedAt={animationStartedAt}
      />
      {showRollButton ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-[1.4rem] left-1/2 -translate-x-1/2 rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] px-4 py-2 text-[0.72rem] uppercase tracking-[0.09em] text-[#fff0d2] shadow-[0_8px_18px_rgba(3,10,22,0.45)] disabled:opacity-50"
          disabled={!pendingControlled}
          onClick={() => dispatch({ type: "roll_initiative" })}
          data-testid="initiative-roll"
          data-setup-action="roll-initiative"
        >
          Roll Initiative
        </button>
      ) : null}
      {mode !== "multiplayer" && state.phase === "initiative_roll" ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-[0.6rem] text-center text-[0.58rem] uppercase tracking-[0.12em] text-[#9bb4ce]">
          {t("sim.setup.initiativeRollingStatus") ?? "rolling"}
        </p>
      ) : null}
    </div>
  );
}
