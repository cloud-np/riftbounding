/**
 * Card SDK (maintainability review F6/G4) — the one module card files import.
 *
 * A card file (`src/cards/<SET>/<slug>.ts`, `src/cards/tokens/<slug>.ts`) imports only from
 * this module, from its own set's `./custom` module, and types from `@rift/protocol`; the
 * import-boundary test (`test/registry/integrity.test.ts`) enforces it. Engine refactors then
 * change this facade, not hundreds of card files.
 *
 * Contents:
 * - registration: `registerCardScript`, `registerCustomCondition`, `registerCustomEffect`;
 * - script builders (`cards/lib/*`): selectors, triggers, conditions, passives, costs,
 *   keywords, tokens and the shared `core:` ids;
 * - the engine surface custom code may use (reads of the room, interpreter frames, primitives
 *   that emit their events). Add to this list deliberately: every export is an engine contract.
 */

/* ---------------------------------------------------------------- registration */
export { registerCardScript } from "./registry";
export { registerCustomCondition } from "../effects/evaluate";
export { registerCustomEffect } from "../effects/ops/control";

/* ---------------------------------------------------------------- script builders */
export * from "./lib/selectors";
export * from "./lib/triggers";
export * from "./lib/conditions";
export * from "./lib/passives";
export * from "./lib/costs";
export * from "./lib/keywords";
export * from "./lib/tokens";
export { IT_IN_COMBAT, LEGION, SELF_IN_COMBAT } from "./lib/custom";

/* ---------------------------------------------------------------- engine surface for custom code */
export type { RulesHost } from "../host";
export type { EvalContext } from "../effects/env";
export type { EffectExecutionContext } from "../effects/execute";
export { RESOLVED } from "../effects/execute";
export { idsOf, lkiOf } from "../effects/env";
export {
  compare,
  evaluateAmount,
  matchingIds,
  mightOf,
  opponentsOf,
  playersInTurnOrder,
  refIds,
  resolvePlayers,
  resolveSelector,
  resolveZoneNames,
  setXp,
  xpOf,
} from "../effects/evaluate";
export {
  attachmentsOf,
  battlefieldZoneOf,
  boardZoneList,
  controllerOf,
  costsOf,
  findChainItem,
  isBattlefieldZone,
  isBoardZone,
  isToken,
  isUnit,
  locate,
  locationOf,
  locationZones,
  ownerOf,
  tagsOf,
  typeOf,
} from "../effects/objects";
export { ctxOf, forgetObject, hostOf } from "../effects/ops/util";
export { evalContextOf, optionFor, recordOutcome, targets } from "../effects/targets";
export { effectiveKeywordValues, effectiveMight, keywordsAtDepth } from "../layers";
export { addContinuousEffect } from "../layers/mods";
export { restrictionFor } from "../layers/restrictions";
export { battlefieldController, controlsBattlefield } from "../actions/control";
export { movePrimitive } from "../actions/move";
export { channelRunes, drawCards } from "../actions/primitives";
export { cardDomains } from "../play/cost-model";
export { legionActive } from "../play/keyword-helpers";
export { canPayCost, payCost } from "../play/payment";
export { registerPlayPermission } from "../play/permissions";
export { playerWins } from "../scoring/concede";
export { teamOf } from "../scoring/teams";
export { hasUnitPresentAt, unitsPresentAt } from "../state/presence";
export { appendChainItem, removeChainItem } from "../timing/fepr/chain";
export { pushEvent } from "../types";
