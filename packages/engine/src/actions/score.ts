import type { ActionHandler } from "../types";
import {
  clampPositive,
  clampScore,
  entityScore,
  setEntityScore,
} from "../state/selectors";
import { logDraft } from "../log/entries";
import { int } from "./common";

function clearOrKeepConcessionOutcome(room: Parameters<typeof entityScore>[0]): void {
  const outcome = room.gameOutcome;
  if (!outcome) return;
  const keep =
    outcome.reason === "concession" ||
    room.players.every(
      (player) => outcome.winnerPlayerIds.includes(player.id) || typeof player.leftAt === "number",
    );
  if (!keep) room.gameOutcome = undefined;
}

/** orig: 35qz5rkx7yexy.js:22758 "set_score" */
export const setScore: ActionHandler = ({ room, player, action, context }) => {
  const previous = entityScore(room, player.id);
  const next = clampScore(room, int(action.score));
  if (previous === next) return;
  setEntityScore(room, player.id, next);
  clearOrKeepConcessionOutcome(room);
  context.log(
    logDraft("setScore", { score: next, delta: next - previous }, {
      authorPlayerId: player.id,
      actionKind: "score",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22764 "adjust_score" */
export const adjustScore: ActionHandler = ({ room, player, action, context }) => {
  const previous = entityScore(room, player.id);
  const next = clampScore(room, previous + int(action.delta));
  if (previous === next) return;
  setEntityScore(room, player.id, next);
  clearOrKeepConcessionOutcome(room);
  context.log(
    logDraft("adjustedScore", { score: next }, {
      authorPlayerId: player.id,
      actionKind: "score",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22807 "adjust_legend_xp" */
export const adjustLegendXp: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const current =
    typeof board.legendXp === "number" && Number.isFinite(board.legendXp)
      ? Math.max(0, Math.min(99, Math.trunc(board.legendXp)))
      : 0;
  const next = clampPositive(current + int(action.delta));
  if (current === next) return;
  room.players[playerIndex]!.board = { ...board, legendXp: next };
  const delta = next - current;
  context.log(
    logDraft("changedXp", {
      direction: delta > 0 ? "Increased" : "Decreased",
      xp: next,
      delta: `${delta > 0 ? "+" : ""}${delta}`,
    }, { authorPlayerId: room.players[playerIndex]?.id, actionKind: "legend-xp", at: context.now }),
  );
};
