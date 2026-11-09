/**
 * Reckoner's Arena (OGN-286, battlefield) — "When you hold this, activate the conquer abilities of
 * units here."
 *
 * Manual: "activate the conquer abilities" makes other objects' conquer-triggered abilities
 * trigger without a conquer event; the trigger layer has no way to fire another object's printed
 * triggered abilities on demand.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Reckoner's Arena",
  text: "When you hold this, activate the conquer abilities of units here.",
  status: "manual",
  notes:
    "Activating other objects' conquer-triggered abilities without a conquer (383.4.c) is not supported by the trigger layer.",
  abilities: [],
});
