"use client";

import type { BoardSlotProps } from "../slot-types";
import { OverlaysLayer } from "../overlays/OverlaysLayer";

/** Transient overlays: flights, bursts, rewind clock, time-warp sweep, dice results, outcome. */
export function OverlaysSlot(props: BoardSlotProps) {
  return <OverlaysLayer {...props} />;
}
