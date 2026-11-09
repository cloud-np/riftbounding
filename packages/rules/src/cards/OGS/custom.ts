/**
 * OGS set module: the set's custom conditions/effects (`ogs:` ids) and the builders its
 * cards share. Imported first by the set barrel.
 */
import { registerCustomCondition } from "../sdk";

/** 323.2 / 466: the candidate (`it`) has the Defender designation in the combat in progress. */
registerCustomCondition("ogs:is-defender", (ctx) => {
  const id = ctx.env.it;
  if (!id || !ctx.room.rules?.combat) return false;
  return ctx.room.rules.objects[id]?.designation === "defender";
});
