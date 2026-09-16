/**
 * The connection manager exists because navigation used to disconnect the cube: every page
 * built its own Connect and tore it down on unmount. These tests pin the rules that replaced
 * that, all of which can be checked without a cube on the table:
 *
 *   attaching and detaching is not connecting and disconnecting
 *   only an explicit disconnect drops the link, and it never reconnects itself
 *   an unexpected drop does reconnect, against the same device, without a picker
 *   the facelets tracker keeps running with nobody listening
 *   a page that attaches late is handed the state the cube is in now
 *   leaving the smart timer type releases the cube, from whichever page wrote the setting
 */

const deviceOne = { deviceId: 'dev-1', name: 'GAN-0001' };

/**
 * Stand-in for a protocol driver. Its alert* methods delegate to the manager exactly the way
 * the real base class (bluetooth/smart_cube.js) does, so the tests drive the manager through
 * the same door a GAN or QiYi driver would.
 */
class FakeCube {
	alertConnected = async (server: any) => getSmartCubeManager().handleConnected(this, server);
	alertDisconnected = () => getSmartCubeManager().handleLinkLost();
	alertTurnCubeBatch = (moves: any[], facelets: string | null = null) =>
		getSmartCubeManager().handleMoveBatch(moves, facelets);
	alertCubeState = (facelets: string) => getSmartCubeManager().handleFacelets(facelets);
	alertBatteryLevel = (level: number) => getSmartCubeManager().handleBattery(level);
	smartCubeInDb = jest.fn(async () => ({ id: 'row-1', device_id: deviceOne.deviceId }));
	addSmartCubeToDb = jest.fn(async () => ({ id: 'row-1' }));
	_trackerCube: any = null;
	resetCubeState = jest.fn(async () => true);
	init = jest.fn(async () => { /* handshake */ });
}

/**
 * Stand-in for Connect. `connect()` opens a picker and hands back a device; `_initCube()`
 * is the picker-free path an auto-reconnect uses, and counting its calls is how the retry
 * behaviour is observed.
 */
class FakeConnect {
	static instances: FakeConnect[] = [];
	static initCubeFails = 0;
	/** When set, the next handshake waits on this promise before reporting connected. */
	static handshakeGate: Promise<void> | null = null;

	device: any = null;
	activeCube: FakeCube | null = null;
	_onCubeCreated: ((cube: any) => void) | null = null;
	initCubeCalls: any[] = [];
	requestDeviceCalls = 0;
	cancelScanCalls = 0;
	disconnectCalls = 0;

	constructor() {
		FakeConnect.instances.push(this);
	}

	// Mirrors the real Connect: a scan, then _initCube on what the user picked.
	connect = jest.fn(async () => {
		this.requestDeviceCalls += 1;
		await this._initCube(deviceOne);
	});

	_initCube = async (device: any) => {
		this.initCubeCalls.push(device);
		this.device = device;
		if (FakeConnect.initCubeFails > 0) {
			FakeConnect.initCubeFails -= 1;
			throw new Error('GATT failed');
		}
		const cube = new FakeCube();
		this.activeCube = cube;
		this._onCubeCreated?.(cube);
		await cube.init();
		if (FakeConnect.handshakeGate) {
			const gate = FakeConnect.handshakeGate;
			FakeConnect.handshakeGate = null;
			await gate;
		}
		await cube.alertConnected({ device: { id: device.deviceId, name: device.name } });
	};

	cancelScan = () => { this.cancelScanCalls += 1; };

	disconnect = jest.fn(async () => {
		this.disconnectCalls += 1;
		const cube = this.activeCube;
		this.activeCube = null;
		this.device = null;
		// The real stack always surfaces the drop through the driver's callback, whether we
		// asked for it or the cube walked away. That is exactly why the intentional flag exists.
		cube?.alertDisconnected();
	});
}

jest.mock('../../../components/timer/smart_cube/bluetooth/connect', () => ({
	__esModule: true,
	default: FakeConnect,
}));

// Heavy client-only modules the manager imports but that have nothing to do with the rules
// under test. i18n would pull five translation bundles and a browser language detector.
jest.mock('../../toast', () => ({ toastError: jest.fn() }));
jest.mock('../../../i18n/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('./../telemetry', () => ({ setTelemetryBattery: jest.fn(), recordEngineEvent: jest.fn() }));

// The client event bus, reduced to what the manager listens on: settings writes.
const settingsListeners: ((setting: any) => void)[] = [];
jest.mock('../../event_handler', () => ({
	addEventListener: (name: string, fn: (setting: any) => void) => {
		if (name === 'settingsDbUpdatedEvent') settingsListeners.push(fn);
	},
}));

// App visibility, controllable: a test flips it and fires the listeners the manager registered.
let mockAppVisible = true;
const mockVisibilityListeners: ((visible: boolean) => void)[] = [];
jest.mock('../../app-visibility', () => ({
	isAppVisible: () => mockAppVisible,
	onVisibilityChange: (cb: (visible: boolean) => void) => {
		mockVisibilityListeners.push(cb);
		return () => {
			const i = mockVisibilityListeners.indexOf(cb);
			if (i >= 0) mockVisibilityListeners.splice(i, 1);
		};
	},
}));

function setAppVisible(visible: boolean): void {
	mockAppVisible = visible;
	for (const cb of [...mockVisibilityListeners]) cb(visible);
}

/** Let a chain of awaited promises (disconnect -> driver -> teardown) run to the end. */
async function flushPromises(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

const dispatched: any[] = [];
let storeState: any = { timer: {}, smartCube: {}, general: { modals: [] } };

jest.mock('../../../components/store', () => ({
	getStore: () => ({
		dispatch: (action: any) => { dispatched.push(action); },
		getState: () => storeState,
	}),
}));

import { getSmartCubeManager, __resetSmartCubeManagerForTests } from '../connection_manager';
import { DEFAULT_SOLVED_STATE } from '../facelets';
import Cube from 'cubejs';

/** A real reachable state: the manager validates facelets and rejects made-up strings. */
const SCRAMBLED = (() => {
	const cube = new Cube();
	cube.move("R U R' F2");
	return cube.asString();
})();

function currentConnect(): FakeConnect {
	return FakeConnect.instances[FakeConnect.instances.length - 1];
}

function currentCube(): FakeCube {
	return currentConnect().activeCube as FakeCube;
}

beforeEach(() => {
	// Legacy timers: the modern implementation tries to replace global.performance, which
	// is read-only on the Node version this suite runs on. Cast because @types/jest is on 27
	// (string argument) while the runtime is Jest 28 (config object).
	(jest.useFakeTimers as unknown as (config: { legacyFakeTimers: boolean }) => void)({ legacyFakeTimers: true });
	FakeConnect.instances = [];
	FakeConnect.initCubeFails = 0;
	FakeConnect.handshakeGate = null;
	dispatched.length = 0;
	settingsListeners.length = 0;
	mockAppVisible = true;
	mockVisibilityListeners.length = 0;
	storeState = { timer: {}, smartCube: {}, general: { modals: [] } };
	__resetSmartCubeManagerForTests();
});

afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
});

describe('attaching and detaching', () => {
	it('does not connect, and does not disconnect', async () => {
		const manager = getSmartCubeManager();

		const detach = manager.attach();
		expect(FakeConnect.instances).toHaveLength(0);
		detach();

		await manager.connect();
		expect(manager.getSnapshot().connected).toBe(true);

		// A page mounts, then navigates away. The link must be exactly where it was.
		const second = manager.attach();
		second();

		expect(manager.getSnapshot().connected).toBe(true);
		expect(currentConnect().disconnectCalls).toBe(0);
	});

	it('mirrors the turn stream into Redux only while a page asks for it', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		const batch = [{ turn: 'R', completedAt: 1000 }];

		// Nobody attached: the moves still reach the tracker, but no page is waiting for them.
		currentCube().alertTurnCubeBatch(batch, SCRAMBLED);
		expect(dispatched.filter((a) => a.type === 'TURN_SMART_CUBE_BATCH')).toHaveLength(0);

		const detach = manager.attach({ turnStream: true });
		currentCube().alertTurnCubeBatch(batch, SCRAMBLED);
		expect(dispatched.filter((a) => a.type === 'TURN_SMART_CUBE_BATCH')).toHaveLength(1);

		// The trainer's shape: attached, but it processes moves itself.
		detach();
		const detachTrainer = manager.attach({ turnStream: false });
		currentCube().alertTurnCubeBatch(batch, SCRAMBLED);
		expect(dispatched.filter((a) => a.type === 'TURN_SMART_CUBE_BATCH')).toHaveLength(1);
		detachTrainer();
	});

	it('hands a late attacher the state the cube is in, not the state it started in', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		// The user scrambles on a page that does not show the cube at all.
		currentCube().alertCubeState(SCRAMBLED);
		expect(manager.getSnapshot().facelets).toBe(SCRAMBLED);

		dispatched.length = 0;
		const detach = manager.attach({ turnStream: true });

		// The stream starts empty, and the very first thing the new page is told is where the
		// cube actually is, with no waiting for the next heartbeat.
		const cleared = dispatched.find((a) => a.type === 'SET_TIMER_PARAM');
		expect(cleared.payload.params.smartTurns).toEqual([]);
		const seeded = dispatched.find((a) => a.type === 'SMART_CUBE_FACELETS');
		expect(seeded.payload.facelets).toBe(SCRAMBLED);
		detach();
	});
});

describe('the facelets tracker', () => {
	it('keeps following the cube with zero listeners', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		expect(manager.getSnapshot().facelets).toBe(DEFAULT_SOLVED_STATE);
		expect(manager.getSnapshot().physicallySolved).toBe(true);

		// A driver that reports moves without a state: the tracker has to apply them itself.
		currentCube().alertTurnCubeBatch([{ turn: 'R', completedAt: 1 }], null);
		const afterR = manager.getSnapshot().facelets;
		expect(afterR).not.toBe(DEFAULT_SOLVED_STATE);
		expect(manager.getSnapshot().physicallySolved).toBe(false);

		// Undo it and the tracker is back on the solved state, still with nobody attached.
		currentCube().alertTurnCubeBatch([{ turn: "R'", completedAt: 2 }], null);
		expect(manager.getSnapshot().facelets).toBe(DEFAULT_SOLVED_STATE);
		expect(manager.getSnapshot().physicallySolved).toBe(true);
	});

	it('prefers the cube\'s own report over the moves when the driver sends both', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		currentCube().alertTurnCubeBatch([{ turn: 'R', completedAt: 1 }], SCRAMBLED);
		expect(manager.getSnapshot().facelets).toBe(SCRAMBLED);
	});

	it('ignores a malformed state rather than adopting it', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		currentCube().alertCubeState('nonsense');
		expect(manager.getSnapshot().facelets).toBe(DEFAULT_SOLVED_STATE);
	});
});

// The link outlives pages now, so it no longer dies as a side effect of leaving the timer.
// A phone locked with the app open must not keep the cube and the phone radios talking.
describe('a cube left in the background', () => {
	const MINUTE = 60 * 1000;

	it('is released after five minutes hidden, and does not reconnect itself', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		const conn = currentConnect();

		setAppVisible(false);
		jest.advanceTimersByTime(4 * MINUTE);
		await flushPromises();
		expect(manager.getSnapshot().connected).toBe(true);

		jest.advanceTimersByTime(1 * MINUTE);
		await flushPromises();
		expect(conn.disconnectCalls).toBe(1);
		expect(manager.getSnapshot().connected).toBe(false);

		// Released on purpose: coming back, the user reconnects with a tap.
		const initCalls = conn.initCubeCalls.length;
		jest.advanceTimersByTime(2 * MINUTE);
		await flushPromises();
		expect(conn.initCubeCalls.length).toBe(initCalls);
		expect(manager.getSnapshot().reconnecting).toBe(false);
	});

	it('stays connected when the app comes back before the deadline', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		setAppVisible(false);
		jest.advanceTimersByTime(4 * MINUTE);
		setAppVisible(true);
		jest.advanceTimersByTime(10 * MINUTE);
		await flushPromises();

		expect(currentConnect().disconnectCalls).toBe(0);
		expect(manager.getSnapshot().connected).toBe(true);
	});

	it('does not stack deadlines when visibility flickers', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		setAppVisible(false);
		jest.advanceTimersByTime(3 * MINUTE);
		setAppVisible(true);
		setAppVisible(false);
		// The first hidden period must not count: a fresh five minutes starts here.
		jest.advanceTimersByTime(4 * MINUTE);
		await flushPromises();
		expect(manager.getSnapshot().connected).toBe(true);

		jest.advanceTimersByTime(1 * MINUTE);
		await flushPromises();
		expect(manager.getSnapshot().connected).toBe(false);
	});
});

describe('explicit disconnect', () => {
	it('drops the link and clears the published connection state', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		expect(manager.getSnapshot().connected).toBe(true);

		await manager.disconnect();

		expect(manager.getSnapshot().connected).toBe(false);
		expect(manager.getSnapshot().deviceId).toBe('');
		expect(currentConnect().disconnectCalls).toBe(1);
	});

	it('never reconnects itself', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		const conn = currentConnect();
		const initCallsBefore = conn.initCubeCalls.length;

		await manager.disconnect();

		// Every backoff step, all at once. None of them may fire.
		jest.advanceTimersByTime(120000);
		await Promise.resolve();

		expect(conn.initCubeCalls.length).toBe(initCallsBefore);
		expect(manager.getSnapshot().connected).toBe(false);
		expect(manager.getSnapshot().reconnecting).toBe(false);
	});

	it('stops a pending retry: a disconnect during the backoff wait is final', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		const conn = currentConnect();
		const initCallsBefore = conn.initCubeCalls.length;

		currentCube().alertDisconnected();
		expect(manager.getSnapshot().reconnecting).toBe(true);

		// The user gives up on the cube before the first retry fires.
		await manager.disconnect();
		jest.advanceTimersByTime(120000);
		await flushRetry();

		expect(conn.initCubeCalls.length).toBe(initCallsBefore);
		expect(manager.getSnapshot().reconnecting).toBe(false);
	});

	it('does not let a handshake already in flight bring the link back after a disconnect', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		currentCube().alertDisconnected();
		let openGate: () => void = () => { /* set below */ };
		FakeConnect.handshakeGate = new Promise<void>((resolve) => { openGate = resolve; });

		// The retry starts and is now waiting on the cube's handshake.
		jest.advanceTimersByTime(1000);
		await flushRetry();

		// The user disconnects while it waits, then the cube answers.
		await manager.disconnect();
		openGate();
		await flushRetry();
		jest.advanceTimersByTime(120000);
		await flushRetry();

		expect(manager.getSnapshot().connected).toBe(false);
		expect(manager.getSnapshot().reconnecting).toBe(false);
	});

	it('refuses to connect a second cube while one holds the link', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		const result = await manager.connect();

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('already_connected');
		expect(result.deviceName).toBe('GAN-0001');
		// The refusal must not have touched the cube that is already on the line.
		expect(currentConnect().requestDeviceCalls).toBe(1);
		expect(manager.getSnapshot().connected).toBe(true);
	});
});

describe('an unexpected drop', () => {
	it('retries the same device without opening a picker', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		const conn = currentConnect();
		const scansBefore = conn.requestDeviceCalls;

		// The cube is switched off: the driver reports the drop, nobody asked for it.
		currentCube().alertDisconnected();

		expect(manager.getSnapshot().connected).toBe(false);
		expect(manager.getSnapshot().reconnecting).toBe(true);

		jest.advanceTimersByTime(1000);
		await Promise.resolve();
		await Promise.resolve();

		// Reconnected through _initCube on the retained handle, with no new scan.
		expect(conn.requestDeviceCalls).toBe(scansBefore);
		expect(conn.initCubeCalls[conn.initCubeCalls.length - 1]).toBe(deviceOne);
		expect(manager.getSnapshot().connected).toBe(true);
		expect(manager.getSnapshot().reconnecting).toBe(false);
	});

	it('backs off between attempts instead of hammering the cube', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();
		const conn = currentConnect();

		// The next two handshakes fail; the third succeeds.
		FakeConnect.initCubeFails = 2;
		const initCallsBefore = conn.initCubeCalls.length;
		currentCube().alertDisconnected();

		jest.advanceTimersByTime(1000);
		await flushRetry();
		expect(conn.initCubeCalls.length).toBe(initCallsBefore + 1);

		// Still 1s later nothing new: the second attempt waits 2s.
		jest.advanceTimersByTime(1000);
		await flushRetry();
		expect(conn.initCubeCalls.length).toBe(initCallsBefore + 1);

		jest.advanceTimersByTime(1000);
		await flushRetry();
		expect(conn.initCubeCalls.length).toBe(initCallsBefore + 2);

		jest.advanceTimersByTime(4000);
		await flushRetry();
		expect(manager.getSnapshot().connected).toBe(true);
	});

	it('gives up after the last backoff step and reports the cube as gone', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		FakeConnect.initCubeFails = 99;
		currentCube().alertDisconnected();

		for (let i = 0; i < 12; i++) {
			jest.advanceTimersByTime(30000);
			await flushRetry();
		}

		expect(manager.getSnapshot().connected).toBe(false);
		expect(manager.getSnapshot().reconnecting).toBe(false);
		expect(manager.getSnapshot().deviceId).toBe('');
	});
});

describe('leaving the smart timer type', () => {
	it('releases the cube whichever page wrote the setting', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		// The settings page, the drawer and a room's allowed-type rule all end in this write.
		settingsListeners.forEach((fn) => fn({ id: 'timer_type', value: 'keyboard', local: false }));
		await flushRetry();

		expect(manager.getSnapshot().connected).toBe(false);
		expect(currentConnect().disconnectCalls).toBe(1);
	});

	it('ignores every other setting, and a write that keeps the type on smart', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		settingsListeners.forEach((fn) => fn({ id: 'inspection', value: true, local: false }));
		settingsListeners.forEach((fn) => fn({ id: 'timer_type', value: 'smart', local: false }));
		await flushRetry();

		expect(manager.getSnapshot().connected).toBe(true);
		expect(currentConnect().disconnectCalls).toBe(0);
	});
});

describe('a background reconnect', () => {
	it('does not close a modal the user opened while the cube was away', async () => {
		const manager = getSmartCubeManager();
		await manager.connect();

		currentCube().alertDisconnected();
		storeState.general.modals = [{ id: 'settings' }];
		dispatched.length = 0;

		jest.advanceTimersByTime(1000);
		await flushRetry();

		expect(manager.getSnapshot().connected).toBe(true);
		// closeModal is a thunk (a function); nothing of the kind may have been dispatched.
		expect(dispatched.some((a) => typeof a === 'function')).toBe(false);
	});

	it('is not attempted for a link that never came up', async () => {
		const manager = getSmartCubeManager();
		// First connect fails in the handshake: the driver reports a drop before alertConnected.
		FakeConnect.initCubeFails = 0;
		const conn = (manager as any).ensureConnect();
		conn._onCubeCreated(new FakeCube());
		conn.device = deviceOne;
		(manager as any).retainedDevice = deviceOne;

		manager.handleLinkLost();
		jest.advanceTimersByTime(60000);
		await flushRetry();

		expect(manager.getSnapshot().reconnecting).toBe(false);
		expect(conn.initCubeCalls).toHaveLength(0);
	});
});

describe('subscriptions', () => {
	it('fan out moves, battery and connection changes, and stop on unsubscribe', async () => {
		const manager = getSmartCubeManager();
		const moves: any[] = [];
		const battery: number[] = [];
		const connection: boolean[] = [];

		const unsubMoves = manager.subscribeMoves((batch) => moves.push(batch));
		const unsubBattery = manager.subscribeBattery((level) => battery.push(level));
		const unsubConnection = manager.subscribeConnection((snap) => connection.push(snap.connected));

		await manager.connect();
		currentCube().alertTurnCubeBatch([{ turn: 'R', completedAt: 1 }], SCRAMBLED);
		currentCube().alertBatteryLevel(73);

		expect(moves).toHaveLength(1);
		expect(moves[0].moves[0].turn).toBe('R');
		expect(battery).toEqual([73]);
		expect(connection).toContain(true);

		unsubMoves();
		unsubBattery();
		unsubConnection();

		const counts = [moves.length, battery.length, connection.length];
		currentCube().alertTurnCubeBatch([{ turn: 'U', completedAt: 2 }], SCRAMBLED);
		currentCube().alertBatteryLevel(70);
		await manager.disconnect();

		expect([moves.length, battery.length, connection.length]).toEqual(counts);
	});

	it('does not let one broken listener stop the others', async () => {
		const manager = getSmartCubeManager();
		const seen: string[] = [];

		manager.subscribeMoves(() => { throw new Error('listener blew up'); });
		manager.subscribeMoves((batch) => seen.push(batch.moves[0].turn));

		await manager.connect();
		currentCube().alertTurnCubeBatch([{ turn: 'R', completedAt: 1 }], SCRAMBLED);

		expect(seen).toEqual(['R']);
	});
});

/** Lets the retry's async chain settle between fake-timer steps. */
async function flushRetry(): Promise<void> {
	for (let i = 0; i < 6; i++) {
		await Promise.resolve();
	}
}
