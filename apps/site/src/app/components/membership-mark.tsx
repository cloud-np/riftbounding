import type { CSSProperties } from "react";

const MEMBERSHIP_MARK_STYLE = {
  "--riftatlas-mark-light": "url(/membership/rift-atlas-membership-layers.webp?v=2c63b42b11aec410)",
  "--riftatlas-mark-dark":
    "url(/membership/rift-atlas-membership-layers-dark.webp?v=09b18d188b44b593)",
} as CSSProperties;

/** Layered Rift Atlas membership mark (crest + glow + star), as on the original site chrome. */
export function MembershipMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-membership-mark="true"
      className={`riftatlas-mark ${className ?? ""}`}
      style={MEMBERSHIP_MARK_STYLE}
    >
      <span className="riftatlas-mark-crest" />
      <span className="riftatlas-mark-glow" />
      <span className="riftatlas-mark-star" />
    </span>
  );
}
