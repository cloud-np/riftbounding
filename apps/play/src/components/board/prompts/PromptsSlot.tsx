"use client";

import type { BoardSlotProps } from "../slot-types";
import { InGamePrompts } from "./ingame/InGamePrompts";
import { SetupOverlays } from "./setup/SetupOverlays";

/**
 * Prompt surface: setup flow overlays (battlefield pick, initiative dice,
 * first-player choice, mulligan, BO3 sideboarding) and the in-game
 * conquer/showdown, payment, dice, deck-peek and clock prompts.
 */
export function PromptsSlot(props: BoardSlotProps) {
  return (
    <>
      <SetupOverlays {...props} />
      <InGamePrompts {...props} />
    </>
  );
}
