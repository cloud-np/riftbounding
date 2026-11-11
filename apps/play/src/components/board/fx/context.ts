/**
 * Runtime context shared by every effect: timers/rAFs/animations that are cancelled together on
 * unmount, ref-counted hiding of real card elements, screen shake and floating numbers.
 */
import type { ParticleEngine } from "./particles";
import { fxSpeed, scaled } from "./speed";

const SKULL_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.9 2 3.5 5.4 3.5 10c0 2.6 1.1 4.5 2.9 5.6V19c0 .6.4 1 1 1h2.1v-2h1.5v2h2v-2h1.5v2h2.1c.6 0 1-.4 1-1v-3.4c1.8-1.1 2.9-3 2.9-5.6C20.5 5.4 17.1 2 12 2Zm-3.6 11.2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7.2 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" fill="currentColor" stroke="rgba(20,4,4,0.9)" stroke-width="1.2" paint-order="stroke"/></svg>';

export type FxLevel = "full" | "reduced";

export class FxContext {
  disposed = false;
  active = 0;
  readonly castOrigins = new Map<string, { x: number; y: number }>();
  private timers = new Set<number>();
  private rafs = new Set<number>();
  private resolvers = new Set<(ok: boolean) => void>();
  private cleanups = new Set<() => void>();
  private animations = new Set<Animation>();
  private hidden = new Map<HTMLElement, { count: number; prev: string }>();
  private shakeAnim: Animation | null = null;
  private shakeStrength = 0;
  private shakeUntil = 0;

  constructor(
    readonly stage: HTMLElement,
    readonly top: HTMLElement,
    private readonly getEngine: () => ParticleEngine | null,
    public level: FxLevel,
    public viewerId: string,
  ) {
    this.applySpeed();
  }

  /** Publish the slow-motion factor to CSS keyframes (`calc(1250ms * var(--fx-t))`). */
  applySpeed(): void {
    const t = (1 / fxSpeed()).toFixed(4);
    this.stage.style.setProperty("--fx-t", t);
    this.top.style.setProperty("--fx-t", t);
  }

  engine(): ParticleEngine | null {
    return this.level === "full" ? this.getEngine() : null;
  }

  wait(nominalMs: number): Promise<boolean> {
    const ms = scaled(nominalMs);
    return new Promise((resolve) => {
      if (this.disposed) return resolve(false);
      if (ms <= 0) return resolve(true);
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        this.resolvers.delete(resolve);
        resolve(!this.disposed);
      }, ms);
      this.timers.add(id);
      this.resolvers.add(resolve);
    });
  }

  /** rAF loop; `fn(t)` gets 0..1. Resolves false when disposed. */
  frames(nominalMs: number, fn: (t: number) => void): Promise<boolean> {
    const ms = scaled(nominalMs);
    return new Promise((resolve) => {
      if (this.disposed) return resolve(false);
      const start = performance.now();
      const step = (now: number) => {
        this.rafs.delete(id);
        if (this.disposed) return resolve(false);
        const t = Math.min(1, (now - start) / ms);
        fn(t);
        if (t >= 1) {
          this.resolvers.delete(resolve);
          return resolve(true);
        }
        id = requestAnimationFrame(step);
        this.rafs.add(id);
      };
      let id = requestAnimationFrame(step);
      this.rafs.add(id);
      this.resolvers.add(resolve);
    });
  }

  own(cleanup: () => void): () => void {
    this.cleanups.add(cleanup);
    return () => {
      if (this.cleanups.delete(cleanup)) cleanup();
    };
  }

  animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
    const slow = fxSpeed();
    const opts = slow === 1 ? options : { ...options };
    if (slow !== 1) {
      if (typeof opts.duration === "number") opts.duration /= slow;
      if (opts.delay) opts.delay /= slow;
      if (opts.endDelay) opts.endDelay /= slow;
    }
    const animation = el.animate(keyframes, opts);
    this.animations.add(animation);
    animation.addEventListener("finish", () => this.animations.delete(animation));
    animation.addEventListener("cancel", () => this.animations.delete(animation));
    return animation;
  }

  hide(el: HTMLElement): void {
    const entry = this.hidden.get(el);
    if (entry) {
      entry.count += 1;
      return;
    }
    this.hidden.set(el, { count: 1, prev: el.style.visibility });
    el.style.visibility = "hidden";
  }

  show(el: HTMLElement): void {
    const entry = this.hidden.get(el);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count > 0) return;
    el.style.visibility = entry.prev;
    this.hidden.delete(el);
  }

  /** Screen shake on the board shell via the standalone `translate` property. */
  shake(strengthPx: number, durationMs: number, steps = 9): void {
    if (this.level !== "full" || this.disposed) return;
    const now = performance.now();
    if (this.shakeAnim && now < this.shakeUntil && this.shakeStrength >= strengthPx) return;
    const shell = document.querySelector<HTMLElement>("[data-game-board-shell]");
    if (!shell) return;
    this.shakeAnim?.cancel();
    const frames: Keyframe[] = [];
    for (let i = 0; i < steps; i += 1) {
      const decay = 1 - i / steps;
      const angle = Math.random() * Math.PI * 2;
      frames.push({
        translate: `${(Math.cos(angle) * strengthPx * decay).toFixed(2)}px ${(Math.sin(angle) * strengthPx * decay).toFixed(2)}px`,
      });
    }
    frames.push({ translate: "0px 0px" });
    this.shakeStrength = strengthPx;
    this.shakeUntil = now + scaled(durationMs);
    const animation = shell.animate(frames, { duration: scaled(durationMs), easing: "linear" });
    this.shakeAnim = animation;
    const done = () => {
      if (this.shakeAnim === animation) this.shakeAnim = null;
    };
    animation.addEventListener("finish", done);
    animation.addEventListener("cancel", done);
  }

  /** Slight board "thud": a quick scale pulse of the board shell (`scale` is independent of the shake's `translate`). */
  thud(amount: number, durationMs = 360): void {
    if (this.level !== "full" || this.disposed) return;
    const shell = document.querySelector<HTMLElement>("[data-game-board-shell]");
    if (!shell) return;
    const animation = shell.animate(
      [
        { scale: "1", easing: "cubic-bezier(0.1, 0.8, 0.3, 1)" },
        { scale: `${1 + amount}`, offset: 0.22, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
        { scale: "1" },
      ],
      { duration: scaled(durationMs) },
    );
    this.animations.add(animation);
    animation.addEventListener("finish", () => this.animations.delete(animation));
    animation.addEventListener("cancel", () => this.animations.delete(animation));
  }

  /**
   * Floating number (damage / buff / score) in the top layer. `big` numbers are the combat hit
   * pops (scale-pop, then rise and fade); `lethal` adds a skull accent.
   */
  number(
    x: number,
    y: number,
    text: string,
    kind: "damage" | "buff" | "score",
    delayMs = 0,
    opts: { big?: boolean; lethal?: boolean; durationMs?: number } = {},
  ): void {
    if (this.disposed) return;
    const node = document.createElement("div");
    node.className = `fx-number fx-number--${kind}${opts.big ? " is-big" : ""}${opts.lethal ? " is-lethal" : ""}`;
    const label = document.createElement("span");
    label.textContent = text;
    if (opts.lethal) {
      const skull = document.createElement("span");
      skull.className = "fx-number-skull";
      skull.innerHTML = SKULL_SVG;
      node.appendChild(skull);
    }
    node.appendChild(label);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.opacity = "0";
    this.top.appendChild(node);
    const remove = this.own(() => node.remove());
    const rise = kind === "score" ? 46 : opts.big ? 70 : 58;
    const peak = opts.big ? 1.9 : 1.5;
    const hold = opts.big ? 0.42 : 0.34;
    const animation = this.animate(
      node,
      [
        { opacity: 0, transform: "translate(-50%, -30%) scale(0.2)", offset: 0 },
        { opacity: 1, transform: `translate(-50%, -62%) scale(${peak})`, offset: 0.14 },
        { opacity: 1, transform: "translate(-50%, -80%) scale(1)", offset: hold },
        { opacity: 1, transform: `translate(-50%, ${-80 - rise * 0.5}%) scale(1)`, offset: 0.74 },
        { opacity: 0, transform: `translate(-50%, ${-80 - rise}%) scale(0.92)`, offset: 1 },
      ],
      { duration: opts.durationMs ?? (opts.big ? 1150 : 1000), delay: delayMs, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "both" },
    );
    animation.addEventListener("finish", remove);
    animation.addEventListener("cancel", remove);
  }

  /** Quick hit reaction on a real card element: knock + flash via translate/filter. */
  hitReaction(el: HTMLElement, tint: "red" | "green" | "white" = "red"): void {
    if (this.disposed) return;
    const filter =
      tint === "red"
        ? "brightness(1.9) saturate(1.8) hue-rotate(-12deg)"
        : tint === "green"
          ? "brightness(1.6) saturate(1.5) hue-rotate(40deg)"
          : "brightness(2.4)";
    this.animate(el, [{ filter }, { filter: "none" }], { duration: 320, easing: "ease-out" });
    if (tint === "green") {
      this.animate(el, [{ scale: "1" }, { scale: "1.1" }, { scale: "1" }], {
        duration: 420,
        easing: "cubic-bezier(0.2, 1.4, 0.35, 1)",
      });
      return;
    }
    if (this.level === "full") {
      this.animate(
        el,
        [
          { translate: "0px 0px" },
          { translate: "-7px 1px" },
          { translate: "6px -2px" },
          { translate: "-4px 1px" },
          { translate: "2px 0px" },
          { translate: "0px 0px" },
        ],
        { duration: 300, easing: "linear" },
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const id of this.timers) clearTimeout(id);
    for (const id of this.rafs) cancelAnimationFrame(id);
    this.timers.clear();
    this.rafs.clear();
    for (const animation of this.animations) {
      try {
        animation.cancel();
      } catch {
        /* already finished */
      }
    }
    this.animations.clear();
    this.shakeAnim?.cancel();
    this.shakeAnim = null;
    for (const resolve of this.resolvers) resolve(false);
    this.resolvers.clear();
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        /* node already removed */
      }
    }
    this.cleanups.clear();
    for (const [el, entry] of this.hidden) el.style.visibility = entry.prev;
    this.hidden.clear();
    this.stage.replaceChildren();
    this.top.replaceChildren();
  }
}
