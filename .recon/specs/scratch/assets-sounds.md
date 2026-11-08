# Asset manifest, sounds & card-image slots — Rift Atlas simulator (/play)

Source: static recon of `play.riftatlas.com` (playapp tree). All quotes are verbatim from the
prettified bundles in `.recon/pretty/playapp/` (file:line given). Manifest data:
`.recon/api/asset-manifest.json` (verbatim copy of the runtime table). Downloaded assets:
`.recon/site/assets/cdn/` (**187/187 files present, 0 missing**).

Key modules referenced below (each bundle file registers its modules with
`e.s([...], <id>)`; ids/aliases are re-bound per factory, ids below are the registration ids):

| module id | file | role |
|---|---|---|
| `633272` | `1ixua9twvm95a.js` | static **asset manifest** (`N`/`z`), manifest keys (`d`/`t`), static base URL (`n`/`w`) |
| `957423` | `1ixua9twvm95a.js` | **card/static image URL builders** (`N`,`R`,`V`,`y`,`o`,`O`,`f`,`h`,`M`) |
| `133704` | `123h3ohyw0ag5.js` | reads the *currently displayed* card-art `<img>` (currentSrc/srcset width) + cache key |
| `454008` | `123h3ohyw0ag5.js` | localized errata / rules-text resolver |
| `582436` | `123h3ohyw0ag5.js` | token-art → card-code **fallback resolver** (`f`) |
| `926062` | `123h3ohyw0ag5.js` | `GameCardArt`, `resolveGameCardImageSlot`, `resolvePreferredGameCardImageUrl` |
| `928748` | `123h3ohyw0ag5.js` | `sources`/`candidateLocales` builder (`x`), displayed-source match (`F`), index step (`g`) |
| `718355` | `123h3ohyw0ag5.js` | **image loader allowlist/URL validator** (`f`), asset error log (`D`), `online`/`visibility` signal (`P`) |
| `608607` | `2goht72gp0rq8.js` | **SFX volume** store (`riftbound_simulator_sfx_volume:v2`) |
| `123139` | `2goht72gp0rq8.js` | **SFX engine** (`v` registry, `y` play, `c` preload-all, `C` preload-one, `f` debug snapshot) |
| `533812` | `2-nry424r0961.js` | playmat/sleeve/token-art **customization** contexts + default card-back resolver (`R`) |

---

## A. ASSET MANIFEST MAP

### A.0 URL form used at runtime

Static (UI) assets — this is the exact runtime form:

```
https://assets.riftatlas-workers.com/riftbound/static/<manifest-key>?v=<16-hex revision>
```

Resized variant (Cloudflare Image Resizing, same origin as the asset host):

```
https://assets.riftatlas-workers.com/cdn-cgi/image/width=<bucket>,quality=<75..92>,format=auto,fit=scale-down,onerror=redirect/riftbound/static/<manifest-key>?v=<rev>
```

Card art (separate base, `?v=` comes from the card-image revision map, not this manifest):

```
https://assets.riftatlas-workers.com/riftbound/cards/[<locale>/]{small-v2|original}/<CARDID>.webp?v=<rev>
```

The bases are hardcoded constants (there is **no** asset-base env var in the bundle; the
`process.env` shim at `1ixua9twvm95a.js:1855-1859` always falls back to `D`):
`w = "https://assets.riftatlas-workers.com/riftbound/static"` (`1ixua9twvm95a.js:1535`) and
`D = "https://assets.riftatlas-workers.com/riftbound/cards"` (`1ixua9twvm95a.js:1732`).

#### A.0.1 `1ixua9twvm95a.js` — asset manifest + URL builders (verbatim)

Module `633272` (manifest + bases), `1ixua9twvm95a.js:1530-1535`:

```js
      f = Object.freeze([640, 768, 1024, 1280, 1536]),
      p = Object.freeze([
        ...Object.freeze([96, 128, 192, 256, 320, 384, 512]),
        ...f,
      ]),
      w = "https://assets.riftatlas-workers.com/riftbound/static",
      N = Object.freeze({
        "ads/tcgplayer-international-shipping-skyscraper.jpeg":
          "13738ece4d852947",
        ...
      }),
      t = Object.freeze(Object.keys(N));
    e.s(["n", 0, w, "d", 0, t, "z", 0, N], 633272);
```

→ **width buckets** (verbatim): `[96, 128, 192, 256, 320, 384, 512, 640, 768, 1024, 1280, 1536]`.

Module `957423` (builders). Base/namespace helpers, `1ixua9twvm95a.js:1732-1781`:

```js
    let D = "https://assets.riftatlas-workers.com/riftbound/cards",
      s = "small-v2",
      n = /^https?:\/\//i,
      r = new Set([s, "original"]),
      i = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu,
      S = /(^|\s)(1?\d?\d)vw/g,
```

```js
    function R(e) {
      let b = e.trim();
      return 0 === b.length ? D : "/" === b ? b : b.replace(/\/+$/, "");
    }
    function l(e) {
      let b = e.trim();
      if (!b) return "";
      let a = (b.split(/[?#]/u, 1)[0] ?? "").replace(/^\/+/, ""),
        c = (a.startsWith("cards/") ? a.slice(6) : a)
          .split("/")
          .filter(Boolean);
      return 0 === c.length
        ? ""
        : (r.has(c[0] ?? "") && c.shift(), c.join("/"));
    }
```

Card-image URL builder (adds `?v=<revision>` from the card-image revision map `d`),
`1ixua9twvm95a.js:1814-1860`:

```js
    function F(e) {
      let b,
        a =
          ((b = e.managedRelativePath.split("/").filter(Boolean)),
          i.test(b[0] ?? "") && r.has(b[1] ?? "") && !(b.length < 3)
            ? {
                assetPathSegment: b[0] ?? "",
                relativePath: b.slice(2).join("/"),
              }
            : null),
        c = a
          ? "/" === e.assetBaseUrl
            ? `/${a.assetPathSegment}`
            : `${e.assetBaseUrl}/${a.assetPathSegment}`
          : e.assetBaseUrl,
        f = a?.relativePath ?? e.managedRelativePath,
        p = (function (e, b, a = L()) {
          let c = R(a),
            f = l(b);
          if (!f) return "";
          let p = "/" === c ? `/${e}/${f}` : `${c}/${e}/${f}`,
            w = d[f];
          return w ? `${p}?v=${w}` : p;
        })(e.slot, f, c);
      return (
        a &&
          p &&
          (p = `${p.split(/[?#]/u, 1)[0]}${(function (e) {
            try {
              return new URL(e).search;
            } catch {
              let b = e.indexOf("?");
              if (b < 0) return "";
              let a = e.indexOf("#", b);
              return e.slice(b, a < 0 ? void 0 : a);
            }
          })(e.src)}`),
        { assetBaseUrl: c, sourceUrl: p }
      );
    }
    function L() {
      return R(
        (void 0 === b.default || void 0 === b.default.env
          ? void 0
          : "https://assets.riftatlas-workers.com/riftbound/cards") ?? D,
      );
    }
```

Static-base derivation + static asset URL (this is `E`, exported as `h`),
`1ixua9twvm95a.js:1861-1881`:

```js
    function u(e) {
      let b = R(e);
      return "/" === b
        ? "/static"
        : b.endsWith("/cards")
          ? `${b.slice(0, -6)}/static`
          : w;
    }
    function V(e) {
      let b = e.trim();
      if (!b || b.startsWith("data:") || n.test(b)) return null;
      let a = (b.split(/[?#]/u, 1)[0] ?? "").replace(/^\/+/, "");
      return a && A.has(a) ? a : null;
    }
    function E({ src: e, assetBaseUrl: b = L() }) {
      let a = e.trim(),
        c = V(a);
      if (!c) return a;
      let d = u(b);
      return `${d}/${c}?v=${N[c]}`;
    }
```

Cloudflare transform builder (`h`, exported as `M`) — `onerror=redirect` is **always** emitted by
this path, `1ixua9twvm95a.js:1882-1928`:

```js
    function h({ src: e, width: b, quality: a, assetBaseUrl: c = L() }) {
      let d = e.trim(),
        f = (function (e, b) {
          let a = V(e);
          if (a || !n.test(e.trim())) return a;
          try {
            let a = new URL(e);
            for (let e of new Set([u(b), w])) {
              if (e.startsWith("/")) continue;
              let b = new URL(e),
                c = `${b.pathname.replace(/\/$/u, "")}/`;
              if (a.origin === b.origin && a.pathname.startsWith(c))
                return V(a.pathname.slice(c.length));
            }
          } catch {}
          return null;
        })(d, c);
      if (!f) return d;
      let p = E({ src: d, assetBaseUrl: c });
      if (!(o.test(f) && G.has(f))) return p;
      let N = v(b);
      if (null === N) return p;
      let t = `width=${N},quality=${m(a, 75)},format=auto,fit=scale-down,onerror=redirect`;
      try {
        let e = new URL(p, "https://local.riftatlas.invalid");
        if ("https://local.riftatlas.invalid" === e.origin)
          return `/cdn-cgi/image/${t}${e.pathname}${e.search}`;
        return `${e.origin}/cdn-cgi/image/${t}${e.pathname}${e.search}`;
      } catch {
        return p;
      }
    }
    function g(e) {
      if (!Number.isFinite(e)) return null;
      let b = Math.trunc(e);
      return b > 0 ? b : null;
    }
    function m(e, b) {
      return Math.min(
        92,
        Math.max(75, ("number" == typeof e ? g(e) : null) ?? b),
      );
    }
    function v(e) {
      let b = g(e);
      return null === b ? null : (p.find((e) => e >= b) ?? p[p.length - 1]);
    }
```

Which static assets are eligible for `cdn-cgi` transforms (`G`, `1ixua9twvm95a.js:1739-1766`):

```js
      O = new Set(["guide-banners/challenger-tcg-partner.webp"]),
      G = new Set([
        "Discord-Symbol-Black.png",
        "Discord-Symbol-White.png",
        "ads/tcgplayer-international-shipping-skyscraper.jpeg",
        "auto_pay-poster.webp",
        "bmc-logo-no-background.png",
        "board.webp",
        "cardback-black-landscape.png",
        "cardback-black.png",
        "cardback-blue.png",
        "cardback-white.png",
        "effects/rewind-clock-face-v1.webp",
        "point-node-outline.png",
        "rewind-poster.webp",
        "showdown-poster.webp",
        "tcgplayer-logo-primary-white.png",
        ...t.filter(
          (e) =>
            !O.has(e) &&
            (e.startsWith("brand/rift-atlas/") ||
              e.startsWith("guide-banners/") ||
              e.startsWith("sealed/") ||
              e.startsWith("sets/")),
        ),
        ...t.filter((e) => e.startsWith("tokens/")),
      ]),
      o = /\.(?:jpe?g|png|webp)$/i;
```

Exports of `957423` (`1ixua9twvm95a.js:1929-2061`). ⚠️ The listing below is **abbreviated**
(only bare names and one-line signatures kept; bodies replaced by `/* … */`); the four lines that
are verbatim are `"h", 0, E,` / `"M", 0, h,`-style entries and the `slot` line quoted in §C.

```
    e.s(
      [
        "N", 0, L,
        "R", 0, function (e, b = L()) { /* asset-fallback rewrite */ },
        "V", 0, function (e, b = L()) { /* namespace → origin rewrite */ },
        "y", 0, function (e) { /* → F({ slot: "original" }).sourceUrl */ },
        "o", 0, function (e, b) { /* → F({ slot: b }).sourceUrl */ },
        "O", 0, function ({ src: e, width: b, quality: a, assetBaseUrl: c = L() }) {
          let d = h({ src: e, width: b, quality: a, assetBaseUrl: c });
          return d !== e.trim()
            ? d
            : (function ({ src: e, width: b, quality: a, assetBaseUrl: c = L() }) {
                ...
                let t =
                    null === (d = v(b))
                      ? null
                      : `width=${d},quality=${m(a, 75)},format=auto,fit=scale-down`,
                  { assetBaseUrl: D, sourceUrl: n } = F({
                    src: p,
                    managedRelativePath: N,
                    slot: null !== (f = v(b)) && f <= 384 ? s : "original",
                    assetBaseUrl: w,
                  });
                ...
              })({ src: e, width: b, quality: a, assetBaseUrl: c });
        },
        "f", 0, function (e) { /* vw-bucketed list: p.filter(e => e >= f[0]*0.01*min(vw)) */ },
        "h",
        0,
        E,
        "M",
        0,
        h,
      ],
      957423,
    );
```

Note the **slot-by-width rule** in `O`: when no explicit slot is given,
`v(width) <= 384 ? "small-v2" : "original"` (`1ixua9twvm95a.js:2029`), and `O`'s transform omits
`onerror=redirect` while `M`/`h` always includes it.

#### A.0.2 `123h3ohyw0ag5.js` — image loader / allowlist (verbatim)

Module `718355`, `123h3ohyw0ag5.js:1149-1175`:

```js
      var S = e.i(633272);
      let C = new URL(S.n).origin,
        k = new Set(S.d),
        A =
          /^\/riftbound\/cards\/(?:zh-CN\/)?(?:original|small-v2)\/[A-Z]{3}-[A-Z0-9]+\.webp$/u,
        I =
          /^width=\d{1,4},quality=\d{2},format=(?:auto|webp|avif),fit=scale-down(?:,onerror=redirect)?$/u;
      function $(e) {
        if (e.length > 1024) return null;
        try {
          let t = new URL(e);
          if (t.origin !== C || t.username || t.password) return null;
          let r = t.pathname;
          if (r.startsWith("/cdn-cgi/image/")) {
            let e = r.indexOf("/", 15);
            if (!I.test(r.slice(15, e))) return null;
            r = r.slice(e);
          }
          let n = r.startsWith("/riftbound/static/") && k.has(r.slice(18));
          if (!A.test(r) && !n) return null;
          let l = t.searchParams.get("v");
          return `${t.origin}${t.pathname}${l && /^[a-f0-9]{8,64}$/iu.test(l) ? `?v=${l}` : ""}`;
        } catch {
          return null;
        }
      }
```

Consequences: only same-origin (`assets.riftatlas-workers.com`) URLs pass; either the card-art
regex (English or `zh-CN`, `small-v2`/`original`, `<SET>-<ID>.webp`) **or** a path whose
`/riftbound/static/` suffix is a manifest key; transform params must match `I`; `v` must be
8–64 hex chars (otherwise the query is dropped).

### A.1 Full manifest table (187 entries)

`revision` = `?v=` value. `local` = file present in `.recon/site/assets/cdn/`.
Generated from `.recon/api/asset-manifest.json`.

| # | manifest key (`riftbound/static/<key>`) | `?v=` revision | local file |
|---|---|---|---|
| 1 | `ads/tcgplayer-international-shipping-skyscraper.jpeg` | `13738ece4d852947` | `site/assets/cdn/ads/tcgplayer-international-shipping-skyscraper.jpeg` ✔ |
| 2 | `auto_pay-poster.webp` | `34e5fd04588dff4f` | `site/assets/cdn/auto_pay-poster.webp` ✔ |
| 3 | `auto_pay.webp` | `7fa4f11067984b86` | `site/assets/cdn/auto_pay.webp` ✔ |
| 4 | `bmc-logo-no-background.png` | `acd4aef87452fcc8` | `site/assets/cdn/bmc-logo-no-background.png` ✔ |
| 5 | `board.webp` | `505ed5610a3785dd` | `site/assets/cdn/board.webp` ✔ |
| 6 | `brand/rift-atlas/rift-atlas-app-icon.webp` | `fb3142785adb80e5` | `site/assets/cdn/brand/rift-atlas/rift-atlas-app-icon.webp` ✔ |
| 7 | `brand/rift-atlas/rift-atlas-lockup-black.webp` | `5aaa5d5633558e9b` | `site/assets/cdn/brand/rift-atlas/rift-atlas-lockup-black.webp` ✔ |
| 8 | `brand/rift-atlas/rift-atlas-lockup-primary.webp` | `d8a138cfde3c39e9` | `site/assets/cdn/brand/rift-atlas/rift-atlas-lockup-primary.webp` ✔ |
| 9 | `brand/rift-atlas/rift-atlas-lockup-white.webp` | `a0c23fc74588e32a` | `site/assets/cdn/brand/rift-atlas/rift-atlas-lockup-white.webp` ✔ |
| 10 | `brand/rift-atlas/rift-atlas-mark-black.webp` | `29f36aa05ad15aea` | `site/assets/cdn/brand/rift-atlas/rift-atlas-mark-black.webp` ✔ |
| 11 | `brand/rift-atlas/rift-atlas-mark-header.webp` | `d09fb621b3c8448a` | `site/assets/cdn/brand/rift-atlas/rift-atlas-mark-header.webp` ✔ |
| 12 | `brand/rift-atlas/rift-atlas-mark-hollow-gold.webp` | `80a657873fcee832` | `site/assets/cdn/brand/rift-atlas/rift-atlas-mark-hollow-gold.webp` ✔ |
| 13 | `brand/rift-atlas/rift-atlas-mark-primary.webp` | `28ba004d68b65988` | `site/assets/cdn/brand/rift-atlas/rift-atlas-mark-primary.webp` ✔ |
| 14 | `brand/rift-atlas/rift-atlas-mark-white.webp` | `f400e988b286e89c` | `site/assets/cdn/brand/rift-atlas/rift-atlas-mark-white.webp` ✔ |
| 15 | `brand/rift-atlas/rift-atlas-social-card.webp` | `c0fed8222425b21e` | `site/assets/cdn/brand/rift-atlas/rift-atlas-social-card.webp` ✔ |
| 16 | `cardback-black-landscape.png` | `dc33540653e13e68` | `site/assets/cdn/cardback-black-landscape.png` ✔ |
| 17 | `cardback-black.png` | `46c03a14aaac1029` | `site/assets/cdn/cardback-black.png` ✔ |
| 18 | `cardback-blue.png` | `1fee21bf638b9cb8` | `site/assets/cdn/cardback-blue.png` ✔ |
| 19 | `cardback-white.png` | `e60116d5a1e2eddb` | `site/assets/cdn/cardback-white.png` ✔ |
| 20 | `Discord-Symbol-Black.png` | `3667ac4e3a56f19d` | `site/assets/cdn/Discord-Symbol-Black.png` ✔ |
| 21 | `Discord-Symbol-White.png` | `64dce9107da58318` | `site/assets/cdn/Discord-Symbol-White.png` ✔ |
| 22 | `effects/rewind-clock-face-v1.webp` | `80119dca0ce1d635` | `site/assets/cdn/effects/rewind-clock-face-v1.webp` ✔ |
| 23 | `guide-banners/challenger-tcg-partner.webp` | `4a989bf25b87052e` | `site/assets/cdn/guide-banners/challenger-tcg-partner.webp` ✔ |
| 24 | `guide-banners/death-from-below-the-pyke-guide.webp` | `c2243cbfb5220534` | `site/assets/cdn/guide-banners/death-from-below-the-pyke-guide.webp` ✔ |
| 25 | `guide-banners/featured-generic-guide.webp` | `98a1d866519ca075` | `site/assets/cdn/guide-banners/featured-generic-guide.webp` ✔ |
| 26 | `guide-banners/kennen-the-heart-of-the-tempest.webp` | `a12c0d29e9ce76ec` | `site/assets/cdn/guide-banners/kennen-the-heart-of-the-tempest.webp` ✔ |
| 27 | `guide-banners/leblanc-riftbound-playmat.webp` | `23f97932ef2898f7` | `site/assets/cdn/guide-banners/leblanc-riftbound-playmat.webp` ✔ |
| 28 | `guide-banners/leblanc-the-queen-of-death.webp` | `eacaaf3f8a801b6e` | `site/assets/cdn/guide-banners/leblanc-the-queen-of-death.webp` ✔ |
| 29 | `guide-banners/the-complete-guide-to-draven.webp` | `59c21c4c5dbc5f65` | `site/assets/cdn/guide-banners/the-complete-guide-to-draven.webp` ✔ |
| 30 | `guide-banners/the-five-best-decks-in-unleashed.webp` | `ab0793f8de17da27` | `site/assets/cdn/guide-banners/the-five-best-decks-in-unleashed.webp` ✔ |
| 31 | `guide-banners/the-unseen-threat-the-best-of-khazix-guide.webp` | `f6f3e48013ed1ab2` | `site/assets/cdn/guide-banners/the-unseen-threat-the-best-of-khazix-guide.webp` ✔ |
| 32 | `icons/0.svg` | `c41af738baf3c321` | `site/assets/cdn/icons/0.svg` ✔ |
| 33 | `icons/1.svg` | `78d8fb8f73f79017` | `site/assets/cdn/icons/1.svg` ✔ |
| 34 | `icons/2.svg` | `f44e879daed57fed` | `site/assets/cdn/icons/2.svg` ✔ |
| 35 | `icons/3.svg` | `fe2767af7fc71a5d` | `site/assets/cdn/icons/3.svg` ✔ |
| 36 | `icons/4.svg` | `4a721ee9a3e0b43b` | `site/assets/cdn/icons/4.svg` ✔ |
| 37 | `icons/5.svg` | `723eb2670d97cf0a` | `site/assets/cdn/icons/5.svg` ✔ |
| 38 | `icons/6.svg` | `695c9d42c9e8d860` | `site/assets/cdn/icons/6.svg` ✔ |
| 39 | `icons/7.svg` | `f676897549a21619` | `site/assets/cdn/icons/7.svg` ✔ |
| 40 | `icons/8.svg` | `360c454538f6280b` | `site/assets/cdn/icons/8.svg` ✔ |
| 41 | `icons/accelerate.svg` | `dcd7ce1cb20aae2e` | `site/assets/cdn/icons/accelerate.svg` ✔ |
| 42 | `icons/accelerate.webp` | `9e0147816313320f` | `site/assets/cdn/icons/accelerate.webp` ✔ |
| 43 | `icons/action.svg` | `791b73656eab9840` | `site/assets/cdn/icons/action.svg` ✔ |
| 44 | `icons/action.webp` | `adee9454b23a5060` | `site/assets/cdn/icons/action.webp` ✔ |
| 45 | `icons/add.svg` | `f5f08dc1486ff964` | `site/assets/cdn/icons/add.svg` ✔ |
| 46 | `icons/add.webp` | `452dc34b4c30c3b0` | `site/assets/cdn/icons/add.webp` ✔ |
| 47 | `icons/ambush.svg` | `2d74e175ed260053` | `site/assets/cdn/icons/ambush.svg` ✔ |
| 48 | `icons/assault_2.svg` | `ea1dac21e5fec00f` | `site/assets/cdn/icons/assault_2.svg` ✔ |
| 49 | `icons/assault_2.webp` | `fb36d70f6ce2f5ae` | `site/assets/cdn/icons/assault_2.webp` ✔ |
| 50 | `icons/assault_3.svg` | `3f852923df21b35a` | `site/assets/cdn/icons/assault_3.svg` ✔ |
| 51 | `icons/assault_3.webp` | `425e467b028e90c5` | `site/assets/cdn/icons/assault_3.webp` ✔ |
| 52 | `icons/assault.svg` | `9b6b6d6b992d439b` | `site/assets/cdn/icons/assault.svg` ✔ |
| 53 | `icons/assault.webp` | `2ee8885d1a27896b` | `site/assets/cdn/icons/assault.webp` ✔ |
| 54 | `icons/body.webp` | `8f667e4ec1b9b748` | `site/assets/cdn/icons/body.webp` ✔ |
| 55 | `icons/buff.svg` | `cb4cb83b8ba587ed` | `site/assets/cdn/icons/buff.svg` ✔ |
| 56 | `icons/burn_2.svg` | `56290529d1e54b14` | `site/assets/cdn/icons/burn_2.svg` ✔ |
| 57 | `icons/burn_3.svg` | `7be89a1d3888afee` | `site/assets/cdn/icons/burn_3.svg` ✔ |
| 58 | `icons/calm.webp` | `b50d713a1483c62c` | `site/assets/cdn/icons/calm.webp` ✔ |
| 59 | `icons/chaos.webp` | `224b21112ac43e32` | `site/assets/cdn/icons/chaos.webp` ✔ |
| 60 | `icons/deathknell.svg` | `c3357ba444f64d2f` | `site/assets/cdn/icons/deathknell.svg` ✔ |
| 61 | `icons/deathknell.webp` | `58c270e018ef7662` | `site/assets/cdn/icons/deathknell.webp` ✔ |
| 62 | `icons/deflect_2.svg` | `b94d056701aee2d5` | `site/assets/cdn/icons/deflect_2.svg` ✔ |
| 63 | `icons/deflect_2.webp` | `f15f86a5f31ba98d` | `site/assets/cdn/icons/deflect_2.webp` ✔ |
| 64 | `icons/deflect_3.svg` | `06e82afb43811f32` | `site/assets/cdn/icons/deflect_3.svg` ✔ |
| 65 | `icons/deflect.svg` | `153d6e19c0db2230` | `site/assets/cdn/icons/deflect.svg` ✔ |
| 66 | `icons/deflect.webp` | `5b6996a670fb4d1c` | `site/assets/cdn/icons/deflect.webp` ✔ |
| 67 | `icons/empower.svg` | `854dd417d8c94579` | `site/assets/cdn/icons/empower.svg` ✔ |
| 68 | `icons/empowered.svg` | `4e4cd9c2e803df1c` | `site/assets/cdn/icons/empowered.svg` ✔ |
| 69 | `icons/equip.svg` | `f5267b5c12126aca` | `site/assets/cdn/icons/equip.svg` ✔ |
| 70 | `icons/equip.webp` | `6862c5a4d69ae3a9` | `site/assets/cdn/icons/equip.webp` ✔ |
| 71 | `icons/flow.svg` | `2f1bba1a52e08069` | `site/assets/cdn/icons/flow.svg` ✔ |
| 72 | `icons/fury.webp` | `096b571a0d211bc2` | `site/assets/cdn/icons/fury.webp` ✔ |
| 73 | `icons/ganking.svg` | `701b8ab0922895a2` | `site/assets/cdn/icons/ganking.svg` ✔ |
| 74 | `icons/ganking.webp` | `a14aa8843f14afff` | `site/assets/cdn/icons/ganking.webp` ✔ |
| 75 | `icons/hidden.svg` | `3fbad30c7f62815d` | `site/assets/cdn/icons/hidden.svg` ✔ |
| 76 | `icons/hidden.webp` | `351decf3c37f6707` | `site/assets/cdn/icons/hidden.webp` ✔ |
| 77 | `icons/hunt_2.svg` | `7b2eeeb254470f2d` | `site/assets/cdn/icons/hunt_2.svg` ✔ |
| 78 | `icons/hunt.svg` | `e33ca257b09b7ded` | `site/assets/cdn/icons/hunt.svg` ✔ |
| 79 | `icons/legion.svg` | `9a2f7a5ef7179b81` | `site/assets/cdn/icons/legion.svg` ✔ |
| 80 | `icons/legion.webp` | `e7c9caa0830e22bc` | `site/assets/cdn/icons/legion.webp` ✔ |
| 81 | `icons/level_11.svg` | `397554e1ff6e585c` | `site/assets/cdn/icons/level_11.svg` ✔ |
| 82 | `icons/level_16.svg` | `c26280beb5a0cae2` | `site/assets/cdn/icons/level_16.svg` ✔ |
| 83 | `icons/level_3.svg` | `b3bb23cebae1da65` | `site/assets/cdn/icons/level_3.svg` ✔ |
| 84 | `icons/level_6.svg` | `0befcb160985ad5a` | `site/assets/cdn/icons/level_6.svg` ✔ |
| 85 | `icons/might.webp` | `10920d6ec63284c4` | `site/assets/cdn/icons/might.webp` ✔ |
| 86 | `icons/mighty.svg` | `14bfee0809dcde01` | `site/assets/cdn/icons/mighty.svg` ✔ |
| 87 | `icons/mighty.webp` | `a8a359266a06c17b` | `site/assets/cdn/icons/mighty.webp` ✔ |
| 88 | `icons/mind.webp` | `6048cf14d9a113ef` | `site/assets/cdn/icons/mind.webp` ✔ |
| 89 | `icons/neutral.svg` | `e80e3be1a2ecdb4f` | `site/assets/cdn/icons/neutral.svg` ✔ |
| 90 | `icons/order.webp` | `f00299635232b05a` | `site/assets/cdn/icons/order.webp` ✔ |
| 91 | `icons/predict.svg` | `1047df5fb7dfcdd0` | `site/assets/cdn/icons/predict.svg` ✔ |
| 92 | `icons/quick-draw.svg` | `f7d485a38eec323b` | `site/assets/cdn/icons/quick-draw.svg` ✔ |
| 93 | `icons/quick-draw.webp` | `c3772ccb6346b416` | `site/assets/cdn/icons/quick-draw.webp` ✔ |
| 94 | `icons/reaction.svg` | `136bcf1ab781e12f` | `site/assets/cdn/icons/reaction.svg` ✔ |
| 95 | `icons/reaction.webp` | `85f16d9ed5c4c6c2` | `site/assets/cdn/icons/reaction.webp` ✔ |
| 96 | `icons/repeat.svg` | `bd0a545be6ff4bf4` | `site/assets/cdn/icons/repeat.svg` ✔ |
| 97 | `icons/repeat.webp` | `c2e878352cd67f22` | `site/assets/cdn/icons/repeat.webp` ✔ |
| 98 | `icons/rune.webp` | `2f1b222dd32ee6ff` | `site/assets/cdn/icons/rune.webp` ✔ |
| 99 | `icons/shield_2.svg` | `be39a9e814d77f97` | `site/assets/cdn/icons/shield_2.svg` ✔ |
| 100 | `icons/shield_2.webp` | `b3c83af99c0394b0` | `site/assets/cdn/icons/shield_2.webp` ✔ |
| 101 | `icons/shield_3.svg` | `b3d7ee63dbc6ceb9` | `site/assets/cdn/icons/shield_3.svg` ✔ |
| 102 | `icons/shield_3.webp` | `1e4d3d33dda52881` | `site/assets/cdn/icons/shield_3.webp` ✔ |
| 103 | `icons/shield_5.webp` | `18aeaf8b349dcb6c` | `site/assets/cdn/icons/shield_5.webp` ✔ |
| 104 | `icons/shield.svg` | `273aef3a7a70eaee` | `site/assets/cdn/icons/shield.svg` ✔ |
| 105 | `icons/shield.webp` | `6c43c21fa5df95bc` | `site/assets/cdn/icons/shield.webp` ✔ |
| 106 | `icons/tank.svg` | `abb37f9ad15ff16e` | `site/assets/cdn/icons/tank.svg` ✔ |
| 107 | `icons/tank.webp` | `6b20f1f3ce4d4b46` | `site/assets/cdn/icons/tank.webp` ✔ |
| 108 | `icons/tap.webp` | `99517cc380990a8c` | `site/assets/cdn/icons/tap.webp` ✔ |
| 109 | `icons/temporary.svg` | `17be0d040b258401` | `site/assets/cdn/icons/temporary.svg` ✔ |
| 110 | `icons/temporary.webp` | `ec82f91b867d761d` | `site/assets/cdn/icons/temporary.webp` ✔ |
| 111 | `icons/vision.svg` | `8e85a8b5fa812c21` | `site/assets/cdn/icons/vision.svg` ✔ |
| 112 | `icons/vision.webp` | `8c584fee0b465298` | `site/assets/cdn/icons/vision.webp` ✔ |
| 113 | `icons/weaponmaster.svg` | `086eefd86d62380d` | `site/assets/cdn/icons/weaponmaster.svg` ✔ |
| 114 | `icons/weaponmaster.webp` | `003d60d7bde6d34a` | `site/assets/cdn/icons/weaponmaster.webp` ✔ |
| 115 | `placeholder.svg` | `64badf7aabda0b96` | `site/assets/cdn/placeholder.svg` ✔ |
| 116 | `point-node-outline.png` | `1ea1e9a70be0ed76` | `site/assets/cdn/point-node-outline.png` ✔ |
| 117 | `rewind-poster.webp` | `e567360fffeb62d2` | `site/assets/cdn/rewind-poster.webp` ✔ |
| 118 | `rewind.webp` | `fe101bb76573d18e` | `site/assets/cdn/rewind.webp` ✔ |
| 119 | `sealed/radiance-booster.webp` | `0096406d32b420c5` | `site/assets/cdn/sealed/radiance-booster.webp` ✔ |
| 120 | `sealed/radiance-prerift-kit.webp` | `4998f74b72b86a73` | `site/assets/cdn/sealed/radiance-prerift-kit.webp` ✔ |
| 121 | `sealed/unleashed-booster.webp` | `5191998836fc7b3e` | `site/assets/cdn/sealed/unleashed-booster.webp` ✔ |
| 122 | `sealed/unleashed-prerift-kit.webp` | `5e097e7abce93b4e` | `site/assets/cdn/sealed/unleashed-prerift-kit.webp` ✔ |
| 123 | `sealed/vendetta-booster.webp` | `3f210a773113fc10` | `site/assets/cdn/sealed/vendetta-booster.webp` ✔ |
| 124 | `sealed/vendetta-prerift-kit.webp` | `8905ff29cf816644` | `site/assets/cdn/sealed/vendetta-prerift-kit.webp` ✔ |
| 125 | `sets/origins-wordmark.webp` | `f43dbae04cb3e173` | `site/assets/cdn/sets/origins-wordmark.webp` ✔ |
| 126 | `sets/radiance-wordmark.webp` | `cf8726d966838e8e` | `site/assets/cdn/sets/radiance-wordmark.webp` ✔ |
| 127 | `sets/spiritforged-wordmark.webp` | `a8edd5e1532f8b1a` | `site/assets/cdn/sets/spiritforged-wordmark.webp` ✔ |
| 128 | `sets/unleashed-wordmark.webp` | `4437627c2b696744` | `site/assets/cdn/sets/unleashed-wordmark.webp` ✔ |
| 129 | `sets/vendetta-wordmark.webp` | `2bcda3e32dc36a76` | `site/assets/cdn/sets/vendetta-wordmark.webp` ✔ |
| 130 | `setup/first-player-choice-opponent-v2.webp` | `c457de744e22aee9` | `site/assets/cdn/setup/first-player-choice-opponent-v2.webp` ✔ |
| 131 | `setup/first-player-choice-self-v2.webp` | `a1340b11dc4dc44b` | `site/assets/cdn/setup/first-player-choice-self-v2.webp` ✔ |
| 132 | `setup/player-left-panel-v1.webp` | `2a33c209b16b9efc` | `site/assets/cdn/setup/player-left-panel-v1.webp` ✔ |
| 133 | `showdown-poster.webp` | `f65537fd93df4edc` | `site/assets/cdn/showdown-poster.webp` ✔ |
| 134 | `showdown.webp` | `e959e0bba859da41` | `site/assets/cdn/showdown.webp` ✔ |
| 135 | `sounds/20260716/baron_nashor.webm` | `ac62659f08f353ad` | `site/assets/cdn/sounds/20260716/baron_nashor.webm` ✔ |
| 136 | `sounds/20260716/card_autopay1.webm` | `79e05db310470b3f` | `site/assets/cdn/sounds/20260716/card_autopay1.webm` ✔ |
| 137 | `sounds/20260716/card_autopay2.webm` | `0f5c4c2f935eabee` | `site/assets/cdn/sounds/20260716/card_autopay2.webm` ✔ |
| 138 | `sounds/20260716/card_autopay3.webm` | `b3a09163c321e2d2` | `site/assets/cdn/sounds/20260716/card_autopay3.webm` ✔ |
| 139 | `sounds/20260716/card_click1.webm` | `1f57c627e383bff3` | `site/assets/cdn/sounds/20260716/card_click1.webm` ✔ |
| 140 | `sounds/20260716/card_discard1.webm` | `ad7728e1d4ecb7e4` | `site/assets/cdn/sounds/20260716/card_discard1.webm` ✔ |
| 141 | `sounds/20260716/card_draw1.webm` | `22e23ab24b0d1e3d` | `site/assets/cdn/sounds/20260716/card_draw1.webm` ✔ |
| 142 | `sounds/20260716/card_exhaust1.webm` | `f4cd1c03b6cc31ec` | `site/assets/cdn/sounds/20260716/card_exhaust1.webm` ✔ |
| 143 | `sounds/20260716/card_exhaust2.webm` | `772ddb5c253362e1` | `site/assets/cdn/sounds/20260716/card_exhaust2.webm` ✔ |
| 144 | `sounds/20260716/card_hover1.webm` | `e11332036af8dd81` | `site/assets/cdn/sounds/20260716/card_hover1.webm` ✔ |
| 145 | `sounds/20260716/card_hover2.webm` | `d94f5030f8bd5614` | `site/assets/cdn/sounds/20260716/card_hover2.webm` ✔ |
| 146 | `sounds/20260716/card_hover3.webm` | `b64ee838c7765003` | `site/assets/cdn/sounds/20260716/card_hover3.webm` ✔ |
| 147 | `sounds/20260716/card_play_from_hand.webm` | `5737eec7cdc4d6e5` | `site/assets/cdn/sounds/20260716/card_play_from_hand.webm` ✔ |
| 148 | `sounds/20260716/card_play1.webm` | `75fbbcb0fe40e0da` | `site/assets/cdn/sounds/20260716/card_play1.webm` ✔ |
| 149 | `sounds/20260716/card_recycle1.webm` | `85cb9ae222489043` | `site/assets/cdn/sounds/20260716/card_recycle1.webm` ✔ |
| 150 | `sounds/20260716/chat_message.webm` | `59af45aaa8ee3ad7` | `site/assets/cdn/sounds/20260716/chat_message.webm` ✔ |
| 151 | `sounds/20260716/game_rewind1.webm` | `3817eb8a137080b3` | `site/assets/cdn/sounds/20260716/game_rewind1.webm` ✔ |
| 152 | `sounds/20260716/game_rewind2.webm` | `db3d03b9d291db76` | `site/assets/cdn/sounds/20260716/game_rewind2.webm` ✔ |
| 153 | `sounds/20260716/game_rewind5.webm` | `b316b2c2d8f9a41b` | `site/assets/cdn/sounds/20260716/game_rewind5.webm` ✔ |
| 154 | `sounds/20260716/game_start.webm` | `90b272d760c382ab` | `site/assets/cdn/sounds/20260716/game_start.webm` ✔ |
| 155 | `sounds/20260716/ping-v2.webm` | `cdc7a62221c75f14` | `site/assets/cdn/sounds/20260716/ping-v2.webm` ✔ |
| 156 | `sounds/20260716/ping.webm` | `16ea0b9a04f9a37e` | `site/assets/cdn/sounds/20260716/ping.webm` ✔ |
| 157 | `sounds/20260716/score_conquer1.webm` | `337a43ddfcdf173b` | `site/assets/cdn/sounds/20260716/score_conquer1.webm` ✔ |
| 158 | `sounds/20260716/score_end.webm` | `6d47a8d52b72a9e3` | `site/assets/cdn/sounds/20260716/score_end.webm` ✔ |
| 159 | `sounds/20260716/score_generic.webm` | `c04f36443415491b` | `site/assets/cdn/sounds/20260716/score_generic.webm` ✔ |
| 160 | `sounds/20260716/score_hold.webm` | `906fa4a7cb973c01` | `site/assets/cdn/sounds/20260716/score_hold.webm` ✔ |
| 161 | `sounds/20260716/time_warp.webm` | `99c7c2c699a43d9e` | `site/assets/cdn/sounds/20260716/time_warp.webm` ✔ |
| 162 | `sounds/20260716/turn_start.webm` | `ee21fb803de49d51` | `site/assets/cdn/sounds/20260716/turn_start.webm` ✔ |
| 163 | `sounds/20260716/ui_click1.webm` | `111d8112cac9c31f` | `site/assets/cdn/sounds/20260716/ui_click1.webm` ✔ |
| 164 | `sounds/20260716/ui_click2.webm` | `fccc2d7d590af080` | `site/assets/cdn/sounds/20260716/ui_click2.webm` ✔ |
| 165 | `sounds/20260716/ui_confirm.webm` | `8fee6628037ddb08` | `site/assets/cdn/sounds/20260716/ui_confirm.webm` ✔ |
| 166 | `tcgplayer-logo-primary-white.png` | `6405043fb4e11d85` | `site/assets/cdn/tcgplayer-logo-primary-white.png` ✔ |
| 167 | `tokens/Bird.webp` | `99be4fbbd69c7202` | `site/assets/cdn/tokens/Bird.webp` ✔ |
| 168 | `tokens/Brush.webp` | `ee597f4c63b9f839` | `site/assets/cdn/tokens/Brush.webp` ✔ |
| 169 | `tokens/Gold.webp` | `3bec6baa2fe394b9` | `site/assets/cdn/tokens/Gold.webp` ✔ |
| 170 | `tokens/Mech.webp` | `64812bc42939f0b2` | `site/assets/cdn/tokens/Mech.webp` ✔ |
| 171 | `tokens/Recruit.webp` | `e0e561a307d80b8f` | `site/assets/cdn/tokens/Recruit.webp` ✔ |
| 172 | `tokens/Reflection.webp` | `34d22eedfabd1ae2` | `site/assets/cdn/tokens/Reflection.webp` ✔ |
| 173 | `tokens/SandSoldier.webp` | `0c6b5a8dfbfce039` | `site/assets/cdn/tokens/SandSoldier.webp` ✔ |
| 174 | `tokens/ShadowClone.webp` | `4e0526bd812d74cb` | `site/assets/cdn/tokens/ShadowClone.webp` ✔ |
| 175 | `tokens/Sprite.webp` | `c8a7c2fbc39415cf` | `site/assets/cdn/tokens/Sprite.webp` ✔ |
| 176 | `tokens/Tentacle.webp` | `1d02aada5412716a` | `site/assets/cdn/tokens/Tentacle.webp` ✔ |
| 177 | `tokens/thumbs/Bird.webp` | `af8b0bbba10d0271` | `site/assets/cdn/tokens/thumbs/Bird.webp` ✔ |
| 178 | `tokens/thumbs/Brush.webp` | `60a86eafc57f6d88` | `site/assets/cdn/tokens/thumbs/Brush.webp` ✔ |
| 179 | `tokens/thumbs/Gold.webp` | `163c9fd497e0bfdf` | `site/assets/cdn/tokens/thumbs/Gold.webp` ✔ |
| 180 | `tokens/thumbs/Mech.webp` | `fe978a5e688ad304` | `site/assets/cdn/tokens/thumbs/Mech.webp` ✔ |
| 181 | `tokens/thumbs/Recruit.webp` | `ed4aaff5d63cf7a2` | `site/assets/cdn/tokens/thumbs/Recruit.webp` ✔ |
| 182 | `tokens/thumbs/Reflection.webp` | `acc3c243d25d503d` | `site/assets/cdn/tokens/thumbs/Reflection.webp` ✔ |
| 183 | `tokens/thumbs/SandSoldier.webp` | `175ad4c554cff893` | `site/assets/cdn/tokens/thumbs/SandSoldier.webp` ✔ |
| 184 | `tokens/thumbs/ShadowClone.webp` | `af59e8cd618177cc` | `site/assets/cdn/tokens/thumbs/ShadowClone.webp` ✔ |
| 185 | `tokens/thumbs/Sprite.webp` | `f182bce0225105eb` | `site/assets/cdn/tokens/thumbs/Sprite.webp` ✔ |
| 186 | `tokens/thumbs/Tentacle.webp` | `5771794bf568e59b` | `site/assets/cdn/tokens/thumbs/Tentacle.webp` ✔ |
| 187 | `turnem-sideways-logo-v1.webp` | `d788c9bc48fdec7b` | `site/assets/cdn/turnem-sideways-logo-v1.webp` ✔ |

### A.2 Category call-outs

**Board background / playmat**
- `board.webp` (`505ed5610a3785dd`) — the only playmat image in the manifest (default board skin).
  It is in the transform allowlist `G` but **no bundle references `/board.webp` literally**: the
  playmat actually rendered comes from the cosmetics catalogue
  (`3-d7t6_l98oo1.js:1315/1338/...` → `/cosmetics/creators/<artist>/playmats/<pack>/board.webp`),
  so `board.webp` is the fallback/default table skin asset.
- `rewind.webp`, `auto_pay.webp`, `showdown.webp` + `*-poster.webp` — launcher/demo media posters
  (referenced on the marketing launcher, not from the board bundle).

**Card backs** (4)
| key | revision | used for |
|---|---|---|
| `cardback-blue.png` | `1fee21bf638b9cb8` | **default deck pile** (main deck) back |
| `cardback-white.png` | `e60116d5a1e2eddb` | **default rune deck** back |
| `cardback-black.png` | `46c03a14aaac1029` | **default battlefield pile** back |
| `cardback-black-landscape.png` | `dc33540653e13e68` | **landscape face-down battlefield card** (setup / hidden battlefield placeholder) |

**Tokens** — 10 types, each `tokens/<Name>.webp` (board art) + `tokens/thumbs/<Name>.webp` (picker):
Bird, Brush, Gold, Mech, Recruit, Reflection, SandSoldier, ShadowClone, Sprite, Tentacle.
Token → card-code map (`123h3ohyw0ag5.js:229-241`, verbatim):

```js
      let o = {
          Bird: "UNL-T02",
          Brush: "UNL-T03",
          Gold: "SFD-T03",
          Mech: "SFD-T01",
          Recruit: "OGN-273",
          Reflection: "UNL-T06",
          SandSoldier: "SFD-T02",
          ShadowClone: "VEN-T05",
          Sprite: "OGN-274",
          Tentacle: "VEN-T06",
        },
        c = new Set([...Object.values(o), "OGN-271", "OGN-272", "UNL-T01"]);
```

**Icons — all 83 keys under `icons/`** (49 `.svg`, 34 `.webp`; runtime tries
`/icons/<name>.webp` then `/icons/<name>.svg`, see §A.3):

- svg **and** webp (24): `accelerate, action, add, assault, assault_2, assault_3, deathknell, deflect, deflect_2, equip, ganking, hidden, legion, mighty, quick-draw, reaction, repeat, shield, shield_2, shield_3, tank, temporary, vision, weaponmaster`
- `.svg` only (25): `0, 1, 2, 3, 4, 5, 6, 7, 8, ambush, buff, burn_2, burn_3, deflect_3, empower, empowered, flow, hunt, hunt_2, level_11, level_16, level_3, level_6, neutral, predict`
- `.webp` only (10): `body, calm, chaos, fury, might, mind, order, rune, shield_5, tap`

(`0`–`8` are numeric icon names — the resolver special-cases them to `.svg`.)

**Sounds** — `sounds/20260716/*.webm`, 31 files (23 registry keys, several multi-variant):
baron_nashor, card_autopay1-3, card_click1, card_discard1, card_draw1, card_exhaust1-2,
card_hover1-3, card_play_from_hand, card_play1, card_recycle1, chat_message, game_rewind1/2/5,
game_start, ping-v2, ping, score_conquer1, score_end, score_generic, score_hold, time_warp,
turn_start, ui_click1-2, ui_confirm. (All 31 downloaded; `ping.webm` is unreferenced — see §B.5.)

**Other groups**
- `sets/` (5): Origins / Spiritforged / Unleashed / Vendetta / Radiance **wordmarks**; referenced by
  card-code prefix in `35qz5rkx7yexy.js:20890-20894`.
- `sealed/` (6): `<unleashed|vendetta|radiance>-booster.webp` and `-prerift-kit.webp` — sealed
  product art; referenced only through the manifest allowlist (server/Convex-supplied data).
- `setup/` (3): `first-player-choice-opponent-v2.webp`, `first-player-choice-self-v2.webp`,
  `player-left-panel-v1.webp` — setup/initiative UI art.
- `effects/` (1): `rewind-clock-face-v1.webp` (rewind overlay clock face).
- `brand/rift-atlas/` (10): app icon, 3 lockups, 5 marks, social card. Used by a download/brand
  module that builds URLs itself with a **hardcoded** `?v=20260713`
  (`1m9zsovi1eyy8.js:1882-1898`), not the manifest revision.
- `guide-banners/` (9): article/guide cover art; only manifest-referenced (site editorial data),
  one is explicitly excluded from transforms (`O`).

### A.3 Icon resolution (verbatim)

`3z6_mkb37q-85.js:1987-1998`:

```js
          i = [
            `/icons/${n}.${/^\d+$/.test(n) ? "svg" : "webp"}`,
            `/icons/${n}.svg`,
          ];
        return (
          a && i.push(`/icons/${r}.webp`, `/icons/${r}.svg`),
          Array.from(new Set(i)).flatMap((e) => {
            let t = (0, g.h)({ src: e });
            return t === e ? [] : [t];
          })
        );
      }
      function N(e) {
        return e.toLowerCase().replace(/\s+/g, "_");
      }
```

→ candidates are `"<name>.webp"` (`.svg` for numeric names) then `"<name>.svg"`, plus base-name
fallbacks with the `_\d+` suffix stripped (e.g. `assault_3` → `assault`), each passed through the
static-asset URL builder `h` and dropped if it is not a manifest key.

---

## B. SOUND TRIGGER MAP

### B.0 Engine

Module `123139` (`2goht72gp0rq8.js:3799-4198`): WebAudio (`AudioContext`), fetch → `decodeAudioData`,
per-file status cache (`w`), 3 attempts (`L = [1e3, 3e3]` backoff), 30 s failure retry
(`retryAfter: Date.now() + 3e4`), 8 s load timeout (`"SFX load timeout"`), one gain node per
playback (no ducking/mixing bus), random variant rotation that avoids repeating the last variant,
±3.5 % pitch jitter unless `pitchVariation: !1`, cooldown map `_` keyed by `cooldownKey ?? key`,
`suspended`/`interrupted` AudioContext resume attempts (gated by `navigator.userActivation`),
diagnostics ring buffers (`E`, max 20 plays; `h` maps URL → `sounds/…` path for diagnostics).
`x` = all variant URLs, used by `c` (preload-all). Sound paths are built with the static-asset URL
builder: `let p = (e) => (0, r.h)({ src: `/sounds/20260716/${e}` })` (`2goht72gp0rq8.js:3799`).

### B.1 Registry (verbatim, `2goht72gp0rq8.js:3799-3928`)

```js
      let p = (e) => (0, r.h)({ src: `/sounds/20260716/${e}` }),
        h = new Map(),
        v = {
          baron_nashor: {
            variants: [{ src: p("baron_nashor.webm") }],
            volume: 0.12,
          },
          card_autopay: {
            variants: [
              { src: p("card_autopay1.webm") },
              { src: p("card_autopay2.webm") },
              { src: p("card_autopay3.webm") },
            ],
            volume: 0.34,
          },
          card_click: {
            variants: [{ src: p("card_click1.webm") }],
            volume: 0.26,
          },
          card_discard: {
            variants: [{ src: p("card_discard1.webm") }],
            volume: 0.32,
          },
          card_draw: { variants: [{ src: p("card_draw1.webm") }], volume: 0.3 },
          card_exhaust: {
            variants: [
              { src: p("card_exhaust1.webm") },
              { src: p("card_exhaust2.webm") },
            ],
            volume: 0.32,
          },
          card_hover: {
            variants: [
              { src: p("card_hover1.webm") },
              { src: p("card_hover2.webm") },
              { src: p("card_hover3.webm") },
            ],
            volume: 0.42,
            cooldownMs: 35,
          },
          card_play: {
            variants: [{ src: p("card_play1.webm") }],
            volume: 0.34,
          },
          card_play_from_hand: {
            variants: [{ src: p("card_play_from_hand.webm") }],
            volume: 0.34,
          },
          card_recycle: {
            variants: [{ src: p("card_recycle1.webm") }],
            volume: 0.32,
          },
          chat_message: {
            variants: [{ src: p("chat_message.webm"), playbackRate: 0.6 }],
            volume: 0.1,
          },
          game_rewind: {
            variants: [{ src: p("game_rewind5.webm") }],
            volume: 0.1,
            pitchVariation: !1,
          },
          game_forward: {
            variants: [
              { src: p("game_rewind1.webm") },
              { src: p("game_rewind2.webm") },
            ],
            volume: 0.34,
          },
          game_start: {
            variants: [{ src: p("game_start.webm") }],
            volume: 0.1,
            pitchVariation: !1,
          },
          ping: {
            variants: [{ src: p("ping-v2.webm") }],
            volume: 0.08,
            pitchVariation: !1,
          },
          score_conquer: {
            variants: [{ src: p("score_conquer1.webm") }],
            volume: 0.12,
            pitchVariation: !1,
          },
          score_end: {
            variants: [{ src: p("score_end.webm") }],
            volume: 0.36,
            pitchVariation: !1,
          },
          score_generic: {
            variants: [{ src: p("score_generic.webm") }],
            volume: 0.11,
            pitchVariation: !1,
          },
          score_hold: {
            variants: [{ src: p("score_hold.webm") }],
            volume: 0.055,
            pitchVariation: !1,
          },
          time_warp: {
            variants: [{ src: p("time_warp.webm") }],
            volume: 0.08,
            pitchVariation: !1,
          },
          turn_start: {
            variants: [{ src: p("turn_start.webm"), playbackRate: 0.9 }],
            volume: 0.05,
            pitchVariation: !1,
          },
          ui_click: {
            variants: [
              { src: p("ui_click1.webm") },
              { src: p("ui_click2.webm") },
            ],
            volume: 0.24,
            cooldownMs: 20,
          },
          ui_confirm: {
            variants: [{ src: p("ui_confirm.webm") }],
            volume: 0.3,
          },
        },
        x = Array.from(
          new Set(
            Object.keys(v).flatMap((e) => v[e].variants.map((e) => e.src)),
          ),
        );
      for (let e of x) {
        let r = new URL(e, "https://riftatlas.invalid").pathname;
        h.set(e, r.slice(r.indexOf("sounds/")));
      }
```

### B.2 Play function, volume store, preferences

Play (`123139.y`), `2goht72gp0rq8.js:4061-4143`:

```js
          "y",
          0,
          function (e, r = {}) {
            let t = v[e],
              a = t.variants[0]?.src ?? "",
              n = r.cooldownMs ?? t.cooldownMs ?? 0,
              o = r.cooldownKey ?? e;
            if (n > 0 && Date.now() - (_.get(o) ?? 0) < n) return;
            let i = Math.max(0, r.volumeScale ?? 1) * b();
            if (i <= 0) return void S(a, "muted");
            let l = (function (e) {
              let r = v[e].variants,
                t = r.filter((e) => A(e.src));
              if (0 === t.length) return null;
              if (1 === t.length) {
                let a = t[0],
                  n = r.findIndex((e) => e.src === a?.src);
                return (y.set(e, Math.max(0, n)), a ?? null);
              }
              let a = y.get(e),
                n = Math.floor(Math.random() * t.length),
                o = t[n];
              return o &&
                (r.findIndex((e) => e.src === o.src) === a &&
                  ((n = (n + 1) % t.length), (o = t[n])),
                o)
                ? (y.set(
                    e,
                    r.findIndex((e) => e.src === o?.src),
                  ),
                  o)
                : null;
            })(e);
            if (!l) {
              (S(a, "not_ready"),
                t.variants.some(({ src: e }) => {
                  let r = w.get(e);
                  return (
                    r?.status === "failed" && Date.now() >= (r.retryAfter ?? 0)
                  );
                }) && D(e));
              return;
            }
            let s = A(l.src);
            if (!s) return;
            let c = R();
            if (!c) return void S(l.src, "unavailable");
            let d = Math.max(0, t.volume * (l.volume ?? 1) * i);
            if (!(d <= 0))
              try {
                var u;
                let e = c.state;
                if ("closed" === e) return void S(l.src, "unavailable");
                if ("suspended" === e || "interrupted" === e) {
                  if (
                    !(function () {
                      if ("u" < typeof navigator) return !1;
                      let e = navigator.userActivation;
                      return !e || e.isActive;
                    })()
                  )
                    return void S(l.src, "suspended");
                  c.resume().catch(() => S(l.src, "resume_failed"));
                }
                let r = c.createBufferSource(),
                  a = c.createGain();
                ((r.buffer = s),
                  (r.playbackRate.value =
                    ((u = l.playbackRate ?? 1),
                    !1 === t.pitchVariation
                      ? Math.max(0.01, u)
                      : Math.max(
                          0.01,
                          u * (1 + (2 * Math.random() - 1) * 0.035),
                        ))),
                  (a.gain.value = d),
                  r.connect(a),
                  a.connect(c.destination),
                  r.start(0),
                  S(l.src, "started"),
                  n > 0 && _.set(o, Date.now()));
              } catch {
                S(l.src, "error");
              }
          },
```

Other engine exports: `c` = preload every variant (`Promise.all(x.map((e) => P(e)))`, one-shot with
reset on failure), `C` = ensure one key's buffers load (`D(e)`), `f` = diagnostic snapshot
(`contextState`, `volumePercent`, per-asset `buffers`, recent `playback` log with outcomes
`muted|not_ready|suspended|unavailable|resume_failed|started|error`).

Volume / mute preference (`608607`, `2goht72gp0rq8.js:3714-3746`):

```js
      let o = "riftbound_simulator_sfx_volume:v2",
        i = new Set(),
        l = 100,
        s = !1;
      function c(e) {
        return Number.isFinite(e)
          ? Math.min(
              200,
              Math.max(0, 5 * Math.round(Math.min(200, Math.max(0, e)) / 5)),
            )
          : 100;
      }
      function d() {
        s ||
          ((s = !0),
          (l = (function (e = (0, n.k)("local")) {
            let r = (0, n.j)(e, o);
            if (null !== r)
              return null === r || "" === r.trim() ? 100 : c(Number(r));
            let t = (0, n.j)(e, "riftbound_simulator_sfx_volume:v1");
            if (null === t || "" === t.trim()) return 100;
            let a = Number(t);
            return Number.isFinite(a)
              ? c((Math.min(100, Math.max(0, a)) / 100) ** 2 * 100)
              : 100;
          })()));
      }
      function u() {
        return (d(), l);
      }
      function b() {
        return c(u()) / 100;
      }
```

- Persisted key: **`localStorage["riftbound_simulator_sfx_volume:v2"]`** (raw string, `"0"`–`"200"`,
  rounded to a 5 % step; **0 = mute**, values are a percentage where 100 = 1.0 gain). Legacy key
  `riftbound_simulator_sfx_volume:v1` is read once and migrated with a `x²` curve.
- Exports of `608607`: `D = 200` (max), `C = 0` (min), `n = 5` (step), `p = b` (gain scale),
  `q` = `useSyncExternalStore` hook returning `[volume, setVolume]`.
- UI: game-settings popover slider `0xawjzm3yjpr1.js:37715-37940` —
  `label: S("current.soundEffects")`, `min: u3.C`, `max: u3.D`, `step: u3.n`,
  `valueText: S("sim.soundEffectsVolumePercentage", { percent: z })`, `onChange: B`; icons switch on
  `0 === z` (muted icon `ur.f` vs `u5`) and the section header uses `S("current.audio")`.
- Haptics: `(0, u3.p)() > 0 && navigator.vibrate?.(fx)` on turn change while the tab is visible
  (`0xawjzm3yjpr1.js:59389`) — the same volume setting gates vibration.
- **No ducking, no per-key mute, no panning.** `volumeScale` (call-site gain multiplier) and
  `cooldownKey`/`cooldownMs` are the only per-call overrides actually used
  (`0xawjzm3yjpr1.js:55635-55637`, `:51027-51028`).

### B.3 Trigger table

Legend: `rl` = `e.i(123139)` in `0xawjzm3yjpr1.js`/`35qz5rkx7yexy.js`, `j` = `e.i(123139)` in
`2goht72gp0rq8.js`. `rl.y` = play, `rl.C` = preload one, `rl.c` = preload all.

| sound key | file:line | semantic event | verbatim call |
|---|---|---|---|
| `game_start` | `35qz5rkx7yexy.js:26606` | game shell mounts (preload) | `(0, rl.C)("game_start");` |
| `game_start` | `35qz5rkx7yexy.js:26609` | match/game start callback `playGameStartSound` (exposed via room context at `:31687` / `:35169`) | `(0, rl.y)("game_start");` |
| `card_hover` | `0xawjzm3yjpr1.js:51026` | pointer enters a **hand** card while idle/unpressed, hand drop-zone, no other hover, tab visible | `(0, rl.y)("card_hover", { cooldownKey: "card_hover", cooldownMs: 35 })` |
| `chat_message` | `35qz5rkx7yexy.js:15246` | chat transcript mounts (preload) | `(0, rl.C)("chat_message");` |
| `chat_message` | `35qz5rkx7yexy.js:15259` | new chat message authored by someone else | `d.authorPlayerId !== r && (0, rl.y)("chat_message"));` |
| `chat_message` | `0xawjzm3yjpr1.js:13040` | board chat panel opens (preload) | `(0, rl.C)("chat_message"));` |
| `chat_message` | `0xawjzm3yjpr1.js:13062` | incoming chat message (author ≠ self) | `tN.authorPlayerId !== eq && (0, rl.y)("chat_message"));` |
| `chat_message` | `0xawjzm3yjpr1.js:13083` | new local chat entry appears (same author, new id) | `((t7.current = tA), (0, rl.y)("chat_message"));` |
| `ping` | `0xawjzm3yjpr1.js:51073` (fired at `:51095`, `:51112`) | realtime **card ping** presence received from another player, deduped by `cardId + pingedAt + intent` via `pF.z` (module `537435`) | `eh = (0, y.useCallback)(() => { (0, rl.y)("ping"); }, []);` — called as `(0, pF.z)(E.current, e, t) && eh()` |
| `baron_nashor` | `0xawjzm3yjpr1.js:52177` | shared battlefield token ("Baron Nashor"/objective) reveal state becomes active (`si = null !== d6`, `d6 ∈ {"reveal","fromGhost"}`), cleared after 3400 ms | `(0, rl.y)("baron_nashor");` |
| `card_play` | `0xawjzm3yjpr1.js:36434`, `:36440` | drag/drop or double-click drop of a hand card onto the board when the target zone requires a *play* (`(0, dN.j)(u)`) | `((0, dN.j)(u) && (0, rl.y)("card_play"), eJ(110));` |
| `card_play` | `0xawjzm3yjpr1.js:53993` | **action-echo**: any applied game action whose mapped key is `card_play` (see mapping below) | `(0, rl.y)(n),` |
| `card_play` / `card_play_from_hand` | `0xawjzm3yjpr1.js:55634` | opponent play inferred from a board diff / new chain entry (when the local UI cannot animate it), throttled | `(0, rl.y)(r, { volumeScale: 0.6, cooldownKey: "observed_opponent_play", cooldownMs: 260 })` |
| `card_click` | `35qz5rkx7yexy.js:37721` | battlefield pick: manual battlefield choice | `(0, rl.y)(a.random ? "ui_confirm" : "card_click"),` |
| `card_click` | `35qz5rkx7yexy.js:37800` | battlefield pick: select specific battlefield | `((0, rl.y)("card_click"),` |
| `card_click` | `35qz5rkx7yexy.js:37872`, `:37877`, `:37887`, `:37892` | mulligan: toggle a card into/out of the mulligan selection (both hand variants / solo lab) | `((0, rl.y)("card_click"), N((t) => t.filter((t) => t !== e)));` |
| `card_click` | `0xawjzm3yjpr1.js:53993` | action-echo for `select_battlefield`, `target_arrow_*`, `equip_card`, `adjust_card_counter`, `clear_card_counter`, `adjust_card_might`, `set_card_label` | `return "card_click";` (mapping) |
| `card_draw` | `35qz5rkx7yexy.js:38044` | hidden refill card consumed/drawn from a deck pile | `((0, rl.y)("card_draw"), et((t) => t.filter((t) => t !== e)));` |
| `card_draw` | `0xawjzm3yjpr1.js:53993` | action-echo for `draw_cards`→hand, `draw_rune`, `take_top_from_deck`/`take_card_from_deck`→hand, `rune_batch` containing `draw_rune`, battlefield-conquer draw, `battlefield_conquer_confirm` draw assist | `return "card_draw";` |
| `card_discard` | `0xawjzm3yjpr1.js:53993` | action-echo for moves into `trash`/`banished`, `move_cards_to_trash_batch`, `chain_resolve`→trash/banished | `return "trash" === e.to ? "card_discard" : null;` |
| `card_exhaust` | `0xawjzm3yjpr1.js:53993` | action-echo: `toggle_exhausted` result, `rune_batch` with `set_rune_exhausted` | `? "card_exhaust"` |
| `card_recycle` | `0xawjzm3yjpr1.js:53993` | action-echo: rune recycled to deck bottom, `send_to_rune_deck`/`send_to_deck`, `recycle_deck_peek_card`, `recycle_all_trash_to_deck`, `move_off_board_cards_batch`→deck, `chain_resolve`→deck top/bottom, `rune_batch` recycle ops | `return "card_recycle";` |
| `card_autopay` | `0xawjzm3yjpr1.js:53993` | action-echo: `payment_batch` with `paymentGroupOrigin === "auto_pay_button"` (auto-pay button paid the costs) | `return "auto_pay_button" === e.paymentGroupOrigin ? "card_autopay" : null;` |
| `score_conquer` | `0xawjzm3yjpr1.js:59545` (key from `rf()` at `:4841-4859`) | a player's score increased in a `battlefield_conquer_confirm` (pending conquer scorer) | `(n && (iD.current = null), i && (0, rl.y)(i));` |
| `score_hold` | same | score gain with `autoScoreFromHold` / at `end_turn` / `end_beginning_phase` (holding a battlefield) | `t || "end_turn" === e || "end_beginning_phase" === e ? "score_hold" : "score_generic"` |
| `score_generic` | same | score gain via `set_score`/`adjust_score` (manual score edit) | `"set_score" === e || "adjust_score" === e ? "score_generic"` |
| `score_end` | same | score gain crosses the victory score (game won) | `a < n && r >= n ? "score_end"` |
| `game_rewind` | `0xawjzm3yjpr1.js:64874` | rewind overlay token changes to a rewind | `(0, rl.y)("rewind" === em.kind ? "game_rewind" : "game_forward")` |
| `game_forward` | `0xawjzm3yjpr1.js:64875` | same effect, forward re-apply | (as above) |
| `game_rewind` / `game_forward` | `0xawjzm3yjpr1.js:53993` | action-echo for `rewind_last_action` / `forward_last_rewind` — **excluded** from the direct echo and played by the overlay path | `!n.startsWith("score_") && "rewind_last_action" !== r.type && "forward_last_rewind" !== r.type && (0, rl.y)(n)` |
| `turn_start` | `0xawjzm3yjpr1.js:59368` | turn number increased (new turn) | `(0, rl.y)(e.extraTurnResumePlayerId ? "time_warp" : "turn_start"));` |
| `time_warp` | `0xawjzm3yjpr1.js:59368` | turn number increased while an extra-turn resume is pending | (as above) |
| `ui_confirm` | `35qz5rkx7yexy.js:37498` | sideboarding submit (self) | `((0, rl.y)("ui_confirm"), _(!0), ex(t.id, rf(v, eW))...)` |
| `ui_confirm` | `35qz5rkx7yexy.js:37538` | sideboarding submit for all players | `((0, rl.y)("ui_confirm"), _(!0), rb({ players: i, playMode: eW, sendSetupAction: ex })...)` |
| `ui_confirm` | `35qz5rkx7yexy.js:37557` | request sideboard skip | `((0, rl.y)("ui_confirm"), _(!0), ex(t.id, { type: "request_sideboard_skip" })...)` |
| `ui_confirm` / `ui_click` | `35qz5rkx7yexy.js:37581` | respond to sideboard skip (accept vs decline/cancel) | `((0, rl.y)("accept" === r ? "ui_confirm" : "ui_click"), ...)` |
| `ui_confirm` | `35qz5rkx7yexy.js:37615` | submit sealed registration decks (all players) | `((0, rl.y)("ui_confirm"), _(!0), (async () => {...}))` |
| `ui_confirm` | `35qz5rkx7yexy.js:37820` | battlefield pick: **random** battlefield | `((0, rl.y)("ui_confirm"), T({ roomCode: eP, value: { playerId: r.id, random: !0 } })...)` |
| `ui_confirm` | `35qz5rkx7yexy.js:37840`, `:37915` | mulligan submitted | `(n.length !== j.length && N(n), (0, rl.y)("ui_confirm"));` |
| `ui_confirm` | `35qz5rkx7yexy.js:37721` | battlefield pick: random (see `card_click` row) | `(0, rl.y)(a.random ? "ui_confirm" : "card_click")` |
| `ui_confirm` | `0xawjzm3yjpr1.js:53993` | action-echo for `submit_sideboard`, `request/respond_sideboard_skip`, `submit_mulligan`, `request/cancel_game_result_confirmation`, `report_game_result`, `request_bo3_rematch` | `return "ui_confirm";` |
| `ui_confirm` / `ui_click` | `0xawjzm3yjpr1.js:54413` | respond to a rewind confirmation request (approve vs decline/cancel) | `(0, rl.y)("approve" === e ? "ui_confirm" : "ui_click"));` |
| `ui_click` | `2goht72gp0rq8.js:1210` | rail action "next game" (spectator branch) | `((0, j.y)("ui_click"), eR(), g?.());` |
| `ui_click` | `2goht72gp0rq8.js:1214` | pick an option in the next-game/leave popover | `e !== d && ((0, j.y)("ui_click"), eb(null), er(), b(e));` |
| `ui_click` | `2goht72gp0rq8.js:1224` | next-game / switch-perspective button (non-spectator, opens confirm) | `: ((0, j.y)("ui_click"), er(), ed(null), eb((e) => ("nextGame" === e ? null : "nextGame")));` |
| `ui_click` | `2goht72gp0rq8.js:1238` | social/spectators launcher button | `(eB(), (0, j.y)("ui_click"), er(), ed(null), eb(null), ep(eW > 0 ? "spectators" : "friends"), ...` |
| `ui_click` | `2goht72gp0rq8.js:1248` | spectator "shown/hidden" reveal toggle | `((0, j.y)("ui_click"), ee?.(e, r));` |
| `ui_click` | `2goht72gp0rq8.js:1259` | leave button (opens leave/concede dialog) | `((0, j.y)("ui_click"), er(), ed(null), eb((e) => ("leave" === e ? null : "leave")));` |
| `ui_confirm` | `2goht72gp0rq8.js:1219` | confirm "next game" dialog | `((0, j.y)("ui_confirm"), eR(), K());` |
| `ui_confirm` | `2goht72gp0rq8.js:1253` | leave dialog → leave room | `((0, j.y)("ui_confirm"), er(), eb(null), U());` |
| `ui_confirm` | `2goht72gp0rq8.js:1256` | leave dialog → return to lobby | `((0, j.y)("ui_confirm"), er(), eR(), Q());` |
| `ui_click` | `0xawjzm3yjpr1.js:48200` | "switch seat" button in the turn control (`canSwitchSeat`, `sim.switchSeat`) | `((0, rl.y)("ui_click"), N());` |
| `ui_click` | `0xawjzm3yjpr1.js:59088`/`:59094`/`:59100`/`:59106`/`:59112`/`:59118` | board tool-mode toggles: counter-add mode, buff mode, target mode, label mode, emote mode, ping mode (`onCounterAddModeChange`, `onBuffModeChange`, `onTargetModeChange`, `onLabelModeChange`, `onEmoteModeChange`, `onPingModeChange`) | `((0, rl.y)("ui_click"), nL(e));` (then `nO`, `nx`, `lk`, `i5`, `n$`) |
| `ui_click` | `0xawjzm3yjpr1.js:59150` | duplicate-mode toggle in the turn control | `((0, rl.y)("ui_click"), yy());` |
| `ui_click` | `35qz5rkx7yexy.js:37243`, `:37330`, `:37352`, `:37437`, `:37446`, `:37469` | sideboarding / sealed-deck edit clicks: move card main deck ↔ sideboard, clear legend, clear champion+deck, toggle card between decks, pick legend | `((0, rl.y)("ui_click"), eM((e) => ({ ...e, legend: [] }))));` etc. |
| `ui_click` | `35qz5rkx7yexy.js:38934`, `:38947` | first-player choice: pick first player / pick single-player turn order | `((0, rl.y)("ui_click"), hh(!0), bj(t, { type: "choose_first_player", firstPlayerId: e })...)` |
| `ui_click` | `0xawjzm3yjpr1.js:53993` | action-echo for `choose_first_player`, `choose_single_player_turn_order`, `battlefield_conquer_pass_focus|pass_response|set_optional_pass|dismiss`, `set_battlefield_brush`, deck-peek/hand-reveal toggles, `chain_set_repeat|flow|resolve_vote`, `peek_deck_bottom`, `shuffle_deck`, `roll_initiative`, `chain_resolve` with no destination | `return "ui_click";` |

Action-echo mapping function (verbatim of the key branches), `0xawjzm3yjpr1.js:53851-53982`;
invoked from the state-diff callback at `:53983-53999`:

```js
              switch (e.type) {
                case "payment_batch":
                  return "auto_pay_button" === e.paymentGroupOrigin
                    ? "card_autopay"
                    : null;
                case "rewind_last_action":
                  return "game_rewind";
                case "forward_last_rewind":
                  return "game_forward";
                ...
                case "move_card":
                  if ("trash" === e.to) return "card_discard";
                  if ("hand" === e.from && ((a = e.to), rs.has(a)))
                    return "card_play_from_hand";
                  if (((n = e.from), (o = e.to), ru.has(n) && ru.has(o)))
                    return "card_play";
                  return null;
                ...
                case "chain_add":
                  return "hand" === e.from
                    ? "card_play_from_hand"
                    : "card_play";
                ...
                default:
                  return null;
              }
            })(r, {
              actorPlayerId: t.id,
              boardBefore: a,
              roomBefore: e,
              victoryScore: (0, eI.N)(e),
            });
            (n &&
              !n.startsWith("score_") &&
              "rewind_last_action" !== r.type &&
              "forward_last_rewind" !== r.type &&
              (0, rl.y)(n),
```

Score sound selection (`rf`), `0xawjzm3yjpr1.js:4841-4859`:

```js
    function rf({
      actionType: e,
      autoScoreFromHold: t = !1,
      nextScore: r,
      previousScore: a,
      victoryScore: n,
    }) {
      return r <= a
        ? null
        : a < n && r >= n
          ? "score_end"
          : "battlefield_conquer_confirm" === e
            ? "score_conquer"
            : "set_score" === e || "adjust_score" === e
              ? "score_generic"
              : t || "end_turn" === e || "end_beginning_phase" === e
                ? "score_hold"
                : "score_generic";
    }
```

Preload-all: `(0, rl.c)();` on board mount (`0xawjzm3yjpr1.js:50993`, inside a `useEffect`).

### B.4 Gating / dedupe summary

- Global mute = volume 0 (`if (i <= 0) return void S(a, "muted")`).
- Per-key default cooldowns: `card_hover` 35 ms, `ui_click` 20 ms.
- Call-site cooldowns: `card_hover` (35 ms, same key) and observed-opponent-play
  (`cooldownKey: "observed_opponent_play"`, 260 ms, `volumeScale: 0.6`).
- One-time-per-event guards: rewind/forward overlay (`ep.current !== em.token`),
  ping (`pF.z` dedupe on `cardId`/`pingedAt`/`intent`), chat (last message id + author check),
  turn (`turnNumber` increase), score (`scoresByPlayerId` increase),
  setup clicks (busy flags `w`/`m`/`hb`/`eT` short-circuit *before* the sound).
- AudioContext resume only on user activation; suspended playback is logged, not retried.
- Emotes are **silent** (board-emote presence only publishes visual state — no sound key exists).

### B.5 Sounds/files with NO trigger found

- `sounds/20260716/ping.webm` — present in the manifest (`16ea0b9a04f9a37e`) but **zero
  references** outside the manifest: the registry uses `ping-v2.webm`. Legacy/unused.
- Every other one of the 31 webm files is referenced by the `123139` registry
  (30/31 files wired; 23 registry keys all have ≥ 1 identified trigger).

---

## C. CARD IMAGE SLOT MAP

Slot → directory mapping (verbatim), `123h3ohyw0ag5.js:281-292`:

```js
      let h = {
        thumb: "small-v2",
        board: "small-v2",
        hand: "small-v2",
        preview: "original",
        hover: "original",
        battlefieldDraft: "original",
        original: "original",
      };
      function m(e) {
        return h[e];
      }
```

Exported as `resolveGameCardImageSlot` (module `926062`, `123h3ohyw0ag5.js:406-408`), used by
`GameCardArt` as `slot: d ?? m(C)` where `C` is the `profile` prop defaulting to `"original"`
(`123h3ohyw0ag5.js:346`, `:359`).

Card-image URL construction (verbatim of the assembly), `1ixua9twvm95a.js:1814-1853` (see §A.0.1) —
`slot` is the directory (`small-v2`/`original`) and the revision is appended:

```js
        p = (function (e, b, a = L()) {
          let c = R(a),
            f = l(b);
          if (!f) return "";
          let p = "/" === c ? `/${e}/${f}` : `${c}/${e}/${f}`,
            w = d[f];
          return w ? `${p}?v=${w}` : p;
        })(e.slot, f, c);
```

Locale-aware final URL (verbatim), `123h3ohyw0ag5.js:1071-1089`:

```js
                    let v =
                      ((f = (0, l.o)(e, t)),
                      (m = "/" === (h = (0, l.N)()) ? `/${t}/` : `${h}/${t}/`),
                      (f.startsWith(m) &&
                        f.slice(m.length).split(/[?#]/u, 1)[0]) ||
                        null);
                    ...
                    let y = (0, l.N)(),
                      b =
                        "/" === y
                          ? `/${encodeURIComponent(p.assetPathSegment)}`
                          : `${y}/${encodeURIComponent(p.assetPathSegment)}`;
                    return `${b}/${t}/${encodeURIComponent(p.assetCardId)}.webp?v=${encodeURIComponent(p.assetRevision)}`;
```

Candidate list assembly (verbatim), `123h3ohyw0ag5.js:1092-1103` — order defines fallback:

```js
              y = f ? (0, l.h)({ src: f }) : null,
              b = new Map();
            for (let [e, t] of [
              [v, p],
              [g, (0, i.p)(d) ?? "en"],
              [y, null],
            ])
              e && !b.has(e) && b.set(e, t);
            return {
              candidates: Array.from(b.keys()),
              candidateLocales: Array.from(b.values()),
            };
```

i.e. 1) localized published card art (`<locale>/<slot>/<assetCardId>.webp?v=<rev>`),
2) the requested image with the requested locale, 3) the English/`imageLocale` static URL.

Convenience wrapper (verbatim), `123h3ohyw0ag5.js:409-416`:

```js
          "resolvePreferredGameCardImageUrl",
          0,
          function (e, t = "original", r, n) {
            return e
              ? (f({ src: e, slot: t, locale: r, cardId: n, fallbackSrc: null })
                  .candidates[0] ?? "")
              : "";
          },
```

Slot call sites (representative, all `slot:` values seen in the playapp bundles):
`"small-v2"` — `03azfb7rltdws.js:3408`, `0xawjzm3yjpr1.js:18694`, `25vik2nxxo51i.js:5978`,
`2atnqtfqvj-z4.js:2081`, `35qz5rkx7yexy.js:5166/6295/9555/9880/10563/12699`, `3ezkmol42s_3m.js:73/257`,
`3pgpu-l3_p_i2.js:468`; `"original"` — `123h3ohyw0ag5.js:109/809/1233`, `35qz5rkx7yexy.js:10404/13127`;
`(0, og.resolvePreferredGameCardImageUrl)(r, "small-v2", s)` — `0xawjzm3yjpr1.js:22052`.
The `O` builder's width rule (`1ixua9twvm95a.js:2029`) is the only place where the slot is derived
from the requested pixel width instead of a named slot:

```js
                    slot: null !== (f = v(b)) && f <= 384 ? s : "original",
```

---

## D. CARD BACKS + TOKEN ART USAGE

### D.1 Default card back per slot (verbatim)

`2-nry424r0961.js:231-237` (module `533812`, exported as `R`):

```js
      function R(L = "deck") {
        return "runeDeck" === L
          ? "/cardback-white.png"
          : "battlefield" === L
            ? "/cardback-black.png"
            : "/cardback-blue.png";
      }
```

Sleeve overrides + default resolution (verbatim), `2-nry424r0961.js:825-899`:

```js
          "S",
          0,
          function (L, e = "deck") {
            return "runeDeck" === e
              ? (L?.runeDeckSleeve ?? null)
              : "battlefield" === e
                ? (L?.battlefieldSleeve ?? null)
                : (L?.deckSleeve ?? null);
          },
```

```js
          "H",
          0,
          function (L) {
            let e = (0, s.useContext)(O[L]),
              t = (0, s.useContext)(E);
            return e ? t : void 0;
          },
          "Z",
          0,
          function (L) {
            return (0, s.useContext)(O[L]) ?? R(L);
          },
```

`O = { deck: A, runeDeck: k, battlefield: N }` are the per-slot contexts (`2-nry424r0961.js:224-225`).
The **CardBack component** resolves `src ?? sleeve.src ?? R(slot)` and applies the sleeve filter
(`2-nry424r0961.js` module `533812` → re-exported as `L` from module `298551`,
`25vik2nxxo51i.js:2656-2680`; verbatim excerpt, one elision marked):

```js
            C = void 0 === g ? "deck" : g,
            S = void 0 === w ? x.b : w,
            P = (0, h.r)(),
            T = ec(b),
            j = (0, p.Z)(C),
            E = (0, p.H)(C);
          f[0] !== y || f[1] !== C
            ? ((r = void 0 === y ? void 0 : (0, p.S)(y, C)),
              (f[0] = y),
              (f[1] = C),
              (f[2] = r))
            : (r = f[2]);
          let I = r;
          f[3] !== y ||  /* … (guard clauses f[3]…f[7] elided) … */  f[7] !== m
            ? ((i = m ?? (void 0 === y ? j : (I?.src ?? (0, p.R)(C)))),
```

and the same component is used as a **card-flip back face** (`0xawjzm3yjpr1.js:26170-26178`):

```js
                      back: (0, a.jsx)(tp.L, {
                        slot: h ? "runeDeck" : "deck",
                        insetPx: 0,
                        alt: Z(h ? "sim.runeCardBack" : "sim.cardBack"),
                      }),
```

| cardback | file:line | UI state | verbatim excerpt |
|---|---|---|---|
| `cardback-blue.png` | `2-nry424r0961.js:236` | default **main deck** pile back (and any generic face-down card with slot `deck`) | `: "/cardback-blue.png";` |
| `cardback-white.png` | `2-nry424r0961.js:233` | default **rune deck** pile back | `? "/cardback-white.png"` |
| `cardback-black.png` | `2-nry424r0961.js:235` | default **battlefield** pile back (portrait) | `? "/cardback-black.png"` |
| `cardback-black-landscape.png` | `0xawjzm3yjpr1.js:42524` | **hidden/unknown battlefield** placeholder on the board (rotated landscape slot, `diagnosticKind: "card-back"`, alt `current.hiddenBattlefieldPlaceholder`) | `sources: ["/cardback-black-landscape.png"],\n diagnosticKind: "card-back",\n alt: e6("current.hiddenBattlefieldPlaceholder"),` |
| `cardback-black-landscape.png` | `2atnqtfqvj-z4.js:880` | setup **battlefield pile** back (`slot: "battlefield"`, `src` override) | `let p = c ? void 0 : "/cardback-black-landscape.png",` |
| `cardback-black-landscape.png` | `2atnqtfqvj-z4.js:1041` | setup flow: face-down **my battlefield** card (`!c.myBattlefieldCardsFaceDown` branch shows the real art) | `src: "/cardback-black-landscape.png", alt: "", fill: !0, draggable: !1, sizes: "(max-width: 980px) 27vw, 13rem", quality: 92,` |
| `cardback-black-landscape.png` | `2atnqtfqvj-z4.js:4135`, `:4393` | sideboarding/battlefield-selection: face-down battlefield art | `src: "/cardback-black-landscape.png", ... className: "object-cover",` |
| deck/rune back (slot-driven) | `0xawjzm3yjpr1.js:26135-26139` | **face-down card** on the board (deck peek hidden card, rune card back) | `(0, a.jsx)(tp.L, { insetPx: 0, slot: h ? "runeDeck" : "deck", alt: Z(h ? "sim.runeCardBack" : "sim.hiddenCard") })` |
| deck back (slot-driven) | `0xawjzm3yjpr1.js:30870` | **rune deck pile** on the board (`cardBackSlot: "runeDeck"`, label `sim.runeDeck`) | `cardBackSlot: "runeDeck",` |
| deck back (slot-driven) | `0xawjzm3yjpr1.js:24242`, `:24335-24343` | any pile (`sq`) with `cardBackImageUrl`/`cardBackSlot` (defaults `"deck"`); top-of-stack card back with `sim.board.namedCardBack` alt | `ec = void 0 === F ? "deck" : F,` … `src: H, slot: ec, alt: eg("sim.board.namedCardBack", { name: D }),` |
| deck back (slot-driven) | `2atnqtfqvj-z4.js:1256` | setup/mulligan: **my mulligan cards face down** (`y.myMulliganCardsFaceDown`) | `(0, a.jsx)(A.L, { customization: h, alt: k("sim.setup.handCardBack"), insetPx: 0,` |
| deck back (slot-driven) | `2atnqtfqvj-z4.js:4775` | setup: **opponent hand** card backs | `(0, a.jsx)(A.L, { customization: av, alt: ao("sim.opponentHandCardBack"), insetPx: 0, sizes: H.Y, quality: H.n, })` |
| deck back (slot-driven) | `2atnqtfqvj-z4.js:1007`, `:4019`, `:4264`, `:4866` | setup alt texts only: `sim.setup.battlefieldCardBack`, `sim.setup.opponentBattlefieldCardBack`, `sim.setup.handCardBack` | `? u("sim.setup.battlefieldCardBack")` |

(`A.L` / `tp.L` = the CardBack component described above; `R.default` = raw `<Image>`. Card-back
images carry `diagnosticKind: "card-back"` and get the allowlist-validated static URL.)

### D.2 Token art usage

Board token palette (verbatim), `0xawjzm3yjpr1.js:21896-21912`:

```js
    function d5(e, t) {
      return {
        name: e,
        imageUrl: `/tokens/${t}.webp`,
        panelImageUrl: `/tokens/thumbs/${t}.webp`,
      };
    }
    let d4 = [
        d5("Recruit", "Recruit"),
        d5("Gold", "Gold"),
        d5("Mech", "Mech"),
        d5("Sand Soldier", "SandSoldier"),
        d5("Sprite", "Sprite"),
        d5("Bird", "Bird"),
        d5("Reflection", "Reflection"),
        d5("Shadow Clone", "ShadowClone"),
        d5("Tentacle", "Tentacle"),
      ],
      d3 = [
        ...d4.filter((e) => "Gold" === e.name),
        ...d4.filter((e) => "Gold" !== e.name),
      ],
      d8 = [
        ...d4.filter((e) => "Gold" !== e.name),
        ((r = "Bomb"),
        (t = (0, d2.W)(r) ?? ""),
        { name: r, imageUrl: t, panelImageUrl: t }),
      ],
```

Selected by zone at `0xawjzm3yjpr1.js:22242-22249` (token-creation picker: `base` → gold first, any
battlefield → non-gold list + Bomb, otherwise full list):

```js
      let q =
        "base" === S
          ? d3
          : "battlefieldA" === S ||
              "battlefieldB" === S ||
              "battlefieldC" === S ||
              "battlefieldToken" === S
            ? d8
            : d4;
```

Token keyword → art fallback (verbatim), `42xlz6r9r64m2.js:815-875` (module `143307`):

```js
      let t = {
          bomb: "/cards/RAD-T02.webp",
          bombtoken: "/cards/RAD-T02.webp",
          birb: "/tokens/Bird.webp",
          ...
          tentacle: "/tokens/Tentacle.webp",
          tentacletoken: "/tokens/Tentacle.webp",
        },
        a = [
          ["sandsoldier", 2],
          ["shadowclone", 0],
          ["reflection", 0],
          ["recruit", 1],
          ["sprite", 3],
          ["tentacle", 1],
          ["bird", 1],
          ["birb", 1],
          ["mech", 3],
        ];
```

```js
        "W",
        0,
        function (e) {
          let a = s(e);
          if (!a) return;
          let r = t[a];
          return (
            r ||
            (a.includes("sandsoldier")
              ? "/tokens/SandSoldier.webp"
              ...
```

Cosmetic token art (creator variants) — board art + thumb per variant, verbatim
`23_dempwo6mp3.js:818-855` (module `94427`), incl. the per-token default:

```js
      function r(e) {
        let t = `/cosmetics/creators/glitchedgoober/tokens/${e}`;
        return {
          id: `glitched-goober-${e}`,
          releasedAt: null,
          label: "recruit" === e ? "pengu" : "riftbuds",
          imageSrc: (0, a.G)(`${t}/board.webp`),
          thumbnailSrc: (0, a.G)(`${t}/thumb.webp`),
          artistId: "glitchedGoober",
          entitlement: "standard_customization",
        };
      }
      ...
      function l(e, t, a, n = e, d = !1) {
        return {
          id: e,
          name: t,
          defaultVariantId: "default",
          variants: [
            i("default", "default", `/tokens/${a}.webp`),
            r(n),
            ...(d ? [o(n)] : []),
          ],
        };
      }
```

```js
          variants: [
            i("OGN-273", "zaun", "/tokens/Recruit.webp"),
            i("OGN-271", "demacia", "/cards/OGN-271.webp"),
            i("OGN-272", "noxus", "/cards/OGN-272.webp"),
            r("recruit"),
          ],
```

`94427.L` resolves the art actually rendered for a battlefield/shared token — `0xawjzm3yjpr1.js:41968`:

```js
          tq = "battlefieldToken" === d ? (0, ry.L)(tF, _?.tokenArt) : void 0,
```

```js
        "L",
        0,
        function (e, a) {
          if (/^baron\s*pit(?:\s*token)?$/i.test(e.trim())) {
            let e = d.find((e) => "baronPit" === e.id);
            return e?.variants.find((e) => e.id === a?.baronPit)?.imageSrc;
          }
          let n = (0, t.W)(e);
          if (!n) return;
          let i = d.find((e) => (0, t.W)(e.name) === n);
          return i?.variants.find((e) => e.id === a?.[i.id])?.imageSrc;
        },
```

Other token-art touch points:
- `0xawjzm3yjpr1.js:10738` — gold counter icon in the match log: `oJ = (0, nq.h)({ src: "/tokens/thumbs/Gold.webp" }),`
- `123h3ohyw0ag5.js:245-278` (`f`, module `582436`) — when a card's `imageUrl` is a token art path
  (`/tokens/(thumbs/)?<Name>.webp`) or one of the token card codes
  (`OGN-271/272/273/274, SFD-T01..03, UNL-T01..03, UNL-T02/03, VEN-T05/06`), the loader rewrites it
  to `/cards/<code>.webp` and prepends that card's real art as the first candidate (so token art
  assets are only a *fallback* when the token has a catalog card).

---

## E. Verification notes / gaps

- All 187 manifest entries exist locally; the manifest copy in the site bundle
  (`pretty/site/0uwhp3tmffog7.js:1536-1729`) is byte-identical in content to the playapp copy.
- `guide-banners/*` and `sealed/*` have no literal references in either bundle: they are
  manifest-allowlisted assets referenced from server data (guides / sealed products).
- `ping.webm` is the only sound file with no reference.
- No error/busy/denied click sound exists; blocked actions simply return before playing `ui_click`.
