/** Aphelios, Exalted. */
import type { Effect } from "@rift/protocol";
import { custom, not, registerCardScript } from "../sdk";
import { target } from "./custom";

/** A mode usable once per turn per source (marks, like Riven, Broken Blade). */
function onceMode(key: string, id: string, label: string, effect: Effect) {
  return {
    id,
    label,
    effect: {
      op: "requires" as const,
      condition: not({ kind: "marked", key, value: id }),
      effect: { op: "seq" as const, effects: [{ op: "mark" as const, key, value: id }, effect] },
    },
  };
}

registerCardScript({
  name: "Aphelios, Exalted",
  text: "When you attach an Equipment to me, choose one that hasn't been chosen this turn —\n- Ready 2 runes.\n- Channel 1 rune exhausted.\n- Buff a friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attach", player: "self", condition: custom("sfd:attached-to-self") },
      },
      effect: {
        op: "choose_mode",
        modes: [
          onceMode("aphelios:{self}", "ready", "Ready 2 runes", {
            op: "seq",
            effects: [
              {
                op: "choose",
                key: "runes",
                selector: {
                  cardType: "rune",
                  controller: "self",
                  zone: "runeArea",
                  exhausted: true,
                },
                min: 2,
                max: 2,
              },
              { op: "ready", target: { targetRef: "runes" } },
            ],
          }),
          onceMode("aphelios:{self}", "channel", "Channel 1 rune exhausted", {
            op: "channel",
            amount: 1,
            exhausted: true,
          }),
          onceMode("aphelios:{self}", "buff", "Buff a friendly unit", {
            op: "buff",
            target: target({ controller: "self" }),
          }),
        ],
      },
    },
  ],
});
