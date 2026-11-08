# 03 — Animation & 3D spec (Rift Atlas simulator)

Specialist analyst #3, 2026-10-22. Everything below was read out of the prettified bundles
(paths under `.recon/pretty/`); module ids are in parentheses. Numbers are copied verbatim.

Library inventory

| lib | chunk | notes |
|---|---|---|
| three.js | `1847m5h7yrvg-.js` (572 KB) | WebGLRenderer, MeshPhysicalMaterial, ShapeGeometry, ExtrudeGeometry, LatheGeometry, CustomShaderMaterial-style `onBeforeCompile`, RoomEnvironment |
| Rive runtime | `37hpdmovr42bt.js` (~3 MB) | `@rive-app/webgl2`-style runtime; wasm is **inlined** in the chunk (no `.wasm` request in either tree); `enableRiveAssetCDN:false` so `.riv` comes from our CDN |
| motion (framer-motion) | `25vik2nxxo51i.js` (303 KB) | vendor only; app-level usage is `motion.div/motion.section`, `AnimatePresence`, variants + springs. Card "flight"/reveal effects are hand-written Web Animations API, not motion |
| WAAPI + custom canvas | board chunk `0xawjzm3yjpr1.js` | reveal flights, drag ghost, pointer tilt, particle bursts, SVG filters |

---

## 1. 3D initiative dice — `InitiativeDiceStage` (module 157661, chunk `3vkoknf821dno.js`)

Loaded lazily (`e.A(355332)` → loader `A(239934)`), SSR disabled, absolute-positioned
`h-55 w-55` stage per player with `data-initiative-player-id` / `-relation` / `-winner` /
`data-team-label`. If WebGL is unavailable (or the context is lost) it swaps to a static 2D
fallback component (`module 269913`), and `WebGLRenderingContext` availability is probed once
with a scratch canvas.

### Geometry

* `DodecahedronGeometry(0.62, 0)` — radius 0.62, no subdivision (12 pentagonal faces,
  36 triangles).
* The *body* mesh geometry is rebuilt by hand: for every source triangle the 3 vertices are
  lerped **7.5 %** toward the face centroid (`lerp(centroid, 0.075)`), producing an inset plate
  per triangle; the three rim quads between the inset triangles and the original edges are
  re-triangulated (plus a fan triangulation of each pentagon hole so the solid stays closed).
  The rebuilt geometry is emitted with triangle groups:
  `addGroup(0, insetTris, 0)` → material 0 (body), `addGroup(insetTris, rimTris, 1)` → material 1 (rim/bevel).
* Number decals: one `PlaneGeometry(0.68 * 0.62, 0.68 * 0.62)` per **source triangle**
  (36 planes), placed at the triangle centroid pushed out along the face normal by
  `+0.00372` world units, oriented with `Matrix4.makeBasis(side, up, normal)`.
  `renderOrder = 3`, `polygonOffset` with `polygonOffsetFactor = -1`, `depthWrite = false`.
* Each die therefore shows 12 pentagons × 3 numbers per face; reachable values are **1..36**.
  `6` and `9` get an underline (`isUnderlined(e)` = `e === 6 || e === 9`).

### Materials

```
body  = MeshPhysicalMaterial({ color: playerColor, metalness: .28, roughness: .30,
                               flatShading: true, clearcoat: .85, clearcoatRoughness: .22 })
rim   = body.clone() with roughness .22, metalness .50
decal = MeshStandardMaterial({ map: numberCanvasTexture, transparent: true, depthWrite: false,
                               side: DoubleSide, color: 0xffefcf, roughness: .58, metalness: .25 })
shadow= MeshBasicMaterial({ map: radialGradientShadow, transparent: true, depthWrite: false })
```
Player colour (`h(player, isMe)`):
`#2bc78f` when it is my die, `#4fafd0` when `relation === "ally"`, `#d88936` otherwise.

### Textures (generated at runtime, no assets)

* **Number face** — 256×256 canvas; `font 600 146px Georgia, serif`, `textAlign center`,
  `textBaseline middle`; glyph stroked with `rgba(6,15,30,.96)` lineWidth 5 at (128,134), then
  filled `#fff1d1` at (128,133); for 6/9 an extra bar from (94.72,202.24) → (161.28,202.24),
  stroke 5, then white `#f7fbff` lineWidth 8 with `lineCap round`.
  Texture: `colorSpace = SRGBColorSpace`, mipmaps on, `anisotropy = 16`, cached per value.
* **Shadow** — 128×128 canvas, radial gradient `rgba(0,0,0,.65)` @0 → `rgba(0,0,0,.42)` @0.55 →
  transparent @1; `PlaneGeometry(1.9, 1.9)` rotated `-π/2`, y = −0.635.

### Camera & lighting

```
PerspectiveCamera(34, w/h, 0.1, 100)  at (0, 5, 0.6)  lookAt (0, 0.65, 0)
HemisphereLight(0xe4ecff, 0x243044, 1.6)
DirectionalLight(0xffeed3, 2.8) at (-2, 4, 3)
DirectionalLight(0x95caff, 0.8) at (-2, -1, 2)
renderer: antialias, alpha, powerPreference "high-performance", pixelRatio min(dpr, 2), clear alpha 0
```
`ResizeObserver` drives `setSize` + `aspect`; the stage only re-renders while
`t < 1.7 s || revealProgress < 1` (and never when `prefers-reduced-motion: reduce`).

### Roll animation (deterministic, keyed off the start timestamp)

The rolled **value is server state** (`room.initiativeRolls[playerId]`, a number) — the client
never randomises the result. Per-die randomisation only affects the *tumble path*
(`direction = rand<.5 ? -1 : 1`, `drift = (rand-.5)*.3`, `turns = 13 + 5*rand`,
`axis = normalize(0.7+0.6*rand, 0.25, 0.6*direction)`), seeded at roll start.

```
p      = (now - startedAt)/1000            // seconds since animationStartedAt
i      = reducedMotion ? 1.7 : p           // "settle" parameter
l      = clamp(i/1.7, 0, 1); a = 1 - l
s      = i < 0.6 ? 1 : exp(-1.8*(i-0.6))   // damping
f      = turns * a*a * s
rotation = axisAngle(axis, f * direction)  then premultiply axisAngle((0,1,0), 0.37*f)
wobble   = sin(l*10π) * sin(l*π) * 0.045   → axisAngle((1,0,0), wobble*a)
height   = bounce curve: 1.05 + c*i - 8i²   (i<0.6, c = (2.88-1.05)/0.6)
           then damped bounces of amplitude (9.6-c)*0.48 halving by 0.48, 16 segments each
position = ( direction*(-0.54*a³ + 0.12*l),  -0.64 + maxVerticesDrop + height,
             drift*l - 0.18*a² )
```
Total tumble lasts **1.7 s**.

### Reveal (after the roll settles)

When `room.phase === "first_player_choice"` and rolls are numbers, each die that matches its
value gets its face orientation computed as
`target = face.orientation⁻¹ premultiplied by cameraQuaternion` (i.e. the winning face is turned
toward the camera), then:

```
t        = clamp(elapsed / 0.44, 0, 1)          // reveal is 440 ms
k        = t*t*(3-2t)                             // smoothstep
quaternion.slerp(target, k); position.lerp(center, k)
scale    = 1 + (winner ? 0.65 : 0.35) * k
shadow scale = 1 + 0.55*height ; shadow opacity = 0.9*(1-0.85k)/(1+1.8*height)
```
Reveal starts at `startedAt + 2000 ms` when the timestamp is numeric, else
`max(now, started+1700) + 300 ms`. In `InitiativeDiceStage`'s parent (`35qz5rkx7yexy.js`),
absolute timers are scheduled at **1700 ms** (roll considered done), **1450 ms**, and
**4000 ms** (report `onComplete`), plus a **5000 ms** static-fallback timeout and a 4 s/5 s
"loadable" retry in module 239934's `loadable`.

Layouts: `duel-vertical` (2 players at `left-[46%] top-[18%]` / `top-[68%]`) and
`multiplayer-grid` (3 at `left-[30%] top-[24%]`, `left-[62%] top-[24%]`, `left-[46%] top-[70%]`;
4 at the 4 corners). 2v2 shows team labels; identity cue only when >2 players.
Chooser banner animates with CSS `initiative-decision-reveal 300ms 550ms both`
(from `opacity:0; margin-top:6px`).

---

## 2. 3D matchmaking rift — `createMatchmakingRiftScene` (module 868029, chunk `286zkw3d8ndo1.js`)

Mount: `tB({active, model = "cards"})` in `35qz5rkx7yexy.js:1779` renders a `<canvas>` into the
lobby, lazy-loads module 616696 (`e.A(616696)`) and registers it so the "match found" transition
can **steal the canvas** and keep the same WebGL context. `playMatchFound(rect)` starts a
`setTimeout(onComplete, 950 ms)` (skipped under reduced motion / hidden tab). The prop accepts
`"cards" | "orb" | "crystal"`; every call site uses the default **`"cards"`** (the other two
variants are complete but unreachable in this build).

Scene skeleton (shared by all three variants):

```
WebGLRenderer({canvas, alpha, antialias, powerPreference:"low-power"}), dpr min(2, 1.5 when zooming)
toneMapping = ACESFilmicToneMapping, exposure 1.2, clear alpha 0
PerspectiveCamera(34, aspect, 0.1, 30) at (0, 0.15, 7.1) lookAt (0,0,0)
environment = PMREMGenerator.fromScene(RoomEnvironment, 0.04)  (three's RoomEnvironment, hand-inlined
              with an emissive pillar/box/corner-light rig), environmentIntensity 1.35
HemisphereLight(0xd7f6ff, 0x0a1604 … 661292, 1.5)
DirectionalLight(0xffe6bd, 4) at (-3, 4, 5)
DirectionalLight(0x44e1ff … 4513791, 3) at (3, -1, -2)
PointLight(0x36dd21 … 3595489, 5, range 6, decay 2) at (0, 0, 0.9)   ← "core light", animated
glow sprite texture = 64² radial gradient rgba(235,255,255,1) → rgba(165,235,255,.65) @.14 →
                      rgba(100,180,255,.08) @.45 → transparent
```
Render loop: driven by `IntersectionObserver` + `requestAnimationFrame`, dt clamped to ≤ 0.05 s,
`u += dt` accumulated every frame from mount (phase-continuous, so no popping).

### 2.1 Variant `"cards"` (live)

* Two cards orbiting the core: `ExtrudeGeometry` from a rounded `Shape`
  (`moveTo(-0.45,-0.785) … quadraticCurveTo`, `depth .036, bevelEnabled, bevelSize .012,
  bevelThickness .012, bevelSegments 3`), plus a `PlaneGeometry(0.972, 1.499)` front/back scale
  model (card aspect ≈ 0.648).
* Card textures are **painted at runtime** at 1.5× (768×1152) with 0.75× surface and glow maps:
  background linear gradient `#183348 → #081823 (50%) → #203c50`, gold double frame
  (`#8b7954` lineWidth 3 inset 22 px; `#3b5460` 1.5 px inset 33 px), diagonal hatch
  `rgba(119,159,167,.1)` every 46 px, the Rift Atlas `markHollowGold` wordmark drawn at
  (110,170,292×337) with a multiply pass, `"RIFTBOUND"`-style set label in `bold 45px Georgia`
  at (256,662) `#edce87`, a hairline `#8cacc5` at (191,687,130×2). The **surface/metalness** map
  is `rgb(0,190,0)` inside the crest and the **glow/emissive mask** is red for the crest hexagon.
* `MeshPhysicalMaterial({ map, roughnessMap, metalnessMap, roughness:1, metalness:1,
  specularIntensity:.3, emissive: 0x3fdd1e / 0x8e6d5f…, emissiveMap: glow, emissiveIntensity:.5 })`
  patched via `onBeforeCompile` with a `vEmissiveMapUv` pulse/flare (see §5.4).
* 48-point additive sparkle `Points` trail + a `Sprite` glow behind the cards.
* Motion: orbit `θ = e*2π/4.2`, radius vector `(0.77cosθ, 0.27sinθ, 0.67sinθ)`,
  cards mounted at odd/even `θ + kπ`; per-card rotation
  `(-0.08+0.15 sinθ, 0.55 sinθ, -0.26 cosθ)`; the second card is mirrored. Idle bob
  `y = 0.05 + 0.035 sin(0.9e)`, `rotation.z = -0.04`.
* `playMatchFound` flies the cards into the viewport frame along a CatmullRom path
  `p0(0,0,0) → p1(v0) → p2(1.25·s, -0.8·s, 1.4) → p3(-0.65·s, -0.6·s, 4.3) → p4(-1.15·s, -0.7·s, 7.7)`
  with `t = clamp((elapsed - 0.075·i)/0.77, 0, 1)^1.25`, plus a per-card `sin(tπ)` roll
  (`±0.32` on x, `±1.15` on y, `∓0.7` on z) using `smoothstep` blending, and
  `uCardFlare = 1.4·sin(min(t/0.6,1)·π)`.
* Camera hand-off: the canvas is re-parented into the found-match panel and the camera uses
  `setViewOffset` + `zoom = rect.height/B` interpolation with
  `smootherstep(elapsed/0.42)` — a 420 ms match-cut from the lobby layout to the panel rect
  (drawing-buffer dpr also drops from 2 → 1.5 during the transition).

### 2.2 Variant `"crystal"` (unreachable, fully implemented)

Three stacked `LatheGeometry` octagonal prisms (`top .53/bottom 0, h .71, y .675`;
`top .44, h .72, y -.04`; `top 0, h .6, y -.7`), a `CylinderGeometry(0.34)` glow core
scaled (0.6, 2.5, 0.6), 3 orbiting `CylinderGeometry(0.22)` shards, additive glow sprite and a
38-point `Points` helix. `MeshPhysicalMaterial({color:0x075578, metalness:.65, roughness:.19,
clearcoat:1, clearcoatRoughness:.08, envMapIntensity:.75, emissive:0x032339, emissiveIntensity:.4,
flatShading:true})` with an `onBeforeCompile` "vein flow" emissive (`pow(1-|sin(flow*2.8+detail*.6)|,16)`,
scale 7, drift time×0.55). Motion: `p.value = e`, `t = ((1-cos(e·2π/3.8))/2)³`, y bob
`0.05+0.065 sin(1.4e)`, body rotation `(0.15+0.13 sin(.65e), 0.8e, -0.17+0.08 sin(.7e))`,
prisms separate by `(1-n)·(0.008+0.1t)`.

### 2.3 Variant `"orb"` (the function's own default, also unreachable)

Three `ExtrudeGeometry` arc rings (`absarc(0,0,1.46,θ,θ+1.82)` width 0.155, inner joints
0.047, `bevelSegments 2`, `curveSegments 40`, depth 0.045/0.09) + 15 rivets
(`CylinderGeometry(0.035,0.068,0.012)`) + 3 crown gems (`IcosahedronGeometry(0.067)`) + 2 inner
rings (`radius 1.15`) with `TorusGeometry` hairlines; core = `SphereGeometry(0.68,48,32)` with a
**custom ShaderMaterial** (vertex passes position/normal/view; fragment: tri-sine `field()` domain
warp, `vein = pow(1-|sin(flow*3.2+fine*1.3)|,12)`, `inner = smoothstep(-0.3,0.75,flow)`,
edge `pow(1-facing,2.7)`, 48-power specular ping, tone-mapped). Motion uses the same
`((1-cos(e·2π/3.8))/2)³` pulse, `uPulse` drives core scale (+2.5 %), core light intensity
`5 + 1.4·pulse`, glow opacity `0.18 + 0.075·pulse`, and a 44-point additive particle belt whose
positions are recomputed per frame from the ring rotations.

### 2.4 Failure path

If the lazy import fails, `onUnavailable` sets state and the DOM fallback shows
`data-matchmaking-model="…"`, an `atmosphere` gradient and — for `"cards"` — two stacked spans
using `url(${J.markHollowGold})` as the card crest. `data-matchmaking-rift` flips
`ready|fallback`.

---

## 3. Rive

Two `.riv` files exist (neither is in `asset-manifest.json`; both are served **same-origin** by the
apps through a Next rewrite → CDN, and both are downloaded to `.recon/site/assets/extra/`):

| file | size | used by | state machine | load mode |
|---|---|---|---|---|
| `/cosmetics/poro/pals.riv` | 51 793 B | poro emotes (chat/ping overlay) | `Reaction` | `buffer` (fetched once as ArrayBuffer, cached) |
| `/metafy/astronaut.riv` | 223 088 B | Metafy membership mascot (`data-metafy-mascot`) | `interaction` | `src` (URL) |

Both use `enableRiveAssetCDN: false`, `shouldDisableRiveListeners: true`, `autoplay: false`, and a
`prefers-reduced-motion` / `document.hidden` gate (hidden or reduced-motion → `pause()`;
reduced-motion also falls back to a static poster: `astronaut.png` for the mascot, the inline poro
SVG for the emotes). `resizeDrawingSurfaceToCanvas()` is wired to a `ResizeObserver`.
The mascot canvas is 336×384 intrinsic, rendered at `h-28 w-24` (`h-20 w-16` compact); no state
machine inputs are ever set (interaction is implicit).

Poro runtime construction (chunk `0ltxa4_95njgw.js`, module ~83200, the emote/ping chunk):

```
new Runtime.Rive({
  canvas, buffer, artboard: <emote id>,
  stateMachine: "Reaction",
  autoplay: false, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
  layout: new Layout({ fit: Fit.Contain }),
})
```
  `artboard` = the emote id itself, so the file contains one artboard per reaction.
* Emote ids / artboards (6): `poro_wave` (Hello 👋 #8de0dc), `poro_heart` (Love ❤️ #ff91b4),
  `poro_laugh` (Laugh 😂 #ffd580), `poro_thinking` (Thinking 🤔 #c7b0ff),
  `poro_sad` (Sad 😢 #8ecfff), `poro_party` (Celebrate 🎉 #ffe299).
  Live emote set = these 6 + `thumbs_up, heart, laugh, wow, cry, angry, good_game`.
* Lifecycle: only plays when `animated` is on, the element is intersecting, the tab is visible and
  reduced-motion is off; `resizeDrawingSurfaceToCanvas()` on load and on resize; a replay token
  resets + plays (`rive.reset({artboard, stateMachine:"Reaction"}); rive.play()`), throttled to
  **≥ 3000 ms** between replays. Failure → poster SVG (the poro is otherwise drawn as an inline
  SVG with 100+ paths, e.g. wave arms `M122 117C131 114 145 99 144 89…`) with
  `data-poro-rive = ready|fallback`, `data-poro-playback = idle|burst`.
* No other `.riv` files exist in either bundle apart from the mascot above, and no Rive
  state-machine inputs are bound anywhere (`stateMachineInputs` are never touched — state is
  implicit through the machines `Reaction` / `interaction`).

---

## 4. framer-motion (motion/react) variants — exact values

`AnimatePresence` + `motion.div/section` are used throughout; the notable, replicated ones:

| where | initial | animate | exit | transition |
|---|---|---|---|---|
| **Battlefield reveal — card materialising (chunk `0xawjzm3yjpr1.js` ~60, `S`)** | `opacity 0, scale .84, y 14, filter brightness(.2) saturate(.5)` | keyframes `opacity [0,.2,.9,1,1]`, `scale [.84,.86,.92,1.05,1]`, `y [14,13,8,-3,0]`, `filter [b(0.2)s(.5), b(0.2)s(.5), b(0.42)s(.7), b(1.6)s(1.2), b(1)s(1)]` | — | `duration 1.5`, `times [0, .2, .4733, .5933, 1]`, `ease [0.16,0.84,0.24,1]` (crossing `[0.5,0,0.9,0.5]`) |
| **same, "already on board" (`N`)** | `opacity .8, scale 1, y 0, filter b(.9)s(.7)` | `opacity [.8,.75,.9,1,1]`, `scale [1,.93,.92,1.05,1]`, `y [0,8,8,-3,0]`, filter arc to `b(1.6)s(1.2)` then `b(1)s(1)` | — | same 1.5 s / same times+ease |
| **overlay fade (`R`)** | `opacity 0` | `opacity 1` | — | `duration .6`, `ease [0.16,0.84,0.24,1]` |
| **battlefield might number roll (`mX` enter / `mZ` leave)** | enter `{opacity 0, y 9·dir, rotateX −40·dir}` | `settled {opacity 1, y 0, rotateX 0}` | `{opacity 0, y −9·dir, rotateX 40·dir}` (exits collapse to `{opacity 0}` when reduced-motion) | `duration .28`, `ease [0.22,1,0.36,1]` |
| **spell-chain card stack entry** | `{x 20, y 24, rotate 5, scale .96, opacity 0}` | `{x 0, y 0, rotate 0, scale 1, opacity 1}` | `{x −34, y −12, rotate −12, scale .9, opacity 0}` | x/y/rotate/scale = spring `{stiffness 420, damping 34, mass .62}`; opacity `duration .2`. `transformOrigin "92% 100%"`, z-index 40 for depth 0 else `20 − depth` |
| **time-warp / rewind card sweep** | `clipPath polygon(0 0, 7% 0, 12% 10%, 9% 24%, 18% 38%, 15% 52%, 23% 66%, 19% 84%, 28% 100%, 0 100%)` (jagged left edge) | full rect `polygon(0 0, 100% 0, 100% 100%, 0 100%)` | `{opacity 0}` | `duration .78`, `ease [0.16,0.78,0.22,1]` |
| **settings/toggle rows** | `{opacity 0, y 6}` | `{opacity 1, y 0}` | `{opacity 0, y 6}` | `duration .22`, `delay .04 + .035·index`, `easeOut` |
| **dialog** | `{opacity 0}` | `{opacity 1}` | — | `duration .18` |
| **hint toasts** | `{opacity 0, y 6, scale .98}` | `{opacity 1, y 0, scale 1}` | — | `duration .16`, `easeOut` |
| **info card (tutorial)** | `{opacity 0, x 8}` | `{opacity 1, x 0}` | `{opacity 0, x 4}` | `duration .2, delay .04·index` (board chunk ~16263) |

`AnimatePresence` counts are high (58 `initial:` blocks in the board chunk alone), so an exact
copy should reuse the four "signature" transitions and keep the rest as-is.

### 4.1 Card reveal / draw / banish flight (module 805545, chunk `25vik2nxxo51i.js`)

A portal-rendered flight for `banish` and `neeko-legend` reveals — **Web Animations API**, not
motion. Layout constants: card aspect `88/63 ≈ 1.3968` (height = 1.3968 × width);
card width `M = clamp(110, min(220, 0.46·playAreaHeight / aspect, 0.4·playAreaWidth))`.

```
start rect  B = source pile ("mainDeck" slot, or the touch-card element) centre
end rect    L = play area centre;  scale from source = sourceWidth / M
phase 1 fly-in : transform  B·scaleSource → B·(1.05·scale) @12% → L·1
                 duration 440 ms, ease cubic-bezier(0.2, 0.8, 0.25, 1)
                 (opacity 0 → 1 across the same keyframes)
phase 2 flip   : card back rotateY(180deg) → rotateY(0deg)
                 duration 340 ms, ease cubic-bezier(0.3, 0.7, 0.2, 1)
                 + overlay opacity 0 → 1 over 360 ms
phase 3 pulse  : L·1 → L·1.035 over 680 ms ease-in-out
hold           : 700 ms minimum spacing per card (cards queue: next start = max(now, prev + 700))
return         : L·1.035 → target·scale, duration 560 ms, ease cubic-bezier(0.55, 0, 0.3, 1)
                 "banish": clip-path inset(0 round 8px) → inset(… round 50%) over 420 ms
                 ease cubic-bezier(0.4, 0, 0.2, 1)  (radial "sucked into the pile" mask)
overlay fade   : 220 ms (abort) / 260 ms (return)
landing pulse  : source card scale 1.16 → 1 (neeko: 1.05 → 1) over 280 ms
                 ease cubic-bezier(0.2, 0.8, 0.25, 1)
reduced-motion : opacity 0 → 1 (200 ms), dwell 900 ms, opacity 1 → 0 (200 ms)
```

### 4.2 Drag ghost physics (board chunk ~35800–35910)

Pointer-drag of a card spawns a translated clone ("drag ghost") with a per-frame spring:

```
λ_vel  = exp(-dt/118)            // velocity decay per frame (dt in ms)
tiltX_target = clamp(-0.0115·vy, -13, 13) deg
tiltY_target = clamp( 0.0115·vx, -13, 13) deg
roll_target  = clamp( 0.0075·vx,  -8,  8) deg
k = 1 - exp(-dt/42)              // follow lerp
transform = perspective(980px) translate3d(x, y, 0) translate(-50%, -50%)
            rotateX(tiltX) rotateY(tiltY) rotateZ(roll) scale(1.02)
```
`prefers-reduced-motion` → plain `translate3d(x,y,0) translate(-50%,-50%)` and `rotate(0)`.
Drop validity is resolved from the pointer position; `Escape`, `drop`, `dragend`, `dragover` and
`keyup` are all wired with capture listeners.

### 4.3 Hand fan geometry (chunk `439rnwycqsxxv.js`, module `l()`)

`--card-width` default `5.2rem`, `--card-height = 1.392857 × width` (= 88/63 aspect).
For `y` visible cards, `b = (y-1)/2`, per-card normalised offset `o = (i-b)/b`:

```
maxRot   P = compact ? 0.7 : (y ≤ 3 ? 2.6 : max(1.9, 7.2 - 0.2·y))     deg
sagZ     z = compact ? 0.15 : (y ≤ 3 ? 4.2 : max(2.6, 10.4 - 0.24·y))  px
baseY    S = compact ? 0.4 : 16                                        px
--fan-offset-x    = (i-b) · spacingRem     (spacing derived from rail width, capped at 0.58·layoutWidth)
--fan-rotate      = o · P                  deg
--fan-translate-y = S + o² · z             px     (quadratic arc: outer cards drop)
--fan-hover-raise = -12px on hover (0px while dragging/touch)
origin: center bottom; transition: transform 220 ms cubic-bezier(0.2, 0.7, 0.2, 1)
hovered card gets z-index 80 (200 for revealed/remote-hovered); reveal indicator chip
1.9rem circle at top −2rem, glow shadow, svg scale 1.4 → 0 when active
```
Rail overflow budget `Math.sin(P·π/180) · 16 / 2` px plus `S + z` is exported as
`--hand-fan-bottom-overflow`.

### 4.4 Point / conquer particle burst (board chunk ~500–560)

Canvas particle system used for score pings and conquer bursts:
`γ = 0.95 − 0.07` (emit window), 64 petals `{angle rand·2π, reach 1.1+1.2·rand,
spawn 0.06+rand·γ-ish, life 0.42+0.24·rand, size 0.9+1.3·rand}` and 110 rays
`{angle rand·2π, speed 0.6+0.9·rand, delay 0.12·rand, width 0.6+1.1·rand}`; palette
`#64ffde` (cyan, every 3rd), `#ff5cb0` (pink, every 7th/8th), `#ecfffa` (white); conic-gradient
sweep when `createConicGradient` is available, else flat `rgba()`. Timing helper
`ee(t, a, b, c, d) = min(fade(t,a,b), 1-fade(t,c,d))` with `fade = clamp((t-a)/(b-a))`.

### 4.5 CSS keyframes (playapp `1sj2l8ggay34g.css`, 35 keyframes)

Hand-written (non-Tailwind) animations, useful for the copy:

```
cardMaterialize            0% opacity .45 → 100% opacity 1
banish-links-lift          0% translate 0 calc(6px - 100%)
initiative-decision-reveal 0% opacity 0, margin-top 6px → 100% opacity 1, margin-top 0
scoreTrackNodeLand         0% brightness(.72) saturate(.86) scale(.82) → 32% b(1.64) s(1.18) scale(1.22)
                           → 54% b(1.04) s(1.04) scale(.93) → 74% b(1.2) s(1.08) scale(1.09) → 100% scale(1)
scoreTrackNodePulse / -ChargeArrival / -LabelArrival / scoreTrackConnectorSurge / showdown*
time-warp-sweep            0%,45% opacity 0 translate(-160%) skew(-18deg) → 60% opacity .4
                           → 80%,100% opacity 0 translate(360%) skew(-18deg)
touch-counter-unfold       0% opacity 0, translate(var(--counter-from-x|y)) scale(.62)
                           → 70% scale(1.035) → 100% none
touch-counter-tick, touch-hold-*, gbPing{Pulse,Flash,CornerPulse,InnerPulse},
gb-playmat-fissure-fill, expectedActionButtonPulse/-SplitPulse, simulator-entry-*, spin, pulse
```
Other CSS chunks: `0mq6k3dqx1du5.css` (brand: `riftatlas-mark-star-glow/-turn`,
`riftatlas-tier-mark-halo/-in/-out/-sheen`), `3of7_4i02s81l.css`
(`inspectionNoticeShake`, `Q62dXa_artwork`, `Q62dXa_lobby-exit`, `zZWz6q_tag-glint/-swing`).

### 4.6 Board texture / SVG filter pipeline

The board "glass map" (frosted displacement + highlight) is generated off-thread:

* worker source kept as a static `.ts`: `/_next/static/immutable/media/glass-map.worker.<hash>.ts`
  (32 lines) → imports `createGlassMapPixels(geometry)`, encodes `displacement` and `highlight`
  as PNGs with `OffscreenCanvas.convertToBlob({type:"image/png"})`, returns
  `{map:{displacement,highlight,scale}}` or `{failed:true}` (main-thread path exists as fallback).
* consumed by an SVG filter: `feGaussianBlur(stdDeviation = frost²·16)` → `feImage` of the
  displacement PNG (`preserveAspectRatio:none`) → 2× `feDisplacementMap`
  (`xChannelSelector R`, `yChannelSelector G`, `scale = map.scale · bend`, bend = `1 + l.j`) →
  `feColorMatrix` per channel → composite.
* `--play-zone-frost` and `playmatIntensity 0.8` / `playmatContrast` are user cosmetics that
  feed this filter; `hideBoardChrome`, `playZoneGlass`, `playmatAnimationsEnabled` toggle the
  related classes (`gb-playmat-zone-glass`, `gb-playmat-zone-ornament`, …).

---

## 5. Cross-cutting constants (copy these exactly)

| constant | value | where |
|---|---|---|
| card aspect | `63/88` (portrait, height/width 1.3968) | reveal flight `l = 88/63`; hand `1.392857·w` |
| card art CDN widths | `96,128,192,256,320,384,512,640,768,1024,1280,1536` | `1ixua9twvm95a.js` |
| default art quality | 75 (clamped 75–92) | `m(width, 75)` |
| small-v2 threshold | width bucket ≤ 384 | responsive builder |
| hand card width | 5.2 rem default | `layoutCardWidthRem` |
| deck-pile draw spacing | 700 ms per queued card | reveal flight queue |
| drag follow | `perspective(980px)`, decay 118 ms, follow 42 ms, tilt ±13°, roll ±8° | drag ghost |
| sound volume store | 0–200 step 5, default 100, key `riftbound_simulator_sfx_volume:v2` | module 608607 |
| chat sound playbackRate | 0.6 | sound map |
| card_hover / ui_click cooldowns | 35 ms / 20 ms | sound map |
| initiative roll | 1700 ms tumble, reveal 440 ms, timers 1450/1700/4000 ms | dice stage |
| match-found transition | 950 ms | rift scene mount |
| rive replay throttle | 3000 ms | poro emote |

## 6. What a faithful copy needs

1. A server (or seeded RNG) that owns `initiativeRolls`, `roll_die` and `roll_initiative` — the
   3D die only *renders* state; there is no client-side dice RNG.
2. The dodecahedron inset-plate geometry + runtime canvas number atlas (36 values, 6/9 underlined)
   if you want the dice to look identical.
3. The three rift variants are separable; ship `"cards"` (the only one reachable live) and keep the
   PMREM `RoomEnvironment` + ACES tone mapping for the material look.
4. `pals.riv` / `astronaut.riv` are binary assets served **same-origin**
   (`https://play.riftatlas.com/cosmetics/poro/pals.riv`, `/metafy/astronaut.riv`) — both were
   fetched into `.recon/site/assets/extra/`; the surrounding SVG poro and the state-machine names
   (`Reaction`, `interaction`) are known, so a clone only needs the same artboards and machine names.
5. Motion: reuse the four signature transitions (§4 table rows 1–2, 4, 5) and the §4.1 WAAPI
   flight; the rest are short 0.16–0.28 s easeOut fades.
