// Klima Kavgası "drama": when a round closes in a freezing or hot room, copies of that
// round's times melt (hot) or freeze, crack and fall (cold) off the screen, and the name of
// the round's slowest finisher faints in the heat or slips on the ice and drops.
//
// Only copies move. Each ghost is a fresh element laid exactly over the real time or name,
// so the real value is never moved, hidden or changed and reads normally as the ghost
// falls away. The owner's rule (2026-11-07): "bunlar sadece efekt".

import { FriendlyRoomParticipantData } from '../../../../shared/friendly_room';

export type DramaMood = 'cold' | 'hot';

export interface RoundDrama {
    // Users with a result in the closed round, in table order.
    finishers: string[];
    // The slowest of them (a DNF counts as slowest), or null with fewer than two finishers.
    worst: string | null;
}

export function pickRoundDrama(participants: FriendlyRoomParticipantData[], roundIndex: number): RoundDrama {
    const results: { id: string; t: number }[] = [];
    for (const p of participants) {
        if (p.is_spectator) continue;
        const s = p.solves.find((x) => x.scramble_index === roundIndex);
        if (!s) continue;
        results.push({ id: p.user_id, t: s.dnf ? Infinity : s.time + (s.plus_two ? 2 : 0) });
    }
    if (results.length < 2) return { finishers: results.map((r) => r.id), worst: null };
    let worst = results[0];
    for (const r of results) if (r.t >= worst.t) worst = r;
    return { finishers: results.map((r) => r.id), worst: worst.id };
}

const GHOST_CLASS = 'zt-room-climate-drama__ghost';
// Removal fallback if animationend never fires (tab hidden mid-animation).
const GHOST_MAX_LIFE_MS = 9000;

type GhostKind = 'melt' | 'shatter' | 'faint' | 'slip';

function cssEscape(value: string): string {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

function spawnGhost(layer: HTMLElement, source: Element, kind: GhostKind, delayMs: number): void {
    const rect = source.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return;
    const text = source.textContent?.trim();
    if (!text) return;

    const cs = getComputedStyle(source);
    const ghost = document.createElement('div');
    ghost.className = `${GHOST_CLASS} ${GHOST_CLASS}--${kind}`;
    ghost.textContent = text;
    ghost.setAttribute('aria-hidden', 'true');
    const style = ghost.style;
    style.left = `${rect.left}px`;
    style.top = `${rect.top}px`;
    style.minWidth = `${rect.width}px`;
    style.height = `${rect.height}px`;
    style.fontFamily = cs.fontFamily;
    style.fontSize = cs.fontSize;
    style.fontWeight = cs.fontWeight;
    style.letterSpacing = cs.letterSpacing;
    // The name row is upper-cased by CSS on its parent; the copy has to say it itself.
    style.textTransform = getComputedStyle(source.parentElement ?? source).textTransform;
    style.color = cs.color;
    style.animationDelay = `${delayMs}ms`;
    // Far enough to leave the screen from wherever it starts.
    style.setProperty('--zt-drama-fall', `${Math.round(window.innerHeight - rect.top + 80)}px`);
    style.setProperty('--zt-drama-drift', `${Math.round((Math.random() - 0.5) * 120)}px`);
    style.setProperty('--zt-drama-spin', `${Math.round((Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40))}deg`);

    if (kind === 'melt' || kind === 'faint') {
        // Drips running off the bottom of a melting time, sweat off a fainting name.
        const spots = kind === 'melt' ? [8, 28, 50, 70, 90] : [22, 50, 78];
        spots.forEach((leftPct, i) => {
            const drip = document.createElement('span');
            drip.className = `${GHOST_CLASS}-drip`;
            drip.style.left = `${leftPct}%`;
            drip.style.animationDelay = `${delayMs + 250 + i * 160}ms`;
            ghost.appendChild(drip);
        });
    }

    const remove = () => ghost.remove();
    ghost.addEventListener('animationend', (e) => {
        if (e.target === ghost) remove();
    });
    setTimeout(remove, GHOST_MAX_LIFE_MS + delayMs);
    layer.appendChild(ghost);
}

/** Play the drama for a closed round. Does nothing for a comfortable room. */
export function playRoundDrama(layer: HTMLElement, participants: FriendlyRoomParticipantData[], roundIndex: number, mood: DramaMood): void {
    const { finishers, worst } = pickRoundDrama(participants, roundIndex);
    finishers.forEach((userId, i) => {
        const cell = document.querySelector(`[data-climate-cell="${cssEscape(`${userId}:${roundIndex}`)}"]`);
        if (cell) spawnGhost(layer, cell, mood === 'hot' ? 'melt' : 'shatter', i * 110);
    });
    if (worst) {
        const name = document.querySelector(`[data-climate-name="${cssEscape(worst)}"]`);
        if (name) spawnGhost(layer, name, mood === 'hot' ? 'faint' : 'slip', 650 + finishers.length * 110);
    }
}
