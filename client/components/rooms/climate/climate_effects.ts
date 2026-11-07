// Klima Kavgası effects: one canvas over the room, drawn from the prototype's numbers
// (.claude/mockups/klima-kavgasi.html is the visual reference, the owner approved its
// intensity). Frost, icicles, snow and a snow drift when cold; an edge glow, heat haze and
// sparks when hot; air streaks from the wall unit while the AC runs.
//
// Never over the times. Two kinds of protection:
//  - data-climate-text (scramble, results, own time, stats, chat, log): the effects spread
//    over the area, but every piece of TEXT inside it is wiped clean with a soft edge, so a
//    number or a move always reads on its own background. Covering whole boxes left a phone
//    with almost nothing to draw on: the results table fills the screen there.
//  - data-climate-protect (chat input): the whole box stays clean.
// The loop pauses whenever the full-screen solve overlay is up and idles when there is
// nothing to draw.
//
// Turned up past the prototype at the owner's request (2026-11-07: "daha abartılı"): wider
// and stronger edges, longer icicles, more snow and sparks, flames along the bottom when
// the room is on fire.
//
// Reduced motion slows everything to a third instead of freezing it: the owner's own
// Windows has animations off, and a still picture read as "the effects are weak". Anyone
// who wants none switches them off on the remote.

import { climateLevel, coldIntensity, hotIntensity } from '../../../../shared/friendly_room/climate';

export interface ClimateEffectInputs {
    enabled: boolean;
    temp: number;
    acOn: boolean;
    cooling: boolean;
    fan: number;
}

export interface ClimateEffectOptions {
    // Slows the motion down, never stops it (see the header).
    reducedMotion: boolean;
    // Native app or a weak device: half the particles, a 1x canvas, ~30 fps.
    lowPower: boolean;
}

interface Seg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    t0: number;
    t1: number;
    w: number;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const IDLE_POLL_MS = 500;

export class ClimateEffectsRenderer {
    private ctx: CanvasRenderingContext2D | null;
    private W = 0;
    private H = 0;
    // The drawing area: from the bottom of the room's header block (the "ceiling", icicles
    // hang from it) to the top of the bottom stats strip (the "floor", snow piles and flames
    // stand on it). Re-measured every second: the strip comes and goes with the mobile tab.
    private top = 0;
    private floor = 0;
    private lastMeasure = 0;
    private crystals: Seg[][] = [];
    private icicles: { x: number; w: number; l: number; d: number }[] = [];
    private flakes: { x: number; y: number; r: number; v: number; d: number }[] = [];
    private embers: { x: number; y: number; v: number; r: number; d: number; g: number }[] = [];
    private flames: { x: number; w: number; h: number; d: number }[] = [];
    private pile = 0;
    private tSec = 0;
    private lastFrame = 0;
    private frameSkip = false;
    private raf = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private drewLast = false;
    private resizeObserver: ResizeObserver | null = null;
    // Soft holes around protected text, redrawn only when the page changes.
    private mask: HTMLCanvasElement | null = null;
    private maskCtx: CanvasRenderingContext2D | null = null;
    private maskDirty = true;
    private lastMaskAt = 0;
    private mutationObserver: MutationObserver | null = null;
    private onScroll = () => {
        this.maskDirty = true;
    };

    constructor(
        private canvas: HTMLCanvasElement,
        private host: HTMLElement,
        private getInputs: () => ClimateEffectInputs,
        private opts: ClimateEffectOptions
    ) {
        this.ctx = canvas.getContext('2d');
    }

    start(): void {
        if (this.running || !this.ctx) return;
        this.running = true;
        this.resize();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.host);
        }
        if (typeof MutationObserver !== 'undefined') {
            this.mutationObserver = new MutationObserver(() => {
                this.maskDirty = true;
            });
            this.mutationObserver.observe(this.host, { subtree: true, childList: true, characterData: true });
        }
        // Scroll does not bubble; capture catches the table and chat scrolling.
        this.host.addEventListener('scroll', this.onScroll, true);
        this.lastFrame = performance.now();
        this.schedule(0);
    }

    stop(): void {
        this.running = false;
        if (this.raf) cancelAnimationFrame(this.raf);
        if (this.timer) clearTimeout(this.timer);
        this.raf = 0;
        this.timer = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.host.removeEventListener('scroll', this.onScroll, true);
        this.clear();
    }

    private schedule(delayMs: number): void {
        if (!this.running) return;
        if (delayMs > 0) {
            this.timer = setTimeout(() => {
                this.timer = null;
                this.lastFrame = performance.now();
                this.raf = requestAnimationFrame((now) => this.frame(now));
            }, delayMs);
        } else {
            this.raf = requestAnimationFrame((now) => this.frame(now));
        }
    }

    private clear(): void {
        if (this.ctx && this.drewLast) this.ctx.clearRect(0, 0, this.W, this.H);
        this.drewLast = false;
    }

    private resize(): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const r = this.host.getBoundingClientRect();
        const dpr = this.opts.lowPower ? 1 : Math.min(2, window.devicePixelRatio || 1);
        this.W = r.width;
        this.H = r.height;
        this.canvas.width = Math.round(this.W * dpr);
        this.canvas.height = Math.round(this.H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!this.mask) {
            this.mask = document.createElement('canvas');
            this.maskCtx = this.mask.getContext('2d');
        }
        this.mask.width = this.canvas.width;
        this.mask.height = this.canvas.height;
        this.maskCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.maskDirty = true;
        this.top = this.measureTop();
        this.floor = this.measureFloor();
        this.lastMeasure = performance.now();
        this.buildCrystals();
        this.buildIcicles();
        this.buildFlames();
        this.drewLast = true;
        this.clear();
    }

    private measureTop(): number {
        const ceiling = this.host.querySelector('[data-climate-ceiling]');
        if (!ceiling) return 0;
        const h = this.host.getBoundingClientRect();
        return Math.max(0, ceiling.getBoundingClientRect().bottom - h.top);
    }

    private measureFloor(): number {
        const floor = this.host.querySelector('[data-climate-floor]');
        if (!floor) return this.H;
        const h = this.host.getBoundingClientRect();
        const r = floor.getBoundingClientRect();
        if (r.height <= 0) return this.H;
        return Math.min(this.H, Math.max(this.top + 40, r.top - h.top));
    }

    /** The header or the stats strip moved without the room resizing (tab switch). */
    private remeasure(now: number): void {
        if (now - this.lastMeasure < 1000) return;
        this.lastMeasure = now;
        const top = this.measureTop();
        const floor = this.measureFloor();
        if (Math.abs(top - this.top) > 1 || Math.abs(floor - this.floor) > 1) {
            this.top = top;
            this.floor = floor;
            this.buildCrystals();
            this.buildIcicles();
        }
    }

    private buildIcicles(): void {
        this.icicles = [];
        let x = 6;
        while (x < this.W - 6) {
            this.icicles.push({ x, w: 5 + Math.random() * 9, l: 20 + Math.random() * 65, d: Math.random() * 10 });
            x += 8 + Math.random() * 20;
        }
    }

    private buildFlames(): void {
        this.flames = [];
        let x = 0;
        while (x < this.W) {
            this.flames.push({ x, w: 18 + Math.random() * 26, h: 30 + Math.random() * 60, d: Math.random() * 10 });
            x += 12 + Math.random() * 18;
        }
    }

    private buildCrystals(): void {
        this.crystals = [];
        const W = this.W;
        const top = this.top;
        const H = this.floor;
        const seeds = Math.round((W + (H - top)) / 22 / (this.opts.lowPower ? 2 : 1));
        for (let i = 0; i < seeds; i++) {
            const edge = i % 4;
            let x: number;
            let y: number;
            let ang: number;
            if (edge === 0) {
                x = Math.random() * W;
                y = top;
                ang = Math.PI / 2;
            } else if (edge === 1) {
                x = W;
                y = top + Math.random() * (H - top);
                ang = Math.PI;
            } else if (edge === 2) {
                x = Math.random() * W;
                y = H;
                ang = -Math.PI / 2;
            } else {
                x = 0;
                y = top + Math.random() * (H - top);
                ang = 0;
            }
            ang += (Math.random() - 0.5) * 0.9;
            const segs: Seg[] = [];
            this.grow(segs, x, y, ang, 40 + Math.random() * 75, 0, 0);
            this.crystals.push(segs);
        }
    }

    private grow(segs: Seg[], x: number, y: number, ang: number, len: number, depth: number, t0: number): void {
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        const t1 = t0 + len / 90;
        segs.push({ x1: x, y1: y, x2, y2, t0, t1, w: Math.max(0.6, 1.6 - depth * 0.4) });
        if (depth >= 3) return;
        const mx = x + (x2 - x) * 0.55;
        const my = y + (y2 - y) * 0.55;
        const tm = t0 + (t1 - t0) * 0.55;
        this.grow(segs, mx, my, ang + 0.6 + Math.random() * 0.3, len * 0.55, depth + 1, tm);
        this.grow(segs, mx, my, ang - 0.6 - Math.random() * 0.3, len * 0.55, depth + 1, tm);
        this.grow(segs, x2, y2, ang + (Math.random() - 0.5) * 0.4, len * 0.7, depth + 1, t1);
    }

    /**
     * Redraw the holes: every non-blank text node inside a data-climate-text area, padded
     * and feathered in two steps (a wide faint ring, then a solid core). Two plain fills
     * instead of a blur filter: Safari's canvas has no ctx.filter.
     */
    private rebuildMask(now: number): void {
        const m = this.maskCtx;
        if (!m || !this.mask) return;
        // Layout can move without a mutation (fonts, images): refresh at least twice a second.
        if (!this.maskDirty && now - this.lastMaskAt < 500) return;
        this.maskDirty = false;
        this.lastMaskAt = now;
        m.clearRect(0, 0, this.W, this.H);
        const hostRect = this.host.getBoundingClientRect();
        const rects: Rect[] = [];
        const range = document.createRange();
        this.host.querySelectorAll('[data-climate-text]').forEach((area) => {
            const box = this.visibleBox(area);
            if (!box) return;
            const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (node.nodeValue && node.nodeValue.trim()) {
                    range.selectNodeContents(node);
                    const list = range.getClientRects();
                    for (let i = 0; i < list.length; i++) {
                        const r = list[i];
                        if (r.width <= 0 || r.height <= 0) continue;
                        // Text scrolled out of its area is not visible; skip it.
                        if (r.bottom < box.top || r.top > box.bottom || r.right < box.left || r.left > box.right) continue;
                        rects.push({ x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height });
                    }
                }
                node = walker.nextNode();
            }
        });
        // Wide and faint outside, solid on the text: reads as a wiped patch, not a box.
        const steps: [number, number, number][] = [
            [16, 12, 0.18],
            [11, 8, 0.32],
            [7, 5, 0.55],
            [4, 3, 1],
        ];
        for (const [px, py, alpha] of steps) {
            m.fillStyle = `rgba(0,0,0,${alpha})`;
            for (const r of rects) m.fillRect(r.x - px, r.y - py, r.w + px * 2, r.h + py * 2);
        }
    }

    /**
     * The part of an area actually on screen: its box cut by every clipping ancestor up to
     * the host. A long results table scrolls inside its container, and rows scrolled out of
     * sight must not punch holes over whatever lies beneath it.
     */
    private visibleBox(area: Element): { top: number; bottom: number; left: number; right: number } | null {
        const r = area.getBoundingClientRect();
        let top = r.top;
        let bottom = r.bottom;
        let left = r.left;
        let right = r.right;
        let el = area.parentElement;
        while (el && el !== this.host) {
            const cs = getComputedStyle(el);
            if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
                const c = el.getBoundingClientRect();
                top = Math.max(top, c.top);
                bottom = Math.min(bottom, c.bottom);
                left = Math.max(left, c.left);
                right = Math.min(right, c.right);
            }
            el = el.parentElement;
        }
        if (bottom <= top || right <= left) return null;
        return { top, bottom, left, right };
    }

    private relRect(el: Element, hostRect: DOMRect): Rect {
        const r = el.getBoundingClientRect();
        return { x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height };
    }

    private edgeTint(rgb: string, alpha: number, band: number): void {
        const ctx = this.ctx!;
        const { W, top } = this;
        const H = this.floor;
        const stops: number[][] = [
            [0, 0, band, 0, 0, top, band, H - top],
            [W, 0, W - band, 0, W - band, top, band, H - top],
            [0, top, 0, top + band, 0, top, W, band],
            [0, H, 0, H - band, 0, H - band, W, band],
        ];
        for (const s of stops) {
            const g = ctx.createLinearGradient(s[0], s[1], s[2], s[3]);
            g.addColorStop(0, `rgba(${rgb},${alpha})`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(s[4], s[5], s[6], s[7]);
        }
    }

    private frame(now: number): void {
        this.raf = 0;
        if (!this.running || !this.ctx) return;

        // Paused while the tab is away or a solve is on screen (the overlay covers the room).
        if (document.hidden || document.querySelector('.room-timer-overlay')) {
            this.clear();
            this.schedule(IDLE_POLL_MS);
            return;
        }

        // ~30 fps on low power: draw every other frame.
        if (this.opts.lowPower) {
            this.frameSkip = !this.frameSkip;
            if (this.frameSkip) {
                this.schedule(0);
                return;
            }
        }

        this.remeasure(now);
        const dt = Math.min(0.05, (now - this.lastFrame) / 1000) * (this.opts.reducedMotion ? 0.35 : 1);
        this.lastFrame = now;
        this.tSec += dt;

        const inputs = this.getInputs();
        const T = inputs.temp;
        const cold = inputs.enabled ? coldIntensity(T) : 0;
        const hot = inputs.enabled ? hotIntensity(T) : 0;
        const flow = inputs.enabled && inputs.acOn;
        if (cold > 0.45) this.pile = Math.min(52 * cold, this.pile + dt * 3.5);
        else if (this.pile > 0) this.pile = Math.max(0, this.pile - dt * (hot > 0 ? 9 : 3));
        if (!inputs.enabled) this.pile = 0;

        const active = cold > 0 || hot > 0 || flow || this.pile > 0.5;
        if (!active) {
            this.clear();
            this.flakes.length = 0;
            this.embers.length = 0;
            this.schedule(IDLE_POLL_MS);
            return;
        }

        this.rebuildMask(now);
        this.draw(T, cold, hot, flow, inputs, dt);
        this.schedule(0);
    }

    private draw(T: number, cold: number, hot: number, flow: boolean, inputs: ClimateEffectInputs, dt: number): void {
        const ctx = this.ctx!;
        const { W, top } = this;
        // Everything stands on the floor (the top of the bottom stats strip).
        const H = this.floor;
        const scale = this.opts.lowPower ? 0.5 : 1;
        const t = this.tSec;

        ctx.clearRect(0, 0, W, this.H);
        this.drewLast = true;
        ctx.save();

        // Everything outside the protected areas, below the ceiling.
        const hostRect = this.host.getBoundingClientRect();
        ctx.beginPath();
        ctx.rect(0, top, W, this.H - top);
        // Each protected area is cut to the drawing area first: with the even-odd rule, a
        // hole lying outside the outer rectangle would turn into a drawable patch instead
        // (snow over the scramble, which sits above the ceiling).
        this.host.querySelectorAll('[data-climate-protect]').forEach((el) => {
            const r = this.relRect(el, hostRect);
            if (r.w <= 0 || r.h <= 0) return;
            const x1 = Math.max(0, r.x - 4);
            const y1 = Math.max(top, r.y - 4);
            const x2 = Math.min(W, r.x + r.w + 4);
            const y2 = Math.min(this.H, r.y + r.h + 4);
            if (x2 <= x1 || y2 <= y1) return;
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
        });
        ctx.clip('evenodd');
        const band = Math.min(W, H - top) * 0.42;

        // Air from the wall unit (or the chip on a phone).
        if (flow) {
            const src = this.host.querySelector('[data-climate-source]');
            const a = src ? this.relRect(src, hostRect) : { x: W - 120, y: 0, w: 80, h: top };
            const sx = a.x + a.w / 2;
            const sy = Math.max(top, a.y + a.h);
            const col = inputs.cooling ? '170,218,255' : '255,165,95';
            const strength = [0, 0.45, 0.72, 1][inputs.fan] ?? 0.72;
            const len = 200 + 300 * strength;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.setLineDash([16, 20]);
            ctx.lineDashOffset = -t * (50 + 90 * strength);
            for (let li = 0; li < 13; li++) {
                const sp = (li - 6) / 6;
                ctx.strokeStyle = `rgba(${col},${0.65 * strength * (1 - Math.abs(sp) * 0.45)})`;
                ctx.beginPath();
                ctx.moveTo(sx + sp * 34, sy + 2);
                ctx.quadraticCurveTo(sx + sp * 70, sy + len * 0.45, sx + sp * 170 - 70, sy + len);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        if (cold > 0) {
            this.edgeTint('159,211,255', 0.55 * cold, band);
            ctx.lineCap = 'round';
            const reach = cold * 3.6;
            ctx.strokeStyle = `rgba(230,244,255,${0.85 * cold})`;
            for (const segs of this.crystals) {
                for (const s of segs) {
                    if (s.t0 > reach) continue;
                    const k = Math.min(1, (reach - s.t0) / (s.t1 - s.t0));
                    ctx.lineWidth = s.w;
                    ctx.beginPath();
                    ctx.moveTo(s.x1, s.y1);
                    ctx.lineTo(s.x1 + (s.x2 - s.x1) * k, s.y1 + (s.y2 - s.y1) * k);
                    ctx.stroke();
                }
            }

            if (cold > 0.25) {
                const grown = (cold - 0.25) / 0.75;
                for (const ic of this.icicles) {
                    const l = ic.l * grown;
                    ctx.fillStyle = 'rgba(215,236,255,0.82)';
                    ctx.beginPath();
                    ctx.moveTo(ic.x, top);
                    ctx.lineTo(ic.x + ic.w, top);
                    ctx.lineTo(ic.x + ic.w * 0.5, top + l);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(ic.x + ic.w * 0.3, top + 1);
                    ctx.lineTo(ic.x + ic.w * 0.48, top + l * 0.7);
                    ctx.stroke();
                    if (grown > 0.5) {
                        const ph = (t * 0.6 + ic.d) % 3;
                        if (ph < 1) {
                            ctx.fillStyle = `rgba(200,230,255,${1 - ph})`;
                            ctx.beginPath();
                            ctx.arc(ic.x + ic.w * 0.5, top + l + ph * 40, 1.6, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }

            if (cold > 0.35) {
                const want = Math.round(240 * cold * scale);
                while (this.flakes.length < want) {
                    this.flakes.push({
                        x: Math.random() * W,
                        y: top - Math.random() * (H - top),
                        r: 1 + Math.random() * 2.6,
                        v: 25 + Math.random() * 55,
                        d: Math.random() * 6,
                    });
                }
                this.flakes.length = Math.min(this.flakes.length, want);
                ctx.fillStyle = `rgba(240,248,255,${0.8 * cold})`;
                for (const f of this.flakes) {
                    f.y += f.v * dt;
                    f.x += Math.sin(t + f.d) * 0.45;
                    if (f.y > H + 5) {
                        f.y = top - 5;
                        f.x = Math.random() * W;
                    }
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                this.flakes.length = 0;
            }
        } else {
            this.flakes.length = 0;
        }

        // Snow piling up along the bottom edge; it melts when the room warms.
        if (this.pile > 0.5) {
            ctx.fillStyle = 'rgba(240,248,255,0.92)';
            ctx.beginPath();
            ctx.moveTo(0, H);
            for (let px = 0; px <= W; px += 10) {
                ctx.lineTo(px, H - this.pile * (0.72 + 0.28 * Math.sin(px * 0.045) + 0.12 * Math.sin(px * 0.13)));
            }
            ctx.lineTo(W, H);
            ctx.closePath();
            ctx.fill();
        }

        if (hot > 0) {
            // Same judgement as the chip's "Oda yanıyor", so the flames start with the label.
            const fire = climateLevel(T) === 'fire';
            const pulse = fire ? 0.7 + 0.3 * Math.sin(t * 4) : 1;
            this.edgeTint(fire ? '226,51,67' : '255,138,61', 0.55 * hot * pulse, band);
            ctx.lineWidth = 1.8;
            const cols = this.opts.lowPower ? 8 : 16;
            for (let side = 0; side < 2; side++) {
                for (let i = 0; i < cols; i++) {
                    const x0 = side === 0 ? 8 + i * (band / cols) : W - 8 - i * (band / cols);
                    const fade = 1 - i / cols;
                    ctx.strokeStyle = `rgba(255,185,125,${0.45 * hot * fade})`;
                    ctx.beginPath();
                    for (let y = H; y > top + (H - top) * 0.08; y -= 6) {
                        const x = x0 + Math.sin(y * 0.045 + t * 3.6 + i) * (6 + 9 * hot);
                        if (y === H) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }

            // Flames licking up from the bottom edge once the room is on fire.
            if (fire) {
                for (const f of this.flames) {
                    const flick = 0.65 + 0.35 * Math.sin(t * 9 + f.d * 3) * Math.sin(t * 5.3 + f.d);
                    const h = f.h * hot * flick;
                    const sway = Math.sin(t * 3 + f.d) * f.w * 0.25;
                    const layers: [string, number][] = [
                        [`rgba(226,51,67,${0.55 * hot})`, 1],
                        [`rgba(255,138,61,${0.6 * hot})`, 0.7],
                        [`rgba(255,214,120,${0.55 * hot})`, 0.42],
                    ];
                    const cx = f.x + f.w / 2;
                    for (const [color, k] of layers) {
                        const w = f.w * k;
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.moveTo(cx - w / 2, H);
                        ctx.quadraticCurveTo(cx - w / 2, H - h * k * 0.55, cx + sway * k, H - h * k);
                        ctx.quadraticCurveTo(cx + w / 2, H - h * k * 0.55, cx + w / 2, H);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }

            if (hot > 0.45) {
                const wantE = Math.round(150 * hot * scale);
                const low = top + (H - top) * 0.1;
                while (this.embers.length < wantE) {
                    const ex = Math.random() < 0.5 ? Math.random() * band : W - Math.random() * band;
                    this.embers.push({
                        x: ex,
                        y: H + Math.random() * (H - top) * 0.5,
                        v: 35 + Math.random() * 70,
                        r: 0.8 + Math.random() * 1.8,
                        d: Math.random() * 6,
                        g: 120 + Math.random() * 110,
                    });
                }
                this.embers.length = Math.min(this.embers.length, wantE);
                for (const e of this.embers) {
                    e.y -= e.v * dt;
                    e.x += Math.sin(t * 2 + e.d) * 0.5;
                    if (e.y < low) e.y = H + 5;
                    const life = Math.max(0, Math.min(1, (e.y - low) / ((H - top) * 0.6)));
                    const flick = 0.6 + 0.4 * Math.sin(t * 12 + e.d * 5);
                    ctx.fillStyle = `rgba(255,${Math.round(e.g)},60,${life * flick})`;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                this.embers.length = 0;
            }
        } else {
            this.embers.length = 0;
        }

        ctx.restore();

        // Wipe the effects off every protected piece of text.
        if (this.mask) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(this.mask, 0, 0, W, this.H);
            ctx.restore();
        }
    }
}
