/** Mirror Image. */
import { aUnit, registerCardScript, token } from "../sdk";

const REFLECTION = { exhausted: false, play: true, keywords: ["Temporary" as const] };

registerCardScript({
  name: "Mirror Image",
  text: "Choose a unit. Play a ready Reflection unit token to your base. Then do this: It becomes a copy of that unit. Give it [Temporary]. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "partial",
  notes:
    "The chosen unit and the ready Reflection token are automated. 'It becomes a copy of that unit' is missing: copy effects (446) are not implemented.",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // Bind the printed "Choose a unit" target; the copy instruction that would use it is
          // not implemented (446). A 0 Might change is a no-op.
          { op: "temporary_might", amount: 0, target: aUnit() },
          { op: "create", token: token("Reflection", REFLECTION), zone: "base" },
        ],
      },
    },
  ],
});
