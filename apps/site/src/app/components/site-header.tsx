"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { MembershipMark } from "./membership-mark";

import {
  BookOpenIcon,
  ChevronDownIcon,
  CircleQuestionIcon,
  Gamepad2Icon,
  LanguagesIcon,
  LibraryIcon,
  MailIcon,
  MenuIcon,
  MoonIcon,
  PackageIcon,
  SearchIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TrophyIcon,
  XBrandIcon,
  XIcon,
  Layers3Icon,
} from "./icons";

const navLinkBase =
  "relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-transparent px-2.5 text-xs font-medium text-foreground/64 transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const navLinkActive =
  "relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 text-xs font-medium transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-secondary/50 text-foreground after:absolute after:-bottom-2 after:inset-x-2.5 after:h-0.5 after:rounded-full after:bg-primary/80";

const mobileLinkClass =
  "relative flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground/78 transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const mobileActiveClass =
  "relative flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-secondary/50 text-foreground shadow-[inset_2px_0_0_0_var(--primary)]";

const themeButtonClass =
  "group relative inline-flex items-center justify-center rounded-full border border-transparent bg-transparent transition-colors hover:border-border/70 hover:bg-secondary/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-sm font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

function AccountLinks({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Account
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            className="inline-flex items-center justify-center rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background text-foreground/75 hover:bg-secondary/45 hover:text-foreground h-10 border border-border/70 text-sm"
            href="https://riftatlas.com/sign-in?redirect_url=%2Fplay"
          >
            Sign in
          </a>
          <a
            className="inline-flex items-center justify-center rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-primary text-primary-foreground transition-[filter] hover:brightness-110 h-10 text-sm"
            href="https://riftatlas.com/sign-up?redirect_url=%2Fplay"
          >
            Sign up
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="items-center gap-1 hidden xl:flex">
      <a
        className="inline-flex items-center justify-center rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background text-foreground/75 hover:bg-secondary/45 hover:text-foreground h-9 px-3 text-xs"
        href="https://riftatlas.com/sign-in?redirect_url=%2Fplay"
      >
        Sign in
      </a>
      <a
        className="inline-flex items-center justify-center rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-primary text-primary-foreground transition-[filter] hover:brightness-110 h-9 px-3.5 text-xs"
        href="https://riftatlas.com/sign-up?redirect_url=%2Fplay"
      >
        Sign up
      </a>
    </div>
  );
}

function LocaleSelect({ className }: { className?: string }) {
  return (
    <span
      data-language-select=""
      className={`group relative inline-flex shrink-0 align-middle ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="invisible inline-flex h-8 items-center whitespace-nowrap pl-6 pr-5 text-xs font-medium"
      >
        EN
      </span>
      <select
        aria-busy="false"
        aria-label="Language"
        data-testid="web-locale-select"
        defaultValue="en"
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "en") return;
          const prefix = value === "zh-CN" ? "zh-CN" : value;
          window.location.assign(`https://riftatlas.com/${prefix}/play`);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[2px] border-0 bg-transparent py-0 pl-6 pr-5 text-xs font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 text-foreground hover:bg-secondary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background"
      >
        <option value="en" lang="en">
          EN
        </option>
        <option value="zh-CN" lang="zh-CN">
          简体中文
        </option>
        <option value="fr" lang="fr">
          FR
        </option>
        <option value="ko" lang="ko">
          한국어
        </option>
      </select>
      <LanguagesIcon className="pointer-events-none absolute left-1.5 top-1/2 size-3.5 -translate-y-1/2 opacity-60 group-has-[:disabled]:opacity-30 text-foreground" />
      <ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 opacity-50 group-has-[:disabled]:opacity-30 text-foreground" />
    </span>
  );
}

export function SiteHeader() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    const el = headerRef.current;
    if (el) {
      const sync = () => {
        document.documentElement.style.setProperty("--app-header-height", `${el.offsetHeight}px`);
      };
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !headerRef.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable */
    }
    setTheme(next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "dark" ? "#1b1c26" : "#fcfcfc");
  }, []);

  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const themeTooltip = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <header
      ref={headerRef}
      data-testid="app-header"
      data-site-chrome="true"
      className="sticky top-0 z-50 border-b border-border/55 shadow-[0_14px_28px_-26px_rgba(0,0,0,0.72)] bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
    >
      <div data-testid="app-header-inner" className="w-full px-3 py-2 sm:px-4 lg:px-5 2xl:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <a
            aria-label="Rift Atlas home"
            className="flex h-9 shrink-0 items-center gap-2 rounded-md pr-1 text-sm font-semibold tracking-[-0.01em] text-foreground/90 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="https://riftatlas.com/"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              width={128}
              height={148}
              decoding="async"
              className="h-6 w-auto"
              src="/riftbound/static/brand/rift-atlas/rift-atlas-mark-header.webp"
              style={{ color: "transparent" }}
            />
            <span className="font-brand hidden min-[430px]:inline text-base">Rift Atlas</span>
          </a>

          <form
            className="relative flex min-w-0 flex-1 items-center gap-1.5 transition-[max-width] duration-200 ease-out motion-reduce:transition-none sm:min-w-min lg:max-w-[24rem]"
            action="https://riftatlas.com/search"
            method="get"
          >
            <div className="relative flex min-w-0 flex-1 items-center rounded-md border border-border/60 bg-secondary/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,box-shadow] focus-within:border-primary/55 focus-within:bg-background/95 focus-within:ring-2 focus-within:ring-primary/20 sm:min-w-[200px]">
              <button
                type="submit"
                aria-label="Submit card search"
                title="Search cards"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-l text-foreground/62 transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
              >
                <SearchIcon className="w-4 h-4" />
              </button>
              <div className="relative flex w-0 min-w-0 flex-1">
                <input
                  ref={searchRef}
                  data-testid="header-card-search"
                  placeholder="Search cards..."
                  aria-label="Search cards"
                  role="combobox"
                  autoComplete="off"
                  autoCapitalize="none"
                  enterKeyHint="search"
                  spellCheck={false}
                  name="q"
                  className="h-9 w-full min-w-0 bg-transparent pr-2 text-sm placeholder:text-foreground/52 focus:outline-none text-foreground"
                  type="text"
                  defaultValue=""
                  aria-autocomplete="list"
                  aria-expanded="false"
                  aria-haspopup="listbox"
                  aria-describedby="header-search-autocomplete-instructions"
                />
              </div>
              <span id="header-search-autocomplete-instructions" className="sr-only">
                Use the up and down arrow keys to navigate suggestions, Enter to choose, and Escape
                to close.
              </span>
              <button
                type="button"
                className="flex h-9 w-8 shrink-0 items-center justify-center text-foreground/62 transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
                aria-label="Search syntax help"
                aria-expanded="false"
                aria-controls="header-search-syntax-help"
              >
                <CircleQuestionIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-keyshortcuts="Meta+K Control+K"
                aria-label="Open quick card search (Control K)"
                title="Open quick card search (Control K)"
                onClick={() => searchRef.current?.focus()}
                className="inline-flex shrink-0 items-center justify-center border font-mono transition-[background-color,border-color,color] hover:border-border hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-background mr-1.5 h-6 min-w-0 rounded border-border/50 bg-background/40 px-1.5 text-[0.62rem] font-medium text-foreground/52 shadow-none focus-visible:ring-inset focus-visible:ring-offset-0"
              >
                <kbd>
                  <span data-platform-modifier-only="meta">⌘ K</span>
                  <span data-platform-modifier-only="control">Ctrl K</span>
                </kbd>
              </button>
            </div>
          </form>

          <a
            aria-label="Advanced Search"
            className="relative h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-transparent px-2.5 text-xs font-medium text-foreground/64 transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background hidden lg:inline-flex"
            href="https://riftatlas.com/advanced"
          >
            <SlidersHorizontalIcon className="hidden h-4 w-4 2xl:block" />
            Advanced
          </a>

          <nav
            aria-label="Primary"
            className="hidden shrink-0 items-center gap-0.5 border-l border-border/45 pl-2 lg:flex"
          >
            <a className={navLinkBase} href="https://riftatlas.com/cards">
              <LibraryIcon className="hidden h-4 w-4 2xl:block" />
              Cards
            </a>
            <a className={navLinkBase} href="https://riftatlas.com/decks">
              <BookOpenIcon className="hidden h-4 w-4 2xl:block" />
              Decks
            </a>
            <a className={navLinkBase} href="https://riftatlas.com/events">
              <TrophyIcon className="hidden h-4 w-4 2xl:block" />
              Events
            </a>
            <a className={navLinkBase} href="https://riftatlas.com/sealed">
              <PackageIcon className="hidden h-4 w-4 2xl:block" />
              Sealed
            </a>
            <a aria-current="page" className={navLinkActive} href="/play">
              <Gamepad2Icon className="hidden h-4 w-4 2xl:block" />
              Play
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
            <div className="hidden items-center gap-1 xl:flex">
              <a
                aria-label="Contact Rift Atlas"
                title="Contact Rift Atlas"
                className="group relative h-9 items-center justify-center rounded-full border transition-colors duration-200 hidden sm:inline-flex w-9 border-transparent bg-transparent hover:border-border/70 hover:bg-secondary/65"
                href="https://riftatlas.com/contact"
              >
                <Tooltip>Contact</Tooltip>
                <MailIcon className="h-4 w-4 shrink-0 text-foreground/70 transition-colors group-hover:text-foreground group-focus-visible:text-foreground" />
              </a>
              <a
                target="_blank"
                rel="noreferrer"
                aria-label="Join the Rift Atlas Discord"
                title="Join the Rift Atlas Discord"
                className="group relative h-9 items-center justify-center rounded-full border border-transparent bg-transparent transition-colors duration-200 hover:border-border/70 hover:bg-secondary/65 hidden sm:inline-flex w-9"
                href="https://discord.gg/8vfhVuUXmT"
              >
                <Tooltip>Discord</Tooltip>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  width={18}
                  height={18}
                  decoding="async"
                  className="h-[18px] w-[18px] object-contain"
                  src="/riftbound/static/Discord-Symbol-Black.png"
                />
              </a>
              <a
                href="https://x.com/playriftatlas"
                target="_blank"
                rel="noreferrer"
                aria-label="Follow us on X"
                title="Follow us on X"
                data-x-button="true"
                className="group relative h-9 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground/70 transition-colors duration-200 hover:border-border/70 hover:bg-secondary/65 hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hidden sm:inline-flex w-9"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute z-20 whitespace-nowrap rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-sm font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 right-full top-1/2 mr-2 -translate-y-1/2 translate-x-2"
                >
                  Follow us on X
                </span>
                <XBrandIcon className="h-[18px] w-[18px] shrink-0" />
              </a>
              <button
                type="button"
                aria-label={themeLabel}
                onClick={toggleTheme}
                className={`${themeButtonClass} h-9 w-9`}
                title={themeLabel}
              >
                <Tooltip>{themeTooltip}</Tooltip>
                {theme === "dark" ? (
                  <SunIcon className="h-4 w-4 text-foreground/70" />
                ) : (
                  <MoonIcon className="h-4 w-4 text-foreground/70" />
                )}
              </button>
              <LocaleSelect />
              <span className="inline-flex items-center gap-1">
                <span className="web-metafy-membership inline-flex gap-1">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Rift Atlas · Membership: Choose a membership"
                    data-connected="false"
                    data-membership-dialog-trigger="true"
                    data-riftatlas-membership-button="true"
                    className="group relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] border-0 bg-transparent opacity-90 transition-[filter,opacity] duration-200 hover:bg-white/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,231,183,0.62)] disabled:cursor-not-allowed disabled:opacity-45 h-9 w-9"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 hidden -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-sm font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block"
                      data-membership-tooltip="true"
                    >
                      Rift Atlas · Membership: Choose a membership
                    </span>
                    <MembershipMark className="h-7" />
                  </button>
                </span>
                <a
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Support Rift Atlas on Buy Me a Coffee"
                  title="Support Rift Atlas"
                  data-coffee-button="true"
                  className="group relative h-9 w-9 items-center justify-center rounded-[2px] border-0 bg-transparent transition-[filter] duration-200 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a97f00] dark:focus-visible:outline-[#F7DC00]/55 hidden sm:inline-flex"
                  href="https://buymeacoffee.com/riftatlas"
                >
                  <span className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#0B083D]/15 bg-[#FFF8C4]/95 px-3 py-1.5 text-sm font-semibold text-[#07062D] opacity-0 shadow-[0_8px_24px_-18px_rgba(247,220,0,0.95)] backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 right-full mr-2 translate-x-2">
                    Buy me a coffee
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width={22}
                    height={32}
                    decoding="async"
                    className="h-7 w-auto object-contain drop-shadow-[0_0_1px_rgba(11,8,61,0.85)] dark:drop-shadow-[0_0_4px_rgba(247,220,0,0.2)]"
                    src="/bmc-logo-dark-ui.svg"
                  />
                </a>
              </span>
            </div>

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/45 bg-secondary/25 text-foreground/72 transition-colors hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {menuOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
            </button>
            <AccountLinks />
          </div>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-navigation-menu"
          aria-label="Primary"
          className="absolute left-3 right-3 top-full z-50 mt-2 flex max-h-[calc(100dvh-var(--app-header-height,55px)-1rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-border/60 bg-background/98 p-2 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.82)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/92 lg:left-auto lg:right-5 lg:w-72"
        >
          <div className="shrink-0 overflow-hidden rounded-md bg-secondary/[0.14] divide-y divide-border/40 lg:hidden">
            <a className={mobileLinkClass} href="https://riftatlas.com/cards">
              <LibraryIcon className="w-4 h-4" />
              Cards
            </a>
            <a className={mobileLinkClass} href="https://riftatlas.com/advanced">
              <SlidersHorizontalIcon className="w-4 h-4" />
              Advanced Search
            </a>
            <a className={mobileLinkClass} href="https://riftatlas.com/decks">
              <BookOpenIcon className="w-4 h-4" />
              Decks
            </a>
            <a className={mobileLinkClass} href="https://riftatlas.com/events">
              <TrophyIcon className="w-4 h-4" />
              Events
            </a>
            <a className={mobileLinkClass} href="https://riftatlas.com/sealed">
              <PackageIcon className="w-4 h-4" />
              Sealed
            </a>
            <a aria-current="page" className={mobileActiveClass} href="/play">
              <Gamepad2Icon className="w-4 h-4" />
              Play
            </a>
          </div>
          <div className="shrink-0 overflow-hidden rounded-md bg-secondary/[0.14] divide-y divide-border/40">
            <a className={mobileLinkClass} href="https://riftatlas.com/sets">
              <Layers3Icon className="w-4 h-4" />
              Sets
            </a>
            <a className={mobileLinkClass} href="https://riftatlas.com/search?random=true">
              <ShuffleIcon className="w-4 h-4" />
              Random
            </a>
          </div>
          <div className="shrink-0 overflow-hidden rounded-md bg-secondary/[0.14] divide-y divide-border/40 xl:hidden">
            <a className={mobileLinkClass} href="https://riftatlas.com/contact">
              <MailIcon className="w-4 h-4" />
              Contact
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              className={mobileLinkClass}
              href="https://discord.gg/8vfhVuUXmT"
            >
              <span className="inline-flex w-4 justify-center text-[11px] font-bold">D</span>
              Discord
            </a>
            <a
              href="https://x.com/playriftatlas"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow us on X"
              title="Follow us on X"
              data-x-button="true"
              className="group border border-transparent bg-transparent duration-200 hover:border-border/70 focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring relative flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground/78 transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background h-auto justify-start rounded-none"
            >
              <XBrandIcon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-sm font-medium">Follow us on X</span>
            </a>
            <div className="flex items-center px-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex xl:hidden">
                  <span className="web-metafy-membership inline-flex gap-1">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label="Rift Atlas · Membership: Choose a membership"
                      data-connected="false"
                      data-membership-dialog-trigger="true"
                      data-riftatlas-membership-button="true"
                      className="group relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] border-0 bg-transparent opacity-90 transition-[filter,opacity] duration-200 hover:bg-white/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,231,183,0.62)] disabled:cursor-not-allowed disabled:opacity-45 h-9 w-9"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 hidden -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-sm font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block"
                        data-membership-tooltip="true"
                      >
                        Rift Atlas · Membership: Choose a membership
                      </span>
                      <MembershipMark className="h-7" />
                    </button>
                  </span>
                </span>
                <a
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Support Rift Atlas on Buy Me a Coffee"
                  title="Support Rift Atlas"
                  data-coffee-button="true"
                  className="group relative h-9 w-9 items-center justify-center rounded-[2px] border-0 bg-transparent transition-[filter] duration-200 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a97f00] dark:focus-visible:outline-[#F7DC00]/55 inline-flex"
                  href="https://buymeacoffee.com/riftatlas"
                >
                  <span className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#0B083D]/15 bg-[#FFF8C4]/95 px-3 py-1.5 text-sm font-semibold text-[#07062D] opacity-0 shadow-[0_8px_24px_-18px_rgba(247,220,0,0.95)] backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 left-full ml-2 -translate-x-2">
                    Buy me a coffee
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width={22}
                    height={32}
                    decoding="async"
                    className="h-7 w-auto object-contain drop-shadow-[0_0_1px_rgba(11,8,61,0.85)] dark:drop-shadow-[0_0_4px_rgba(247,220,0,0.2)]"
                    src="/bmc-logo-dark-ui.svg"
                  />
                </a>
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-foreground/70">
                Theme
              </span>
              <button
                type="button"
                aria-label={themeLabel}
                onClick={toggleTheme}
                className={`${themeButtonClass} h-8 w-8`}
                title={themeLabel}
              >
                <Tooltip>{themeTooltip}</Tooltip>
                {theme === "dark" ? (
                  <SunIcon className="h-3.5 w-3.5 text-foreground/70" />
                ) : (
                  <MoonIcon className="h-3.5 w-3.5 text-foreground/70" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-foreground/70">
                Language
              </span>
              <LocaleSelect />
            </div>
          </div>
          <div className="shrink-0 rounded-md bg-secondary/[0.14] px-3 py-3 xl:hidden">
            <AccountLinks compact />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
