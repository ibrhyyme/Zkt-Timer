/**
 * case_snapshot: still pictures of 3D-only cases (F2L, ZBLS, L6E, 2x2 PBL...).
 *
 * A live 3D view per card does not scale: WebGL contexts are scarce (browsers allow about
 * sixteen), and a grid of 20 visible F2L cards would need 20. Instead each case is drawn once
 * offscreen and shown as an image:
 *  - 2x2 and 3x3 by our cube engine (cube_view/render/cube_pictures.ts), one context for every
 *    picture, the case and its stickering mask from case_cube.ts;
 *  - other puzzles (4x4, Pyraminx, Skewb, Square-1, whose 2D pattern is missing) by a
 *    short-lived cubing.js player, captured with experimentalScreenshot (the PDF export does
 *    the same); an algorithm the engine cannot read also goes this way.
 * A card asks inside the twisty_slots budget either way (CasePattern), so the work stays bounded.
 *
 * Pictures are kept per case and orientation: in memory for the session and in IndexedDB on the
 * device (WebP, at most MAX_STORED, oldest dropped first), so a case is drawn once per device. A
 * stored picture is read without a player or a slot. Bump SNAPSHOT_VERSION when the drawing
 * changes; older pictures are then ignored and pruned.
 */
import {getOrientationRotation, getPuzzleType, getStickering, isCubeShapePuzzle} from '../../../util/trainer/algorithm_engine';
import {getRemappedMask} from '../../../util/trainer/stickering_remap';
import {capLooksFromMask, caseTurns} from '../../../util/trainer/case_cube';
import {drawCubePicture} from '../../timer/smart_cube/cube_view/render/cube_pictures';
import type {CubeFace} from '../types';

// 2: 2x2 and 3x3 drawn by our engine (was cubing.js).
const SNAPSHOT_VERSION = 2;
/** Pixel size of a picture: sharp in the largest box that shows one (the selector card, 2x). */
const SNAPSHOT_SIZE = 240;
/** How long the player gets to draw its first frame before the capture (as the PDF export). */
const DRAW_WAIT_MS = 300;
const MAX_CACHED = 600;
const MAX_STORED = 3000;

const IDB_NAME = 'zkt-case-snapshots';
const IDB_STORE = 'pictures';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export interface SnapshotCase {
	category: string;
	algorithm: string;
	topFace: CubeFace;
	frontFace: CubeFace;
}

export function snapshotKey({category, algorithm, topFace, frontFace}: SnapshotCase): string {
	return `v${SNAPSHOT_VERSION}|${category}|${topFace}${frontFace}|${algorithm}`;
}

/** The picture when it is already in memory (no wait). */
export function getCaseSnapshot(key: string): string | null {
	return cache.get(key) ?? null;
}

function remember(key: string, url: string) {
	cache.delete(key);
	cache.set(key, url);
	while (cache.size > MAX_CACHED) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

// ---------------------------------------------------------------------------------------
// Device store (IndexedDB). Every failure means "not stored": the case is simply drawn.
// ---------------------------------------------------------------------------------------

type StoredPicture = {url: string; ts: number};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve) => {
		try {
			if (typeof indexedDB === 'undefined') return resolve(null);
			const req = indexedDB.open(IDB_NAME, 1);
			req.onupgradeneeded = () => {
				const store = req.result.createObjectStore(IDB_STORE);
				store.createIndex('ts', 'ts');
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
			req.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}

async function readStored(key: string): Promise<string | null> {
	const db = await openDb();
	if (!db) return null;
	return new Promise((resolve) => {
		try {
			const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
			req.onsuccess = () => resolve((req.result as StoredPicture | undefined)?.url ?? null);
			req.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

let writesSincePrune = 0;

async function writeStored(key: string, url: string): Promise<void> {
	const db = await openDb();
	if (!db) return;
	try {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		tx.objectStore(IDB_STORE).put({url, ts: Date.now()} as StoredPicture, key);
	} catch {
		return;
	}
	// Pruning walks the store, so it runs now and then, not on every write.
	if (++writesSincePrune >= 100) {
		writesSincePrune = 0;
		whenIdle(() => prune(db));
	}
}

/** Drops pictures of older drawing versions and the oldest ones beyond MAX_STORED. */
function prune(db: IDBDatabase) {
	try {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const store = tx.objectStore(IDB_STORE);
		const countReq = store.count();
		countReq.onsuccess = () => {
			let excess = countReq.result - MAX_STORED;
			const prefix = `v${SNAPSHOT_VERSION}|`;
			// Oldest first: stale versions go regardless, current ones only while over the cap.
			const cursorReq = store.index('ts').openCursor();
			cursorReq.onsuccess = () => {
				const cursor = cursorReq.result;
				if (!cursor) return;
				const stale = !String(cursor.primaryKey).startsWith(prefix);
				if (stale || excess > 0) {
					cursor.delete();
					excess--;
				}
				cursor.continue();
			};
		};
	} catch {
		// a full or blocked store keeps what it has
	}
}

function whenIdle(fn: () => void) {
	const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: {timeout: number}) => void) | undefined;
	if (ric) ric(fn, {timeout: 5000});
	else setTimeout(fn, 1000);
}

/** PNG capture to WebP: a few times smaller on the device. Falls back to the PNG. */
function toWebp(pngUrl: string): Promise<string> {
	return new Promise((resolve) => {
		try {
			const img = new Image();
			img.onload = () => {
				try {
					const canvas = document.createElement('canvas');
					canvas.width = img.naturalWidth || SNAPSHOT_SIZE;
					canvas.height = img.naturalHeight || SNAPSHOT_SIZE;
					const ctx = canvas.getContext('2d');
					if (!ctx) return resolve(pngUrl);
					ctx.drawImage(img, 0, 0);
					const webp = canvas.toDataURL('image/webp', 0.85);
					// Browsers without a WebP encoder return a PNG data URL here.
					resolve(webp.startsWith('data:image/webp') && webp.length < pngUrl.length ? webp : pngUrl);
				} catch {
					resolve(pngUrl);
				}
			};
			img.onerror = () => resolve(pngUrl);
			img.src = pngUrl;
		} catch {
			resolve(pngUrl);
		}
	});
}

// ---------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------

let host: HTMLDivElement | null = null;

function offscreenHost(): HTMLDivElement {
	if (!host || !host.isConnected) {
		host = document.createElement('div');
		host.setAttribute('aria-hidden', 'true');
		host.style.cssText = `position:fixed;left:-9999px;top:0;width:${SNAPSHOT_SIZE}px;height:${SNAPSHOT_SIZE}px;opacity:0;pointer-events:none`;
		document.body.appendChild(host);
	}
	return host;
}

async function draw(c: SnapshotCase): Promise<string | null> {
	const puzzleType = getPuzzleType(c.category);
	if (puzzleType === '3x3x3' || puzzleType === '2x2x2') {
		const rotation = getOrientationRotation(c.topFace, c.frontFace);
		const turns = caseTurns(c.algorithm, rotation);
		if (turns) {
			const stickering = puzzleType === '3x3x3' ? getStickering(c.category) : 'full';
			// Unrotated: case_cube reads it for the places the rotation puts pieces in.
			const mask = stickering !== 'full' ? await getRemappedMask(stickering, '') : null;
			return drawCubePicture({
				size: puzzleType === '2x2x2' ? 2 : 3,
				turns,
				looks: mask ? capLooksFromMask(mask, rotation) : null,
				pixels: SNAPSHOT_SIZE,
			});
		}
	}
	return drawWithCubing(c);
}

async function drawWithCubing(c: SnapshotCase): Promise<string | null> {
	const {TwistyPlayer} = await import('cubing/twisty');
	const puzzleType = getPuzzleType(c.category);
	const rotation = isCubeShapePuzzle(c.category) ? getOrientationRotation(c.topFace, c.frontFace) : '';
	const baseStickering = puzzleType === '3x3x3' ? getStickering(c.category) : 'full';
	const customMask = baseStickering !== 'full' ? await getRemappedMask(baseStickering, rotation) : null;

	const player = new TwistyPlayer({
		puzzle: puzzleType as any,
		visualization: '3D',
		alg: c.algorithm,
		experimentalSetupAnchor: 'end',
		controlPanel: 'none',
		hintFacelets: 'none',
		experimentalDragInput: 'none',
		background: 'none',
		...(rotation ? {experimentalSetupAlg: rotation} : {}),
		...(baseStickering !== 'full' ? {experimentalStickering: baseStickering as any} : {}),
	});
	player.style.width = `${SNAPSHOT_SIZE}px`;
	player.style.height = `${SNAPSHOT_SIZE}px`;

	const parent = offscreenHost();
	parent.appendChild(player);
	try {
		if (customMask) (player as any).experimentalStickeringMaskOrbits = customMask;
		await new Promise((r) => setTimeout(r, DRAW_WAIT_MS));
		const url: string = await (player as any).experimentalScreenshot({width: SNAPSHOT_SIZE, height: SNAPSHOT_SIZE});
		return url || null;
	} finally {
		// Removing the element gives its WebGL context back.
		player.remove();
	}
}

/** The picture kept on this device, without drawing. Null when there is none. */
export async function findStoredSnapshot(c: SnapshotCase): Promise<string | null> {
	const key = snapshotKey(c);
	const known = cache.get(key);
	if (known) return known;
	const stored = await readStored(key);
	if (stored) remember(key, stored);
	return stored;
}

/** The picture of a case, drawn on first call. Null when it could not be drawn. */
export function renderCaseSnapshot(c: SnapshotCase): Promise<string | null> {
	const key = snapshotKey(c);
	const known = cache.get(key);
	if (known) return Promise.resolve(known);
	let run = pending.get(key);
	if (!run) {
		run = draw(c)
			.catch(() => null)
			.then(async (png) => {
				pending.delete(key);
				if (!png) return null;
				const url = await toWebp(png);
				remember(key, url);
				writeStored(key, url);
				return url;
			});
		pending.set(key, run);
	}
	return run;
}
