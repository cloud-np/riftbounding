/** Yeti Brawler. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Yeti Brawler",
  text: 'When I conquer, if you assigned 3 or more excess damage, play two Gold gear tokens exhausted.\n(They have "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "manual",
  notes:
    "Not automated: excess damage assigned in combat is not recorded (467.2.c.4), so the conquer trigger's condition cannot be checked; it opens the manual window on every conquer. The catalog's [Reaction]/[Add] are the Gold token's reminder text (suppressed).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "custom", id: "manual" },
    },
  ],
});
