import { describe, expect, it } from "vitest";

import {
  buildCompiledKey,
  createMessageTranslator,
  createSentenceTranslator,
  createTranslator,
  deriveFrenchParams,
  fnv1a,
  formatDate,
  formatList,
  formatNumber,
  getLocaleDefinition,
  intlLocale,
  localeCookie,
  localeForCountry,
  localeFromPathname,
  localePrefix,
  localizedPath,
  localizeUrl,
  normalizeLocale,
  pickerLabels,
  postProcessKorean,
  renderCompiled,
  sentenceCatalog,
  stripLocalePrefix,
  translateRuntimeMessage,
} from "./index";

describe("locales", () => {
  it("defines the four original locales", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("zh")).toBe("zh-CN");
    expect(normalizeLocale("zh-Hans")).toBe("zh-CN");
    expect(normalizeLocale("zh-sg")).toBe("zh-CN");
    expect(normalizeLocale("fr-FR")).toBe("fr");
    expect(normalizeLocale("ko-KR")).toBe("ko");
    expect(normalizeLocale("de")).toBeNull();
    expect(getLocaleDefinition("fr")?.labelSeparator).toBe("\u00a0: ");
    expect(getLocaleDefinition("zh-CN")?.sentenceEnd).toBe("。");
    expect(pickerLabels["zh-CN"]).toBe("简体中文");
    expect(localeForCountry("cn")).toBe("zh-CN");
    expect(localeForCountry("US")).toBeNull();
  });

  it("splits and rebuilds localized paths", () => {
    expect(localeFromPathname("/fr/game")).toEqual({ locale: "fr", pathname: "/game" });
    expect(localeFromPathname("/game")).toEqual({ locale: null, pathname: "/game" });
    expect(stripLocalePrefix("/zh-CN/play")).toBe("/play");
    expect(localePrefix("en")).toBe("");
    expect(localePrefix("ko")).toBe("/ko");
    expect(localizedPath("/game", "?a=1", "#x", "fr")).toBe("/fr/game?a=1#x");
    expect(localizedPath("/fr/game", "", "", "en")).toBe("/game");
    expect(localizeUrl("https://play.riftatlas.com/game", "fr")).toBe(
      "https://play.riftatlas.com/fr/game",
    );
    expect(localizeUrl("#hash", "fr")).toBe("#hash");
    expect(intlLocale("ko")).toBe("ko-KR");
    expect(formatNumber(1234.5, "fr")).toBe("1\u202f234,5");
    expect(formatList(["a", "b"], "en")).toBe("a and b");
    expect(
      formatDate(new Date(Date.UTC(2026, 0, 2)), "en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    ).toBe("01/02/2026");
  });

  it("builds the locale cookie exactly", () => {
    expect(localeCookie("fr")).toBe("riftbound_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(localeCookie("fr", { hostname: "play.riftatlas.com", secure: true })).toBe(
      "riftbound_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Domain=riftatlas.com; Secure",
    );
    expect(localeCookie("fr", { hostname: "example.com" })).toBe(
      "riftbound_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });
});

describe("compiled message runtime", () => {
  it("renders interpolation, select and plural nodes", () => {
    expect(renderCompiled(["Hello ", ["name"], "!"], { name: "Vi" }, "en")).toBe("Hello Vi!");
    expect(
      renderCompiled(["kind", 1, { yes: "auto", other: "manual" }], { kind: "yes" }, "en"),
    ).toBe("auto");
    expect(renderCompiled(["count", 2, { one: "card", other: "cards" }], { count: 1 }, "en")).toBe(
      "card",
    );
    expect(renderCompiled(["count", 2, { one: "card", other: "cards" }], { count: 3 }, "en")).toBe(
      "cards",
    );
    expect(
      renderCompiled(["count", 2, { "=0": "none", other: ["count"] }], { count: 0 }, "en"),
    ).toBe("none");
    expect(renderCompiled([0, " literal"], {}, "en")).toBe("0 literal");
  });

  it("translates EN keys from the namespaced catalog", () => {
    const t = createTranslator("en");
    expect(t("sim.noRunesChanneled")).toBe("No runes channeled");
    expect(t("sim.increaseTag", { tag: "Might" })).toBe("Increase Might");
    expect(t("does.not.exist")).toBeNull();
    expect(t.has("sim.noRunesChanneled")).toBe(true);
  });

  it("falls back to EN for missing localized keys", () => {
    const t = createTranslator("fr");
    expect(t("sim.noRunesChanneled")).toBe("No runes channeled");
    expect(t("not.a.key")).toBeNull();
  });

  it("computes the original generated key (widget + fnv1a)", () => {
    expect(fnv1a("Sign in to manage community decks.")).toBe(Number.parseInt("0jnr3ma", 36));
    expect(buildCompiledKey("Sign in to manage community decks.")).toBe(
      "signInToManageCommunityDecks_0jnr3ma",
    );
    expect(buildCompiledKey("")).toMatch(/^message_/);
  });

  it("localizes runtime messages by generated key", () => {
    const t = createTranslator("fr");
    expect(t.translateText("Sign in to manage community decks.")).toBe(
      "Connectez-vous pour gérer les decks de la communauté.",
    );
    expect(translateRuntimeMessage("fr", "Comment text is required.")).toBe(
      "Le texte du commentaire est requis.",
    );
    expect(translateRuntimeMessage("en", "Comment text is required.")).toBe(
      "Comment text is required.",
    );
    expect(translateRuntimeMessage("fr", "Totally unknown message.")).toBe(
      "Totally unknown message.",
    );
  });

  it("renders localized patterns and parts", () => {
    const t = createTranslator("fr");
    expect(t("mainDeckSafetyLimit", { max: 80, maxPlural: 80, found: 81 })).toBe(
      "Le deck principal peut contenir au maximum 80 cartes. Il en contient 81.",
    );
    expect(t("mainDeckSafetyLimit", { max: 1, maxPlural: 1, found: 2 })).toBe(
      "Le deck principal peut contenir au maximum 1 carte. Il en contient 2.",
    );
    expect(t("parts.suggestionItem", { value: "Vi" })).toBe("« Vi »");
    const zh = createTranslator("zh-CN");
    expect(zh("mainDeckSafetyLimit", { max: 80, maxPlural: 80, found: 81 })).toContain("80");
  });

  it("applies French parameter derivation", () => {
    const derived = deriveFrenchParams({ card: "le deck" });
    expect(derived.cardDe).toBe("du deck");
    expect(derived.cardA).toBe("au deck");
    expect(deriveFrenchParams({ card: "une carte" }).cardDe).toBe("d’une carte");
  });

  it("applies Korean particle post-processing", () => {
    expect(postProcessKorean("카드을(를) 뽑았습니다.")).toBe("카드를 뽑았습니다.");
    expect(postProcessKorean("룬을(를) 전개했습니다.")).toBe("룬을 전개했습니다.");
    expect(postProcessKorean("3을(를) 얻었습니다.")).toBe("3을 얻었습니다.");
    expect(postProcessKorean("(으)로")).toBe("(으)로");
    expect(postProcessKorean("집(으)로")).toBe("집으로");
    expect(postProcessKorean("물(으)로")).toBe("물로");
  });

  it("translates the sentence catalogs", () => {
    const fr = createSentenceTranslator("fr");
    expect(fr.has("sentence.drewCards")).toBe(true);
    expect(fr("sentence.drewCards", { count: 1 })).toBe("A pioché 1 carte.");
    expect(fr("sentence.drewCards", { count: 3 })).toBe("A pioché 3 cartes.");
    const zh = createSentenceTranslator("zh-CN");
    expect(zh("sentence.drewCards", { count: 3 })).toBe("抽了 3 张卡牌。");
    const ko = createSentenceTranslator("ko");
    expect(ko("sentence.drewCards", { count: 1 })).toContain("1");
    expect(sentenceCatalog("fr")).not.toBeNull();
    expect(sentenceCatalog("en")).toBeNull();
    expect(createSentenceTranslator("en")("sentence.closedDeckPeek")).toBe("Closed deck peek.");
    expect(createSentenceTranslator("en")("sentence.drewCards")).toBeNull();
    const custom = createMessageTranslator("fr", { hello: ["Bonjour ", ["name"], "!"] });
    expect(custom("hello", { name: "Vi" })).toBe("Bonjour Vi!");
  });
});
