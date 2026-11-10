"use client";

import type { CardSide } from "../card/types";

const SELF_ACCENT = "rgb(126 232 191)";
const SELF_ACCENT_SOFT = "rgb(79 178 159 / 0.52)";
const OPPONENT_ACCENT = "rgb(231 185 117)";
const OPPONENT_ACCENT_SOFT = "rgb(174 117 63 / 0.52)";

interface NodePlacement {
  value: number;
  row: number;
  col: 1 | 2;
  winning: boolean;
  fullWidth: boolean;
}

function nodePlacements(values: number[], side: CardSide): NodePlacement[] {
  const max = Math.max(...values);
  return values.map((value, index) => {
    if (value === max) {
      return {
        value,
        row: side === "self" ? 1 : 1 + Math.ceil((values.length - 1) / 2),
        col: 1,
        winning: true,
        fullWidth: true,
      };
    }
    if (side === "self") {
      if (value === max - 1) {
        return { value, row: 2, col: 1, winning: false, fullWidth: false };
      }
      const pairIndex = max - 2 - value;
      return {
        value,
        row: 3 + Math.floor(pairIndex / 2),
        col: pairIndex % 2 === 0 ? 2 : 1,
        winning: false,
        fullWidth: false,
      };
    }
    return {
      value,
      row: Math.floor(index / 2) + 1,
      col: index % 2 === 0 ? 2 : 1,
      winning: false,
      fullWidth: false,
    };
  });
}

/** Simple rail polyline through the node centres (matches the original zig-zag). */
function ScoreRailConnectors({
  placements,
  rowCount,
  side,
  score,
}: {
  placements: NodePlacement[];
  rowCount: number;
  side: CardSide;
  score: number;
}) {
  const ordered = [...placements].sort((a, b) => {
    return a.row - b.row || b.col - a.col;
  });
  const points = ordered.map((node) => {
    const x = node.fullWidth ? 50 : node.col === 1 ? 25 : 75;
    const y = (node.row - 0.5) * 100;
    return `${x},${y}`;
  });
  const litPoints = ordered
    .map((node, index) => ({ node, point: points[index] }))
    .filter(({ node }) => node.value <= score)
    .map(({ point }) => point);
  const litColor = side === "self" ? "rgba(126,232,191,0.95)" : "rgba(255,196,110,0.95)";
  return (
    <svg
      aria-hidden="true"
      data-score-rail={side}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 100 ${rowCount * 100}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(136,180,211,0.4)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.12"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(136,180,211,0.4)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="2.4 4.2"
        opacity="0.78"
        vectorEffect="non-scaling-stroke"
      />
      {litPoints.length > 1 ? (
        <>
          <polyline
            points={litPoints.join(" ")}
            fill="none"
            stroke={litColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.22"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={litPoints.join(" ")}
            fill="none"
            stroke={litColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
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
  const placements = nodePlacements(values, side);
  const rowCount = Math.max(...placements.map((p) => p.row));
  const accent = side === "self" ? SELF_ACCENT : OPPONENT_ACCENT;
  const accentSoft = side === "self" ? SELF_ACCENT_SOFT : OPPONENT_ACCENT_SOFT;

  return (
    <div
      data-board-player-scores={side === "self" ? "true" : undefined}
      data-board-opponent-scores={side === "opponent" ? "true" : undefined}
      className={
        side === "self"
          ? "absolute left-(--track-edge-inset) bottom-(--track-player-bottom) z-12 grid w-(--score-track-rail-width) grid-cols-[var(--track-node-size)_var(--track-node-size)] auto-rows-(--track-row-size) place-items-center gap-x-(--score-track-column-gap) translate-x-(--track-player-nudge) border-none bg-transparent p-0 shadow-none"
          : "absolute top-(--track-opponent-score-top) right-(--track-edge-inset) left-auto z-12 grid w-(--score-track-rail-width) grid-cols-[var(--track-node-size)_var(--track-node-size)] auto-rows-(--track-row-size) place-items-center gap-x-(--score-track-column-gap) -translate-x-(--track-opponent-nudge) border-none bg-transparent p-0 shadow-none"
      }
      role="group"
      aria-label={side === "self" ? "Your score track" : "Opponent score track"}
    >
      <ScoreRailConnectors placements={placements} rowCount={rowCount} side={side} score={score} />
      {placements.map((node) => {
        const reached = score >= node.value;
        const active = score === node.value;
        const winning = node.value === winningValue;
        return (
          <div
            key={`${side}-score-${node.value}`}
            className={
              "relative z-1 grid place-items-center w-(--track-node-size)" +
              (node.fullWidth ? " w-full col-span-2 col-start-1 justify-self-stretch" : "") +
              (!node.fullWidth && node.col === 1 ? " col-start-1" : "") +
              (!node.fullWidth && node.col === 2 ? " col-start-2" : "") +
              (!node.fullWidth && side === "opponent" && node.value % 2 === 1 ? " translate-y-(--score-track-stagger-offset)" : "") +
              (!node.fullWidth && side === "self" && node.col === 2 ? " -translate-y-(--score-track-stagger-offset)" : "")
            }
            style={{ gridRowStart: node.row }}
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
              <span className="scoreTrackNodeLabel">{node.value}</span>
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
