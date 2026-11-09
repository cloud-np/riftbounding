/**
 * Unleashed units with [Level N] Dependent Keyword abilities (824, 727.1.b): each is a
 * `conditional` passive that is Inactive until you have N+ XP (824.1.b.1, `xp-at-least`).
 * Keywords that only appear inside a Level ability are suppressed from the catalog list
 * (`value: 0`) so they apply only while the ability is active. [Hunt N] is the engine keyword (823).
 */
import type { Modifier } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";
import { ENTER_READY_MODIFIER, atLevel } from "../lib/passives";

const enterReady = ENTER_READY_MODIFIER;

registerCardScript({
  name: "Gemhand Hunter",
  text: "[Hunt] (When i conquer or hold, gain 1 XP.)\n[Level 6] I have +1 [might] . (While you have 6+ XP, get the effect.)",
  status: "implemented",
  abilities: [atLevel(6, { kind: "might", amount: 1, target: SELF })],
});

registerCardScript({
  name: "Targonian Visionary",
  text: "[Level 11] I have +4[Might]. (While you have 11+ XP, get this effect.)",
  status: "implemented",
  abilities: [atLevel(11, { kind: "might", amount: 4, target: SELF })],
});

registerCardScript({
  name: "Mosstomper",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 3] I have +1[Might] and [Deflect]. (While you have 3+ XP, get the effect. Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    atLevel(3, { kind: "might", amount: 1, target: SELF }),
    atLevel(3, { kind: "keyword", keyword: "Deflect", target: SELF }),
  ],
});

registerCardScript({
  name: "Master Yi, Tempered",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 6] I have [Deflect] and [Ganking]. (While you have 6+ XP, opponents must pay [Rune] to choose me with a spell or ability and I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    atLevel(6, { kind: "keyword", keyword: "Deflect", target: SELF }),
    atLevel(6, { kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});

registerCardScript({
  name: "Scorchclaw",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 3] I have +1 [Might] and enter ready. (While you have 3+ XP, get the effect.)",
  status: "implemented",
  // "Enter ready" is a replacement on entering (369.3) checked as I am played.
  abilities: [atLevel(3, { kind: "might", amount: 1, target: SELF }), atLevel(3, enterReady)],
});

registerCardScript({
  name: "Bandle Soldier",
  text: "[Level 3] I enter ready. (While you have 3+ XP, get the effect.)",
  status: "implemented",
  abilities: [atLevel(3, enterReady)],
});
