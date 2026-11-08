"use client";

import { useState } from "react";

import { BuilderIcon } from "./BuilderIcon";
import { T } from "./strings";

export interface BuilderHeaderProps {
  signedIn: boolean;
  accountName?: string | null;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
}

const NAV = [
  { label: "Cards", href: "https://riftatlas.com/cards" },
  { label: "Decks", href: "/decks/new", active: true },
  { label: "Events", href: "https://riftatlas.com/events" },
  { label: "Sealed", href: "https://riftatlas.com/sealed" },
  { label: "Play", href: "https://play.riftatlas.com" },
] as const;

function HeaderSearch({ compact = false }: { compact?: boolean }) {
  return (
    <form
      action="https://riftatlas.com/search"
      method="get"
      className={compact ? "relative min-w-0 flex-1" : "relative w-[clamp(12rem,26vw,26rem)]"}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const q = String(data.get("q") ?? "").trim();
        window.location.assign(`https://riftatlas.com/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <BuilderIcon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        name="q"
        aria-label="Search cards"
        placeholder="Search cards..."
        className="h-8 w-full rounded-md border border-border/80 bg-white pl-9 pr-16 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
      />
      {compact ? null : (
        <span className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border/80 bg-secondary px-1 py-0.5 font-mono text-[9px]">
            Ctrl K
          </kbd>
        </span>
      )}
    </form>
  );
}

export function BuilderHeader({
  signedIn,
  accountName,
  onSignIn,
  onSignUp,
  onSignOut,
}: BuilderHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(true);

  return (
    <header className="sticky top-0 z-[60] border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[55px] w-full max-w-none items-center gap-3 px-3 lg:px-4">
        <a href="/decks/new" aria-label="Rift Atlas" className="inline-flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/riftbound/static/brand/rift-atlas/rift-atlas-lockup-black.webp"
            alt="Rift Atlas"
            className="db-header-logo-desktop h-9 w-auto"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/riftbound/static/brand/rift-atlas/rift-atlas-mark-black.webp"
            alt="Rift Atlas"
            className="db-header-logo-mobile h-7 w-auto"
          />
        </a>

        <div className="db-header-desktop min-w-0 items-center gap-2">
          <HeaderSearch />
          <a
            href="https://riftatlas.com/search"
            className="inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-foreground/75 hover:bg-secondary"
          >
            Advanced
          </a>
        </div>
        <div className="db-header-mobile min-w-0 flex-1">
          <HeaderSearch compact />
        </div>

        <nav aria-label="Primary" className="db-header-desktop items-center gap-0.5">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`inline-flex h-9 items-center gap-1.5 border-b-2 px-2 text-[13px] font-medium transition-colors ${
                "active" in item && item.active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground/75 hover:text-foreground"
              }`}
            >
              {item.label === "Cards" ? <BuilderIcon name="list" className="h-4 w-4" /> : null}
              {item.label === "Decks" ? <BuilderIcon name="list" className="h-4 w-4" /> : null}
              {item.label === "Events" ? <BuilderIcon name="bookmark" className="h-4 w-4" /> : null}
              {item.label === "Sealed" ? <BuilderIcon name="lock" className="h-4 w-4" /> : null}
              {item.label === "Play" ? <BuilderIcon name="play" className="h-3.5 w-3.5" /> : null}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <a
            aria-label="Contact"
            href="mailto:hello@riftatlas.com"
            className="db-header-wide h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="mail" className="h-4 w-4" />
          </a>
          <a
            aria-label="Discord"
            href="https://discord.gg/riftatlas"
            target="_blank"
            rel="noopener noreferrer"
            className="db-header-wide h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="discord" className="h-4 w-4" />
          </a>
          <a
            aria-label="X"
            href="https://x.com/riftatlas"
            target="_blank"
            rel="noopener noreferrer"
            className="db-header-wide h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="x" className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            aria-label="Theme"
            title="Theme"
            className="db-header-wide h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <span className="size-4 rounded-full border border-foreground/70" />
          </button>
          <div className="db-header-wide items-center gap-1 rounded px-1.5 text-xs font-medium text-foreground/70">
            <BuilderIcon name="globe" className="h-3.5 w-3.5" />
            EN
            <BuilderIcon name="chevron-down" className="h-3 w-3" />
          </div>
          <a
            href="https://riftatlas.com/membership"
            className="db-header-wide h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground/75 hover:bg-secondary hover:text-foreground"
          >
            <span className="inline-flex size-4 items-center justify-center rounded-full border border-foreground/40">
              <BuilderIcon name="help" className="h-2.5 w-2.5" />
            </span>
            Membership
          </a>
          <button
            type="button"
            aria-label="Notifications"
            className="db-header-wide h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="bell" className="h-4 w-4" />
          </button>

          {signedIn ? (
            <div className="relative">
              <button
                type="button"
                data-testid="deckbuilder-account"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((current) => !current)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <BuilderIcon name="user" className="h-4 w-4" />
                <span className="max-w-28 truncate">{accountName ?? "Account"}</span>
                <BuilderIcon name="chevron-down" className="h-3 w-3" />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-44 rounded-md border border-border/70 bg-popover p-1 shadow-[0_16px_40px_rgba(9,10,19,0.2)]"
                >
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-semibold text-foreground">{accountName}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground/80 hover:bg-secondary"
                  >
                    <BuilderIcon name="user" className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <a
                href="#sign-in"
                onClick={(event) => {
                  event.preventDefault();
                  onSignIn();
                }}
                className="db-header-desktop h-8 items-center px-2 text-xs font-medium text-foreground/80 hover:text-foreground"
              >
                Sign in
              </a>
              <a
                href="#sign-up"
                onClick={(event) => {
                  event.preventDefault();
                  onSignUp();
                }}
                className="db-header-desktop h-8 items-center rounded-md bg-[#0a84ff] px-3 text-xs font-semibold text-white hover:bg-[#0074e0]"
              >
                Sign up
              </a>
              <button
                type="button"
                aria-label="Sign in"
                onClick={onSignIn}
                className="db-header-mobile h-8 w-8 items-center justify-center rounded border border-border/70 text-foreground/75"
              >
                <BuilderIcon name="user" className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
            className="db-header-mobile h-8 w-8 items-center justify-center rounded border border-border/70 text-foreground/75"
          >
            <BuilderIcon name={mobileOpen ? "close" : "menu"} className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Utility menu"
            className="db-header-desktop h-8 w-8 items-center justify-center rounded text-foreground/65 hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="menu" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="db-mobile-nav border-t border-border/60 bg-background px-4 py-3">
          <nav aria-label="Mobile" className="grid gap-1">
            {NAV.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded px-2 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            {signedIn ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onSignOut();
                }}
                className="rounded px-2 py-2 text-left text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
              >
                Sign out
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onSignIn();
                  }}
                  className="rounded px-2 py-2 text-left text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onSignUp();
                  }}
                  className="rounded px-2 py-2 text-left text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
                >
                  Sign up
                </button>
              </>
            )}
          </nav>
        </div>
      ) : null}

      {promoOpen ? (
        <div className="relative flex min-h-10 items-center justify-center gap-2 border-t border-border/50 bg-background/95 px-8 text-center text-[12px] text-foreground/75">
          <span className="font-semibold text-foreground">Six months of building RiftAtlas</span>
          <span className="text-muted-foreground">—</span>
          <a
            href="https://riftatlas.com/blog/six-months"
            className="font-medium text-[#0073d2] hover:underline"
          >
            Read the story <span aria-hidden="true">↗</span>
          </a>
          <span className="db-summary-desktop text-muted-foreground">·</span>
          <a
            href="https://riftatlas.com/support"
            className="db-promo-support items-center gap-1 text-foreground/75 hover:text-foreground"
          >
            <span aria-hidden="true">♥</span> Consider supporting us
          </a>
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => setPromoOpen(false)}
            className="absolute right-3 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <span className="sr-only">{T.signInDeckFeatures}</span>
    </header>
  );
}
