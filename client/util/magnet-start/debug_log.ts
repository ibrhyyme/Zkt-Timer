// Admin field-test log for magnet lift-to-start. Everything stays on the device; the
// admin exports it from the settings panel. Raw sample windows around each lift or
// rejected trigger are exported in the test-fixture format, so a field log can be dropped
// into __tests__/fixtures unchanged.
import type { DetectorConfig } from './config';
import type { MagnetCapabilities, MagnetPlatform, MagnetSample, Vec3 } from './types';

export interface MagnetLogEntry {
	t: number;
	kind: string;
	data?: Record<string, unknown>;
}

export interface PendingWindow {
	label: string;
	centerT: number;
	/** Window span around centerT, ms. Defaults to ±1.5 s. */
	beforeMs?: number;
	afterMs?: number;
	onset?: number;
	confirmedAt?: number;
	nearDelta?: number;
	far: Vec3 | null;
}

export interface CapturedWindow {
	v: 1;
	kind: 'magnet-fixture';
	platform: MagnetPlatform | null;
	source: string;
	note: string;
	far: Vec3 | null;
	labels: { lifts: { onsetRef: number; farAt: number; nearDelta: number; noiseMax: number }[] };
	d: number[];
}

const MAX_ENTRIES = 300;
const MAX_WINDOWS = 20;
const DEFAULT_HALF_MS = 1500;
// Longest window span requested (lift: 3 s before the onset, 1 s after) plus slack.
const RECENT_MS = 4500;
// localStorage is shared with the offline solve-queue backup; never let this log be the
// thing that fills the quota.
const STORAGE_KEY = 'zkt_magnet_debug';
const MAX_PERSIST_CHARS = 64 * 1024;
const PERSIST_THROTTLE_MS = 10_000;

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

class MagnetDebugLog {
	private entries: MagnetLogEntry[] | null = null;
	private windows: CapturedWindow[] = [];
	private pending: PendingWindow[] = [];
	private recent: MagnetSample[] = [];
	private platform: MagnetPlatform | null = null;
	private persistTimer: ReturnType<typeof setTimeout> | null = null;
	private listeners = new Set<() => void>();

	setPlatform(platform: MagnetPlatform | null): void {
		this.platform = platform;
	}

	record(kind: string, data?: Record<string, unknown>, t = Date.now()): void {
		const entries = this.load();
		entries.push(data ? { t, kind, data } : { t, kind });
		if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
		this.schedulePersist();
		this.notify();
	}

	/** Keeps the last few seconds of raw samples so windows can be cut around events. */
	addSamples(samples: MagnetSample[]): void {
		if (!samples.length) return;
		for (const s of samples) this.recent.push(s);
		const latest = samples[samples.length - 1].t;
		const cutoff = latest - RECENT_MS;
		let drop = 0;
		while (drop < this.recent.length && this.recent[drop].t < cutoff) drop++;
		if (drop) this.recent.splice(0, drop);
		this.resolvePending(latest);
	}

	/** Cuts a raw window around `centerT` once enough later samples have arrived. */
	captureAround(request: PendingWindow): void {
		this.pending.push(request);
		if (this.pending.length > MAX_WINDOWS) this.pending.shift();
	}

	/** Drops pending windows whose tail will never arrive (stream stopped). */
	flushPending(): void {
		const latest = this.recent.length ? this.recent[this.recent.length - 1].t : 0;
		this.resolvePending(latest, true);
		this.recent = [];
	}

	getEntries(): MagnetLogEntry[] {
		return this.load().slice();
	}

	getWindowCount(): number {
		return this.windows.length;
	}

	clear(): void {
		this.entries = [];
		this.windows = [];
		this.pending = [];
		if (typeof window !== 'undefined') {
			try {
				window.localStorage.removeItem(STORAGE_KEY);
			} catch (e) {
				// Nothing to clean up
			}
		}
		this.notify();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	buildExport(meta: {
		platform: MagnetPlatform | null;
		capabilities: MagnetCapabilities | null;
		config: DetectorConfig | null;
		far: Vec3 | null;
		device?: unknown;
		appVersion?: string;
	}) {
		return {
			v: 1,
			kind: 'magnet-debug-log',
			exportedAt: new Date().toISOString(),
			...meta,
			entries: this.getEntries(),
			windows: this.windows.slice(),
		};
	}

	async exportToFile(meta: Parameters<MagnetDebugLog['buildExport']>[0]): Promise<void> {
		// Imported lazily: save-file pulls in i18n and the toast layer.
		const [{ saveFile }, { getDeviceInfo }] = await Promise.all([
			import('../save-file'),
			import('../device-info'),
		]);
		let device: unknown;
		try {
			device = await getDeviceInfo();
		} catch (e) {
			device = undefined;
		}
		const appVersion = typeof window !== 'undefined' ? (window as any).__ASSET_VERSION__ || undefined : undefined;
		const doc = this.buildExport({ ...meta, device, appVersion });
		const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		await saveFile(JSON.stringify(doc), `zkt-magnet-log-${stamp}.json`, 'application/json');
	}

	private resolvePending(latest: number, force = false): void {
		if (!this.pending.length) return;
		const keep: PendingWindow[] = [];
		for (const p of this.pending) {
			if (!force && latest < p.centerT + (p.afterMs ?? DEFAULT_HALF_MS)) {
				keep.push(p);
				continue;
			}
			const captured = this.cut(p);
			if (captured) {
				this.windows.push(captured);
				if (this.windows.length > MAX_WINDOWS) this.windows.shift();
			}
		}
		this.pending = keep;
		this.notify();
	}

	private cut(p: PendingWindow): CapturedWindow | null {
		const from = p.centerT - (p.beforeMs ?? DEFAULT_HALF_MS);
		const to = p.centerT + (p.afterMs ?? DEFAULT_HALF_MS);
		const samples = this.recent.filter((s) => s.t >= from && s.t <= to);
		if (samples.length < 10) return null;

		const start = samples[0].t;
		const d: number[] = [];
		for (const s of samples) d.push(round1(s.t - start), round1(s.x), round1(s.y), round1(s.z));

		const lifts: CapturedWindow['labels']['lifts'] = [];
		if (p.onset !== undefined) {
			// Noise of the plateau the lift left, for comparison with the recorded fixtures.
			const plateau = samples.filter((s) => s.t >= p.onset - 300 && s.t <= p.onset - 50);
			let noiseMax = 0;
			if (plateau.length) {
				const m = [0, 0, 0];
				for (const s of plateau) {
					m[0] += s.x;
					m[1] += s.y;
					m[2] += s.z;
				}
				m[0] /= plateau.length;
				m[1] /= plateau.length;
				m[2] /= plateau.length;
				for (const s of plateau) {
					noiseMax = Math.max(noiseMax, Math.hypot(s.x - m[0], s.y - m[1], s.z - m[2]));
				}
			}
			lifts.push({
				onsetRef: round1(p.onset - start),
				farAt: round1((p.confirmedAt ?? p.onset) - start),
				nearDelta: round1(p.nearDelta ?? 0),
				noiseMax: round1(noiseMax),
			});
		}

		return {
			v: 1,
			kind: 'magnet-fixture',
			platform: this.platform,
			source: 'Zkt Timer admin field log',
			note: p.label,
			far: p.far ? [round1(p.far[0]), round1(p.far[1]), round1(p.far[2])] : null,
			labels: { lifts },
			d,
		};
	}

	private load(): MagnetLogEntry[] {
		if (this.entries) return this.entries;
		this.entries = [];
		if (typeof window === 'undefined') return this.entries;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			const parsed = raw ? JSON.parse(raw) : null;
			if (Array.isArray(parsed)) this.entries = parsed.slice(-MAX_ENTRIES);
		} catch (e) {
			// Corrupt or unavailable storage: start empty
		}
		return this.entries;
	}

	private schedulePersist(): void {
		if (typeof window === 'undefined' || this.persistTimer) return;
		this.persistTimer = setTimeout(() => {
			this.persistTimer = null;
			this.persist();
		}, PERSIST_THROTTLE_MS);
	}

	private persist(): void {
		const entries = this.load();
		try {
			let start = 0;
			let json = JSON.stringify(entries);
			while (json.length > MAX_PERSIST_CHARS && start < entries.length) {
				start += Math.max(1, Math.ceil((entries.length - start) / 4));
				json = JSON.stringify(entries.slice(start));
			}
			window.localStorage.setItem(STORAGE_KEY, json);
		} catch (e) {
			// Quota: the in-memory log is still exportable
		}
	}

	private notify(): void {
		this.listeners.forEach((listener) => listener());
	}
}

export const magnetDebugLog = new MagnetDebugLog();
