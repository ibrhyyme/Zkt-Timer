import Connect from '../../timer/smart_cube/bluetooth/connect';
import { SmartSolveEngine, SmartEngineEvent, DEFAULT_SOLVED_STATE, isValidFacelets } from '../../../util/smart_cube';
import { SmartCubeDriverSink } from '../../../util/smart_cube/driver_sink';
import { SmartTurn } from '../../../util/smart_scramble';
import { setTimerParams } from '../../timer/helpers/params';

/**
 * One player's cube in battle.
 *
 * Battle is the only surface that needs two cubes on the line at once, and the app-wide
 * connection manager cannot give it that: it is a singleton by design, it mirrors the move
 * stream into Redux, and it owns reconnects, battery policy and the background release.
 * Those are the right answers for the timer page, where one cube belongs to one user for a
 * whole session. Here they are the wrong shape entirely: two cubes writing the same Redux
 * fields would overwrite each other, and the second link would have nowhere to live.
 *
 * So battle drives the layer below the manager. Each link owns its own Connect, its own
 * SmartSolveEngine and its own move stream, and it reports to itself rather than to the
 * app-wide sink (see bluetooth/smart_cube.js `_sink`). The manager is left untouched, still
 * holding whatever cube the timer page had, and nothing that exists today changes behaviour.
 *
 * What it deliberately does NOT do:
 * - No auto-reconnect. A battle is a few minutes at a table; a dropped cube shows a reconnect
 *   button rather than silently retrying under a running round.
 * - No Redux move mirror. Moves go straight into this link's engine.
 * - No smart device DB row. Nothing here is persisted, so there is no device to attribute.
 */

export type BattleCubeState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface BattleCubeStatus {
	state: BattleCubeState;
	deviceName: string | null;
	/**
	 * The BLE id of the cube on this link, so the other player's scan can exclude it.
	 *
	 * Without it both players can pick the same physical cube: the second driver then takes
	 * over the notification and the first one goes quiet while still looking connected.
	 */
	deviceId: string | null;
	/**
	 * Identity that survives across connections, unlike `deviceId`.
	 *
	 * On web every requestDevice call mints a fresh `web_N` id, so the SAME physical cube comes
	 * back with a different id on the second player's scan and an id-based exclusion list can
	 * never catch it. Chrome's own picker cannot be filtered either. This is the only value
	 * that identifies the cube itself, and it is known only once the handshake is done.
	 */
	persistentId: string | null;
	batteryLevel: number | null;
	/** Failure kind, named as the scanning picker's error states name them. */
	error: string | null;
	/**
	 * Whether the cube last reported itself solved. Null until it has reported anything.
	 *
	 * A cube connected while already scrambled cannot be tracked towards a scramble, and the
	 * engine can only say so indirectly, by giving up after enough unmatched turns. That read
	 * as "you turned too much" to a player who had turned nothing at all. Surfacing the cube's
	 * own answer lets the UI say the true thing the moment the cube connects.
	 */
	physicallySolved: boolean | null;
}

/**
 * A flat shape rather than a discriminated union on purpose: this project compiles with
 * strictNullChecks off, and without it TypeScript will not narrow `{ok:true} | {ok:false,...}`
 * by its discriminant, so every read of `reason` would be an error at the call site.
 */
export interface BattleConnectResult {
	ok: boolean;
	/** Why the cube did not come up. Absent when ok. */
	reason?: 'already_connected' | 'scan_busy' | 'failed';
}

export interface BattleCubeLinkOptions {
	/** Engine decisions for this player: scramble done, timer start, solve complete. */
	onEvent: (event: SmartEngineEvent) => void;
	/** Connection state for this player's UI. */
	onStatus: (status: BattleCubeStatus) => void;
	/**
	 * The move stream and the cube's last reported state, for a view that mirrors this cube.
	 *
	 * Fires per move rather than per frame. The 3D view needs both: the moves to animate, and
	 * the state to re-anchor to when a packet was dropped.
	 */
	onStream?: (turns: SmartTurn[], facelets: string | null) => void;
	solvedState?: string;
	/**
	 * Act on moves the cube reported out of order. Off unless the user turns it on, exactly as
	 * the timer page and rooms pass it: it ends a solve on inference rather than on a confirmed
	 * state, so a wrong call costs a real attempt.
	 */
	moveOrderFix?: boolean;
	/**
	 * Name for this link in the diagnostic trace, e.g. the cube slot.
	 *
	 * With two cubes live, "a turn arrived" is not a useful log line: the question is always
	 * WHICH link received it. Every trace line below is prefixed with this, so a stream landing
	 * on the wrong link is visible in the console instead of having to be inferred from
	 * behaviour. console.debug on purpose — production strips log/warn/info but keeps debug.
	 */
	label?: string;
}

/**
 * Whether a BLE scan is running anywhere in battle.
 *
 * The native adapter keeps ONE set of scan fields (the pending promise, the collected
 * devices, the selection resolver), so a second requestDevice while the first is still
 * open would overwrite the first one's state and strand its promise. Connecting the two
 * cubes one after the other is the whole fix; this flag is what enforces it, and it is
 * also why the picker's shared Redux fields below are safe to write.
 */
let scanInFlight = false;

/** The picker fields both links share. Only ever written while this link holds the scan. */
function clearPickerParams(): void {
	setTimerParams({
		smartCubeScanning: false,
		smartCubeConnecting: false,
		smartCubeScanError: null,
		smartCubeConnectStep: null,
		smartScanDevices: [],
	});
}

export class BattleCubeLink implements SmartCubeDriverSink {
	private readonly opts: BattleCubeLinkOptions;
	private readonly conn: any;
	private readonly engine: SmartSolveEngine;

	/**
	 * Every turn this cube has reported for the current round, oldest first.
	 *
	 * The engine takes the whole stream rather than the newest turn: it diffs against what
	 * it last saw and applies the difference one turn at a time, so an intermediate wrong
	 * state is never skipped over. A shorter array than last time means "start again", which
	 * is how a new round clears it.
	 */
	private turns: SmartTurn[] = [];

	private status: BattleCubeStatus = {
		state: 'idle',
		deviceName: null,
		deviceId: null,
		persistentId: null,
		batteryLevel: null,
		error: null,
		physicallySolved: null,
	};

	/** The cube's own last report of its state, republished with the stream. */
	private lastFacelets: string | null = null;

	/**
	 * Gyroscope readers (the 3D mirror) and this link's subscription to the driver.
	 *
	 * The driver publishes gyro locally, no command goes to the cube, so subscribing costs
	 * nothing but the listener call. The indirection exists because the driver only appears
	 * after the handshake, while the view asks for the stream as soon as it sees "connected".
	 */
	private gyroListeners = new Set<(event: any) => void>();
	private cubeGyroUnsub: (() => void) | null = null;

	private disposed = false;

	constructor(options: BattleCubeLinkOptions) {
		this.opts = options;
		this.conn = new Connect();
		// The line that makes two cubes possible: this Connect, and every driver it builds,
		// reports here instead of to the app-wide manager.
		this.conn._sink = this;

		this.engine = new SmartSolveEngine(
			(event) => {
				if (this.disposed) return;
				if (event.type !== 'SCRAMBLE_PROGRESS') this.trace('event', event.type);
				// A turn the engine has decided belongs to the scramble rather than the solve.
				// Dropping the stream is this layer's job, not the UI's: the engine needs the
				// tracker rebuilt from the scramble before the next turn arrives, and a React
				// component would only get there a render later.
				if (event.type === 'LATE_SCRAMBLE_MOVE') this.clearStream();
				this.opts.onEvent(event);
			},
			{
				solvedState: options.solvedState ?? DEFAULT_SOLVED_STATE,
				moveOrderFix: options.moveOrderFix === true,
			}
		);
	}

	/**
	 * Follow this cube's gyroscope. Returns an unsubscribe.
	 *
	 * Safe to call before the cube is up: the driver is picked up on connect, and readers that
	 * arrive first are attached then.
	 */
	subscribeGyro(listener: (event: any) => void): () => void {
		this.gyroListeners.add(listener);
		this.attachCubeGyro();
		return () => {
			this.gyroListeners.delete(listener);
			if (!this.gyroListeners.size) this.detachCubeGyro();
		};
	}

	private attachCubeGyro(): void {
		if (this.cubeGyroUnsub || !this.gyroListeners.size) return;
		const cube = this.conn?.activeCube;
		if (typeof cube?.subscribeGyro !== 'function') return;
		this.cubeGyroUnsub = cube.subscribeGyro((event: any) => {
			this.gyroListeners.forEach((listener) => listener(event));
		});
	}

	private detachCubeGyro(): void {
		if (!this.cubeGyroUnsub) return;
		try {
			this.cubeGyroUnsub();
		} catch (e) {
			// Cube already gone; nothing to release.
		}
		this.cubeGyroUnsub = null;
	}

	/** Keep the setting live without rebuilding the engine, as the timer page does. */
	setMoveOrderFix(enabled: boolean): void {
		if (this.disposed) return;
		this.engine.setMoveOrderFix(enabled);
	}

	/** See `label`. Prefixed so two live cubes can be told apart in one console. */
	private trace(...args: any[]): void {
		console.debug(`[battle-cube ${this.opts.label || '?'}]`, ...args);
	}

	getStatus(): BattleCubeStatus {
		return this.status;
	}

	get connected(): boolean {
		return this.status.state === 'connected';
	}

	/** True while this link is between "picker opened" and "cube answered". */
	get busy(): boolean {
		return this.status.state === 'scanning' || this.status.state === 'connecting';
	}

	/**
	 * Open the picker and connect this player's cube.
	 *
	 * Failures inside the flow report themselves through the sink callbacks (which is what
	 * drives the picker's error state); the result only names the cases the caller has to
	 * explain to the user.
	 */
	async connect(excludeDeviceIds: string[] = []): Promise<BattleConnectResult> {
		if (this.disposed) return { ok: false, reason: 'failed' };
		if (this.connected) return { ok: false, reason: 'already_connected' };
		if (scanInFlight) return { ok: false, reason: 'scan_busy' };

		scanInFlight = true;
		try {
			// 'battle' is the surface tag for the telemetry study; the exclusion list keeps this
			// player off a cube another link already holds.
			await this.conn.connect(false, 'battle', excludeDeviceIds);
		} catch (e) {
			// connect() reports its own failures through alertScanError; this is a safety net.
			console.error('[battle-cube] connect failed:', e);
		} finally {
			scanInFlight = false;
		}

		return this.connected ? { ok: true } : { ok: false, reason: 'failed' };
	}

	cancelScan(): void {
		this.conn?.cancelScan?.();
		if (this.busy) {
			this.setStatus({ state: 'idle', error: null });
		}
		clearPickerParams();
	}

	async disconnect(): Promise<void> {
		try {
			await this.conn.disconnect();
		} catch (e) {
			console.warn('[battle-cube] disconnect failed:', e);
		}
		// handleLinkLost may already have run from the driver's own teardown; it is idempotent.
		this.handleLinkLost();
	}

	/**
	 * Point this cube at the round's scramble and start its stream over.
	 *
	 * Order matters: the engine rebuilds its per-prefix state table from the new scramble,
	 * and clearing the stream afterwards re-anchors the tracker against that table. Clearing
	 * first would anchor it to the scramble that just ended.
	 */
	setScramble(scramble: string): void {
		if (this.disposed) return;
		this.trace('setScramble', scramble);
		this.engine.setScramble(scramble || '');
		this.clearStream();
	}

	/**
	 * Drop the recorded stream without touching the scramble.
	 *
	 * The engine asks for this when a turn it just received belongs to the scramble rather
	 * than the solve, so it can rebuild its tracker from the scramble instead of from moves
	 * it should never have counted.
	 */
	clearStream(): void {
		if (!this.turns.length) return;
		this.turns = [];
		this.engine.pushTurns(this.turns);
		this.publishStream();
	}

	/** Give up on the round in progress (round deleted, sides switched, battle reset). */
	abortRound(): void {
		if (this.disposed) return;
		this.engine.abort();
		this.clearStream();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.engine.dispose();
		void this.disconnect();
	}

	// Called by the cube drivers (see bluetooth/smart_cube.js)

	handleScanning(): void {
		this.setStatus({ state: 'scanning', error: null });
		setTimerParams({
			smartCubeScanning: true,
			smartCubeConnecting: false,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
		});
	}

	handleConnecting(): void {
		this.setStatus({ state: 'connecting', error: null });
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: true,
			smartCubeScanError: null,
			smartScanDevices: [],
		});
	}

	handleScanError(message: string): void {
		this.setStatus({ state: 'error', error: message || 'notfound' });
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: message,
			smartCubeConnectStep: null,
		});
	}

	async handleConnected(cube: any, server: any): Promise<void> {
		if (this.disposed) {
			// The player left the page mid-handshake. Finishing it would leave a live cube
			// nobody owns, so close it here.
			try {
				await cube?.disconnect?.();
			} catch (e) {
				// Already closed.
			}
			return;
		}

		const deviceName = server?.device?.name || this.conn?.device?.name || null;
		// The BLE handle, not the database row id: this is what the other player's scan excludes.
		const deviceId = this.conn?.device?.deviceId || null;
		const persistentId = this.conn?.device?.persistentId || null;
		this.trace('connected', deviceName, '| deviceId:', deviceId, '| persistentId:', persistentId);
		this.setStatus({ state: 'connected', deviceName, deviceId, persistentId, error: null });
		// The handshake is done, so the shared picker fields go back to neutral. 'done' is
		// what tells the picker to show its final step before it closes.
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: null,
			smartCubeConnectStep: 'done',
			smartScanDevices: [],
		});

		// Reconnecting on the same link reuses the same engine, so the stream from the cube
		// that just left has to go before the new one speaks. Clearing only the local array
		// would leave the engine holding turns it would then try to diff against.
		// Clear only if there IS something to clear, and never the last reported state.
		//
		// The driver does not await this callback: a cube can deliver its first FACELETS packet
		// while the handshake chain is still running, i.e. just BEFORE this line. Wiping
		// unconditionally threw away the very seed the engine needs to place the cube, and the
		// engine cannot ask for another one — it only re-anchors on what the cube sends.
		if (this.turns.length) {
			this.turns = [];
			this.engine.pushTurns(this.turns);
		}
		this.engine.setConnected(true);
		// Readers that subscribed before the handshake finished get hooked up now.
		this.attachCubeGyro();
		this.publishStream();
	}

	handleLinkLost(): void {
		if (this.status.state === 'idle') return;
		this.turns = [];
		this.lastFacelets = null;
		this.detachCubeGyro();
		this.publishStream();
		this.engine.setConnected(false);
		this.setStatus({ state: 'idle', deviceName: null, deviceId: null, persistentId: null, batteryLevel: null, error: null, physicallySolved: null });
	}

	handleBattery(level: number): void {
		if (typeof level !== 'number') return;
		this.setStatus({ batteryLevel: level });
	}

	handleGyroSupported(_supported: boolean): void {
		// Battle draws no 3D cube, so the gyroscope has no consumer here.
	}

	handleMove(move: string): void {
		if (this.disposed) return;
		const turn = {
			turn: (move || '').replace(/\s/g, ''),
			completedAt: Date.now(),
			cubeTimestamp: null,
			localTimestamp: null,
		} as unknown as SmartTurn;

		this.turns = [...this.turns, turn];
		this.engine.pushTurns(this.turns);
		this.publishStream();
	}

	handleMoveBatch(moves: any[], facelets: string | null = null): void {
		if (this.disposed) return;
		if (!moves || moves.length === 0) return;

		const formatted: SmartTurn[] = moves.map((m) => ({
			turn: (m.move || m.turn || '').replace(/\s/g, ''),
			completedAt: m.timestamp || m.completedAt || Date.now(),
			cubeTimestamp: m.cubeTimestamp ?? null,
			localTimestamp: m.localTimestamp ?? null,
			// Pulled back from the cube's move history after a dropped packet, so its
			// timestamp is the moment of recovery, not the moment of the turn.
			recovered: m.recovered === true,
		})) as SmartTurn[];

		this.turns = [...this.turns, ...formatted];
		this.trace('moves', formatted.map((m) => m.turn).join(' '), '| toplam:', this.turns.length, '| facelets:', facelets ? facelets.slice(0, 12) : 'yok');
		if (facelets && isValidFacelets(facelets)) {
			this.noteSolvedState(facelets === (this.opts.solvedState ?? DEFAULT_SOLVED_STATE));
		}
		this.engine.pushTurns(this.turns);

		// After the turns, never before: the state a batch produced must not reach the engine
		// ahead of the moves that produced it, or the last scramble move reads as the first
		// solve move.
		if (facelets && isValidFacelets(facelets)) {
			this.lastFacelets = facelets;
			this.engine.pushFacelets(facelets);
		}
		this.publishStream();
	}

	handleFacelets(facelets: string): void {
		if (this.disposed) return;
		if (!isValidFacelets(facelets)) return;
		const solved = facelets === (this.opts.solvedState ?? DEFAULT_SOLVED_STATE);
		this.trace('facelets', facelets.slice(0, 12), solved ? '(cozulmus)' : '(karisik)');
		this.lastFacelets = facelets;
		this.noteSolvedState(solved);
		this.engine.pushFacelets(facelets);
		this.publishStream();
	}

	/**
	 * Tell the cube to treat its current physical position as solved.
	 *
	 * The cube keeps its own state in firmware. Turn it while it is asleep or disconnected and
	 * the two drift apart: the cube keeps insisting it is scrambled while it sits physically
	 * solved in front of you, and nothing app-side can talk it out of that. This is the only
	 * way back, which is why it is offered right where the mismatch is reported.
	 */
	async markSolved(): Promise<boolean> {
		const cube = this.conn?.activeCube;
		if (!cube?.resetCubeState) return false;

		// Web Bluetooth serialises GATT operations per device, so this write fails outright if
		// it lands while the driver is busy asking the cube for moves it missed ("GATT operation
		// already in progress"). That recovery is short, so backing off and trying again is
		// enough; the alternative is a button that silently does nothing at the exact moment
		// the player needs it.
		const ATTEMPTS = 3;
		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			try {
				const ok = await cube.resetCubeState();
				this.trace('markSolved ->', ok, '| deneme:', attempt);
				// The cube reports its new state on its own; this only moves the UI immediately
				// rather than waiting for the next packet.
				if (ok) this.noteSolvedState(true);
				return ok;
			} catch (e) {
				const message = String((e as any)?.message || e);
				const busy = message.includes('already in progress');
				this.trace('markSolved hata | deneme:', attempt, '|', message);
				if (!busy || attempt === ATTEMPTS) {
					console.warn('[battle-cube] resetCubeState failed:', e);
					return false;
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}
		return false;
	}

	private noteSolvedState(solved: boolean): void {
		if (this.status.physicallySolved === solved) return;
		this.setStatus({ physicallySolved: solved });
	}

	// Internals

	private setStatus(patch: Partial<BattleCubeStatus>): void {
		this.status = { ...this.status, ...patch };
		if (!this.disposed) this.opts.onStatus(this.status);
	}

	/** Hand the current stream to whatever is drawing this cube. */
	private publishStream(): void {
		if (this.disposed) return;
		this.opts.onStream?.(this.turns, this.lastFacelets);
	}
}
