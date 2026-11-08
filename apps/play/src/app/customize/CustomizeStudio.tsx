"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Room } from "@rift/protocol";

import { AppFooter } from "@/components/shell/AppFooter";
import { AccountDialog } from "@/components/shell/AccountDialog";
import { AppHeader } from "@/components/shell/AppHeader";
import { CardSearchDialog } from "@/components/shell/CardSearchDialog";
import { GameHistoryDialog } from "@/components/shell/GameHistoryDialog";
import { MembershipDialog } from "@/components/shell/MembershipDialog";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import { emptyBoard, fillerDeck, makePlayer, makeRoom, rune } from "@/fixtures/common";
import { searchCards } from "@/components/lobby/deck-adapter";
import type { GuestSession } from "@/components/lobby/types";
import { Icon } from "@/components/ui/Icon";
import { NativeDialog } from "@/components/ui/NativeDialog";
import { useIdentity } from "@/runtime";

import "@/components/shell/hub-theme.css";

const GUEST_STORAGE = "riftbound_simulator_guest_session_v1";
const LOCALE_COOKIE = "riftbound_locale";

type PreviewLayout = "desktop" | "tablet" | "phone";

const PLAYMAT_SRC =
  "/riftbound/static/cosmetics/creators/lootpixie/playmats/table_skin_loot_pixie_poro_pack/preview.webp";
const SLEEVE_TEAL =
  "/riftbound/static/cosmetics/creators/riftatlas/sleeves/sleeve_pack_rift_atlas/variants/verdant/board.webp";
const SLEEVE_WHITE = "/riftbound/static/cardback-white.png";
const SLEEVE_BLACK = "/riftbound/static/cardback-black.png";

function readGuest(): GuestSession | null {
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

function writeGuest(value: GuestSession | null) {
  try {
    if (value) window.localStorage.setItem(GUEST_STORAGE, JSON.stringify(value));
    else window.localStorage.removeItem(GUEST_STORAGE);
  } catch {
    /* ignore */
  }
}

function readLocaleCookie(): string {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return match?.split("=")[1] ?? "en";
}

const PREVIEW_VIEWER_ID = "customize-you";
const PREVIEW_OPPONENT_ID = "customize-opponent";

function makePreviewRoom(): Room {
  const you = makePlayer({
    id: PREVIEW_VIEWER_ID,
    seat: 0,
    name: "You",
    board: emptyBoard({
      deck: fillerDeck("customize-you-deck", 12),
      runeDeck: Array.from({ length: 12 }, (_, index) => rune("Calm", index)),
    }),
  });
  you.identity = {
    boardCustomization: {
      deckSleeve: { src: SLEEVE_TEAL },
      runeDeckSleeve: { src: SLEEVE_WHITE },
      battlefieldSleeve: { src: SLEEVE_BLACK },
    },
  };
  const opponent = makePlayer({
    id: PREVIEW_OPPONENT_ID,
    seat: 1,
    name: "Opponent",
    board: emptyBoard({
      deck: fillerDeck("customize-opponent-deck", 6),
      runeDeck: Array.from({ length: 6 }, (_, index) => rune("Mind", index)),
    }),
  });
  return makeRoom({
    roomCode: "PREVIEW",
    players: [you, opponent],
    firstPlayerId: PREVIEW_VIEWER_ID,
    activeTurnPlayerId: PREVIEW_VIEWER_ID,
    turnNumber: 1,
  });
}

const PREVIEW_ROOM = makePreviewRoom();

function BoardPreview({ layout, className }: { layout: PreviewLayout; className?: string }) {
  return (
    <div className={`sim-game-viewport ${className ?? ""}`} data-padded="false" style={{ height: "100%" }}>
      <GameBoardView
        state={PREVIEW_ROOM}
        viewerId={PREVIEW_VIEWER_ID}
        layoutHints={{
          mode: layout === "desktop" ? "desktop" : "touch",
          showSidebarSlot: layout !== "phone",
          showTurnControls: false,
          canEndTurn: false,
          canSwitchSeat: false,
          boardLines: "default",
        }}
        className="min-h-0"
      />
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#9fdff2]">
        {children}
      </h2>
      <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(109,223,255,0.28),rgba(109,223,255,0))]" />
    </div>
  );
}

function NewDot() {
  return (
    <>
      <span
        data-cosmetic-new-dot="true"
        className="pointer-events-none absolute -top-0.5 -right-0.5 z-10 size-2 rounded-full bg-red-500 ring-2 ring-[#09111e]"
      >
        <span className="sr-only">New cosmetics available</span>
      </span>
    </>
  );
}

function CosmeticCard({
  label,
  title,
  children,
  badge,
  onOpen,
  className = "",
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  badge?: string;
  onOpen: (title: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      {badge ? <NewDot /> : null}
      <div className="group grid w-full min-w-0 overflow-hidden rounded-sm border border-[rgba(132,150,184,0.2)] bg-[rgba(9,14,24,0.48)] text-left transition-[border-color,background-color] duration-180 hover:border-[rgba(190,226,255,0.34)] hover:bg-[rgba(13,22,38,0.64)]">
        <button
          type="button"
          className="grid w-full min-w-0 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200"
          aria-label={label}
          onClick={() => onOpen(title)}
        >
          {children}
        </button>
        <div className="flex min-h-12 items-center gap-3 border-t border-white/6 px-3 py-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            onClick={() => onOpen(title)}
          >
            <span className="line-clamp-1 block text-sm font-semibold text-text-main">{title}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DefaultArt({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate grid min-w-0 w-full place-items-center overflow-hidden bg-[linear-gradient(135deg,rgba(18,28,45,0.94),rgba(7,12,22,0.96))]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(73,122,158,0.18),transparent_48%),#080e19]" />
      <div className="relative z-1 grid w-full place-items-center">{children}</div>
    </div>
  );
}

export function CustomizeStudio() {
  const identityApi = useIdentity();
  const accountIdentity = identityApi.identity;
  const accountSignedIn = accountIdentity.kind === "account";
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [locale, setLocale] = useState("en");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountReason, setAccountReason] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>("desktop");
  const [fullBoardOpen, setFullBoardOpen] = useState(false);
  const pickerTitleId = useId();

  const signedIn = Boolean(guest) || accountSignedIn;
  const signedInName = accountSignedIn ? accountIdentity.name : (guest?.name ?? null);
  const signedInKind: "guest" | "account" = accountSignedIn ? "account" : "guest";

  useEffect(() => {
    setGuest(readGuest());
    setLocale(readLocaleCookie());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale, hydrated]);

  useEffect(() => {
    if (!fullBoardOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullBoardOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullBoardOpen]);

  const openAccount = (
    reason: string | null = null,
    mode: "login" | "register" = "login",
  ) => {
    setAccountReason(reason);
    setAccountMode(mode);
    setAccountOpen(true);
  };

  const handleGuestLogin = (name: string) => {
    const session: GuestSession = { name: name.trim().slice(0, 24), createdAt: Date.now() };
    setGuest(session);
    writeGuest(session);
    setAccountOpen(false);
    setAccountReason(null);
  };

  const handlePasswordLogin = async (username: string, password: string) => {
    await identityApi.signIn(username, password);
    setGuest(null);
    writeGuest(null);
    setAccountOpen(false);
    setAccountReason(null);
  };

  const handleRegisterAccount = async (username: string, password: string) => {
    await identityApi.register(username, password);
    setGuest(null);
    writeGuest(null);
    setAccountOpen(false);
    setAccountReason(null);
  };

  const signOut = () => {
    identityApi.signOut();
    setGuest(null);
    writeGuest(null);
    setAccountOpen(false);
  };

  const boardPreview = useMemo(
    () => (
      <div
        className={`relative overflow-hidden rounded-sm border border-[rgba(132,150,184,0.2)] bg-[#050b16] ${
          previewLayout === "phone"
            ? "mx-auto aspect-[0.55] w-[390px] max-w-full"
            : previewLayout === "tablet"
              ? "mx-auto aspect-[1.32] w-full max-w-[900px]"
              : "aspect-[1.57] w-full"
        }`}
      >
        <BoardPreview layout={previewLayout} />
      </div>
    ),
    [previewLayout],
  );

  return (
    <div className="hub-theme min-h-dvh bg-[#07101c] text-text-main">
      <AppHeader
        title="Customization"
        eyebrow="Creator Studio"
        description="Playmats, sleeves and member cosmetics."
        signedIn={signedIn}
        guestName={signedInName}
        locale={locale}
        backToLobby
        onLocaleChange={setLocale}
        onSignIn={() => openAccount()}
        onSignUp={() => openAccount(null, "register")}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenHistory={() => openHistory(setHistoryOpen, signedIn)}
        onOpenMembership={() => setMembershipOpen(true)}
        onOpenAccount={() => openAccount()}
      />

      <main
        className="relative box-border h-dvh overflow-x-hidden overflow-y-auto px-2 pb-3 pt-[118px] text-text-main sm:px-4 md:px-6 lg:px-8"
        data-hub-scroll-frame="true"
        data-hub-scroll-surface="customization"
      >
        <div className="relative mx-auto min-h-full w-full max-w-7xl">
          <div className="relative flex min-h-full w-full flex-col gap-4 pb-4">
            <section
              aria-labelledby="customization-membership-strip"
              data-customization-membership-strip=""
              className="relative mb-4 overflow-hidden rounded-xl bg-[#0d1830]/80 ring-1 ring-white/8"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                className="absolute inset-y-0 right-0 hidden h-full w-[30%] object-cover opacity-75 [mask-image:linear-gradient(to_right,transparent,black_45%)] md:block"
                src={PLAYMAT_SRC}
              />
              <p className="absolute right-2 bottom-1.5 z-10 hidden rounded-full bg-[#060c17]/75 px-2 py-0.5 text-[0.65rem] leading-4 text-[#d5deea] backdrop-blur-sm md:block">
                Art by Loot Pixie
              </p>
              <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5 md:pr-[30%]">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    data-membership-mark="true"
                    data-on-dark="true"
                    className="riftatlas-mark h-8 w-8"
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
                  <h2
                    id="customization-membership-strip"
                    className="text-base font-semibold text-white"
                  >
                    RiftAtlas membership
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <button
                    type="button"
                    className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-[rgba(255,231,183,0.36)] bg-[rgba(255,231,183,0.1)] px-4 py-1.5 text-sm font-semibold text-[#fff0d7] transition-colors hover:border-[rgba(255,231,183,0.6)] hover:bg-[rgba(255,231,183,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                    onClick={() => setMembershipOpen(true)}
                  >
                    Become a member
                  </button>
                  <a
                    className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-[#e9d6ad] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-200"
                    href="https://riftatlas.com/membership"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Compare tiers
                    <Icon name="chevron-right" className="size-3.5" />
                  </a>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Already subscribed?"
                    data-connected="false"
                    data-membership-dialog-trigger="true"
                    data-riftatlas-membership-button="true"
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-[#b9c7da] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setMembershipOpen(true)}
                  >
                    <span
                      aria-hidden="true"
                      data-membership-mark="true"
                      className="riftatlas-mark h-6"
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
                    <span>Already subscribed?</span>
                  </button>
                </div>
              </div>
            </section>

            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5">
              <a
                className="inline-flex min-h-11 min-w-0 flex-1 basis-[40%] items-center justify-center gap-2 text-sm font-medium text-cyan-100 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 sm:ml-auto sm:flex-none sm:basis-auto"
                href="https://riftatlas.com/artists"
                target="_blank"
                rel="noreferrer"
              >
                Meet the artists
                <Icon name="arrow-up-right" className="size-3.5" />
              </a>
            </div>

            <section
              aria-label="Customization options"
              className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start 2xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
            >
              <div className="grid gap-4" data-customization-editor="true">
                <CosmeticCard
                  label="Playmat"
                  title="Riftbound default"
                  badge="new"
                  onOpen={setPicker}
                >
                  <div className="relative isolate h-48 min-w-0 w-full overflow-hidden bg-[linear-gradient(135deg,rgba(18,28,45,0.94),rgba(7,12,22,0.96))]">
                    <div className="absolute inset-0 z-1 overflow-hidden" aria-hidden="true">
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,16,29,0.98),rgba(18,35,56,0.86)_44%,rgba(5,10,18,0.98))]" />
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(136,217,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(136,217,255,0.16)_1px,transparent_1px)] bg-size-[18px_18px] opacity-[0.28]" />
                      <div className="absolute top-1/2 left-1/2 h-[74%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-[0.36rem] border border-[rgba(151,181,224,0.28)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.18)]" />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(2,6,13,0),rgba(2,6,13,0.42))]" />
                    </div>
                    <span className="pointer-events-none absolute top-0 left-0 z-5 max-w-[calc(100%-1rem)] truncate rounded-br-sm bg-[#0b1423]/85 px-3 py-1.5 text-[0.6rem] font-medium uppercase leading-3 tracking-[0.08em] text-[#b4c0ca]">
                      Playmat
                    </span>
                  </div>
                </CosmeticCard>

                <section className="grid gap-2">
                  <SectionHeading>Sleeves</SectionHeading>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CosmeticCard
                      label="Card sleeve"
                      title="Riftbound default"
                      badge="new"
                      onOpen={setPicker}
                    >
                      <DefaultArt>
                        <div className="relative h-44 w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="absolute top-1/2 left-1/2 h-36 w-[6.4rem] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 object-cover shadow-lg"
                            src={SLEEVE_TEAL}
                          />
                          <span className="pointer-events-none absolute top-0 left-0 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                            Card sleeve
                          </span>
                        </div>
                      </DefaultArt>
                    </CosmeticCard>
                    <CosmeticCard
                      label="Rune deck sleeve"
                      title="Riftbound default"
                      badge="new"
                      onOpen={setPicker}
                    >
                      <DefaultArt>
                        <div className="relative h-44 w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="absolute top-1/2 left-1/2 h-36 w-[6.4rem] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 object-cover shadow-lg"
                            src={SLEEVE_WHITE}
                          />
                          <span className="pointer-events-none absolute top-0 left-0 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                            Rune deck sleeve
                          </span>
                        </div>
                      </DefaultArt>
                    </CosmeticCard>
                    <CosmeticCard
                      label="Battlefield sleeve"
                      title="Riftbound default"
                      badge="new"
                      onOpen={setPicker}
                    >
                      <DefaultArt>
                        <div className="relative h-44 w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="absolute top-1/2 left-1/2 h-36 w-[6.4rem] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 object-cover shadow-lg"
                            src={SLEEVE_BLACK}
                          />
                          <span className="pointer-events-none absolute top-0 left-0 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                            Battlefield sleeve
                          </span>
                        </div>
                      </DefaultArt>
                    </CosmeticCard>
                  </div>
                </section>

                <section className="grid gap-2">
                  <SectionHeading>Other</SectionHeading>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CosmeticCard
                      label="Nameplates: Default nameplate"
                      title="Default nameplate"
                      onOpen={setPicker}
                    >
                      <DefaultArt>
                        <div className="grid h-32 w-full place-items-center px-5">
                          <div className="w-full max-w-64 border border-[rgba(134,168,246,0.32)] bg-[linear-gradient(180deg,rgba(17,32,52,0.96),rgba(9,17,31,0.96))] px-4 py-3 text-center text-sm font-semibold text-[#eaf3ff] shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
                            You
                          </div>
                        </div>
                      </DefaultArt>
                    </CosmeticCard>
                    <CosmeticCard
                      label="Account badges: 0 of 5 account badges selected"
                      title="0 of 5 account badges selected"
                      onOpen={setPicker}
                    >
                      <DefaultArt>
                        <div className="grid h-32 w-full place-items-center px-5">
                          <div className="w-full max-w-64 border border-[rgba(134,168,246,0.32)] bg-[linear-gradient(180deg,rgba(17,32,52,0.96),rgba(9,17,31,0.96))] px-4 py-3 text-center text-sm font-semibold text-[#eaf3ff] shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
                            You
                          </div>
                        </div>
                      </DefaultArt>
                    </CosmeticCard>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <CosmeticCard label="Tokens" title="Tokens" onOpen={setPicker}>
                    <DefaultArt>
                      <div className="relative grid h-44 w-full place-items-center">
                        <div className="flex items-center">
                          {["Recruit", "Bird", "Gold"].map((token, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={token}
                              alt=""
                              className="h-28 w-20 rounded-sm border border-white/20 object-cover shadow-lg"
                              style={{ marginLeft: index === 0 ? 0 : -18, rotate: `${index * 4 - 4}deg` }}
                              src={`/riftbound/static/tokens/${token}.webp`}
                            />
                          ))}
                        </div>
                        <span className="absolute top-2 left-2 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                          Tokens
                        </span>
                      </div>
                    </DefaultArt>
                  </CosmeticCard>
                  <CosmeticCard label="Points rail: Default" title="Default" onOpen={setPicker}>
                    <DefaultArt>
                      <div className="relative grid h-44 w-full place-items-center">
                        <div className="grid grid-cols-2 gap-6">
                          {[0, 1].map((column) => (
                            <div key={column} className="grid justify-items-center gap-1">
                              {[4, 3, 2, 1].map((value) => (
                                <span
                                  key={value}
                                  className="grid size-7 place-items-center rounded-full border border-[rgba(134,168,246,0.36)] bg-[rgba(10,20,35,0.85)] text-[0.62rem] font-semibold text-[#bcd4ee]"
                                >
                                  {value}
                                </span>
                              ))}
                              <span className="size-5 rounded-full border-2 border-[#9fdff2] bg-[rgba(10,20,35,0.85)]" />
                            </div>
                          ))}
                        </div>
                        <span className="absolute top-2 left-2 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                          Points rail
                        </span>
                      </div>
                    </DefaultArt>
                  </CosmeticCard>
                  <CosmeticCard label="Board lines: Default" title="Default" onOpen={setPicker}>
                    <DefaultArt>
                      <div className="relative grid h-44 w-full place-items-center">
                        <div className="relative h-28 w-44 border border-[rgba(134,168,246,0.36)]">
                          <img
                            alt=""
                            className="absolute top-0 left-0 size-10 object-contain"
                            src="/riftbound/static/board-lines/legend/corner-top-left.svg"
                          />
                          <img
                            alt=""
                            className="absolute top-0 right-0 size-10 object-contain"
                            src="/riftbound/static/board-lines/legend/corner-top-right.svg"
                          />
                          <img
                            alt=""
                            className="absolute bottom-0 left-0 size-10 object-contain"
                            src="/riftbound/static/board-lines/legend/corner-bottom-left.svg"
                          />
                          <img
                            alt=""
                            className="absolute right-0 bottom-0 size-10 object-contain"
                            src="/riftbound/static/board-lines/legend/corner-bottom-right.svg"
                          />
                        </div>
                        <span className="absolute top-2 left-2 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                          Board lines
                        </span>
                      </div>
                    </DefaultArt>
                  </CosmeticCard>
                  <CosmeticCard label="Emote wheel" title="Emote wheel" onOpen={setPicker}>
                    <DefaultArt>
                      <div className="relative grid h-44 w-full place-items-center">
                        <div className="grid grid-cols-3 gap-4 text-3xl">
                          {["👍", "❤️", "😂", "❌", "⏳", "😠"].map((emoji) => (
                            <span key={emoji} aria-hidden="true" className="select-none">
                              {emoji}
                            </span>
                          ))}
                        </div>
                        <span className="absolute top-2 left-2 z-5 rounded-br-sm bg-[#0b1423]/85 px-2.5 py-1 text-[0.56rem] font-medium uppercase tracking-[0.08em] text-[#b4c0ca]">
                          Emote wheel
                        </span>
                      </div>
                    </DefaultArt>
                  </CosmeticCard>
                </section>
              </div>

              <section className="min-w-0 xl:sticky xl:top-4">
                <div className="overflow-hidden rounded-sm border border-[rgba(132,150,184,0.2)] bg-[rgba(7,12,22,0.46)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-2">
                    <p className="text-xs font-medium text-[#9fb2c8]">Preview layout</p>
                    {(
                      [
                        ["desktop", "Desktop"],
                        ["tablet", "Tablet"],
                        ["phone", "Phone"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={previewLayout === value}
                        onClick={() => setPreviewLayout(value)}
                        className={`rounded-sm px-2.5 py-1.5 text-xs transition-colors ${
                          previewLayout === value
                            ? "bg-white/10 text-text-main"
                            : "text-text-dim hover:bg-white/5 hover:text-text-main"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {boardPreview}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-1 pt-2">
                    <h2 className="text-sm font-semibold text-text-main">
                      Live appearance preview
                    </h2>
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-text-soft transition-colors hover:bg-white/6 hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                      onClick={() => setFullBoardOpen(true)}
                    >
                      <Icon name="arrow-up-right" className="size-3.5" />
                      View full board
                    </button>
                  </div>
                </div>
              </section>
            </section>

            <AppFooter />
          </div>
        </div>
      </main>

      {fullBoardOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="View full board"
          className="fixed inset-0 z-[200] bg-[#050b16]"
          data-full-board-preview="true"
        >
          <div className="flex h-14 items-center justify-between border-b border-[rgba(132,150,184,0.22)] px-4">
            <h2 className="text-sm font-semibold text-text-main">View full board</h2>
            <button
              type="button"
              aria-label="Close full board preview"
              className="inline-flex size-9 items-center justify-center rounded-md border border-[rgba(132,150,184,0.28)] text-[#b9c7da] transition hover:bg-white/5 hover:text-white"
              onClick={() => setFullBoardOpen(false)}
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <div className="absolute inset-x-2 top-[3.75rem] bottom-2 overflow-hidden rounded-sm border border-[rgba(134,168,246,0.34)]">
            <BoardPreview layout="desktop" />
          </div>
        </div>
      ) : null}

      <NativeDialog
        open={picker !== null}
        onClose={() => setPicker(null)}
        ariaLabelledBy={pickerTitleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0c1525] p-4 text-[#e8f3ff] shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)] sm:p-6 backdrop:bg-black/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#9fdff2]">
              Customization options
            </p>
            <h2 id={pickerTitleId} className="mt-1 text-lg font-semibold">
              {picker}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close appearance picker"
            className="inline-flex size-8 items-center justify-center rounded-md text-[#94a3b8] hover:bg-white/5 hover:text-white"
            onClick={() => setPicker(null)}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-[rgba(103,232,249,0.5)] bg-[rgba(29,67,83,0.5)] px-3 py-3">
            <span className="text-sm font-semibold">Riftbound default</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#bdf2cf]">
              <Icon name="check" className="size-3.5" />
              Selected
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#b9c7da]">
            Member designs are not available in this build yet. Your default appearance is used
            for every match.
          </p>
        </div>
      </NativeDialog>

      <AccountDialog
        open={accountOpen}
        onClose={() => {
          setAccountOpen(false);
          setAccountReason(null);
        }}
        onGuestLogin={handleGuestLogin}
        onPasswordLogin={handlePasswordLogin}
        onRegisterAccount={handleRegisterAccount}
        onSignOut={signedIn ? signOut : undefined}
        guestName={signedInName}
        signedInKind={signedInKind}
        initialName={guest?.name ?? ""}
        reason={accountReason}
        initialMode={accountMode}
      />
      <MembershipDialog open={membershipOpen} onClose={() => setMembershipOpen(false)} />
      <CardSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        searchCards={(query) => searchCards(query)}
        onSelectCard={() => setSearchOpen(false)}
      />
      <GameHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

/** History stays gated behind an account, matching the lobby header. */
function openHistory(setOpen: (open: boolean) => void, signedIn: boolean) {
  if (!signedIn) return;
  setOpen(true);
}
