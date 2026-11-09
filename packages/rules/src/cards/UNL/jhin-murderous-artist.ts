/**
 * Jhin, Murderous Artist (UNL-022) — [Deflect], [Ganking] (engine keywords). "When I move, [Add]
 * [1][Rune]." (430.5: 1 Energy and 1 Power of any Domain.) The catalog's [Add] is the ability's
 * tag, not a keyword (suppressed).
 */
import { registerCardScript } from "../registry";
import { WHEN_I_MOVE } from "../dsl";

registerCardScript({
  name: "Jhin, Murderous Artist",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Ganking] (I can move from battlefield to battlefield.)\nWhen I move, [Add] [1][Rune]. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "The Add trigger goes on the chain like any triggered ability and can be responded to; triggered Add abilities must finalize and resolve immediately without passing Priority (430.2, 430.2.a).",
  abilities: [
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: { op: "add", resources: { energy: 1, power: { any: 1 } } },
    },
  ],
});
