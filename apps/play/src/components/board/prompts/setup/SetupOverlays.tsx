"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import type { BoardSlotProps } from "../../slot-types";
import { InitiativeDiceStage } from "../../three/InitiativeDiceStage";
import { BattlefieldPickOverlay } from "./BattlefieldPickOverlay";
import { FirstPlayerChoiceOverlay } from "./FirstPlayerChoiceOverlay";
import { InitiativeOverlay } from "./InitiativeOverlay";
import { MulliganOverlay } from "./MulliganOverlay";
import { SideboardingOverlay } from "./SideboardingOverlay";
import { SetupDimBackdrop } from "./SetupChrome";
import {
  activePlayers,
  initiativeChooserId,
  initiativePlayers,
  initiativeRolls,
  isSetupPhase,
} from "./setup-state";

type PreviewKind = "sideboarding" | "battlefield" | "initiative" | "first_player_choice" | "mulligan";

/** Avoid the SSR `useLayoutEffect` warning while still updating before paint in the browser. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const PREVIEW_KINDS: ReadonlySet<string> = new Set<PreviewKind>([
  "sideboarding",
  "battlefield",
  "initiative",
  "first_player_choice",
  "mulligan",
]);

function InitiativePreview({ props }: { props: BoardSlotProps }) {
  const [startedAt] = useState(() =>
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const players = activePlayers(props.state).slice(0, 2).map((player, index) => ({
    id: player.id,
    name: player.name,
    relation: (index === 0 ? "self" : "opponent") as "self" | "opponent",
    value: index === 0 ? 13 : 9,
    rolling: false,
  }));
  const chooser = players[0]?.id ?? null;
  return (
    <div className="pointer-events-none absolute inset-0 z-95" data-testid="initiative-preview">
      <InitiativeDiceStage
        players={players}
        meId={props.viewerId}
        chooserId={chooser}
        animationStartedAt={startedAt}
      />
    </div>
  );
}

export function SetupOverlays(props: BoardSlotProps) {
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stageStartedAt, setStageStartedAt] = useState<number | null>(null);
  const [resultSeenAt, setResultSeenAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = new URLSearchParams(window.location.search).get("setupPreview");
    if (value && PREVIEW_KINDS.has(value)) setPreview(value as PreviewKind);
  }, []);

  const livePhase = props.state.phase;
  const phase = preview !== null ? preview : livePhase;
  const previewing = preview !== null;

  useEffect(() => {
    if (livePhase !== "initiative_roll" && livePhase !== "first_player_choice") return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [livePhase]);

  // The original mounts the dice stage when the roll result is known and removes it after
  // `onComplete() @+4000ms` (`35qz5rkx7yexy.js:13962-14070`). The first-player overlay is
  // rendered on the same frame the dice stage goes away, so both are never unmounted.
  const chooserId = initiativeChooserId(props.state);
  const rolls = initiativeRolls(props.state);
  const allRolled =
    initiativePlayers(props.state).length > 0 &&
    initiativePlayers(props.state).every((player) => typeof rolls[player.id] === "number");
  const hasResult = !!chooserId && allRolled;

  useIsomorphicLayoutEffect(() => {
    if (livePhase !== "initiative_roll" && livePhase !== "first_player_choice") {
      setStageStartedAt(null);
      setResultSeenAt(null);
      return;
    }
    if (livePhase === "initiative_roll") {
      setStageStartedAt((previous) =>
        previous ?? (typeof performance !== "undefined" ? performance.now() : Date.now()),
      );
    }
    if (livePhase === "first_player_choice" && hasResult) {
      setStageStartedAt((previous) =>
        previous ?? (typeof performance !== "undefined" ? performance.now() : Date.now()),
      );
    }
    if (hasResult) setResultSeenAt((previous) => previous ?? Date.now());
    else if (livePhase === "initiative_roll") setResultSeenAt(null);
  }, [hasResult, livePhase]);

  const diceElapsed = resultSeenAt !== null ? Math.max(0, now - resultSeenAt) : 0;
  const showDice =
    !previewing &&
    (livePhase === "initiative_roll" ||
      (livePhase === "first_player_choice" && hasResult && diceElapsed < 4000));

  const setup = previewing || isSetupPhase(phase);

  if (!setup) return null;

  return (
    <div className="pointer-events-none absolute inset-0" data-setup-flow="true" data-setup-phase={phase}>
      <SetupDimBackdrop visible />
      {phase === "battlefield" || phase === "battlefield_pick" ? (
        <BattlefieldPickOverlay {...props} />
      ) : null}
      {phase === "initiative" ? <InitiativePreview props={props} /> : null}
      {showDice ? <InitiativeOverlay {...props} animationStartedAt={stageStartedAt} /> : null}
      {phase === "first_player_choice" && !showDice ? <FirstPlayerChoiceOverlay {...props} /> : null}
      {phase === "mulligan" ? <MulliganOverlay {...props} /> : null}
      {phase === "sideboarding" ? <SideboardingOverlay {...props} /> : null}
    </div>
  );
}
