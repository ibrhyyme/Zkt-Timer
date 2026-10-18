/**
 * twisty_slots: a small budget for live 3D players (cubing.js TwistyPlayer) in card grids
 * (trainer-sets 5.6).
 *
 * Categories without a 2D pattern file (F2L, ZBLS, L6E...) fall back to a 3D TwistyPlayer. A
 * picker step with 164 F2L cards that all open a WebGL player is too much for a phone, so at most
 * MAX_TWISTY_SLOTS players live at once: a card asks for a slot when it scrolls into view and
 * gives it back when it scrolls out (its player is removed). Cards that ask while the budget is
 * full wait in order and get a slot as soon as one frees.
 *
 * Pure and React free so the rule is testable in node.
 */

export const MAX_TWISTY_SLOTS = 8;

type Grant = () => void;

interface SlotPool {
	readonly max: number;
	request(id: number, grant: Grant): void;
	release(id: number): void;
	/** Holders and waiters, for tests. */
	snapshot(): {active: number[]; waiting: number[]};
}

export function createSlotPool(max: number = MAX_TWISTY_SLOTS): SlotPool {
	const active = new Set<number>();
	const waiting: {id: number; grant: Grant}[] = [];

	function drain() {
		while (active.size < max && waiting.length > 0) {
			const next = waiting.shift()!;
			active.add(next.id);
			next.grant();
		}
	}

	return {
		max,
		request(id, grant) {
			if (active.has(id) || waiting.some((w) => w.id === id)) return;
			if (active.size < max) {
				active.add(id);
				grant();
				return;
			}
			waiting.push({id, grant});
		},
		release(id) {
			const at = waiting.findIndex((w) => w.id === id);
			if (at >= 0) waiting.splice(at, 1);
			if (active.delete(id)) drain();
		},
		snapshot() {
			return {active: Array.from(active), waiting: waiting.map((w) => w.id)};
		},
	};
}

/** The app wide pool every CasePattern shares. */
export const twistySlots = createSlotPool();

let nextId = 1;

/** A unique id for one CasePattern instance. */
export function nextTwistySlotId(): number {
	return nextId++;
}
