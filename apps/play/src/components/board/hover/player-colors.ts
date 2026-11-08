/**
 * Per-player colours — verbatim `eP` / `eS` from the board chunk
 * (`0xawjzm3yjpr1.js`, spec §7).
 */
export const PLAYER_COLOR_KEYS = ["p1", "p2", "p3", "p4"] as const;
export type PlayerColorKey = (typeof PLAYER_COLOR_KEYS)[number];

export interface PlayerColors {
  solid: string;
  border: string;
  glow: string;
  surface: string;
  text: string;
}

export const PLAYER_COLORS: Record<PlayerColorKey, PlayerColors> = {
  p1: { solid: "#69c8e6", border: "rgba(105,200,230,0.68)", glow: "rgba(105,200,230,0.14)", surface: "rgba(105,200,230,0.1)", text: "#cef4ff" },
  p2: { solid: "#de7c77", border: "rgba(222,124,119,0.68)", glow: "rgba(222,124,119,0.14)", surface: "rgba(222,124,119,0.1)", text: "#ffe0dd" },
  p3: { solid: "#d7b260", border: "rgba(215,178,96,0.68)", glow: "rgba(215,178,96,0.14)", surface: "rgba(215,178,96,0.1)", text: "#ffedc9" },
  p4: { solid: "#a995e8", border: "rgba(169,149,232,0.68)", glow: "rgba(169,149,232,0.14)", surface: "rgba(169,149,232,0.1)", text: "#e9e1ff" },
};

export function playerColorKeyFor(index: number): PlayerColorKey {
  const safe = Math.max(0, Math.trunc(index)) % 4;
  return PLAYER_COLOR_KEYS[safe] ?? "p1";
}

export function playerColorFor(index: number): PlayerColors {
  return PLAYER_COLORS[playerColorKeyFor(index)];
}
