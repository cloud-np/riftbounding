/**
 * Whirlwind (OGN-187) — "Starting with the next player, each player may return a unit to its owner's
 * hand."
 *
 * Registers `ogn:each-player-may-return`: in Turn Order starting with the player after the
 * controller (303.2.a), each player in turn picks up to one unit on the board (a decision made on
 * resolution, 355.18) and it returns to its owner's hand (056) before the next player decides.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Whirlwind",
  text: "Starting with the next player, each player may return a unit to its owner's hand.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "custom", id: "ogn:each-player-may-return" } }],
});
