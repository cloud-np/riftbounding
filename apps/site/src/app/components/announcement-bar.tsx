"use client";

import { useEffect, useState } from "react";

import { ArrowUpRightIcon, HeartIcon, XIcon } from "./icons";
import { MembershipMark } from "./membership-mark";

const DISMISSAL_KEY = "riftatlas:announcement-dismissal:v1";
const DISMISSAL_COOKIE = "riftatlas_announcement_dismissal_v1";
const DISMISSAL_VALUE = "how-i-build-riftatlas-2026-09-metafy";

function readDismissed(): boolean {
  try {
    const stored = window.localStorage.getItem(DISMISSAL_KEY);
    if (stored) return true;
    return document.cookie.split("; ").some((entry) => entry.startsWith(`${DISMISSAL_COOKIE}=`));
  } catch {
    return false;
  }
}

export function BuilderStoryAnnouncement() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (readDismissed()) setDismissed(true);
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    const value = `${DISMISSAL_VALUE}|${Date.now()}`;
    try {
      window.localStorage.setItem(DISMISSAL_KEY, value);
      document.cookie = `${DISMISSAL_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* ignore unavailable storage */
    }
  };

  return (
    <aside
      aria-label="RiftAtlas builder story"
      className="border-b border-border/55 bg-secondary/[0.14] backdrop-blur-xl supports-[backdrop-filter]:bg-secondary/[0.11]"
      data-announcement=""
      data-site-chrome="true"
      data-testid="builder-story-announcement"
    >
      <div className="page-shell flex min-h-11 items-center gap-2 py-1.5">
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-1.5">
          <a
            className="group inline-flex min-h-9 min-w-0 basis-full items-center justify-center gap-1.5 rounded-md text-center text-sm text-foreground/76 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:basis-auto"
            href="https://how-i-build.riftatlas.com"
            rel="noreferrer"
            target="_blank"
          >
            <span className="font-semibold text-foreground/92">
              <span className="sm:hidden">Six months of RiftAtlas</span>
              <span className="hidden sm:inline">Six months of building RiftAtlas</span>
            </span>
            <span aria-hidden="true" className="hidden text-foreground/34 sm:inline">
              —
            </span>
            <span className="font-medium text-primary">Read the story</span>
            <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </a>
          <span aria-hidden="true" className="hidden shrink-0 text-foreground/34 sm:inline">
            ·
          </span>
          <button
            className="group inline-flex min-h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-md text-center text-sm font-medium text-foreground/76 sm:shrink-0 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            type="button"
          >
            <MembershipMark className="h-4" />
            <span className="min-w-0">
              <span className="sm:hidden">Support us</span>
              <span className="hidden sm:inline">Consider supporting us</span>
            </span>
            <HeartIcon className="h-3.5 w-3.5 shrink-0 fill-current" />
          </button>
        </span>
        <button
          aria-label="Dismiss builder story announcement"
          onClick={dismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color] hover:bg-secondary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          type="button"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
