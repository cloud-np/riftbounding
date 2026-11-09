"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConstructedDeckRegistration, RoomSessionDoc } from "@rift/protocol";

import "@/components/shell/hub-theme.css";

import { AppFooter } from "@/components/shell/AppFooter";
import { AppHeader } from "@/components/shell/AppHeader";
import { AccountDialog } from "@/components/shell/AccountDialog";
import { CardSearchDialog } from "@/components/shell/CardSearchDialog";
import { EntryShell, SeoBlock } from "@/components/shell/EntryShell";
import { GameHistoryDialog } from "@/components/shell/GameHistoryDialog";
import { MembershipDialog } from "@/components/shell/MembershipDialog";
import { ToastStack, type ToastEntry } from "@/components/ui/ToastStack";
import {
  MatchmakingClient,
  createNextGame,
  createRoom as createRealtimeRoom,
  getAuthToken,
  joinRoom as joinRealtimeRoom,
  leaveRoom as leaveRealtimeRoom,
  newOperationId,
  resolveRoomMembership,
  returnToLobby as returnRealtimeToLobby,
  switchToSpectator as switchRealtimeToSpectator,
  takeSeat as takeRealtimeSeat,
  useIdentity,
  isRoomApiError,
  useMatchmaking,
  REALTIME_CONNECTION_LOST_MESSAGE,
  createSavedDeck,
  deleteSavedDeck,
  listSavedDeckSummaries,
  resolveSavedDeckForPlayFresh,
  upsertSavedDeck,
  SavedDeckApiError,
  type MatchmakingSearchAttempt,
} from "@/runtime";

import { BuilderStory } from "./BuilderStory";
import { DeckPanel, type DeckPanelView } from "./DeckPanel";
import { DeckImportDialog } from "./DeckImportDialog";
import { DeckPickerDialog } from "./DeckPickerDialog";
import { PromoRail } from "./PromoRail";
import { SidePanel } from "./SidePanel";
import { TournamentPromo } from "./TournamentPromo";
import { decodeDeckCode, exportDeckText, parseDeckText, searchCards } from "./deck-adapter";
import { format, strings } from "./strings";
import { pendingRoomState, roomStateFromSessionDoc } from "./integration/roomMapping";
import {
  clearGameSessions,
  createGameSession,
  gameHref,
  readLastGameSession,
  saveGameSession,
} from "./integration/session";
import { useRoomShellRuntime } from "./integration/useRoomShellRuntime";
import type {
  ActiveSavedDeck,
  DeckRulesMode,
  GameVariant,
  GuestSession,
  LobbyQuickMatchSettings,
  MatchFormat,
  ParsedDeck,
  PlayMode,
  RoomState,
  RulesMode,
  SavedDeck,
} from "./types";
import { RoomShell } from "@/components/room/RoomShell";

const STORAGE = {
  guest: "riftbound_simulator_guest_session_v1",
  playerName: "riftbound_simulator_player_name",
  deckDraft: "riftbound_simulator_deck_draft",
  deckDraftSavedId: "riftbound_simulator_deck_draft_saved_deck_id",
  privateDeck: "riftbound_simulator_private_deck",
  playMode: "riftbound_simulator_play_mode",
  table: "riftbound_simulator_quick_match_table",
  locale: "riftbound_locale",
} as const;

interface LobbyRoomSession {
  roomCode: string;
  gameInstanceId: string;
  playerId: string;
  playerName: string;
  viewerRole: "player" | "spectator";
  playMode: PlayMode;
  deckRulesMode: DeckRulesMode;
  roomMode: "multiplayer" | "solo_lab" | "single_player";
  controlledPlayerIds?: string[];
  variant: GameVariant;
  format: MatchFormat;
  lastKnownPhase?: string;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string): T | null {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function variantForTable(table: LobbyQuickMatchSettings["table"]): GameVariant {
  if (table === "ffa3") return "free_for_all_3";
  if (table === "ffa4") return "free_for_all_4";
  if (table === "teams") return "teams_2v2";
  return "duel";
}

/** Original `K` helper: a deck is Radiance-only when it contains `RAD-*` cards. */
function deckUsesRadianceCards(deck: ParsedDeck | null): boolean {
  if (!deck) return false;
  return [...deck.sections.mainDeck, ...deck.sections.champion].some((entry) =>
    entry.cardCode?.startsWith("RAD-"),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Something went wrong. Try again.";
}

export function LobbyContainer() {
  const router = useRouter();
  const identityApi = useIdentity();
  const accountIdentity = identityApi.identity;
  const accountSignedIn = accountIdentity.kind === "account";
  const [hydrated, setHydrated] = useState(false);
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [savedDecksLoading, setSavedDecksLoading] = useState(false);
  const [savedDecksError, setSavedDecksError] = useState<string | null>(null);
  const [activeSavedDeck, setActiveSavedDeck] = useState<ActiveSavedDeck | null>(null);
  const [deckBusy, setDeckBusy] = useState(false);
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [privateDeck, setPrivateDeck] = useState(false);
  const [deckView, setDeckView] = useState<DeckPanelView>("list");
  const [deckDetailsOpen, setDeckDetailsOpen] = useState(false);
  const [settings, setSettings] = useState<LobbyQuickMatchSettings>({
    table: "duel",
    format: "bo1",
    cardPool: "standard",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playModeTab, setPlayModeTab] = useState<"constructed" | "radiance">("constructed");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [locale, setLocale] = useState("en");

  const [roomSession, setRoomSession] = useState<LobbyRoomSession | null>(null);
  const [roomBusy, setRoomBusy] = useState<"host" | "solo" | "join" | null>(null);
  const [matchmakingClient, setMatchmakingClient] = useState<MatchmakingClient | null>(null);
  const matchmaking = useMatchmaking(matchmakingClient);
  const mmStatus = matchmaking.status.status;
  const searching =
    mmStatus === "preparing" ||
    mmStatus === "connecting" ||
    mmStatus === "searching" ||
    mmStatus === "reconnecting" ||
    mmStatus === "cancelling";

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountReason, setAccountReason] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [importOpen, setImportOpen] = useState(false);
  const [importInitial, setImportInitial] = useState("");
  const [importMode, setImportMode] = useState<"import" | "view">("import");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const toastId = useRef(0);
  const navigatingRef = useRef(false);

  const signedIn = Boolean(guest) || accountSignedIn;
  const signedInName = accountSignedIn ? accountIdentity.name : (guest?.name ?? null);
  const signedInKind: "guest" | "account" = accountSignedIn ? "account" : "guest";
  // The original parses lobby paste imports under `unrestricted` until a session exists.
  const deckRulesMode: DeckRulesMode = signedIn ? "standard" : "unrestricted";
  const radianceDeck = deckUsesRadianceCards(deck);

  const pushToast = useCallback((message: string, tone: "info" | "success" | "error" = "info") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  /* ------------------------------------------------------------ hydration */
  useEffect(() => {
    const storedGuest = readJson<GuestSession>(STORAGE.guest);
    const storedName = readStorage(STORAGE.playerName) ?? "";
    const storedDraft = readStorage(STORAGE.deckDraft);
    const storedTable = readStorage(STORAGE.table) as LobbyQuickMatchSettings["table"] | null;
    const storedPlayMode = readStorage(STORAGE.playMode);
    const cookieLocale = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${STORAGE.locale}=`))
      ?.split("=")[1];

    if (storedGuest?.name) setGuest(storedGuest);
    setPlayerName(storedName || storedGuest?.name || "");
    if (storedDraft && storedDraft.trim().length > 0) {
      setDeck(parseDeckText(storedDraft, { deckRulesMode: "unrestricted" }));
    }
    if (storedTable && ["duel", "ffa3", "ffa4", "teams"].includes(storedTable)) {
      setSettings((current) => ({ ...current, table: storedTable }));
    }
    if (storedPlayMode === "sealed") setPlayModeTab("radiance");
    setPrivateDeck(readStorage(STORAGE.privateDeck) === "1");
    if (cookieLocale) setLocale(cookieLocale);
    setHydrated(true);
  }, []);

  /* ------------------------------------------------------------ persistence */
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
    document.cookie = `${STORAGE.locale}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE.playerName, playerName.trim() || null);
  }, [playerName, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE.deckDraft, deck?.raw ?? null);
    writeStorage(STORAGE.deckDraftSavedId, savedDeckId);
  }, [deck, savedDeckId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE.privateDeck, privateDeck ? "1" : "0");
  }, [privateDeck, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE.playMode, playModeTab === "radiance" ? "sealed" : "constructed");
  }, [playModeTab, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE.table, settings.table);
  }, [settings.table, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setDeck((current) =>
      current ? parseDeckText(current.raw, { deckRulesMode }) : current,
    );
    // Only the rule bucket changes; the raw list is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckRulesMode, hydrated]);

  useEffect(() => {
    if (!radianceDeck) return;
    setSettings((current) =>
      current.cardPool === "radiance" ? current : { ...current, cardPool: "radiance" },
    );
  }, [radianceDeck]);

  useEffect(() => {
    if (!hydrated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (document.querySelector("dialog[open]")) return;
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hydrated]);

  /* ------------------------------------------------------------ auth */
  const pendingAction = useRef<(() => void) | null>(null);
  const requireAuth = useCallback(
    (reason: string, action?: () => void) => {
      if (action && guest) {
        action();
        return;
      }
      if (guest) return;
      setAccountReason(reason);
      setAccountMode("login");
      setAccountOpen(true);
      if (!action) return;
      pendingAction.current = action;
    },
    [guest],
  );

  const openAccount = (
    reason: string | null = null,
    mode: "login" | "register" = "login",
  ) => {
    setAccountReason(reason);
    setAccountMode(mode);
    setAccountOpen(true);
  };

  const handleGuestLogin = (name: string) => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    // "Continue as guest" always means the local guest identity, even if an account token was
    // persisted from an earlier session.
    identityApi.signOut();
    const session: GuestSession = { name: trimmed, createdAt: Date.now() };
    setGuest(session);
    setPlayerName(trimmed);
    writeStorage(STORAGE.guest, JSON.stringify(session));
    setAccountOpen(false);
    setAccountReason(null);
    pushToast(`Signed in as ${trimmed}`, "success");
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) window.setTimeout(action, 0);
  };

  const handlePasswordLogin = async (username: string, password: string) => {
    const identity = await identityApi.signIn(username, password);
    setGuest(null);
    writeStorage(STORAGE.guest, null);
    setPlayerName(identity.name);
    setAccountOpen(false);
    setAccountReason(null);
    pushToast(`Signed in as ${identity.name}`, "success");
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) window.setTimeout(action, 0);
  };

  const handleRegisterAccount = async (username: string, password: string) => {
    const identity = await identityApi.register(username, password);
    setGuest(null);
    writeStorage(STORAGE.guest, null);
    setPlayerName(identity.name);
    setAccountOpen(false);
    setAccountReason(null);
    pushToast(`Signed in as ${identity.name}`, "success");
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) window.setTimeout(action, 0);
  };

  const handleSignOut = () => {
    identityApi.signOut();
    setGuest(null);
    writeStorage(STORAGE.guest, null);
    setRoomSession(null);
    clearGameSessions();
    setAccountOpen(false);
    pushToast("Signed out", "info");
  };

  /* ------------------------------------------------------------ saved deck library */
  const refreshSavedDecks = useCallback(async () => {
    if (!accountSignedIn) {
      setSavedDecks([]);
      setSavedDecksError(null);
      return;
    }
    setSavedDecksLoading(true);
    try {
      const decks = await listSavedDeckSummaries();
      setSavedDecks(decks);
      setSavedDecksError(null);
    } catch (error) {
      setSavedDecksError(
        error instanceof SavedDeckApiError ? error.message : strings["sim.deckLibraryReconnecting"],
      );
    } finally {
      setSavedDecksLoading(false);
    }
  }, [accountSignedIn]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshSavedDecks();
  }, [hydrated, refreshSavedDecks]);

  const requireAccount = useCallback(
    (reason: string, action?: () => void) => {
      if (accountSignedIn) {
        action?.();
        return;
      }
      setAccountReason(reason);
      setAccountMode("login");
      setAccountOpen(true);
      if (action) pendingAction.current = action;
    },
    [accountSignedIn],
  );

  const loadSavedDeck = useCallback(
    async (deckId: string) => {
      if (!accountSignedIn) {
        pushToast(strings["sim.signInToLoadSavedDeck"], "info");
        requireAccount(strings["sim.signInDeckLibrary"]);
        return;
      }
      try {
        const result = await resolveSavedDeckForPlayFresh({ deckId });
        if (result.kind !== "found") {
          pushToast(strings["sim.savedDeckUnavailable"], "error");
          return;
        }
        const content = result.deck.deckContent;
        let parsed: ParsedDeck | null = null;
        if (content.kind === "parsedDeck") {
          parsed = parseDeckText(content.parsedDeck.raw, { deckRulesMode });
        } else {
          const decoded = decodeDeckCode(content.deckCode, { deckRulesMode });
          if ("error" in decoded) {
            pushToast(strings["sim.savedDeckUnavailable"], "error");
            return;
          }
          parsed = decoded;
        }
        setDeck(parsed);
        setSavedDeckId(result.deck.id);
        setActiveSavedDeck({
          id: result.deck.id,
          name: result.deck.name,
          status: result.deck.status,
          revision: result.deck.revision,
          legalityVersion: result.deck.legalityVersion,
        });
        if (deckUsesRadianceCards(parsed)) {
          setSettings((current) => ({ ...current, cardPool: "radiance" }));
        }
        pushToast(strings["sim.deckLoadedToast"], "success");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    },
    [accountSignedIn, deckRulesMode, pushToast, requireAccount],
  );

  // Original entry points: `?savedDeckId=` (account library) and `?deckCode=` (anyone). The URL is
  // cleaned after the deck loads, exactly like the launcher page.
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (!hydrated || identityApi.loading || deepLinkRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const savedDeckParam = params.get("savedDeckId")?.trim() ?? "";
    const deckCodeParam = params.get("deckCode")?.trim() ?? "";
    if (!savedDeckParam && !deckCodeParam) {
      deepLinkRef.current = true;
      return;
    }
    deepLinkRef.current = true;

    void (async () => {
      // Original precedence: a deck code wins over a savedDeckId in the same URL.
      if (deckCodeParam) {
        const decoded = decodeDeckCode(deckCodeParam, { deckRulesMode });
        if ("error" in decoded) {
          pushToast(decoded.error, "error");
        } else {
          setDeck(decoded);
          setSavedDeckId(null);
          setActiveSavedDeck(null);
          if (deckUsesRadianceCards(decoded)) {
            setSettings((current) => ({ ...current, cardPool: "radiance" }));
          }
          pushToast(strings["sim.deckLoadedToast"], "success");
        }
      } else if (savedDeckParam) {
        await loadSavedDeck(savedDeckParam);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("savedDeckId");
      url.searchParams.delete("deckCode");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    })();
  }, [deckRulesMode, hydrated, identityApi.loading, loadSavedDeck, pushToast]);

  /* ------------------------------------------------------------ deck */
  const openImport = (initial = deck?.raw ?? "") => {
    setImportInitial(initial);
    setImportMode("import");
    setImportOpen(true);
  };

  const handleImport = (parsed: ParsedDeck) => {
    setDeck(parsed);
    setSavedDeckId(null);
    setActiveSavedDeck(null);
    setImportOpen(false);
    const radiance = deckUsesRadianceCards(parsed);
    if (radiance) {
      // The original only switches the card pool; CONSTRUCTED stays the selected play tab.
      setSettings((current) => ({ ...current, cardPool: "radiance" }));
    }
    pushToast(strings["sim.deckLoadedToast"], "success");
  };

  const handleNewDeck = () => {
    // In-app builder route (B27); guests get the local draft, accounts the saved library.
    router.push("/decks/new");
  };

  const handleChooseDeck = () => {
    if (!accountSignedIn) {
      requireAccount(strings["sim.signInDeckLibrary"], () => setPickerOpen(true));
      return;
    }
    setPickerOpen(true);
    void refreshSavedDecks();
  };

  const handleChooseSavedDeck = (saved: SavedDeck) => {
    setPickerOpen(false);
    setDeckBusy(true);
    void loadSavedDeck(saved.id).finally(() => setDeckBusy(false));
  };

  const handleEditSavedDeck = (saved: SavedDeck) => {
    setPickerOpen(false);
    router.push(`/decks/${encodeURIComponent(saved.id)}/edit`);
  };

  const handleDeleteSavedDeck = (saved: SavedDeck) => {
    void (async () => {
      try {
        await deleteSavedDeck(saved.id);
        setSavedDecks((current) => current.filter((entry) => entry.id !== saved.id));
        if (savedDeckId === saved.id) {
          setSavedDeckId(null);
          setActiveSavedDeck(null);
        }
        pushToast("Deck deleted.", "info");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    })();
  };

  const handleSaveDeck = () => {
    if (!accountSignedIn) {
      requireAccount(strings["sim.signInDeckLibrary"]);
      return;
    }
    if (!deck) return;
    const name =
      deck.sections.legend[0]?.name ??
      deck.sections.champion[0]?.name ??
      activeSavedDeck?.name ??
      `Deck ${savedDecks.length + 1}`;
    setDeckBusy(true);
    void (async () => {
      try {
        if (activeSavedDeck) {
          const saved = await upsertSavedDeck({
            deckId: activeSavedDeck.id,
            name,
            deckSections: deck.sections,
            guideHtml: "",
            revision: activeSavedDeck.revision,
          });
          setActiveSavedDeck({
            id: saved.id,
            name: saved.name,
            status: saved.status,
            revision: saved.revision,
            legalityVersion: saved.legalityVersion,
          });
          setSavedDeckId(saved.id);
        } else {
          const saved = await createSavedDeck({
            name,
            decklistRaw: deck.raw || exportDeckText(deck),
          });
          setActiveSavedDeck({
            id: saved.id,
            name,
            status: saved.status,
            revision: saved.revision,
            legalityVersion: saved.legalityVersion,
          });
          setSavedDeckId(saved.id);
        }
        await refreshSavedDecks();
        pushToast(strings["sim.deckSaved"], "success");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      } finally {
        setDeckBusy(false);
      }
    })();
  };

  /* ------------------------------------------------------------ rooms */
  const myId =
    roomSession?.playerId ??
    accountIdentity.subject ??
    (guest ? `guest-${guest.createdAt}` : "local-guest");
  const myName = accountSignedIn
    ? accountIdentity.name
    : playerName.trim() || guest?.name || "Guest";

  const handleGameStarted = useCallback(
    (doc: RoomSessionDoc) => {
      if (!roomSession || navigatingRef.current) return;
      navigatingRef.current = true;
      const controlled =
        roomSession.roomMode !== "multiplayer"
          ? doc.players.filter((player) => !player.leftAt).map((player) => player.id)
          : roomSession.controlledPlayerIds;
      const session = createGameSession({
        roomCode: roomSession.roomCode,
        gameInstanceId: roomSession.gameInstanceId,
        playerId: roomSession.playerId,
        playerName: roomSession.playerName,
        viewerRole: roomSession.viewerRole,
        playMode: roomSession.playMode,
        deckRulesMode: roomSession.deckRulesMode,
        roomMode: roomSession.roomMode,
        ...(controlled && controlled.length > 0 ? { controlledPlayerIds: controlled } : {}),
        lastKnownPhase: doc.phase,
      });
      saveGameSession(session);
      router.push(gameHref(session));
    },
    [roomSession, router],
  );

  useEffect(() => {
    navigatingRef.current = false;
  }, [roomSession?.roomCode, roomSession?.playerId]);

  const shell = useRoomShellRuntime(roomSession, { onGameStarted: handleGameStarted });

  const room = useMemo<RoomState | null>(() => {
    if (!roomSession) return null;
    if (shell.sessionDoc) {
      return roomStateFromSessionDoc({
        sessionDoc: shell.sessionDoc,
        myPlayerId: roomSession.playerId,
        viewerRole: roomSession.viewerRole,
        deckReadyFallback: Boolean(deck?.valid),
        chatEntries: shell.chatEntries,
        spectators: shell.spectators,
      });
    }
    return pendingRoomState({
      roomCode: roomSession.roomCode,
      myPlayerId: roomSession.playerId,
      myPlayerName: roomSession.playerName,
      viewerRole: roomSession.viewerRole,
      roomMode: roomSession.roomMode,
      variant: roomSession.variant,
      playMode: roomSession.playMode,
      format: roomSession.format,
      deckRules: roomSession.deckRulesMode,
      deckReady: Boolean(deck?.valid),
      controlledPlayerIds: roomSession.controlledPlayerIds,
    });
  }, [roomSession, shell.sessionDoc, shell.chatEntries, shell.spectators, deck?.valid]);

  const deckRegistration = useCallback(
    (matchFormat: MatchFormat): ConstructedDeckRegistration | undefined => {
      if (!deck?.valid || !deck.raw) return undefined;
      return {
        decklistRaw: deck.raw,
        matchmakingPool: "standard",
        savedDeckId: activeSavedDeck?.id ?? null,
        savedDeckName: activeSavedDeck?.name ?? null,
        savedDeckRevision: activeSavedDeck?.revision ?? null,
        savedDeckLegalityVersion: activeSavedDeck?.legalityVersion ?? null,
        savedDeckStatus: activeSavedDeck?.status ?? null,
        savedDeckOwnerUserId: accountSignedIn ? (accountIdentity.subject ?? null) : null,
        deckRulesMode,
        matchFormat,
      };
    },
    [
      accountIdentity.subject,
      accountSignedIn,
      activeSavedDeck,
      deck?.raw,
      deck?.valid,
      deckRulesMode,
    ],
  );

  // Register the currently chosen deck whenever it changes (create/join already send it once).
  const submittedDeckRef = useRef<string | null>(null);
  useEffect(() => {
    submittedDeckRef.current = null;
  }, [roomSession?.roomCode, roomSession?.playerId]);
  useEffect(() => {
    if (!roomSession || roomSession.viewerRole !== "player" || !shell.runtime) return;
    if (!deck?.valid || !deck.raw) return;
    const signature = `${deck.raw}|${activeSavedDeck?.id ?? ""}|${activeSavedDeck?.revision ?? ""}`;
    if (submittedDeckRef.current === signature) return;
    const registration = deckRegistration(roomSession.format ?? "bo1");
    submittedDeckRef.current = `${deck.raw}|${activeSavedDeck?.id ?? ""}|${activeSavedDeck?.revision ?? ""}`;
    void shell
      .sendShellAction({
        type: "submit_deck",
        decklist: deck.raw,
        ...(registration ? { constructedDeckRegistration: registration } : {}),
      })
      .catch((error) => pushToast(errorMessage(error), "error"));
  }, [
    activeSavedDeck?.id,
    activeSavedDeck?.revision,
    deck?.raw,
    deck?.valid,
    deckRegistration,
    roomSession,
    shell.runtime,
    shell.sendShellAction,
    pushToast,
  ]);

  const createLobbyRoom = useCallback(
    async (roomMode: "multiplayer" | "single_player" | "solo_lab") => {
      if (!signedIn) {
        requireAuth(strings["sim.signInToPlay"]);
        return;
      }
      setRoomBusy(roomMode === "multiplayer" ? "host" : "solo");
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("A sign-in token is temporarily unavailable.");
        const variant: GameVariant =
          roomMode === "multiplayer" ? variantForTable(settings.table) : "duel";
        const format: MatchFormat = variant === "duel" ? settings.format : "bo1";
        const created = await createRealtimeRoom({
          operationId: newOperationId(),
          playerName: myName,
          playMode: "constructed",
          matchFormat: format,
          roomMode,
          gameVariant: variant,
          ...(deck?.valid && deck.raw ? { decklist: deck.raw } : {}),
          ...(deckRegistration(format)
            ? { constructedDeckRegistration: deckRegistration(format) }
            : {}),
          authToken: token,
        });
        setRoomSession({
          roomCode: created.roomCode,
          gameInstanceId: created.roomCode,
          playerId: created.playerId,
          playerName: myName,
          viewerRole: "player",
          playMode: "constructed",
          deckRulesMode: roomMode === "multiplayer" ? "standard" : "unrestricted",
          roomMode,
          ...(created.controlledPlayerIds
            ? { controlledPlayerIds: created.controlledPlayerIds }
            : {}),
          variant,
          format,
        });
        setJoinError(null);
        pushToast(
          roomMode === "single_player"
            ? "Solo room created."
            : roomMode === "solo_lab"
              ? "Solo Lab created."
              : "Room created.",
          "success",
        );
      } catch (error) {
        pushToast(errorMessage(error), "error");
      } finally {
        setRoomBusy(null);
      }
    },
    [deck?.raw, deck?.valid, deckRegistration, myName, pushToast, requireAuth, settings, signedIn],
  );

  const handleHostRoom = () => {
    void createLobbyRoom("multiplayer");
  };
  const handleSoloRoom = () => {
    void createLobbyRoom("single_player");
  };

  const handleJoin = async (codeOverride?: string) => {
    const code = (codeOverride ?? joinCode).trim().toUpperCase();
    if (!code) {
      setJoinError(strings["sim.enterRoomCodeFirst"]);
      return;
    }
    if (code.length < 4) {
      setJoinError(format(strings["sim.noRoomFoundForCode"], { roomCode: code }));
      return;
    }
    if (!signedIn) {
      requireAuth(strings["sim.signInToPlay"]);
      return;
    }
    setRoomBusy("join");
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("A sign-in token is temporarily unavailable.");
      const request = {
        roomCode: code,
        playerName: myName,
        playMode: "constructed" as const,
        matchFormat: "bo1" as const,
        ...(deck?.valid && deck.raw ? { decklist: deck.raw } : {}),
        ...(deckRegistration("bo1")
          ? { constructedDeckRegistration: deckRegistration("bo1") }
          : {}),
        authToken: token,
      };
      let joined;
      try {
        joined = await joinRealtimeRoom(request);
      } catch (error) {
        // In-progress/full rooms fall back to the spectate path (the original join button gates
        // both), while preserving the original error copy for genuinely missing rooms.
        if (
          isRoomApiError(error) &&
          (error.code === "room_access_denied" || error.code === "room_full")
        ) {
          joined = await joinRealtimeRoom({ ...request, viewerRole: "spectator" });
        } else {
          throw error;
        }
      }
      const isSpectator = joined.role === "spectator";
      setRoomSession({
        roomCode: joined.roomCode,
        gameInstanceId: joined.roomCode,
        playerId: isSpectator ? (accountIdentity.subject ?? myId) : (joined.playerId ?? myId),
        playerName: isSpectator ? (joined.spectatorName ?? myName) : myName,
        viewerRole: isSpectator ? "spectator" : "player",
        playMode: "constructed",
        deckRulesMode: "standard",
        roomMode: "multiplayer",
        variant: "duel",
        format: "bo1",
      });
      setJoinError(null);
      pushToast(isSpectator ? "Joined room as a spectator." : "Joined room.", "success");
      if (codeOverride) setJoinCode(code);
    } catch (error) {
      if (isRoomApiError(error) && error.code === "room_not_found") {
        setJoinError(format(strings["sim.noRoomFoundForCode"], { roomCode: code }));
      } else {
        setJoinError(errorMessage(error));
      }
    } finally {
      setRoomBusy(null);
    }
  };

  // Deep link / invite link: `/?room=CODE` prefills and joins once the user is signed in.
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!hydrated || roomSession || autoJoinRef.current) return;
    const code = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase();
    if (!code) return;
    autoJoinRef.current = true;
    setJoinCode(code);
    if (signedIn) void handleJoin(code);
    else openAccount(strings["sim.signInToPlay"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, roomSession, signedIn]);

  // Reattach to the last game room after "Leave game" (seat is kept by the /game screen).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || roomSession || restoredRef.current) return;
    const last = readLastGameSession();
    if (!last) return;
    restoredRef.current = true;
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const membership = await resolveRoomMembership({
          roomCode: last.roomCode,
          authToken: token,
        });
        if (membership.role === "absent") {
          clearGameSessions();
          return;
        }
        setRoomSession({
          roomCode: membership.roomCode,
          gameInstanceId: last.gameInstanceId,
          playerId:
            membership.role === "player" ? (membership.playerId ?? last.playerId) : last.playerId,
          playerName:
            membership.role === "player"
              ? (membership.playerName ?? last.playerName)
              : (membership.spectatorName ?? last.playerName),
          viewerRole: membership.role,
          playMode: last.playMode,
          deckRulesMode: last.deckRulesMode,
          roomMode: last.roomMode ?? "multiplayer",
          variant: "duel",
          format: "bo1",
          ...(last.controlledPlayerIds ? { controlledPlayerIds: last.controlledPlayerIds } : {}),
        });
      } catch {
        clearGameSessions();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, roomSession]);

  const handleFindMatch = () => {
    if (searching) {
      void matchmaking.cancel();
      return;
    }
    if (!signedIn) {
      requireAuth(strings["sim.signInToPlay"]);
      return;
    }
    if (!deck?.valid) {
      pushToast("Paste a valid deck before searching for a match.", "error");
      openImport();
      return;
    }
    const variant = variantForTable(settings.table);
    const matchFormat: MatchFormat = variant === "duel" ? settings.format : "bo1";
    const registration = deckRegistration(matchFormat);
    const attempt: MatchmakingSearchAttempt = {
      searchId: newOperationId(),
      initiatingUserId: myId,
      playerName: myName,
      playMode: "constructed",
      decklist: deck.raw,
      ...(registration ? { constructedDeckRegistration: registration } : {}),
      matchmakingPool: "standard",
      matchFormat,
      ...(variant !== "duel" ? { gameVariant: variant } : {}),
      extensions: ["pools", "tables"],
    };
    let client = matchmakingClient;
    if (!client) {
      client = new MatchmakingClient();
      setMatchmakingClient(client);
    }
    void client.search(attempt);
  };

  const matchedHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (matchmaking.status.status !== "matched") return;
    const matched = matchmaking.status;
    if (matchedHandledRef.current === matched.roomCode) return;
    matchedHandledRef.current = matched.roomCode;
    const session = createGameSession({
      roomCode: matched.roomCode,
      gameInstanceId: matched.roomCode,
      playerId: matched.playerId,
      playerName: matched.playerName || myName,
      viewerRole: "player",
      playMode: matchmaking.search?.playMode ?? "constructed",
      deckRulesMode: "standard",
      roomMode: "multiplayer",
      ...(matchmaking.search?.gameVariant ? { variant: matchmaking.search.gameVariant } : {}),
      lastKnownPhase: "in_game",
    });
    saveGameSession(session);
    pushToast("Match found.", "success");
    router.push(gameHref(session));
  }, [
    matchmaking.status,
    matchmaking.search?.gameVariant,
    matchmaking.search?.playMode,
    myName,
    pushToast,
    router,
  ]);

  const reportedMatchmakingErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!matchmaking.error || reportedMatchmakingErrorRef.current === matchmaking.error) return;
    reportedMatchmakingErrorRef.current = matchmaking.error;
    pushToast(matchmaking.error, "error");
  }, [matchmaking.error, pushToast]);

  const leaveRoom = () => {
    const session = roomSession;
    setRoomSession(null);
    clearGameSessions();
    pushToast(strings["sim.lobby.returningToLobby"], "info");
    if (session) {
      void (async () => {
        try {
          const token = await getAuthToken();
          if (!token) return;
          await leaveRealtimeRoom({
            roomCode: session.roomCode,
            ...(session.viewerRole === "player" ? { playerId: session.playerId } : {}),
            viewerRole: session.viewerRole,
            authToken: token,
          });
        } catch {
          /* best effort: the seat is also released by the socket disconnect */
        }
      })();
    }
  };

  const runShellAction = (action: { type: string; [k: string]: unknown }, errorPrefix = "") => {
    void shell.sendShellAction(action).catch((error) => {
      const message = errorMessage(error);
      pushToast(errorPrefix ? `${errorPrefix} ${message}` : message, "error");
    });
  };

  const handleSetReady = (ready: boolean) => {
    runShellAction({ type: "set_lobby_ready", ready });
  };

  const handleTakeSeat = () => {
    if (!roomSession) return;
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("A sign-in token is temporarily unavailable.");
        const result = await takeRealtimeSeat({
          roomCode: roomSession.roomCode,
          authToken: token,
        });
        setRoomSession((current) =>
          current
            ? {
                ...current,
                playerId: result.playerId ?? current.playerId,
                viewerRole: "player",
                playerName: myName,
              }
            : current,
        );
        pushToast("Seat taken.", "success");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    })();
  };

  const handleSwitchToSpectator = () => {
    if (!roomSession) return;
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("A sign-in token is temporarily unavailable.");
        const result = await switchRealtimeToSpectator({
          roomCode: roomSession.roomCode,
          playerId: roomSession.playerId,
          authToken: token,
        });
        setRoomSession((current) =>
          current
            ? {
                ...current,
                viewerRole: "spectator",
                playerName: result.spectatorName ?? current.playerName,
              }
            : current,
        );
        pushToast(strings["sim.switchingToSpectator"], "info");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    })();
  };

  const handleSwitchSeat = (targetSeat: number) => {
    runShellAction({ type: "switch_lobby_seat", targetSeat });
  };

  const handleRandomizeTeams = () => {
    runShellAction({ type: "randomize_lobby_teams" });
  };

  const handleUpdateRoomSettings = (patch: {
    variant?: GameVariant;
    playMode?: PlayMode;
    format?: MatchFormat;
    deckRules?: DeckRulesMode;
    rulesMode?: RulesMode;
  }) => {
    if (patch.variant)
      runShellAction({ type: "set_lobby_game_variant", gameVariant: patch.variant });
    if (patch.playMode) runShellAction({ type: "set_lobby_play_mode", playMode: patch.playMode });
    if (patch.format) runShellAction({ type: "set_lobby_match_format", matchFormat: patch.format });
    if (patch.deckRules) runShellAction({ type: "set_lobby_deck_rules", mode: patch.deckRules });
    if (patch.rulesMode) runShellAction({ type: "set_lobby_rules_mode", mode: patch.rulesMode });
  };

  const handleStartMatch = () => {
    if (!roomSession) return;
    pushToast(strings["sim.startingMatch"], "info");
    runShellAction({ type: "start_lobby_match" });
  };

  const handleCreateNextGame = () => {
    if (!roomSession) return;
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("A sign-in token is temporarily unavailable.");
        await createNextGame({ roomCode: roomSession.roomCode, authToken: token });
        pushToast(strings["sim.startingNextGame"], "info");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    })();
  };

  const handleReturnToLobby = () => {
    if (!roomSession) return;
    if (roomSession.viewerRole === "spectator") {
      leaveRoom();
      return;
    }
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("A sign-in token is temporarily unavailable.");
        const result = await returnRealtimeToLobby({
          roomCode: roomSession.roomCode,
          authToken: token,
        });
        setRoomSession((current) =>
          current
            ? {
                ...current,
                roomCode: result.lobbyRoomCode,
                gameInstanceId: result.lobbyRoomCode,
                lastKnownPhase: "lobby",
              }
            : current,
        );
      } catch (error) {
        pushToast(errorMessage(error), "error");
      }
    })();
  };

  const handleSendChat = (text: string) => {
    if (!shell.sendChat(text.slice(0, 200))) {
      pushToast(REALTIME_CONNECTION_LOST_MESSAGE, "error");
    }
  };

  const handleCopyRoomCode = async (): Promise<boolean> => {
    if (!room) return false;
    return copyText(room.code);
  };

  const handleCopyInviteLink = async (): Promise<boolean> => {
    if (!room) return false;
    return copyText(`${window.location.origin}/?room=${encodeURIComponent(room.code)}`);
  };

  const openCardSearch = () => setSearchOpen(true);

  /* ------------------------------------------------------------ render */
  if (!hydrated) {
    return (
      <>
        <SeoBlock />
        <EntryShell />
      </>
    );
  }

  return (
    <div className="hub-theme">
      <AppHeader
        title={
          room
            ? format(strings["sim.roomTitle"], { roomCode: room.code })
            : strings["sim.lobbyLabel"]
        }
        description={strings["sim.pasteDeckFirst"]}
        inRoom={Boolean(room)}
        signedIn={signedIn}
        guestName={signedInName}
        locale={locale}
        onLocaleChange={(next) => setLocale(next)}
        onSignIn={() => openAccount()}
        onSignUp={() => openAccount(null, "register")}
        onOpenSearch={openCardSearch}
        onOpenHistory={() => {
          if (!signedIn) {
            openAccount(strings["gameHistory.signIn"]);
            return;
          }
          setHistoryOpen(true);
        }}
        onOpenMembership={() => setMembershipOpen(true)}
        onOpenAccount={() => openAccount()}
      />
      <SeoBlock />

      <div className="contents" data-player-moderation-surface="">
        <div data-testid="simulator-content">
          <div className="hub-theme min-h-dvh">
            <div className="contents" data-room-auth-recovery-surface="">
              <div
                className="relative isolate box-border h-dvh overflow-x-hidden overflow-y-auto px-2 py-3 text-text-main sm:px-4 md:px-6 lg:px-8"
                data-hub-scroll-frame="true"
                data-hub-scroll-surface="lobby"
                style={{ ["--hub-content-top" as string]: "118px" }}
              >
                <div
                  className="lobby-shell relative z-1 mx-auto flex min-h-full w-full flex-col pt-[var(--hub-content-top,13rem)] md:pt-[var(--hub-content-top,9rem)] lg:pt-[var(--hub-content-top,8rem)] max-w-7xl min-[1280px]:grid min-[1280px]:grid-rows-[minmax(0,1fr)_auto] min-[1280px]:gap-x-4 min-[1280px]:gap-y-3"
                  style={{
                    gridTemplateColumns: "11rem minmax(0px, 1fr) 208px",
                    maxWidth: "calc(208px + 93rem)",
                  }}
                >
                  <PromoRail onOpenMembership={() => setMembershipOpen(true)} />

                  <div className="lobby-content-column relative flex min-h-0 w-full flex-1 flex-col gap-4 min-[1280px]:col-start-2 min-[1280px]:row-start-1">
                    <BuilderStory onSupport={() => setMembershipOpen(true)} />
                    <main className="lobby-main-grid grid flex-1 items-stretch gap-5">
                      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
                      <DeckPanel
                        deck={deck}
                        savedDeckName={
                          savedDecks.find((entry) => entry.id === savedDeckId)?.name ?? null
                        }
                        signedIn={signedIn}
                        privateDeck={privateDeck}
                        onPrivateDeckChange={(value) => {
                          if (!signedIn) {
                            openAccount(strings["sim.signInPrivacy"]);
                            return;
                          }
                          setPrivateDeck(value);
                        }}
                        view={deckView}
                        onViewChange={setDeckView}
                        detailsOpen={deckDetailsOpen}
                        onDetailsOpenChange={setDeckDetailsOpen}
                        onImportDeck={() => openImport()}
                        onNewDeck={handleNewDeck}
                        onChooseDeck={handleChooseDeck}
                        onSaveDeck={handleSaveDeck}
                      />

                      {room ? (
                        <section className="lobby-side-panel grid min-h-0 min-w-0 self-stretch gap-4">
                          <RoomShell
                            room={room}
                            onCopyRoomCode={handleCopyRoomCode}
                            onCopyInviteLink={handleCopyInviteLink}
                            onLeaveRoom={leaveRoom}
                            onSetReady={handleSetReady}
                            onTakeSeat={handleTakeSeat}
                            onSwitchToSpectator={handleSwitchToSpectator}
                            onSwitchSeat={handleSwitchSeat}
                            onRandomizeTeams={handleRandomizeTeams}
                            onUpdateRoomSettings={handleUpdateRoomSettings}
                            onStartMatch={handleStartMatch}
                            onCreateNextGame={handleCreateNextGame}
                            onReturnToLobby={handleReturnToLobby}
                            onSendChat={handleSendChat}
                            onLoadDeck={() => openImport()}
                            onToast={pushToast}
                          />
                        </section>
                      ) : (
                        <SidePanel
                          signedIn={signedIn}
                          playerName={playerName}
                          onPlayerNameChange={setPlayerName}
                          settings={settings}
                          onSettingsChange={setSettings}
                          settingsOpen={settingsOpen}
                          onSettingsOpenChange={setSettingsOpen}
                          searching={searching}
                          onFindMatch={() => {
                            if (!signedIn) {
                              requireAuth(strings["sim.signInToPlay"]);
                              return;
                            }
                            handleFindMatch();
                          }}
                          onCancelSearch={() => {
                            void matchmaking.cancel();
                          }}
                          onHostRoom={() => {
                            if (!signedIn) {
                              requireAuth(strings["sim.signInToPlay"]);
                              return;
                            }
                            handleHostRoom();
                          }}
                          onSoloRoom={() => {
                            if (!signedIn) {
                              requireAuth(strings["sim.signInToPlay"]);
                              return;
                            }
                            handleSoloRoom();
                          }}
                          joinCode={joinCode}
                          onJoinCodeChange={(value) => {
                            setJoinCode(value);
                            setJoinError(null);
                          }}
                          onJoin={() => {
                            if (!signedIn) {
                              requireAuth(strings["sim.signInToPlay"]);
                              return;
                            }
                            handleJoin();
                          }}
                          onRequireAuth={requireAuth}
                          joinError={joinError}
                          playModeTab={playModeTab}
                          radianceDeck={radianceDeck}
                          onPlayModeTabChange={(mode) => {
                            if (mode === "radiance" && !signedIn) {
                              requireAuth(strings["sim.signInRadiance"]);
                              return;
                            }
                            setPlayModeTab(mode);
                            setSettings((current) => ({
                              ...current,
                              cardPool: mode === "radiance" ? "radiance" : "standard",
                            }));
                          }}
                        />
                      )}
                    </main>
                  </div>

                  <TournamentPromo />
                  <AppFooter />
                </div>
              </div>
              <div className="contents" data-room-auth-surface-portal-host="" />
            </div>
          </div>
        </div>
      </div>

      <AccountDialog
        open={accountOpen}
        onClose={() => {
          setAccountOpen(false);
          setAccountReason(null);
          pendingAction.current = null;
        }}
        onGuestLogin={handleGuestLogin}
        onPasswordLogin={handlePasswordLogin}
        onRegisterAccount={handleRegisterAccount}
        onSignOut={signedIn ? handleSignOut : undefined}
        guestName={signedInName}
        signedInKind={signedInKind}
        initialName={playerName || guest?.name || ""}
        reason={accountReason}
        initialMode={accountMode}
      />

      <DeckImportDialog
        open={importOpen}
        mode={importMode}
        initialText={importInitial}
        deckRulesMode={deckRulesMode}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <DeckPickerDialog
        open={pickerOpen}
        decks={savedDecks}
        loading={savedDecksLoading || deckBusy}
        error={savedDecksError}
        onClose={() => setPickerOpen(false)}
        onChoose={handleChooseSavedDeck}
        onEdit={handleEditSavedDeck}
        onDelete={handleDeleteSavedDeck}
        onRefresh={() => void refreshSavedDecks()}
        onImport={() => {
          setPickerOpen(false);
          openImport();
        }}
      />

      <CardSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        searchCards={searchCards}
        onSelectCard={(card) => {
          setSearchOpen(false);
          window.open(`https://riftatlas.com/card/${card.id}`, "_blank", "noopener,noreferrer");
        }}
      />

      <GameHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <MembershipDialog open={membershipOpen} onClose={() => setMembershipOpen(false)} />
      <ToastStack toasts={toasts} />
    </div>
  );
}
