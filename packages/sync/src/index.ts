/**
 * @rift/sync — wire-level helpers shared by the realtime server and the web client.
 *
 *  - `messages`  exact client-compatible message parser/validators + envelope helpers
 *  - `patch`     runtime patch applier (port of `1w8d13szpogkp.js`) + rune invariants
 *  - `diff`      runtime state → patch operations for the patch applier
 *  - `redact`    per-viewer snapshot redaction (hidden hands / deck order / face-down cards / peeks)
 */

export * from "./messages";
export * from "./patch";
export * from "./diff";
export * from "./redact";
