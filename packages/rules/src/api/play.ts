/**
 * Play-domain public surface — process of play, costs/targets, activated abilities, moves,
 * pass/end-turn and prompt answers. Wave R2-play adds here.
 */
export { activatableAbilities, activationVerdict, activateIntentVerdict } from "../legality/activate";
export type { ActivatedAbility, ActivationVerdict, ActivationVerdictOk } from "../legality/activate";
export { playCardVerdict, playIntentVerdict, playLocationVerdict } from "../legality/play";
export type { PlayCardVerdict, PlayCardVerdictOk, PlayIntentVerdict } from "../legality/play";
export { moveTimingVerdict } from "../legality/move";
export type { MoveVerdictContext } from "../legality/move";
export { passVerdict } from "../legality/pass";
export { endTurnVerdict } from "../legality/end-turn";
export { chooseVerdict } from "../legality/choose";
export type { ChooseVerdict } from "../legality/choose";
export { manualDoneVerdict } from "../legality/manual";

// 165/356/357 payment (the `pay` op contract) and helpers.
export { canPayCost, payCost, planPayment, applyPayment, costObjectChoice, poolTotal } from "../play/payment";
export type { PaymentPlan, PaymentContext, PaymentPlanResult } from "../play/payment";
export {
  POWER_DOMAINS,
  printedCardCost,
  resolveCost,
  applyCostDeltas,
  addCosts,
  isFreeCost,
  costSummary,
  ADDITIONAL_COST_KEYS,
} from "../play/cost-model";
export type { PowerRequirement, ResolvedCost, ObjectCostRequirement, PowerDomain } from "../play/cost-model";
export { planResources, validateResources } from "../play/planner";
export type { ResourcePlan } from "../play/planner";
export { paymentSources, runeSources } from "../play/sources";
export type { PaymentSources, RuneSource } from "../play/sources";
export { parseCostText, parseCostAlternatives, parseActivatedLine, parseEquipCosts, parseRepeatCosts, parseAdditionalCosts } from "../play/cost-text";

// 349–359 process of play / 399–407 activation.
export { planCardPlay, executeCardPlay, cancelPendingItem, continuePendingItem } from "../play/process";
export type { CardPlayPlan, LimitedPlay } from "../play/process";
export { planActivation, executeActivation, DEFAULT_ABILITY_REF } from "../play/activation";
export type { ActivationPlan } from "../play/activation";
export { planCore } from "../play/core";
export type { CoreInput, CorePlan } from "../play/core";
export { activatedAbilitiesOf, findActivatedAbility } from "../play/abilities";
export type { ActivatedAbilityInfo } from "../play/abilities";
export { requestFromIntent } from "../play/request";
export type { PlayRequest } from "../play/request";

// 356.2 additional costs, 354 play permissions, 355.2 locations, 190 control proxy.
export { registerAdditionalCosts, registerAdditionalCostProvider, additionalCostsFor } from "../play/additional-costs";
export type { AdditionalCostSpec, AdditionalCostQuery, AdditionalCostProvider } from "../play/additional-costs";
export { registerPlayPermission, playPermission } from "../play/permissions";
export type { PlayPermission, PlayPermissionProvider } from "../play/permissions";
export { playLocations, chooseLocation } from "../play/locations";
export type { LocationOption } from "../play/locations";
export { controlsBattlefield, facedownCardAt, playersWithUnitsAt } from "../play/control";

// Keywords (806/813/811/812/819/821/822/830) and Hide (422).
export { printedCardKeywords, parseCardKeywords, cardKeywords, hasKeyword, keywordValue } from "../play/keywords";
export { legionActive, recordFinalizedCard, weaponmasterEquipCosts } from "../play/keyword-helpers";
export { planHide, executeHide, hideLocations, HIDE_COST } from "../play/hidden";

// 411.2 play prompts.
export { PLAY_PROMPT_REASONS } from "../prompts/play/reasons";
