import { afterEach, describe, expect, it } from "vitest";

import {
  ASSET_MANIFEST,
  CARD_IMAGE_REVISIONS,
  buildCardImageCandidates,
  buildCardImageUrl,
  buildResponsiveSrc,
  buildStaticResponsiveSrc,
  candidateLocaleOf,
  configureAssetBases,
  configureStaticAssetBase,
  defaultPublicationResolver,
  fromAssetFallbackUrl,
  getCardsBase,
  getStaticAssetBase,
  getStaticBase,
  keywordIconCandidates,
  parseLocaleImageManifest,
  qualityOf,
  resolveManagedPath,
  responsiveWidthsFromStyle,
  sanitizeAssetUrl,
  setLocaleImageManifests,
  slotToSize,
  staticAsset,
  staticKeyOf,
  toAssetFallbackUrl,
  toStaticUrl,
  widthBucket,
  withTokenArtCandidates,
} from "./index";

const CDN = "https://assets.riftatlas-workers.com";

afterEach(() => {
  configureAssetBases({
    cardsBase: "https://assets.riftatlas-workers.com/riftbound/cards",
    staticBase: "https://assets.riftatlas-workers.com/riftbound/static",
  });
  configureStaticAssetBase("/riftbound/static");
  setLocaleImageManifests({});
});

describe("asset URL builders", () => {
  it("exposes the original default bases", () => {
    expect(getCardsBase()).toBe(`${CDN}/riftbound/cards`);
    expect(getStaticBase()).toBe(`${CDN}/riftbound/static`);
    expect(ASSET_MANIFEST["board.webp"]).toBe("505ed5610a3785dd");
    expect(CARD_IMAGE_REVISIONS["OGN-001.webp"]).toBe("f5b1b91d61327a2c");
  });

  it("normalizes managed paths", () => {
    expect(resolveManagedPath("/cards/OGN-001.webp")).toBe("OGN-001.webp");
    expect(resolveManagedPath("small-v2/OGN-001.webp")).toBe("OGN-001.webp");
    expect(resolveManagedPath("/fr/small-v2/RAD-063.webp")).toBeNull();
    expect(resolveManagedPath("fr/small-v2/RAD-063.webp")).toBe("fr/small-v2/RAD-063.webp");
    expect(resolveManagedPath("/cards/fr/small-v2/RAD-063.webp")).toBe("fr/small-v2/RAD-063.webp");
    expect(resolveManagedPath("cards/original/OGN-001.webp?v=1#x")).toBe("OGN-001.webp");
    expect(resolveManagedPath("/icons/tap.webp")).toBeNull();
  });

  it("builds card art URLs per slot with revisions", () => {
    expect(buildCardImageUrl("/cards/OGN-001.webp", "small-v2")).toBe(
      `${CDN}/riftbound/cards/small-v2/OGN-001.webp?v=f5b1b91d61327a2c`,
    );
    expect(buildCardImageUrl("/cards/OGN-001.webp", "original")).toBe(
      `${CDN}/riftbound/cards/original/OGN-001.webp?v=f5b1b91d61327a2c`,
    );
    expect(buildCardImageUrl("/cards/OGN-001.webp", "original")).toContain("original/OGN-001.webp");
  });

  it("builds locale card art URLs and lets the source query replace the revision", () => {
    expect(buildCardImageUrl("fr/small-v2/RAD-063.webp", "small-v2")).toBe(
      `${CDN}/riftbound/cards/fr/small-v2/RAD-063.webp`,
    );
    expect(buildCardImageUrl("/cards/small-v2/RAD-063.webp?assetRevision=abc", "small-v2")).toBe(
      `${CDN}/riftbound/cards/small-v2/RAD-063.webp?v=${CARD_IMAGE_REVISIONS["RAD-063.webp"]}`,
    );
    expect(buildCardImageUrl("fr/small-v2/RAD-063.webp?assetRevision=abc", "small-v2")).toBe(
      `${CDN}/riftbound/cards/fr/small-v2/RAD-063.webp?assetRevision=abc`,
    );
  });

  it("builds static asset URLs with manifest revisions", () => {
    expect(toStaticUrl("/icons/tap.webp")).toBe(
      `${CDN}/riftbound/static/icons/tap.webp?v=${ASSET_MANIFEST["icons/tap.webp"]}`,
    );
    expect(toStaticUrl("icons/tap.webp")).toBe(toStaticUrl("/icons/tap.webp"));
    expect(toStaticUrl("/not-in-manifest.png")).toBe("/not-in-manifest.png");
    expect(staticKeyOf("/board.webp?v=1")).toBe("board.webp");
    expect(staticKeyOf("/riftbound/static/board.webp?v=1")).toBeNull();
  });

  it("exposes staticAsset() for the self-hosted static copy", () => {
    expect(staticAsset("board.webp")).toBe(
      `/riftbound/static/board.webp?v=${ASSET_MANIFEST["board.webp"]}`,
    );
    expect(staticAsset("/sounds/20260716/ping-v2.webm")).toBe(
      `/riftbound/static/sounds/20260716/ping-v2.webm?v=${ASSET_MANIFEST["sounds/20260716/ping-v2.webm"]}`,
    );
    expect(staticAsset("/riftbound/static/icons/tap.webp")).toBe(
      `/riftbound/static/icons/tap.webp?v=${ASSET_MANIFEST["icons/tap.webp"]}`,
    );
    configureStaticAssetBase("/static");
    expect(getStaticAssetBase()).toBe("/static");
    expect(staticAsset("board.webp")).toBe(`/static/board.webp?v=${ASSET_MANIFEST["board.webp"]}`);
  });

  it("supports a configurable cards base", () => {
    configureAssetBases({ cardsBase: "/" });
    expect(buildCardImageUrl("/cards/OGN-001.webp", "small-v2")).toBe(
      `/small-v2/OGN-001.webp?v=${CARD_IMAGE_REVISIONS["OGN-001.webp"]}`,
    );
    expect(toStaticUrl("/icons/tap.webp")).toBe(
      `/static/icons/tap.webp?v=${ASSET_MANIFEST["icons/tap.webp"]}`,
    );
  });

  it("clamps quality and picks width buckets", () => {
    expect(qualityOf(undefined, 75)).toBe(75);
    expect(qualityOf(10, 75)).toBe(75);
    expect(qualityOf(76, 75)).toBe(76);
    expect(qualityOf(200, 75)).toBe(92);
    expect(widthBucket(100)).toBe(128);
    expect(widthBucket(384)).toBe(384);
    expect(widthBucket(384.9)).toBe(384);
    expect(widthBucket(99999)).toBe(1536);
    expect(widthBucket(0)).toBeNull();
  });

  it("builds responsive static URLs with onerror=redirect", () => {
    expect(buildStaticResponsiveSrc({ src: "/board.webp", width: 384 })).toBe(
      `${CDN}/cdn-cgi/image/width=384,quality=75,format=auto,fit=scale-down,onerror=redirect/riftbound/static/board.webp?v=${ASSET_MANIFEST["board.webp"]}`,
    );
    expect(
      buildStaticResponsiveSrc({ src: "/guide-banners/challenger-tcg-partner.webp", width: 384 }),
    ).toBe(toStaticUrl("/guide-banners/challenger-tcg-partner.webp"));
  });

  it("builds responsive card URLs with the small-v2/original bucket split", () => {
    expect(buildResponsiveSrc({ src: "/cards/OGN-001.webp", width: 384 })).toBe(
      `${CDN}/cdn-cgi/image/width=384,quality=75,format=auto,fit=scale-down/riftbound/cards/small-v2/OGN-001.webp?v=f5b1b91d61327a2c`,
    );
    expect(buildResponsiveSrc({ src: "/cards/OGN-001.webp", width: 640 })).toBe(
      `${CDN}/cdn-cgi/image/width=640,quality=75,format=auto,fit=scale-down/riftbound/cards/original/OGN-001.webp?v=f5b1b91d61327a2c`,
    );
  });

  it("derives responsive widths from inline vw styles", () => {
    expect(responsiveWidthsFromStyle("width: 50vw")).toEqual([
      320, 384, 512, 640, 768, 1024, 1280, 1536,
    ]);
    expect(responsiveWidthsFromStyle("width: 10vw")).toEqual([
      96, 128, 192, 256, 320, 384, 512, 640, 768, 1024, 1280, 1536,
    ]);
  });

  it("maps image slots to asset sizes", () => {
    expect(slotToSize("thumb")).toBe("small-v2");
    expect(slotToSize("board")).toBe("small-v2");
    expect(slotToSize("hover")).toBe("original");
    expect(slotToSize("battlefieldDraft")).toBe("original");
  });

  it("sanitizes CDN asset URLs", () => {
    const url = buildCardImageUrl("/cards/OGN-001.webp", "small-v2");
    expect(sanitizeAssetUrl(url)).toBe(url);
    expect(
      sanitizeAssetUrl(
        "https://evil.example/riftbound/cards/small-v2/OGN-001.webp?v=f5b1b91d61327a2c",
      ),
    ).toBeNull();
    expect(sanitizeAssetUrl(`${CDN}/riftbound/cards/OGN-001.webp`)).toBeNull();
    expect(sanitizeAssetUrl(toStaticUrl("/board.webp"))).toBe(toStaticUrl("/board.webp"));
  });

  it("round-trips the same-origin asset fallback proxy", () => {
    const url = buildCardImageUrl("/cards/OGN-001.webp", "original");
    const proxied = toAssetFallbackUrl(url);
    expect(proxied).toBe(
      `/asset-fallback/riftbound/cards/original/OGN-001.webp?v=${CARD_IMAGE_REVISIONS["OGN-001.webp"]}`,
    );
    expect(fromAssetFallbackUrl(proxied!)).toBe(url);
    expect(toAssetFallbackUrl("/local/thing.webp")).toBeNull();
  });

  it("builds the 3-candidate locale fallback list", () => {
    setLocaleImageManifests({
      ko: {
        schemaVersion: 2,
        assetPathSegment: "ko",
        publishedSets: { OGN: ["OGN-001"] },
        assetRevisions: { "OGN-001": "0123456789abcdef" },
      },
    });
    const result = buildCardImageCandidates({
      src: "/cards/OGN-001.webp",
      slot: "small-v2",
      locale: "ko",
      cardId: "OGN-001",
    });
    expect(result.candidates).toEqual([
      `${CDN}/riftbound/cards/ko/small-v2/OGN-001.webp?v=0123456789abcdef`,
      `${CDN}/riftbound/cards/small-v2/OGN-001.webp?v=f5b1b91d61327a2c`,
      `${CDN}/riftbound/static/placeholder.svg?v=${ASSET_MANIFEST["placeholder.svg"]}`,
    ]);
    expect(result.candidateLocales).toEqual(["ko", "en", null]);
    expect(candidateLocaleOf(result, result.candidates[0]!)).toBe("ko");
    expect(defaultPublicationResolver("OGN-001", "fr").status).toBe("data-not-loaded");
    expect(defaultPublicationResolver("OGN-001", "en").status).toBe("not-requested");
  });

  it("validates locale manifests like the original", () => {
    expect(
      parseLocaleImageManifest("fr", {
        schemaVersion: 2,
        assetPathSegment: "fr",
        publishedSets: { RAD: ["RAD-063"] },
        assetRevisions: { "RAD-063": "a7e3911ac17e312a" },
      })?.assetPathSegment,
    ).toBe("fr");
    expect(parseLocaleImageManifest("fr", { schemaVersion: 1 })).toBeNull();
    expect(
      parseLocaleImageManifest("fr", {
        schemaVersion: 2,
        assetPathSegment: "fr",
        publishedSets: { RAD: ["OGN-001"] },
        assetRevisions: { "OGN-001": "a7e3911ac17e312a" },
      }),
    ).toBeNull();
  });

  it("swaps token art for localized card art candidates", () => {
    setLocaleImageManifests({
      fr: {
        schemaVersion: 2,
        assetPathSegment: "fr",
        publishedSets: { UNL: ["UNL-T02"] },
        assetRevisions: { "UNL-T02": "0123456789abcdef" },
      },
    });
    const result = withTokenArtCandidates({
      src: "/tokens/Bird.webp",
      slot: "original",
      locale: "fr",
      cardId: "UNL-T02",
    });
    expect(result.candidates[0]).toBe(
      `${CDN}/riftbound/cards/fr/original/UNL-T02.webp?v=0123456789abcdef`,
    );
    expect(result.candidates[1]).toBe("/tokens/Bird.webp");
    expect(result.candidateLocales).toEqual(["fr", "en", null]);
    expect(candidateLocaleOf(result, result.candidates[0]!)).toBe("fr");
  });

  it("builds keyword icon candidates only for manifest-resolvable assets", () => {
    expect(keywordIconCandidates("Assault 2")).toEqual([
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault_2.webp?v=${ASSET_MANIFEST["icons/assault_2.webp"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault_2.svg?v=${ASSET_MANIFEST["icons/assault_2.svg"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault.webp?v=${ASSET_MANIFEST["icons/assault.webp"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault.svg?v=${ASSET_MANIFEST["icons/assault.svg"]}`,
    ]);
    expect(keywordIconCandidates("nope")).toEqual([]);
  });
});
