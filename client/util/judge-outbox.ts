// The judge's outbox: every time typed on the entry card is written to the
// device first and sent second, so a dead hall Wi-Fi, a closed app or a crash
// never loses one.
//
// Separate from offline-queue.ts on purpose. That queue replays the member's
// own solves and may drop what the server refuses; here an entry is somebody
// else's official attempt, and the only thing allowed to remove it is the
// federation site naming that exact entry in its answer.
//
// Rules (plan §5 "Bağlantı kopunca"):
// - An entry leaves the outbox only when the answer carries its submissionId
//   with status 200. A captive portal's "200 OK" HTML page never matches.
// - 200 with a refusing outcome (REJECTED_*, LATE) also leaves, but as a notice:
//   the row is NOT shown as sent and the judge types it again (new id).
// - 403 / 404: kept and marked blocked, the judge is told. Never deleted here.
// - 422: kept aside as invalid so it cannot hold up the entries behind it.
// - 409, 429, 5xx, no answer: retried with jittered exponential backoff.
// - Entries belong to the account that typed them. After an account switch they
//   are neither sent for the new account nor deleted.
// - submissionId is made once per human entry; a retry reuses it, so the site
//   can answer a repeat with the first result.

import {JudgeEntryItem, JudgeEntryOutcome, JudgeEntryResult, outcomeLanded} from '../../shared/zkt_judge';

export type OutboxState = 'pending' | 'blocked' | 'invalid';

export interface OutboxItem extends JudgeEntryItem {
	/** Zkt-Timer account that typed the entry. */
	userId: string;
	/** `zkt-<slug>` */
	competitionId: string;
	createdAt: number;
	tries: number;
	state: OutboxState;
	/** The site's code for a blocked or invalid entry. */
	error?: string;
}

/** An entry the site processed but did not put on the card. */
export interface OutboxNotice {
	submissionId: string;
	cardId: string;
	kind: 'ATTEMPT' | 'NO_SHOW';
	attemptNo: number | null;
	value: number | null;
	outcome: JudgeEntryOutcome;
	at: number;
}

export type OutboxPause = 'auth' | null;

export interface OutboxSnapshot {
	items: OutboxItem[];
	notices: OutboxNotice[];
	/** Sending stopped until the member signs in again. */
	paused: OutboxPause;
	/** True while the last attempt did not get an answer (offline, server down). */
	offline: boolean;
}

export interface OutboxStorage {
	load(): Promise<OutboxItem[]>;
	save(items: OutboxItem[]): Promise<void>;
}

export type OutboxSendError = 'auth' | 'retry';

export interface OutboxDeps {
	storage: OutboxStorage;
	/** Sends the entries; resolves with the site's per-entry answers, rejects with an OutboxSendError. */
	send(items: JudgeEntryItem[]): Promise<JudgeEntryResult[]>;
	getUserId(): string | null;
	now?: () => number;
	random?: () => number;
	/** Called with every entry that left the outbox and the site's answer for it. */
	onResults?: (settled: {item: OutboxItem; result: JudgeEntryResult}[]) => void;
}

const MAX_PER_CALL = 50;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 60000;
const MAX_NOTICES = 30;

/** 2s, 4s, 8s ... capped at 60s, with half of it random so 40 phones do not retry in step. */
export function backoffDelayMs(failures: number, random: number): number {
	const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, Math.max(0, failures - 1)));
	return Math.round(ceiling * (0.5 + 0.5 * random));
}

/** What one answer does to the entry it names. Pure, so it is unit tested. */
export function settleItem(
	item: OutboxItem,
	result: JudgeEntryResult | undefined
): {keep: OutboxItem | null; notice: OutboxNotice | null; retry: boolean} {
	// No answer for this id: it was not processed as far as the phone can tell.
	if (!result || result.submissionId !== item.submissionId) {
		return {keep: {...item, tries: item.tries + 1}, notice: null, retry: true};
	}
	if (result.status === 200) {
		if (outcomeLanded(result.outcome)) return {keep: null, notice: null, retry: false};
		// Processed and refused. Without an outcome the answer is not one we
		// understand, so the entry stays.
		if (!result.outcome) return {keep: {...item, tries: item.tries + 1}, notice: null, retry: true};
		return {
			keep: null,
			notice: {
				submissionId: item.submissionId,
				cardId: item.cardId,
				kind: item.kind,
				attemptNo: item.attemptNo,
				value: item.value,
				outcome: result.outcome,
				at: Date.now(),
			},
			retry: false,
		};
	}
	if (result.status === 403 || result.status === 404) {
		return {keep: {...item, state: 'blocked', error: result.error || String(result.status)}, notice: null, retry: false};
	}
	if (result.status === 422) {
		return {keep: {...item, state: 'invalid', error: result.error || '422'}, notice: null, retry: false};
	}
	// 409 (switch off for a moment) and anything unexpected: try again later.
	return {keep: {...item, tries: item.tries + 1, error: result.error}, notice: null, retry: true};
}

export function createJudgeOutbox(deps: OutboxDeps) {
	const now = deps.now || (() => Date.now());
	const random = deps.random || Math.random;

	let items: OutboxItem[] = [];
	let notices: OutboxNotice[] = [];
	let paused: OutboxPause = null;
	let offline = false;
	let loaded: Promise<void> | null = null;
	let flushing = false;
	let flushAgain = false;
	let failures = 0;
	let nextAttemptAt = 0;
	let snapshot: OutboxSnapshot = {items, notices, paused, offline};
	const listeners = new Set<() => void>();

	function emit() {
		snapshot = {items, notices, paused, offline};
		listeners.forEach((listener) => {
			try {
				listener();
			} catch {
				// A broken listener must not stop the outbox.
			}
		});
	}

	function load(): Promise<void> {
		if (!loaded) {
			loaded = deps.storage
				.load()
				.then((stored) => {
					// Entries added before the device copy arrived win over it.
					const known = new Set(items.map((i) => i.submissionId));
					items = [...stored.filter((i) => !known.has(i.submissionId)), ...items];
					emit();
				})
				.catch(() => {});
		}
		return loaded;
	}

	async function persist(): Promise<void> {
		try {
			await deps.storage.save(items);
		} catch {
			// Nothing else to do: the entry is still in memory and will be sent.
		}
	}

	async function flush(force = false): Promise<void> {
		await load();
		if (flushing) {
			flushAgain = true;
			return;
		}
		const userId = deps.getUserId();
		if (!userId) return;
		if (!force && now() < nextAttemptAt) return;
		const due = items
			.filter((i) => i.userId === userId && i.state === 'pending')
			.sort((a, b) => a.deviceSeq - b.deviceSeq)
			.slice(0, MAX_PER_CALL);
		if (due.length === 0) return;

		flushing = true;
		let results: JudgeEntryResult[] | null = null;
		let sendError: OutboxSendError | null = null;
		try {
			results = await deps.send(
				due.map(({userId: _u, competitionId: _c, createdAt: _t, tries: _r, state: _s, error: _e, ...entry}) => entry)
			);
		} catch (error) {
			sendError = error === 'auth' ? 'auth' : 'retry';
		}
		flushing = false;

		if (!results) {
			if (sendError === 'auth') {
				paused = 'auth';
			} else {
				offline = true;
				failures += 1;
				nextAttemptAt = now() + backoffDelayMs(failures, random());
			}
			emit();
			return;
		}

		paused = null;
		offline = false;
		const byId = new Map(results.filter((r) => r && typeof r.submissionId === 'string').map((r) => [r.submissionId, r]));
		const settled: {item: OutboxItem; result: JudgeEntryResult}[] = [];
		let retry = false;
		const dueIds = new Set(due.map((d) => d.submissionId));
		const next: OutboxItem[] = [];
		for (const item of items) {
			if (!dueIds.has(item.submissionId)) {
				next.push(item);
				continue;
			}
			const result = byId.get(item.submissionId);
			const outcome = settleItem(item, result);
			if (outcome.keep) next.push(outcome.keep);
			if (outcome.notice) notices = [outcome.notice, ...notices].slice(0, MAX_NOTICES);
			if (!outcome.keep && result) settled.push({item, result});
			retry = retry || outcome.retry;
		}
		items = next;
		if (retry) {
			failures += 1;
			nextAttemptAt = now() + backoffDelayMs(failures, random());
		} else {
			failures = 0;
			nextAttemptAt = 0;
		}
		await persist();
		// Before the listeners hear the entry is gone: the screen takes the site's
		// card first, so a delivered row never reads as empty for a frame.
		if (settled.length > 0 && deps.onResults) {
			try {
				deps.onResults(settled);
			} catch {
				// see emit()
			}
		}
		emit();
		// More than one call's worth waiting, or entries added meanwhile.
		const more = items.some((i) => i.userId === userId && i.state === 'pending');
		if ((flushAgain || more) && !retry) {
			flushAgain = false;
			await flush(true);
		}
		flushAgain = false;
	}

	return {
		load,
		flush,

		/** Write the entry to the device, then try to send it. Resolves once it is stored. */
		async enqueue(entry: Omit<OutboxItem, 'createdAt' | 'tries' | 'state'>): Promise<void> {
			await load();
			items = [...items, {...entry, createdAt: now(), tries: 0, state: 'pending'}];
			// A new time for this attempt replaces an old refusal notice for it.
			notices = notices.filter((n) => !(n.cardId === entry.cardId && n.attemptNo === entry.attemptNo && n.kind === entry.kind));
			emit();
			await persist();
			void flush(true);
		},

		/** Blocked entries of a card become sendable again (the judge was approved for it once more). */
		async retryBlocked(cardId: string): Promise<void> {
			await load();
			if (!items.some((i) => i.cardId === cardId && i.state === 'blocked')) return;
			items = items.map((i) => (i.cardId === cardId && i.state === 'blocked' ? {...i, state: 'pending', error: undefined} : i));
			emit();
			await persist();
			void flush(true);
		},

		/** The judge read the problem and lets the entry go (blocked or invalid only). */
		async discard(submissionId: string): Promise<void> {
			await load();
			items = items.filter((i) => i.submissionId !== submissionId || i.state === 'pending');
			emit();
			await persist();
		},

		dismissNotice(submissionId: string): void {
			notices = notices.filter((n) => n.submissionId !== submissionId);
			emit();
		},

		/** Signed in again: sending may resume. */
		resume(): void {
			if (paused) {
				paused = null;
				emit();
			}
			void flush(true);
		},

		getSnapshot(): OutboxSnapshot {
			return snapshot;
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

export type JudgeOutbox = ReturnType<typeof createJudgeOutbox>;

// A device-side order for the site ("a later correction never lands before what
// it corrects"). Seconds since 2026 keep it inside a GraphQL Int and rising
// across restarts; the in-memory step keeps two entries of one second apart.
const SEQ_EPOCH_MS = Date.UTC(2026, 0, 1);
let lastSeq = 0;

export function nextDeviceSeq(nowMs = Date.now()): number {
	lastSeq = Math.max(lastSeq + 1, Math.floor((nowMs - SEQ_EPOCH_MS) / 1000));
	return lastSeq;
}
