/**
 * Card-script entry barrel — §6.1.
 *
 * Imported once for side-effect registration from `src/api/effects.ts`, so production rooms see
 * the scripts (not only tests). Layout and conventions: docs/rules/CARD-AUTHORING.md — one card
 * per file in `src/cards/<SET>/<slug>.ts`, imported by the set barrel `<SET>/index.ts`; a set's
 * custom ids and shared builders in `<SET>/custom.ts`; shared builders and `core:` ids in
 * `lib/`, reached through `sdk.ts`.
 */
// Shared core: custom conditions/effects (cards/lib) register before the sets that use them.
import "./lib/custom";
import "./OGN";
import "./SFD";
import "./UNL";
import "./RAD";
import "./VEN";
import "./OGS";
import "./ARC";
import "./SGN";
import "./tokens";

export {};
