/** Blue Sentinel. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";

registerCardScript({
  name: "Blue Sentinel",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\nYour hold effects for holding here trigger an additional time.\nWhen I hold, [Add] [Rune] at the start of your next Main Phase. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "'Your hold effects for holding here trigger an additional time' is not automated: the trigger detector has no way to make triggers fire an additional time (383.1.b, 383.4.d); only my own delayed Add is.",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "phase", phase: "main" },
        effect: { op: "add", resources: { power: { any: 1 } } },
        duration: "this-turn",
      },
    },
  ],
});
