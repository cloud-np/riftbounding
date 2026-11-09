/**
 * Card-specific conditions for the Proving Grounds (OGS) scripts (wave R3, ven-ogs lane).
 * Builders are shared with Vendetta (`../VEN/shared`).
 */
import { registerCustomCondition } from "../sdk";

/** 323.2 / 466: the candidate (`it`) has the Defender designation in the combat in progress. */
registerCustomCondition("ogs:is-defender", (ctx) => {
  const id = ctx.env.it;
  if (!id || !ctx.room.rules?.combat) return false;
  return ctx.room.rules.objects[id]?.designation === "defender";
});

export {};
