import type { DieRoll } from "@rift/protocol";
import type { ActionHandler } from "../types";
import { num } from "./common";
import { logDraft } from "../log/entries";

const VALID_SIDES = new Set([4, 6, 8, 10, 12, 20]);

/** orig: 35qz5rkx7yexy.js:22720 "roll_die" */
export const rollDie: ActionHandler = ({ room, player, action, context }) => {
  const sides = num(action.sides);
  if (!VALID_SIDES.has(sides)) return;
  const roll: DieRoll = {
    id: context.idFactory("die"),
    playerId: player.id,
    sides: sides as DieRoll["sides"],
    result: Math.floor(context.rng() * sides) + 1,
    rolledAt: context.now,
  };
  const recent = room.recentDieRolls ?? (room.lastDieRoll ? [room.lastDieRoll] : []);
  room.lastDieRoll = roll;
  room.recentDieRolls = [
    ...recent.filter((entry) => entry.rolledAt > roll.rolledAt - 5000).slice(-15),
    roll,
  ];
  context.log(
    logDraft("rolledDie", { sides, result: roll.result }, {
      authorPlayerId: player.id,
      actionKind: "board",
      at: context.now,
    }),
  );
};
