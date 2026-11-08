/**
 * Play-domain public surface — process of play, costs/targets, activated abilities, moves,
 * pass/end-turn and prompt answers. Wave R2-play adds here.
 */
export { activatableAbilities, activationVerdict } from "../legality/activate";
export type { ActivatedAbility, ActivationVerdict } from "../legality/activate";
export { playCardVerdict, playLocationVerdict } from "../legality/play";
export type { PlayCardVerdict } from "../legality/play";
export { moveTimingVerdict } from "../legality/move";
export type { MoveVerdictContext } from "../legality/move";
export { passVerdict } from "../legality/pass";
export { endTurnVerdict } from "../legality/end-turn";
export { chooseVerdict } from "../legality/choose";
export type { ChooseVerdict } from "../legality/choose";
export { manualDoneVerdict } from "../legality/manual";
export { canPayCost, payCost } from "../play/payment";
