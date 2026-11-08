/**
 * @rift/protocol — public surface.
 *
 * The three modules are copied verbatim from `.recon/specs/types/` (recon-derived mirrors of
 * the Rift Atlas client bundles). Treat them as generated: update from recon, do not hand-edit.
 *
 *  - `game-state.ts`  room / player / board / card-instance state shapes
 *  - `actions.ts`     the client→server action union (~99 wire action types)
 *  - `messages.ts`    realtime websocket framing + room HTTP API shapes
 */
export * from "./game-state";
export * from "./actions";
export * from "./rules-state";
export * from "./messages";
