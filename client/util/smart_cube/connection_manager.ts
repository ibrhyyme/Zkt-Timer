import Connect from '../../components/timer/smart_cube/bluetooth/connect';
import { setSmartCubeParams, setTimerParams } from '../../components/timer/helpers/params';
import { getStore } from '../../components/store';
import { closeModal } from '../../actions/general';
import { smartCubeFaceletsAction, turnSmartCube, turnSmartCubeBatch } from '../../actions/timer';
import { setTelemetryBattery } from './telemetry';
import type { TelemetrySurface } from './telemetry';
import { CubeTracker } from './tracker';
import { DEFAULT_SOLVED_STATE, isValidFacelets } from './facelets';
import { isAppVisible, onVisibilityChange } from '../app-visibility';
import { addEventListener as addClientEventListener } from '../event_handler';
import { setSmartCubeDriverSink, SmartCubeDriverSink } from './driver_sink';
import { toastError } from '../toast';
import i18n from '../../i18n/i18n';
import type { SmartTurn } from '../smart_scramble';

/**
 * App-level owner of the smart cube Bluetooth link.
 *
 * Before this existed each page built its own `Connect`, wired the cube's callbacks to
 * itself and tore the link down on unmount. Opening settings from the timer therefore
 * disconnected the cube, and the three surfaces (timer, friendly rooms, trainer) each
 * carried their own slightly different copy of the lifecycle.
 *
 * The rule now: a page ATTACHES and SUBSCRIBES, it never connects or disconnects on
 * mount/unmount. Only a deliberate user action disconnects: the Disconnect menu items,
 * the rooms session takeover, and switching the timer type away from smart.
 *
 * Module-scoped singleton, created lazily, exactly like getBleAdapter(): nothing here may
 * touch a browser API at import time, because server/router.tsx pulls the pages that use
 * it into the SSR bundle.
 */

export interface SmartCubeSnapshot {
	connected: boolean;
	connecting: boolean;
	scanning: boolean;
	/** Last scan/handshake failure: permission / disabled / notfound / timeout / wrong_mac. */
	scanError: string | null;
	/** True while an unexpected drop is being retried against the same device. */
	reconnecting: boolean;
	/** SmartDevice row id, written onto saved solves. Falls back to the BLE id offline. */
	deviceId: string;
	/** Advertised cube name, for "already connected as X" messages. */
	deviceName: string | null;
	/** 54-char facelets: the cube's own last report, advanced by any moves since. */
	facelets: string;
	/** The state counted as solved. Constant today, kept as data because the engine takes it. */
	solvedState: string;
	physicallySolved: boolean;
	batteryLevel: number | null;
	gyroSupported: boolean;
}

export interface SmartCubeMoveBatch {
	moves: SmartTurn[];
	/** Cube state after these moves, when the driver tracks it. */
	facelets: string | null;
}

export interface SmartCubeConnectResult {
	ok: boolean;
	/**
	 * Why it did not connect. 'already_connected' is the one a caller has to explain to the
	 * user; 'failed' has already reached Redux through alertScanError and the scan UI.
	 */
	reason?: 'already_connected' | 'failed';
	/** Name of the cube currently holding the link, for that message. */
	deviceName?: string | null;
}

export interface SmartCubeAttachOptions {
	/**
	 * Mirror the move stream into `timer.smartTurns`.
	 *
	 * The timer and friendly rooms read the stream from there. The trainer processes moves
	 * itself and never reads that array, so mirroring for it would only grow a list nobody
	 * empties, every dispatch copying a longer array than the last.
	 */
	turnStream?: boolean;
}

type Unsubscribe = () => void;
type Listener<T> = (value: T) => void;

/** Retry schedule after an unexpected drop. Capped, so a cube left off does not poll forever. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 20000, 20000, 20000];

/** Battery poll period while a page is showing the cube, and while none is. */
const BATTERY_POLL_ACTIVE_MS = 10000;
const BATTERY_POLL_IDLE_MS = 60000;

/**
 * How long a connected cube may sit in a hidden tab or a backgrounded app before it is
 * released. Long enough for a quick look at a message; short enough that a phone locked
 * with the app open does not drain the cube and the phone for hours.
 */
const BACKGROUND_RELEASE_MS = 5 * 60 * 1000;

function emit<T>(listeners: Set<Listener<T>>, value: T): void {
	// Copied first: a listener that unsubscribes itself inside the callback would otherwise
	// mutate the set being iterated.
	for (const listener of [...listeners]) {
		try {
			listener(value);
		} catch (e) {
			console.warn('[smart-cube] listener threw:', e);
		}
	}
}

class SmartCubeConnectionManager implements SmartCubeDriverSink {
	private conn: any = null;
	private activeCubeRef: any = null;
	/** The BLE device handle, kept so a reconnect skips the picker entirely. */
	private retainedDevice: any = null;

	private connected = false;
	private connecting = false;
	private scanning = false;
	private scanError: string | null = null;
	private reconnecting = false;
	private deviceId = '';
	private deviceName: string | null = null;
	private batteryLevel: number | null = null;
	private gyroSupported = false;
	/** Whether this cube has actually delivered a gyro reading; see noteGyroSeen. */
	private gyroSeen = false;
	private solvedState = DEFAULT_SOLVED_STATE;

	/**
	 * The lightweight state tracker. It runs whether or not a page is listening, so a page
	 * that attaches later starts from the cube's real state instead of waiting for the next
	 * heartbeat (and, on drivers that only report state on request, possibly forever).
	 */
	private tracker = new CubeTracker();

	/**
	 * Whether the last facelets the cube itself REPORTED were the solved state. Kept apart
	 * from the tracker on purpose: the post-solve silence guard below has always keyed off the
	 * cube's own report, never a state derived from moves, and that is preserved exactly.
	 */
	private reportedSolved = false;

	/** Set by disconnect(), cleared when a connect starts. Blocks auto-reconnect. */
	private intentional = false;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	/** True while a picker-free handshake is running, so a drop inside it is not scheduled twice. */
	private reconnectInFlight = false;

	private attachments = new Set<SmartCubeAttachOptions>();
	private moveListeners = new Set<Listener<SmartCubeMoveBatch>>();
	private faceletsListeners = new Set<Listener<string>>();
	private batteryListeners = new Set<Listener<number>>();
	private gyroListeners = new Set<Listener<any>>();
	private connectionListeners = new Set<Listener<SmartCubeSnapshot>>();

	private cubeGyroUnsub: Unsubscribe | null = null;
	private visibilityUnsub: Unsubscribe | null = null;
	private settingsWatchInstalled = false;
	/** The slow battery poll used while no page is attached. The cube's own 10s poll is paused then. */
	private idleBatteryTimer: ReturnType<typeof setInterval> | null = null;
	/** Running while the app is hidden with a cube connected; see BACKGROUND_RELEASE_MS. */
	private backgroundReleaseTimer: ReturnType<typeof setTimeout> | null = null;

	// ── Public API ───────────────────────────────────────────────────────────────

	getSnapshot(): SmartCubeSnapshot {
		return {
			connected: this.connected,
			connecting: this.connecting,
			scanning: this.scanning,
			scanError: this.scanError,
			reconnecting: this.reconnecting,
			deviceId: this.deviceId,
			deviceName: this.deviceName,
			facelets: this.tracker.state,
			solvedState: this.solvedState,
			physicallySolved: this.tracker.isSolved(this.solvedState),
			batteryLevel: this.batteryLevel,
			gyroSupported: this.gyroSupported,
		};
	}

	get activeCube(): any {
		return this.activeCubeRef;
	}

	/** True while at least one page is actively using the cube. */
	get attached(): boolean {
		return this.attachments.size > 0;
	}

	/**
	 * Register a page as an active user of the cube.
	 *
	 * Attaching never connects and detaching never disconnects; it only says whether
	 * anything on screen depends on the cube right now, which decides how hard the manager
	 * works (battery poll rate, gyro processing, the Redux turn mirror).
	 */
	attach(options: SmartCubeAttachOptions = {}): Unsubscribe {
		const token: SmartCubeAttachOptions = { turnStream: options.turnStream !== false };
		this.attachments.add(token);

		if (token.turnStream) {
			// A fresh attacher starts from the cube's current state, not from a stream left
			// over from the page that had it last. Its engine re-seeds from the facelets below.
			setTimerParams({ smartTurns: [] });
			// Only with a cube on the line: publishing the tracker's idle state with nothing
			// connected would tell the page's engine a cube had reported itself solved.
			if (this.connected) this.publishFacelets(true);
		}
		this.applyPowerState();

		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.attachments.delete(token);
			this.applyPowerState();
		};
	}

	subscribeMoves(listener: Listener<SmartCubeMoveBatch>): Unsubscribe {
		this.moveListeners.add(listener);
		return () => { this.moveListeners.delete(listener); };
	}

	subscribeFacelets(listener: Listener<string>): Unsubscribe {
		this.faceletsListeners.add(listener);
		return () => { this.faceletsListeners.delete(listener); };
	}

	subscribeBattery(listener: Listener<number>): Unsubscribe {
		this.batteryListeners.add(listener);
		return () => { this.batteryListeners.delete(listener); };
	}

	subscribeGyro(listener: Listener<any>): Unsubscribe {
		this.gyroListeners.add(listener);
		this.applyPowerState();
		return () => {
			this.gyroListeners.delete(listener);
			this.applyPowerState();
		};
	}

	subscribeConnection(listener: Listener<SmartCubeSnapshot>): Unsubscribe {
		this.connectionListeners.add(listener);
		return () => { this.connectionListeners.delete(listener); };
	}

	/**
	 * Open the device picker and connect.
	 *
	 * Refuses while another cube is on the link rather than silently reusing it or failing
	 * with a scan error: the user picked a second cube on purpose and has to be told which
	 * one is holding the connection.
	 */
	async connect(acceptAll = false, surface: TelemetrySurface = 'timer'): Promise<SmartCubeConnectResult> {
		if (this.connected) {
			return { ok: false, reason: 'already_connected', deviceName: this.deviceName };
		}

		this.cancelReconnect();
		this.intentional = false;

		const conn = this.ensureConnect();
		try {
			await conn.connect(acceptAll, surface);
		} catch (e) {
			// connect() reports its own failures through alertScanError; this is a safety net.
			console.error('[smart-cube] connect failed:', e);
		}

		return this.connected ? { ok: true } : { ok: false, reason: 'failed' };
	}

	cancelScan(): void {
		this.conn?.cancelScan?.();
		this.scanning = false;
		this.connecting = false;
		this.scanError = null;
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
		});
		this.publishConnection();
	}

	/**
	 * Drop the link on purpose.
	 *
	 * The only caller is a user action. Navigation must never reach this; that is the whole
	 * point of the manager. The intentional flag is what stops the drop we are about to cause
	 * from being treated as a cube that went out of range.
	 */
	async disconnect(): Promise<void> {
		this.intentional = true;
		this.cancelReconnect();
		this.clearBackgroundRelease();
		this.conn?.cancelScan?.();
		this.retainedDevice = null;

		const conn = this.conn;
		if (conn) {
			try {
				await conn.disconnect();
			} catch (e) {
				console.warn('[smart-cube] disconnect failed:', e);
			}
		}
		this.teardownConnectionState();
	}

	/**
	 * Tell the cube to treat its current physical position as solved.
	 *
	 * The cube keeps its own state in firmware, so resetting app-side state alone does not
	 * survive: the next FACELETS packet overwrites it with the cube's stale view.
	 */
	async resetCubeState(): Promise<boolean> {
		let done = true;
		const cube = this.activeCubeRef;
		if (cube?.resetCubeState) {
			try {
				done = await cube.resetCubeState();
			} catch (e) {
				done = false;
			}
		}
		this.tracker.setSolved(0);
		this.reportedSolved = true;
		this.publishFacelets(true);
		return done;
	}

	/** Current tracker state, for a page seeding its engine. */
	get trackerState(): string {
		return this.tracker.state;
	}

	// ── Called by the cube drivers (see bluetooth/smart_cube.js) ──────────────────

	handleScanning(): void {
		this.scanning = true;
		this.connecting = false;
		this.scanError = null;
		setTimerParams({
			smartCubeScanning: true,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
		});
		this.publishConnection();
	}

	handleConnecting(): void {
		this.scanning = false;
		this.connecting = true;
		this.scanError = null;
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: true,
			smartCubeScanError: null,
			smartScanDevices: [],
		});
		this.publishConnection();
	}

	handleScanError(message: string): void {
		this.scanning = false;
		this.connecting = false;
		this.scanError = message;
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: message,
			smartCubeConnectStep: null,
		});
		this.publishConnection();
	}

	async handleConnected(cube: any, server: any): Promise<void> {
		if (this.intentional) {
			// A reconnect handshake that was already under way when the user pressed Disconnect.
			// Letting it finish would bring back a link the user just asked to drop.
			try {
				await cube?.disconnect?.();
			} catch (e) {
				// Already closed.
			}
			return;
		}

		// A background reconnect must not touch the UI the user is in the middle of.
		const background = this.reconnecting;
		this.activeCubeRef = cube;
		this.retainedDevice = this.conn?.device || this.retainedDevice;
		this.deviceName = server?.device?.name || this.retainedDevice?.name || null;

		let dev: any;
		try {
			const exists = await cube.smartCubeInDb(server);
			dev = exists || (await cube.addSmartCubeToDb(server.device.name, server.device.id));
		} catch (error) {
			console.error('Smart Cube DB Error (continuing offline):', error);
			// Offline fallback: the BLE id stands in for the row id so solves still record a device.
			dev = { id: server?.device?.id, name: server?.device?.name, device_id: server?.device?.id };
		}

		const store = getStore();
		if (!background && store && store.getState()?.general?.modals?.length > 0) {
			// The scanning picker has done its job. Skipped on a background reconnect: no picker
			// is open then, and the top modal is something the user opened themselves.
			// closeModal is a thunk; the store here is typed as a plain Redux store.
			(store.dispatch as any)(closeModal());
		}

		this.connected = true;
		this.connecting = false;
		this.scanning = false;
		this.reconnecting = false;
		this.reconnectAttempt = 0;
		this.scanError = null;
		this.deviceId = dev?.id || '';

		setTimerParams({
			smartCubeConnecting: false,
			smartCubeScanning: false,
			smartCubeScanError: null,
			smartCubeConnectStep: 'done',
		});
		setSmartCubeParams({
			smartCubeConnected: true,
			smartReconnecting: false,
			smartDeviceId: this.deviceId,
			smartDeviceName: this.deviceName,
		});

		// Whatever the cube that just left had sent belongs to that cube, not this one.
		this.gyroSeen = false;

		if (typeof cube.subscribeGyro !== 'function') {
			// A cube with no gyroscope must not inherit the previous cube's flag, or the
			// "reset gyro" action shows for a cube that cannot use it.
			this.gyroSupported = false;
			setSmartCubeParams({ smartGyroSupported: false });
		}

		this.ensureVisibilityWatch();
		this.ensureSettingsWatch();
		this.applyPowerState();
		// Once more after the driver finishes: Particula and Giiker start their own battery
		// interval right after alertConnected resolves, which the call above cannot see yet.
		setTimeout(() => this.applyPowerState(), 0);
		this.publishConnection();
	}

	/**
	 * The link went away.
	 *
	 * Fires both for a deliberate disconnect (we asked for it) and for a cube that was
	 * switched off or carried out of range. Only the second one is worth retrying, which is
	 * what the intentional flag decides.
	 */
	handleLinkLost(): void {
		// A handshake that fails inside a reconnect attempt reports its drop here too. The
		// attempt's own continuation decides what happens next; scheduling from both places
		// would burn two backoff steps per failure and leave a stray timer behind.
		if (this.reconnectInFlight) return;

		// Only a link that was actually up is worth retrying. A drop during the very first
		// connect is connect()'s own retry loop's business, and retrying from here as well
		// would race it.
		const wasEstablished = this.connected || this.reconnecting;

		this.detachCubeGyro();
		this.clearIdleBatteryPoll();
		this.activeCubeRef = null;
		this.connected = false;
		this.connecting = false;
		this.scanning = false;

		if (this.intentional || !this.retainedDevice || !wasEstablished) {
			this.teardownConnectionState();
			return;
		}

		this.scheduleReconnect();
	}

	handleBattery(level: number): void {
		if (typeof level !== 'number') return;
		this.batteryLevel = level;
		setSmartCubeParams({ smartCubeBatteryLevel: level });
		// Mirrored into telemetry so every recorded event carries the battery level the cube
		// had at the time, which is what lets the study test the "low battery drops packets"
		// theory instead of guessing at it.
		setTelemetryBattery(level);
		emit(this.batteryListeners, level);
	}

	handleGyroSupported(supported: boolean): void {
		// Never downgrades a cube that has already sent gyro data; see noteGyroSeen.
		this.gyroSupported = !!supported || this.gyroSeen;
		setSmartCubeParams({ smartGyroSupported: this.gyroSupported });
		this.applyPowerState();
		this.publishConnection();
	}

	/** A driver that reports one move at a time and does not track cube state itself. */
	handleMove(move: string): void {
		const cleanMove = (move || '').replace(/\s/g, '');
		const completedAt = Date.now();
		const turn = {
			turn: cleanMove,
			completedAt,
			cubeTimestamp: null,
			localTimestamp: null,
		} as unknown as SmartTurn;

		this.applyMovesToTracker([turn]);
		emit(this.moveListeners, { moves: [turn], facelets: null });

		if (this.mirrorsTurnStream()) {
			getStore()?.dispatch(turnSmartCube(cleanMove, completedAt));
		}
		// No facelets publish here: this path is for drivers that report moves only, and a
		// derived state has never been published as if the cube had reported it.
	}

	handleMoveBatch(moves: any[], facelets: string | null = null): void {
		if (!moves || moves.length === 0) return;

		if (this.dropDuringSolvedSilence()) return;

		const formatted: SmartTurn[] = moves.map((m) => ({
			turn: (m.move || m.turn || '').replace(/\s/g, ''),
			completedAt: m.timestamp || m.completedAt || Date.now(),
			cubeTimestamp: m.cubeTimestamp ?? null,
			localTimestamp: m.localTimestamp ?? null,
			// Pulled back from the cube's move history after a dropped packet, so its
			// timestamp is the moment of recovery, not the moment of the turn.
			recovered: m.recovered === true,
		})) as SmartTurn[];

		if (facelets && isValidFacelets(facelets)) {
			this.tracker.setFromFacelets(facelets, 0);
			this.reportedSolved = facelets === this.solvedState;
		} else {
			this.applyMovesToTracker(formatted);
		}

		emit(this.moveListeners, { moves: formatted, facelets: facelets ?? null });

		const store = getStore();
		if (this.mirrorsTurnStream()) {
			// One action, both slices: the moves land in `timer` and the state they produced in
			// `smartCube`. Two dispatches would let the state overtake its own moves, which is
			// how the last scramble move once read as the first solve move.
			store?.dispatch(turnSmartCubeBatch(formatted as any, facelets ?? null));
		} else if (facelets) {
			store?.dispatch(smartCubeFaceletsAction(facelets));
		}

		// Facelets subscribers are deliberately NOT notified here. Drivers raise their own
		// FACELETS event for that, and a listener like the trainer's treats it as "the cube
		// reported its state", and firing it on every move batch would re-anchor mid-sequence.
	}

	handleFacelets(facelets: string): void {
		if (!isValidFacelets(facelets)) return;
		this.tracker.setFromFacelets(facelets, 0);
		this.reportedSolved = facelets === this.solvedState;
		this.publishFacelets(false);
	}

	// ── Internals ────────────────────────────────────────────────────────────────

	private ensureConnect(): any {
		if (!this.conn) {
			this.conn = new Connect();
			// Every cube instance routes its callbacks through this manager already (the base
			// class delegates), so the only wiring left is grabbing the instance itself.
			this.conn._onCubeCreated = (cube: any) => {
				this.activeCubeRef = cube;
				this.retainedDevice = this.conn?.device || this.retainedDevice;
			};
		}
		return this.conn;
	}

	/**
	 * Extra moves arriving inside the post-solve silence window must not reach the stream:
	 * the cube is already solved and the solve has been committed.
	 *
	 * This used to be a guard inside the timer reducer. It needs both the cube's solved state
	 * and whether a solve is running, and those now live in two slices, so it belongs here:
	 * the one place that can see both.
	 */
	private dropDuringSolvedSilence(): boolean {
		if (!this.reportedSolved) return false;
		return !!getStore()?.getState()?.timer?.timeStartedAt;
	}

	private applyMovesToTracker(turns: SmartTurn[]): void {
		// CubeTracker counts against a caller-owned cumulative stream; the manager hands it
		// one batch at a time, so the counter is zeroed before each batch is applied.
		this.tracker.acknowledge(0);
		this.tracker.applyNew(turns);
	}

	private mirrorsTurnStream(): boolean {
		for (const token of this.attachments) {
			if (token.turnStream) return true;
		}
		return false;
	}

	private publishFacelets(force: boolean): void {
		const state = this.tracker.state;
		const store = getStore();
		if (store && (force || state !== store.getState()?.smartCube?.smartCurrentState)) {
			store.dispatch(smartCubeFaceletsAction(state));
		}
		emit(this.faceletsListeners, state);
	}

	private publishConnection(): void {
		emit(this.connectionListeners, this.getSnapshot());
	}

	private teardownConnectionState(): void {
		this.detachCubeGyro();
		this.clearIdleBatteryPoll();
		this.activeCubeRef = null;
		this.connected = false;
		this.connecting = false;
		this.scanning = false;
		this.reconnecting = false;
		this.reconnectAttempt = 0;
		this.scanError = null;
		this.deviceId = '';
		this.deviceName = null;
		this.batteryLevel = null;
		this.gyroSupported = false;
		this.gyroSeen = false;
		this.reportedSolved = false;
		this.tracker.setSolved(0);

		setTimerParams({
			smartCanStart: false,
			smartCubeConnecting: false,
			smartCubeScanning: false,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
			smartTurns: [],
			smartOutOfSync: false,
		});
		setSmartCubeParams({
			smartCubeConnected: false,
			smartReconnecting: false,
			smartDeviceId: '',
			smartDeviceName: null,
			smartCubeBatteryLevel: null,
			smartGyroSupported: false,
			smartCurrentState: null,
			smartPhysicallySolved: false,
		});
		this.publishConnection();
	}

	// ── Auto-reconnect ───────────────────────────────────────────────────────────

	private scheduleReconnect(): void {
		if (this.reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
			// Out of attempts: the cube is off, or too far away to come back on its own. The
			// toast waits until here on purpose: a cube that comes straight back should not
			// announce a problem the user never had.
			console.warn('[smart-cube] giving up on reconnect after', this.reconnectAttempt, 'attempts');
			toastError(i18n.t('smart_cube.connection_lost'));
			this.teardownConnectionState();
			return;
		}

		const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt];
		this.reconnectAttempt += 1;
		this.reconnecting = true;
		setSmartCubeParams({ smartCubeConnected: false, smartReconnecting: true });
		this.publishConnection();

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.attemptReconnect();
		}, delay);
	}

	/**
	 * Reconnect without a picker.
	 *
	 * The device handle is retained across the drop (web: the BluetoothDevice, native: the
	 * platform device id), so this goes straight to the protocol handshake. Asking the user
	 * to pick the same cube out of a list again is exactly the friction this exists to avoid.
	 */
	private async attemptReconnect(): Promise<void> {
		if (this.intentional || !this.retainedDevice) return;

		const conn = this.ensureConnect();
		this.reconnectInFlight = true;
		try {
			await conn._initCube(this.retainedDevice);
		} catch (e) {
			console.warn('[smart-cube] reconnect attempt failed:', (e as any)?.message || e);
			// A half-open GATT session would make the next attempt fail on "already connected".
			try {
				await conn.adapter?.disconnect?.(this.retainedDevice);
			} catch (err) {
				// Nothing open to close.
			}
		} finally {
			this.reconnectInFlight = false;
		}

		if (this.intentional) return;
		if (!this.connected) {
			this.scheduleReconnect();
		}
	}

	private cancelReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.reconnectAttempt = 0;
		if (this.reconnecting) {
			this.reconnecting = false;
			setSmartCubeParams({ smartReconnecting: false });
		}
	}

	// ── Power management ─────────────────────────────────────────────────────────

	private ensureVisibilityWatch(): void {
		if (this.visibilityUnsub) return;
		this.visibilityUnsub = onVisibilityChange(() => this.applyPowerState());
	}

	/**
	 * Leaving the smart timer type is a deliberate user action and releases the cube.
	 *
	 * Watched here, on the settings write itself, rather than in a page: the type can be
	 * changed from the settings page, the mobile drawer, a room enforcing its allowed types or
	 * the unsupported-puzzle reset, and on most of those no smart cube component is mounted to
	 * notice. This used to happen by accident, through SmartCube's unmount cleanup.
	 */
	private ensureSettingsWatch(): void {
		if (this.settingsWatchInstalled) return;
		this.settingsWatchInstalled = true;
		addClientEventListener('settingsDbUpdatedEvent', (setting: any) => {
			if (setting?.id !== 'timer_type' || setting.value === 'smart') return;
			if (!this.connected && !this.reconnecting) return;
			void this.disconnect();
		});
	}

	/**
	 * Decide how much work the live link should be doing.
	 *
	 * The link and the state tracker always stay up; that is what makes navigation free.
	 * What gets throttled is the part only an on-screen page benefits from: the battery
	 * poll slows right down with nobody watching and stops in a backgrounded tab, and
	 * gyroscope packets stop being processed when nothing draws them.
	 */
	private applyPowerState(): void {
		const cube = this.activeCubeRef;
		// Nothing is managed until the driver has finished its handshake: before that it has
		// not started its own battery interval yet, and taking that over early leaked one.
		if (!cube || !this.connected) {
			this.detachCubeGyro();
			this.clearIdleBatteryPoll();
			this.clearBackgroundRelease();
			return;
		}

		const visible = isAppVisible();
		this.scheduleBackgroundRelease(visible);
		const wantGyro = visible && this.attached && this.gyroListeners.size > 0;
		if (wantGyro) this.attachCubeGyro();
		else this.detachCubeGyro();

		this.applyBatteryPolicy(cube, visible);
	}

	/**
	 * Battery polling for drivers that poll (Giiker, Particula). GAN and the others push
	 * battery packets on their own and have nothing to throttle.
	 *
	 * On screen the driver's own 10s interval runs as it always has. With no page attached
	 * it is paused and a 60s manager poll stands in; in a background tab nothing polls.
	 */
	private applyBatteryPolicy(cube: any, visible: boolean): void {
		if (typeof cube.updateBattery !== 'function' && typeof cube.getBatteryLevel !== 'function') return;

		if (visible && this.attached) {
			this.clearIdleBatteryPoll();
			if (!cube.batteryInterval) {
				cube.batteryInterval = setInterval(() => this.pollBattery(), BATTERY_POLL_ACTIVE_MS);
			}
			return;
		}

		if (cube.batteryInterval) {
			clearInterval(cube.batteryInterval);
			cube.batteryInterval = null;
		}
		if (!visible) {
			this.clearIdleBatteryPoll();
			return;
		}
		if (!this.idleBatteryTimer) {
			this.idleBatteryTimer = setInterval(() => this.pollBattery(), BATTERY_POLL_IDLE_MS);
		}
	}

	/**
	 * One battery read. `updateBattery` reports on its own; `getBatteryLevel` only returns the
	 * value, which the old page-level restart silently dropped for Particula cubes.
	 */
	private pollBattery(): void {
		const cube = this.activeCubeRef;
		if (!cube) return;
		try {
			if (typeof cube.updateBattery === 'function') {
				void cube.updateBattery();
			} else if (typeof cube.getBatteryLevel === 'function') {
				Promise.resolve(cube.getBatteryLevel())
					.then((level: number) => this.handleBattery(level))
					.catch(() => { /* a missed read is retried on the next tick */ });
			}
		} catch (e) {
			// Link dropping mid-read; the disconnect path cleans up.
		}
	}

	private clearIdleBatteryPoll(): void {
		if (!this.idleBatteryTimer) return;
		clearInterval(this.idleBatteryTimer);
		this.idleBatteryTimer = null;
	}

	/**
	 * Release a cube left connected in a hidden tab or a backgrounded app.
	 *
	 * The link used to die with the page, so leaving the timer let go of the cube as a side
	 * effect. Now it outlives pages on purpose, and without this a phone locked with the app
	 * open would keep both radios talking, draining the cube and the phone, until the OS got
	 * round to killing the app. The release is a deliberate disconnect, so nothing reconnects
	 * behind the user's back: coming back, they reconnect with one tap.
	 */
	private scheduleBackgroundRelease(visible: boolean): void {
		if (visible) {
			this.clearBackgroundRelease();
			return;
		}
		if (this.backgroundReleaseTimer) return;
		this.backgroundReleaseTimer = setTimeout(() => {
			this.backgroundReleaseTimer = null;
			if (isAppVisible() || !this.connected) return;
			void this.disconnect();
		}, BACKGROUND_RELEASE_MS);
	}

	private clearBackgroundRelease(): void {
		if (!this.backgroundReleaseTimer) return;
		clearTimeout(this.backgroundReleaseTimer);
		this.backgroundReleaseTimer = null;
	}

	private attachCubeGyro(): void {
		if (this.cubeGyroUnsub) return;
		const cube = this.activeCubeRef;
		if (!cube || typeof cube.subscribeGyro !== 'function') return;
		this.cubeGyroUnsub = cube.subscribeGyro((event: any) => {
			this.noteGyroSeen();
			emit(this.gyroListeners, event);
		});
	}

	/**
	 * A cube that sends gyro data HAS a gyroscope, whatever its hardware packet claimed.
	 *
	 * The claim is the only thing `smartGyroSupported` used to rest on, and it is wrong for
	 * most GAN generations: Gen2 reports "no gyroscope" unconditionally and Gen3 only admits
	 * to one on the GAN 12 ui Maglev. Meanwhile the 3D view subscribes to the stream without
	 * consulting the flag, so on a GAN i4 the cube followed the user's hands on screen while
	 * the gear menu hid "Reset gyro", the one action that fixes the drift they were watching.
	 */
	private noteGyroSeen(): void {
		if (this.gyroSeen) return;
		this.gyroSeen = true;
		if (this.gyroSupported) return;
		this.gyroSupported = true;
		setSmartCubeParams({ smartGyroSupported: true });
		this.publishConnection();
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
}

let manager: SmartCubeConnectionManager | null = null;

export function getSmartCubeManager(): SmartCubeConnectionManager {
	if (!manager) {
		manager = new SmartCubeConnectionManager();
		// Before any Connect exists, so the drivers always find it (see driver_sink.ts).
		setSmartCubeDriverSink(manager);
	}
	return manager;
}

/** Test seam: drops the singleton so each test starts from a cold manager. */
export function __resetSmartCubeManagerForTests(): void {
	manager = null;
	setSmartCubeDriverSink(null);
}

export type { SmartCubeConnectionManager };
