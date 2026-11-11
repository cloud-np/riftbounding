"use client";

import type { CardSide } from "../card/types";

const SELF_ACCENT = "rgb(150 205 185)";
const SELF_ACCENT_SOFT = "rgb(110 160 145 / 0.5)";
const OPPONENT_ACCENT = "rgb(214 172 120)";
const OPPONENT_ACCENT_SOFT = "rgb(160 120 75 / 0.5)";

/**
 * Index (0 = first node from the top of the column) of a score value.
 * Self reads bottom-up (0 at the bottom, victory at the top); the opponent reads top-down.
 */
export function scoreNodeIndex(values: number[], value: number): number {
  return values.indexOf(value);
}

export interface ScoreRailGeometry {
  /** Number of nodes in the straight column (0 ... victory score inclusive). */
  nodeCount: number;
  /** Lit segment length measured in node rows (between node centres), clamped to the rail. */
  litRows: number;
  /** The lit segment grows from the 0 node: "bottom" for self, "top" for the opponent. */
  litAnchor: "top" | "bottom";
  /** Total connector length in node rows (between the first and last node centres). */
  railRows: number;
}

/** Pure geometry for the single straight rail; unit-tested. */
export function scoreRailGeometry(
  values: number[],
  score: number,
  side: CardSide,
): ScoreRailGeometry {
  const nodeCount = values.length;
  const max = nodeCount ? Math.max(...values) : 0;
  const clamped = Math.max(0, Math.min(max, Number.isFinite(score) ? score : 0));
  return {
    nodeCount,
    railRows: Math.max(0, nodeCount - 1),
    litRows: clamped,
    litAnchor: side === "self" ? "bottom" : "top",
  };
}

/** Straight connector through the node centres, lit from the 0 node up to the current score. */
function ScoreRailConnector({
  geometry,
  side,
}: {
  geometry: ScoreRailGeometry;
  side: CardSide;
}) {
  const rail = geometry.railRows;
  if (rail <= 0) return null;
  const lit = Math.min(rail, geometry.litRows);
  const edge = "calc(var(--track-row-size) / 2)";
  const anchor = geometry.litAnchor === "bottom" ? "bottom" : "top";
  return (
    <>
      <span
        aria-hidden="true"
        data-score-rail={side}
        className="score-rail-line pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: edge, bottom: edge }}
      />
      {lit > 0 ? (
        <span
          aria-hidden="true"
          data-score-rail-lit={side}
          className="score-rail-lit pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            [anchor]: edge,
            height: `calc(var(--track-row-size) * ${lit})`,
          }}
        />
      ) : null}
    </>
  );
}

export function ScoreTrack({
  side,
  values,
  score,
  winningValue,
}: {
  side: CardSide;
  values: number[];
  score: number;
  winningValue: number;
}) {
  const geometry = scoreRailGeometry(values, score, side);
  const accent = side === "self" ? SELF_ACCENT : OPPONENT_ACCENT;
  const accentSoft = side === "self" ? SELF_ACCENT_SOFT : OPPONENT_ACCENT_SOFT;

  return (
    <div
      data-board-player-scores={side === "self" ? "true" : undefined}
      data-board-opponent-scores={side === "opponent" ? "true" : undefined}
      data-score-track-straight="true"
      className={
        side === "self"
          ? "absolute left-(--track-edge-inset) bottom-(--track-player-bottom) z-12 flex w-(--score-track-rail-width) flex-col items-center translate-x-(--track-player-nudge) border-none bg-transparent p-0 shadow-none"
          : "absolute top-(--track-opponent-score-top) right-(--track-edge-inset) left-auto z-12 flex w-(--score-track-rail-width) flex-col items-center -translate-x-(--track-opponent-nudge) border-none bg-transparent p-0 shadow-none"
      }
      style={{ height: `calc(var(--track-row-size) * ${geometry.nodeCount})` }}
      role="group"
      aria-label={side === "self" ? "Your score track" : "Opponent score track"}
    >
      <ScoreRailConnector geometry={geometry} side={side} />
      {values.map((value) => {
        const reached = score >= value;
        const active = score === value;
        const winning = value === winningValue;
        return (
          <div
            key={`${side}-score-${value}`}
            className="relative z-1 grid w-full shrink-0 place-items-center"
            style={{ height: "var(--track-row-size)" }}
          >
            <div
              data-active={active}
              data-reached={reached}
              data-variant={side}
              data-winning={winning}
              data-terminal={winning}
              className={
                "scoreTrackNodeConstellation st-gem z-1" + (winning ? " scoreTrackNodeWinning" : "")
              }
              style={{
                ["--track-node-accent" as string]: accent,
                ["--track-node-accent-soft" as string]: accentSoft,
              }}
            >
              <span className="scoreTrackNodeArrival" aria-hidden="true" />
              <span className="scoreTrackNodeCore" aria-hidden="true" />
              <span className="scoreTrackNodeCharge" aria-hidden="true" />
              <span className="scoreTrackNodeLabel">{value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Identity rail animated background behind the score rail. */
export function IdentityRail({
  side,
  rowCount,
}: {
  side: CardSide;
  rowCount: number;
}) {
  return (
    <div
      className={
        side === "self"
          ? "identityRailTurn identityRailTurnPlayer absolute left-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-rail-width)/2)] bottom-[calc(var(--track-player-bottom)-var(--identity-rail-vpad))] z-11 w-(--identity-rail-width) translate-x-(--identity-badge-player-nudge) rounded-[0.24rem] pointer-events-none identityRailTurnOn"
          : "identityRailTurn identityRailTurnOpponent absolute right-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-rail-width)/2)] top-[calc(var(--track-opponent-score-top)-var(--identity-rail-vpad))] z-11 w-(--identity-rail-width) -translate-x-(--identity-badge-opponent-nudge) rounded-[0.24rem] pointer-events-none identityRailTurnOff"
      }
      style={{ height: `calc(var(--track-row-size) * ${rowCount} + var(--identity-rail-vpad) * 2)` }}
    />
  );
}
