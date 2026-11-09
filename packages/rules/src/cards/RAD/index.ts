/**
 * Radiance (RAD) card scripts. Each module calls `registerCardScript`.
 */
import "./blade-of-the-exile";
import "./reckless-innovator";
import "./riven-the-exile";
import "./riven-broken-blade";
import "./clanging-sentry";
// Wave R3 (lane RAD): card-specific conditions/effects first, then the scripts.
import "./custom";
import "./simple-units";
import "./spells";
import "./gear";
import "./units";
import "./battlefields";
import "./bombs-and-more";
import "./batch6";
// Radiance Bomb gear token (RAD-T02): Deploy 830 and its Deathknell.
import "../tokens/bomb";
// Wave R4 (lane RAD): Show Off/Flow/damage-split upgrades and the remaining cards.
import "./r4-units";
import "./r4-spells";
import "./r4-battlefields";
import "./r4-manual";

export {};
