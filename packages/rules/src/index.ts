/**
 * @rift/rules — strict Riftbound rules layer.
 *
 * Timing, priority/focus, chain (HOT FEPR), showdowns, cleanups, primitive game actions,
 * intents and the read-side view. Card-script coverage grows wave by wave; unscripted cards
 * fall back to the manual window (§6.4). Runtime deps: only @rift/protocol + @rift/cards.
 *
 * Public surface is split into per-domain barrels so wave R2 agents only ever edit their own:
 *   api/core    — shared state/timing/intents/view/registries
 *   api/play    — process of play, activated abilities, moves, pass/end-turn
 *   api/combat  — showdowns, combat, scoring
 *   api/effects — card scripts, effect ops, interpreter (also registers card scripts)
 */
export * from "./api/core";
export * from "./api/play";
export * from "./api/combat";
export * from "./api/effects";
