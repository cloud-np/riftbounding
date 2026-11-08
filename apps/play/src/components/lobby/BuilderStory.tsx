"use client";

import { useState } from "react";

import { strings } from "./strings";
import { Icon } from "@/components/ui/Icon";

export interface BuilderStoryProps {
  onSupport?: () => void;
}

function MemberMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`riftatlas-mark ${className ?? ""}`}
      style={{
        ["--riftatlas-mark-light" as string]:
          "url(/riftbound/static/membership/rift-atlas-membership-layers.webp)",
        ["--riftatlas-mark-dark" as string]:
          "url(/riftbound/static/membership/rift-atlas-membership-layers-dark.webp)",
      }}
    >
      <span className="riftatlas-mark-crest" />
      <span className="riftatlas-mark-glow" />
      <span className="riftatlas-mark-star" />
    </span>
  );
}

export function BuilderStory({ onSupport }: BuilderStoryProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <aside
      aria-label={strings["builder.aria"]}
      data-testid="builder-story-announcement"
      className="flex min-h-11 items-center gap-2 border border-[rgba(109,223,255,0.24)] bg-[linear-gradient(90deg,rgba(12,35,48,0.88),rgba(10,24,40,0.78))] px-2.5 py-1.5 text-[#d8eef5] shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-1.5">
        <a
          className="group inline-flex min-h-9 min-w-0 basis-full items-center justify-center gap-1.5 rounded-[0.42rem] text-center text-[0.82rem] sm:basis-auto text-[#c4d7e6] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(109,223,255,0.48)]"
          href="https://how-i-build.riftatlas.com"
          rel="noreferrer"
          target="_blank"
        >
          <span className="font-semibold text-[#f0f8fc]">
            <span className="sm:hidden">{strings["builder.titleShort"]}</span>
            <span className="hidden sm:inline">{strings["builder.title"]}</span>
          </span>
          <span aria-hidden="true" className="hidden text-[#7693a8] sm:inline">
            —
          </span>
          <span className="font-medium text-[#79ddf5]">{strings["builder.read"]}</span>
          <Icon name="arrow-up-right" className="h-3.5 w-3.5 shrink-0" />
        </a>
        <span aria-hidden="true" className="hidden shrink-0 text-[#4d6577] sm:inline">
          ·
        </span>
        <button
          className="group inline-flex min-h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-[0.42rem] text-center text-[0.82rem] font-medium text-[#ffe7b7] sm:shrink-0 transition-colors hover:text-[#fff6e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,231,183,0.55)]"
          type="button"
          onClick={onSupport}
        >
          <MemberMark className="h-4" />
          <span className="min-w-0">
            <span className="sm:hidden">{strings["builder.supportShort"]}</span>
            <span className="hidden sm:inline">{strings["builder.support"]}</span>
          </span>
          <Icon name="heart" className="h-3.5 w-3.5 shrink-0 fill-current" />
        </button>
      </span>
      <button
        aria-label={strings["builder.dismiss"]}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.42rem] text-[#8eabbf] transition-[background-color,color] hover:bg-[rgba(255,255,255,0.07)] hover:text-[#eefaff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(109,223,255,0.42)]"
        type="button"
        onClick={() => setDismissed(true)}
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </aside>
  );
}
