/**
 * Demon Shade (RAD-102) — "[Hidden] Choose a friendly unit, then choose one – • Move it to an open
 * battlefield. • Give it [Ganking] this turn if there are no open battlefields." (170.11.c, 810)
 */
import { aUnit, custom, registerCardScript } from "../sdk";
import { zoneRef } from "./custom";

const OPEN_DESTINATION = custom("rad:zone-open", { ref: "destination" });

registerCardScript({
  name: "Demon Shade",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nChoose a friendly unit, then choose one –\n• Move it to an open battlefield.\n• Give it [Ganking] this turn if there are no open battlefields. (It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "move",
            label: "Move it to an open battlefield",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "requires",
                  condition: OPEN_DESTINATION,
                  rule: "355.4",
                  effect: {
                    op: "if",
                    condition: OPEN_DESTINATION,
                    then: {
                      op: "move",
                      target: aUnit({ controller: "self", targetRef: "target:0" }),
                      to: zoneRef("destination"),
                    },
                  },
                },
              ],
            },
          },
          {
            id: "ganking",
            label: "Give it [Ganking] this turn if there are no open battlefields",
            effect: {
              op: "if",
              condition: custom("rad:no-open-battlefield"),
              then: {
                op: "grant_keyword",
                keyword: "Ganking",
                target: aUnit({ controller: "self", targetRef: "target:0" }),
                duration: "this-turn",
              },
            },
          },
        ],
      },
    },
  ],
});
