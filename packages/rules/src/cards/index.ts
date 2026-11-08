/**
 * Card-script entry barrel — §6.1.
 *
 * Imported once for side-effect registration from `src/api/effects.ts`, so production rooms see
 * the scripts (not only tests). Add new scripts in `src/cards/<setCode>/<slug>.ts` and import
 * them from the set barrel below.
 */
import "./OGN";
import "./SFD";
import "./UNL";
import "./RAD";
import "./VEN";
import "./OGS";
import "./ARC";
import "./SGN";
import "./tokens/gold";

export {};
