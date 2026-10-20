import SmartCube from './smart_cube';
import { isEqual } from 'lodash';
import { Subject } from 'rxjs';
import { isNative } from '../../../../util/platform';
import Cube from 'cubejs';
import { getStore } from '../../../store';
import { setSmartSolveEndTime, setSmartCubeClockSkew, getSmartCubeClockSkew } from '../../helpers/events';
import { setTimerParams } from '../../helpers/params';
import { requestMacFromUser } from '../mac_input/requestMacFromUser';
import { readCachedMac, readAnyMac, writeCachedMac, clearCachedMac, cubeStorageId } from './mac_cache';
import { macFromNativeDeviceId } from '../../../../util/ble/native-mac';
import GanGen1ProtocolDriver, { isSupportedGen1Version } from './gan_v1_driver';
import {
	GAN_GEN2_SERVICE,
	GAN_GEN2_COMMAND_CHARACTERISTIC,
	GAN_GEN2_STATE_CHARACTERISTIC,
	GAN_GEN3_SERVICE,
	GAN_GEN3_COMMAND_CHARACTERISTIC,
	GAN_GEN3_STATE_CHARACTERISTIC,
	GAN_GEN4_SERVICE,
	GAN_GEN4_COMMAND_CHARACTERISTIC,
	GAN_GEN4_STATE_CHARACTERISTIC,
	GAN_GEN1_DATA_SERVICE,
	GAN_GEN1_META_SERVICE,
	GAN_GEN1_VERSION_CHARACTERISTIC,
	GAN_GEN1_HARDWARE_CHARACTERISTIC,
	GAN_GEN1_STATE_CHARACTERISTIC,
	GAN_GEN1_MOVES_CHARACTERISTIC,
	GAN_GEN1_TIMES_CHARACTERISTIC,
	GAN_GEN1_BATTERY_CHARACTERISTIC,
	GAN_CIC_LIST,
	GAN_ENCRYPTION_KEYS,
	now,
	GanGen2CubeEncrypter,
	GanGen3CubeEncrypter,
	GanGen4CubeEncrypter,
	GanGen2ProtocolDriver,
	GanGen3ProtocolDriver,
	GanGen4ProtocolDriver,
	GanCubeClassicConnection,
	isValidGanGen2Packet,
	isValidGanGen3Packet,
	isValidGanGen4Packet,
} from './gan_protocol';

// Simple linear regression: y = slope * x + intercept
// Returns [slope, intercept]
function linregress(xs, ys) {
	const n = xs.length;
	if (n < 2) return [1, 0];
	let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
	for (let i = 0; i < n; i++) {
		sumX += xs[i];
		sumY += ys[i];
		sumXY += xs[i] * ys[i];
		sumX2 += xs[i] * xs[i];
	}
	const denom = n * sumX2 - sumX * sumX;
	if (denom === 0) return [1, 0];
	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;
	return [slope, intercept];
}

// Move inversion: R → R', R' → R, R2 → R2
function invertMove(move) {
	if (move.endsWith("'")) return move.slice(0, -1);
	if (move.endsWith('2')) return move;
	return move + "'";
}


/** Fallback when the app has not told us what "solved" means for this cube yet. */
const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * While a held-back FACELETS state waits on a move-history recovery, ask for a fresh one
 * this often. Long enough for a history reply (tens of ms) to land in between, short
 * enough that a paused user sees their scramble progress within half a second.
 */
const GAP_RESYNC_INTERVAL_MS = 400;


/**
 * Gen1 connection — the polling counterpart of GanCubeClassicConnection.
 *
 * First-generation cubes push nothing: the move counter, the time offsets and the cube
 * state are all read on demand. cstimer polls them in a tight loop (`loopRead`, a read
 * chain that restarts the moment it finishes) and this keeps the same cadence, so the
 * traffic on the wire matches the reference implementation.
 *
 * It exposes the same surface as the classic connection (`events$`, `sendCubeCommand`,
 * `disconnect`, `deviceName`, `deviceMAC`), which is what lets `GAN.handleCubeEvent`,
 * the silence detector and the teardown path stay untouched.
 */
class GanCubeV1PollingConnection {
	constructor(adapter, device, driver) {
		this.adapter = adapter;
		this.device = device;
		this.driver = driver;
		this.events$ = new Subject();
		this._disconnected = false;
		/** Set by disconnect(); every await in the loop checks it before continuing. */
		this._stopped = false;
		/** Guards start() so the poll loop can never be launched twice. */
		this._started = false;
		/** Raised by REQUEST_FACELETS, which must work even when no move has happened. */
		this._forceStateRead = false;
		/** Firmware version string, filled by _initDecoder and reported in HARDWARE. */
		this._version = '';
		/**
		 * Serialises GATT reads. BLE stacks reject a second operation while one is still in
		 * flight ("GATT operation already in progress"), and here the poll loop and the
		 * init-time battery request read at the same time. The notifying generations never
		 * had this problem: they write commands and receive pushes.
		 */
		this._readLock = Promise.resolve();

		this.onDisconnect = async () => {
			if (this._disconnected) return;
			this._disconnected = true;
			this._stopped = true;
			this.events$.next({ timestamp: now(), type: 'DISCONNECT' });
			this.events$.unsubscribe();
		};
	}

	static async create(adapter, device, driver) {
		const conn = new GanCubeV1PollingConnection(adapter, device, driver);
		await conn._initDecoder();
		return conn;
	}

	/**
	 * Begins polling. Separate from create() on purpose: `events$` is a hot Subject, so
	 * anything emitted before the caller subscribes is dropped on the floor. The notifying
	 * generations get away with starting inside create() because a cube sends nothing until
	 * it is asked; a poll loop starts talking immediately, and the events it would lose are
	 * the ones that confirm the connection — losing them means the handshake watchdog tears
	 * a perfectly healthy cube down after 7 seconds.
	 */
	start() {
		if (this._started || this._stopped) return;
		this._started = true;
		// Gen1 carries no hardware-info payload. The event is still emitted because the UI
		// otherwise waits for orientation data this cube will never send; `hardwareName` is
		// deliberately absent so the cube keeps its advertised name.
		this._emit({
			type: 'HARDWARE',
			timestamp: now(),
			hardwareVersion: this._version,
			softwareVersion: this._version,
			gyroSupported: false,
		});
		// Not awaited: this is the poll loop, it runs for the life of the connection.
		this._loopRead();
	}

	/**
	 * cstimer `v1init()` — reads the firmware version, rejects the versions the key
	 * derivation does not cover, then salts the key with the hardware characteristic.
	 */
	async _initDecoder() {
		const versionValue = await this._read(GAN_GEN1_META_SERVICE, GAN_GEN1_VERSION_CHARACTERISTIC);
		const version =
			(versionValue.getUint8(0) << 16) | (versionValue.getUint8(1) << 8) | versionValue.getUint8(2);
		this._version = version.toString(16);
		console.log('[ZKT:GAN-V1] firmware version', this._version);

		if (!isSupportedGen1Version(version)) {
			throw new Error("Can't find target BLE services - unsupported GAN v1 firmware " + this._version);
		}

		const hardwareValue = await this._read(GAN_GEN1_META_SERVICE, GAN_GEN1_HARDWARE_CHARACTERISTIC);
		if (!this.driver.initDecoder(version, hardwareValue)) {
			throw new Error("Can't find target BLE services - unsupported GAN v1 key version " + this._version);
		}
		console.log('[ZKT:GAN-V1] decoder ready');
	}

	/**
	 * Publish an event unless the connection is already gone. A read can complete after
	 * teardown has begun, and `events$` is unsubscribed by then — pushing into it would
	 * throw ObjectUnsubscribedError out of the poll loop.
	 */
	_emit(event) {
		if (this._stopped || this._disconnected) return;
		this.events$.next(event);
	}

	/** Every GATT read goes through here, one at a time. See `_readLock`. */
	async _read(serviceUuid, characteristicUuid) {
		const previous = this._readLock;
		let release;
		this._readLock = new Promise((resolve) => {
			release = resolve;
		});
		// A failed read belongs to whoever issued it; it must not poison the queue.
		await previous.catch(() => {});
		try {
			return await this.adapter.readCharacteristic(this.device, serviceUuid, characteristicUuid);
		} finally {
			release();
		}
	}

	get deviceName() {
		return this.device.name || 'GAN-XXXX';
	}

	get deviceMAC() {
		// Gen1 derives its key from the hardware characteristic, so no MAC is ever resolved.
		// Returning null (rather than the classic connection's 00:00:00:00:00:00 placeholder)
		// matters: the caller falls back to the platform device id, and without that every
		// Gen1 cube would be stored under one and the same identity.
		return this.device.mac || null;
	}

	async _loopRead() {
		while (!this._stopped) {
			try {
				await this._readOnce();
			} catch (e) {
				if (this._stopped) return;
				// A transient read failure on a live link is worth retrying; a cube that is
				// really gone keeps failing, and the adapter's own disconnect callback is
				// what tears the connection down. Backing off keeps that case from spinning.
				console.warn('[ZKT:GAN-V1] poll read failed:', e?.message);
				await new Promise((r) => setTimeout(r, 200));
			}
		}
	}

	/** One iteration of cstimer's `loopRead()`. */
	async _readOnce() {
		const movesValue = await this._read(GAN_GEN1_DATA_SERVICE, GAN_GEN1_MOVES_CHARACTERISTIC);
		if (this._stopped) return;

		const locTime = now();
		const decodedMoves = this.driver.decode(movesValue);
		// The same characteristic carries the orientation in its first six bytes (three
		// int16 / 16384, w derived). cstimer never read it; smartcube-web-bluetooth emits it
		// on every poll, mapped onto GAN's frame (x, z, -y).
		const quaternion = gyroFromGen1State(decodedMoves);
		if (quaternion) this._emit({ type: 'GYRO', timestamp: locTime, quaternion });
		const advanced = this.driver.parseMoves(decodedMoves);

		// REQUEST_FACELETS must be honoured even when the counter has not moved — the
		// silence detector asks precisely when nothing is happening. It must NOT be served
		// before the move characteristic has been read at least once, though: the driver
		// would take -1 as its baseline counter and the cube's last six moves would then be
		// replayed as if the user had just made them. Reading moves first rules that out.
		const forced = this._forceStateRead;
		this._forceStateRead = false;

		if (!advanced) {
			if (forced) await this._readState();
			return;
		}

		const timesValue = await this._read(GAN_GEN1_DATA_SERVICE, GAN_GEN1_TIMES_CHARACTERISTIC);
		if (this._stopped) return;
		const timeBytes = this.driver.decode(timesValue);

		if (this.driver.needsStateCheck || forced) {
			const isInitial = await this._readState();
			if (this._stopped) return;
			if (!isInitial) {
				// cstimer behaviour: a mid-session state read replaces this round's move
				// processing. `prevMoveCnt` was not advanced, so the very next iteration
				// picks the same moves up and delivers them normally.
				return;
			}
		}

		this.driver.parseTimeOffsets(timeBytes);
		const events = this.driver.updateMoveTimes(locTime);
		for (const event of events) {
			this._emit(event);
		}
	}

	/** Reads the cube's own state and publishes it. Returns true on the initial sync. */
	async _readState() {
		const value = await this._read(GAN_GEN1_DATA_SERVICE, GAN_GEN1_STATE_CHARACTERISTIC);
		const facelets = this.driver.parseFacelets(this.driver.decode(value));
		const isInitial = this.driver.applyStateRead();
		this._emit({
			type: 'FACELETS',
			timestamp: now(),
			serial: this.driver.moveCnt,
			facelets: facelets,
		});
		return isInitial;
	}

	async _readBattery() {
		const value = await this._read(GAN_GEN1_DATA_SERVICE, GAN_GEN1_BATTERY_CHARACTERISTIC);
		// cstimer reads the level out of byte 7 of the decoded battery characteristic.
		const batteryLevel = this.driver.decode(value)[7];
		this._emit({
			type: 'BATTERY',
			timestamp: now(),
			batteryLevel: Math.min(batteryLevel, 100),
		});
	}

	/**
	 * Gen1 has no command channel: every "request" is a read. REQUEST_RESET has no Gen1
	 * equivalent at all, so it is ignored and `resetCubeState()` reports failure, leaving
	 * the app-side markSolved path to do the work.
	 */
	async sendCubeCommand(command) {
		if (this._stopped) return;
		switch (command?.type) {
			case 'REQUEST_FACELETS':
				this._forceStateRead = true;
				return;
			case 'REQUEST_BATTERY':
				return this._readBattery().catch((e) => {
					console.warn('[ZKT:GAN-V1] battery read failed:', e?.message);
				});
			case 'REQUEST_RESET':
				// Throwing rather than quietly succeeding: resetCubeState() reports true when
				// this resolves, and a caller told the cube was reset when it was not would
				// leave the app and the cube disagreeing about what "solved" means. The
				// rejection sends it down the app-side markSolved path instead.
				throw new Error('GAN v1 has no cube state reset command');
			default:
				return;
		}
	}

	async disconnect() {
		this._stopped = true;
		await this.onDisconnect();
		try {
			await this.adapter.disconnect(this.device);
		} catch (e) { }
	}
}

/** Gen1 orientation from a decoded moves/state payload; null when it is too short. */
function gyroFromGen1State(t) {
	if (!t || t.length < 6) return null;
	const int16 = (lo, hi) => {
		const v = t[lo] | (t[hi] << 8);
		return v > 32767 ? v - 65536 : v;
	};
	const r = int16(0, 1) / 16384;
	const s = int16(2, 3) / 16384;
	const a = int16(4, 5) / 16384;
	const o = 1 - r * r - s * s - a * a;
	return { x: r, y: a, z: -s, w: o > 0 ? Math.sqrt(o) : 0 };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Extract MAC from manufacturer data
function extractMAC(manufacturerData) {
	const mac = [];
	let dataView;
	if (manufacturerData instanceof DataView) {
		dataView = new DataView(manufacturerData.buffer.slice(2, 11));
	} else {
		for (const id of GAN_CIC_LIST) {
			if (manufacturerData.has(id)) {
				dataView = new DataView(manufacturerData.get(id).buffer.slice(0, 9));
				break;
			}
		}
	}
	if (dataView && dataView.byteLength >= 6) {
		for (let i = 1; i <= 6; i++) {
			mac.push(dataView.getUint8(dataView.byteLength - i).toString(16).toUpperCase().padStart(2, '0'));
		}
	}
	return mac.join(':');
}

// Auto-retrieve MAC address using adapter's watchAdvertisements
async function autoRetrieveMacAddress(adapter, device) {
	if (!adapter.watchAdvertisements) return null;

	const manufacturerData = await adapter.watchAdvertisements(device);
	if (!manufacturerData) return null;

	return extractMAC(manufacturerData) || null;
}

// ============================================================================
// MAIN GAN CLASS
// ============================================================================

// Wrong MAC => GAN packets never decrypt => no HARDWARE event arrives. The watchdog
// tears the connection down instead of leaving it stuck on "connecting" forever.
const GAN_HANDSHAKE_TIMEOUT_MS = 7000;
const GAN_MAC_CACHE_KEY = 'gan_cube_mac';

export default class GAN extends SmartCube {
	device;
	adapter;

	// Company identifier codes for GAN cubes — declared in requestDevice so Chrome exposes
	// the advertisement manufacturer data the MAC is read from (see connect.js _deviceOptions).
	static cics = GAN_CIC_LIST;

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;
		// True once the first valid protocol packet confirms the connection (see _confirmConnectionOnce).
		this._connectionConfirmed = false;
		this.gyroListeners = [];
		// Move batching properties
		this.moveQueue = [];
		this.moveFlushTimeout = null;
		// Moves are queued for this long before being dispatched as one batch.
		// Measured turn rate peaks around 4 moves/sec (~240ms apart), so a wide window
		// almost never coalesces anything and only adds latency: it accounted for
		// roughly half of the 17ms BLE-to-screen delay. Kept non-zero so a genuine
		// burst (gap recovery replaying several moves) still arrives as one dispatch.
		this.BATCH_FLUSH_DELAY = 2;
		// FACELETS resync flag
		this._resyncPending = false;
		// Re-asks for FACELETS while a move-history recovery is pending (see handleCubeEvent).
		this._gapResyncId = null;
		// Cube state tracking
		this._trackerCube = new Cube(); // Tracks all moves received from BLE
		// Serial of the last FACELETS state adopted into the tracker, until a newer move
		// arrives. A move at or below it is already part of that state (see handleCubeEvent).
		this._publishedSerial = null;
		this.GAN_DEBUG_FACELETS = false; // Set to true to log FACELETS bytes
		// Silence detector: request FACELETS after last move (solution detection safety)
		this._silenceTimeoutId = null;
		this._silenceRetryId = null;
		this._SILENCE_TIMEOUT = 200; // 0.2 seconds
		// cubeTimestamp calibration (ganInitialFacelets no longer used — solved detection uses only smartSolvedState)
		// cubeTimestamp → Date.now() calibration offset
		this._cubeTimeOffset = null;
		// Clock skew: (localTimestamp, cubeTimestamp) pairs — collected from pre-solve moves
		this._skewSamples = [];
		this._SKEW_WINDOW = 50; // Last N samples
		// Handshake watchdog + deferred MAC caching. GAN already defers alertConnected to
		// the HARDWARE event; these add wrong-MAC self-heal (don't persist a MAC until the
		// cube proves it works, and surface an error if it never answers).
		this._handshakeTimer = null;
		this._pendingMac = null;
	}

	subscribeGyro(callback) {
		this.gyroListeners.push(callback);
		return () => {
			this.gyroListeners = this.gyroListeners.filter((cb) => cb !== callback);
		};
	}

	retryCount = 0;

	customMacAddressProvider = async (device, isFallbackCall) => {
		// Keyed by device: two cubes of the same brand used to share one entry, so the
		// second cube always started with the first one's MAC and failed to connect.
		const cachedMac = readCachedMac(GAN_MAC_CACHE_KEY, cubeStorageId(device));

		// Capacitor Android: deviceId IS the BLE MAC address (iOS/web return null here).
		const nativeMac = macFromNativeDeviceId(device.deviceId);
		if (nativeMac) {
			return nativeMac;
		}

		// If we have a cached MAC and this is NOT a fallback call (meaning first attempt), try using it.
		if (cachedMac && !isFallbackCall) {
			this.retryCount = 0; // Reset retry count on fresh attempt
			return cachedMac;
		}

		// AUTO-RETRY LOGIC:
		// If the first attempt failed (isFallbackCall=true) but we have a valid-looking cached MAC,
		// try it one more time automatically before bothering the user.
		// Connection flakiness is common with Web Bluetooth.
		if (isFallbackCall && cachedMac && this.retryCount < 1) {
			this.retryCount++;
			return cachedMac;
		}

		let macAddress;
		if (isFallbackCall) {
			// Fallback (auto retries exhausted) — ask the user via modal.
			// No entry for this device: offer any MAC we have seen as a starting point,
			// the user still has to confirm it.
			macAddress = await requestMacFromUser({ defaultMac: cachedMac || readAnyMac(GAN_MAC_CACHE_KEY), deviceName: this.device?.name });
		} else {
			// On native, watchAdvertisements won't work; skip the manual prompt entirely.
			if (isNative()) {
				macAddress = null;
			} else {
				// If the browser exposes watchAdvertisements the MAC is auto-resolved; only ask
				// manually when it's unavailable.
				macAddress = this.adapter.watchAdvertisements
					? null
					: await requestMacFromUser({ defaultMac: cachedMac, deviceName: this.device?.name });
			}
		}

		if (macAddress) {
			// Already normalized by the modal. Persisted only after the cube confirms.
			return macAddress;
		}
		return macAddress;
	};

	/**
	 * Connect to GAN cube using the already-selected BleDevice
	 */
	connectWithExistingDevice = async (device, macAddressProvider) => {
		// Only the silent MAC sources are consulted here. The prompt (the `true` fallback
		// call) is deliberately held back until the generation is known: a Gen1 cube needs
		// no MAC at all — it derives its key from its own hardware characteristic — and the
		// generation cannot be read before the link is up. Asking first would put a MAC
		// dialog in front of every first-generation user for nothing.
		let mac =
			(macAddressProvider && (await macAddressProvider(device, false))) ||
			(await autoRetrieveMacAddress(this.adapter, device));

		// Connect via adapter and get device primary services
		await this.adapter.connect(device, () => {
			// onDisconnect callback
			if (this.conn) {
				this.conn.onDisconnect();
			}
		});
		const services = await this.adapter.getServices(device);
		const hasService = (uuid) => services.some((s) => s.toLowerCase() === uuid);

		// Logged because the generation is now resolved by priority rather than by whichever
		// service the adapter listed first. If a cube turns out to expose both its own
		// generation's service and Gen1's fff0, this line is where that shows up.
		console.log('[BLE-GAN] services advertised by', device.name, ':', services);

		// Fixed priority, not "first service the adapter happens to list". Gen4's command and
		// state characteristics are the plain 16-bit fff5/fff6, the same UUIDs Gen1 uses, so
		// only the service tells them apart — and a Gen4 cube that also exposes fff0 would be
		// mistaken for a Gen1 under an order-dependent scan. Gen1 is therefore tested last,
		// and only when both of its services are present (cstimer applies the same rule).
		if (hasService(GAN_GEN1_DATA_SERVICE) && hasService(GAN_GEN1_META_SERVICE)
			&& !hasService(GAN_GEN2_SERVICE) && !hasService(GAN_GEN3_SERVICE) && !hasService(GAN_GEN4_SERVICE)) {
			console.log('[ZKT:GAN-V1] first-generation cube detected, no MAC needed');
			return GanCubeV1PollingConnection.create(this.adapter, device, new GanGen1ProtocolDriver());
		}

		// Every other generation salts its key with the MAC, so it is worth asking for now.
		if (!mac && macAddressProvider) {
			mac = await macAddressProvider(device, true);
		}
		if (!mac) {
			throw new Error('Unable to determine cube MAC address, connection is not possible!');
		}
		device.mac = mac;

		// Create encryption salt from MAC address bytes placed in reverse order
		const salt = new Uint8Array(
			device.mac
				.split(/[:-\s]+/)
				.map((c) => parseInt(c, 16))
				.reverse()
		);

		// Resolve type of connected cube device and setup appropriate encryption / protocol driver
		if (hasService(GAN_GEN2_SERVICE)) {
			const key = device.name?.startsWith('AiCube') ? GAN_ENCRYPTION_KEYS[1] : GAN_ENCRYPTION_KEYS[0];
			const encrypter = new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
			const driver = new GanGen2ProtocolDriver();
			console.log('[BLE-GAN] generation resolved: Gen2');
			return GanCubeClassicConnection.create(this.adapter, device, GAN_GEN2_SERVICE, GAN_GEN2_COMMAND_CHARACTERISTIC, GAN_GEN2_STATE_CHARACTERISTIC, encrypter, driver, isValidGanGen2Packet);
		}
		if (hasService(GAN_GEN3_SERVICE)) {
			const key = GAN_ENCRYPTION_KEYS[0];
			const encrypter = new GanGen3CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
			const driver = new GanGen3ProtocolDriver();
			console.log('[BLE-GAN] generation resolved: Gen3');
			return GanCubeClassicConnection.create(this.adapter, device, GAN_GEN3_SERVICE, GAN_GEN3_COMMAND_CHARACTERISTIC, GAN_GEN3_STATE_CHARACTERISTIC, encrypter, driver, isValidGanGen3Packet);
		}
		if (hasService(GAN_GEN4_SERVICE)) {
			const key = GAN_ENCRYPTION_KEYS[0];
			const encrypter = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
			const driver = new GanGen4ProtocolDriver();
			console.log('[BLE-GAN] generation resolved: Gen4');
			return GanCubeClassicConnection.create(this.adapter, device, GAN_GEN4_SERVICE, GAN_GEN4_COMMAND_CHARACTERISTIC, GAN_GEN4_STATE_CHARACTERISTIC, encrypter, driver, isValidGanGen4Packet);
		}

		throw new Error("Can't find target BLE services - wrong or unsupported cube device model");
	};

	init = async () => {
		// Use the existing device instead of calling connectGanCube which triggers a new requestDevice
		this.conn = await this.connectWithExistingDevice(this.device, async (device, isFallback) => {
			const mac = await this.customMacAddressProvider(device, isFallback);
			return mac;
		});

		// Treat the resolved MAC as unverified until the cube answers (see _confirmGanConnected).
		this._pendingMac = this.device?.mac || null;

		setTimerParams({ smartCubeConnectStep: 'paired' });

		this.conn.events$.subscribe(this.handleCubeEvent);

		// Gen1 polls rather than being notified, so its loop only starts once the subscriber
		// above exists (see GanCubeV1PollingConnection.start). No-op for every other
		// generation, which has nothing to start.
		if (typeof this.conn.start === 'function') {
			this.conn.start();
		}

		setTimerParams({ smartCubeConnectStep: 'reading_service' });

		await this.conn.sendCubeCommand({ type: 'REQUEST_BATTERY' });
		await this.conn.sendCubeCommand({ type: 'REQUEST_HARDWARE' });
		await this.conn.sendCubeCommand({ type: 'REQUEST_FACELETS' }); // Synchronize tracker with physical state

		// alertConnected is called after the HARDWARE event is received (handleCubeEvent).
		// If it never arrives within the timeout, the MAC is wrong / cube is asleep.
		this._startHandshakeWatchdog();
	};

	// Wrong MAC => packets never decrypt => no valid event. Tear the connection down,
	// drop the bad cached MAC, and surface a clear error.
	//
	// Race fix: a valid packet (HARDWARE/FACELETS/MOVE) can arrive during init's await chain,
	// i.e. BEFORE this runs, confirming the connection already. In that case arming the watchdog
	// at all is wrong — it would fire later with nothing left to cancel it. So bail if confirmed.
	_startHandshakeWatchdog = () => {
		if (this._connectionConfirmed) return;
		if (this._handshakeTimer) clearTimeout(this._handshakeTimer);
		this._handshakeTimer = setTimeout(() => {
			this._handshakeTimer = null;
			console.warn('[GAN] handshake timeout — wrong MAC or cube unresponsive');
			// Forget only this cube's entry; other cubes keep theirs.
			clearCachedMac(GAN_MAC_CACHE_KEY, cubeStorageId(this.device));
			try { this.adapter.disconnect(this.device); } catch (e) { /* ignore */ }
			this.alertScanError('wrong_mac');
		}, GAN_HANDSHAKE_TIMEOUT_MS);
	};

	// Called once the HARDWARE event arrives — proof the MAC is right. Persists the MAC
	// and stops the watchdog.
	_confirmGanConnected = () => {
		if (this._handshakeTimer) {
			clearTimeout(this._handshakeTimer);
			this._handshakeTimer = null;
		}
		if (this._pendingMac) {
			writeCachedMac(GAN_MAC_CACHE_KEY, cubeStorageId(this.device), this._pendingMac);
			this._pendingMac = null;
		}
	};

	// Confirm the connection on the FIRST valid protocol packet — HARDWARE, FACELETS, or MOVE.
	// GAN 12 UI Maglev (Gen4) firmware sometimes never emits the full 4-part HARDWARE bundle,
	// which left the 7s handshake watchdog tearing down a healthy connection ("Cihaz yanıt
	// vermedi / MAC yanlış" toast, drop after ~15s). Any decryptable packet already proves the
	// MAC is correct, so it is enough to confirm — cstimer likewise never gates on HARDWARE.
	_confirmConnectionOnce = () => {
		if (this._connectionConfirmed) return;
		this._connectionConfirmed = true;
		this._confirmGanConnected(); // stop watchdog + persist the verified MAC
		const deviceId = this.conn?.deviceMAC || this.device?.deviceId || 'unknown';
		const dummyServer = {
			device: {
				name: this.hardwareName || this.device?.name || 'GAN Cube',
				id: deviceId,
			},
		};
		this.alertConnected(dummyServer);
	};

	handleCubeEvent = (event) => {
		if (event.type == 'MOVE') {
			if (event.move) {
				// A decryptable MOVE proves the MAC is correct — confirm the connection.
				this._confirmConnectionOnce();
				// cubeTimestamp calibration: map cube internal clock to local time
				if (event.cubeTimestamp != null) {
					const localNow = Date.now();
					const newOffset = localNow - event.cubeTimestamp;
					const timerRunning = !!getStore().getState().timer.timeStartedAt;

					if (this._cubeTimeOffset === null) {
						this._cubeTimeOffset = newOffset;
					} else if (!timerRunning) {
						// Update offset during solve — prevent drift
						const diff = Math.abs(newOffset - this._cubeTimeOffset);
						if (diff > 2000) {
							this._cubeTimeOffset = newOffset;
							this._skewSamples = []; // Reset samples on large jump
						} else {
							this._cubeTimeOffset = this._cubeTimeOffset * 0.9 + newOffset * 0.1;
						}

						// Clock skew calculation: collect (local, cube) pairs from pre-solve moves
						this._skewSamples.push({ local: localNow, cube: event.cubeTimestamp });
						if (this._skewSamples.length > this._SKEW_WINDOW) {
							this._skewSamples.shift();
						}
						if (this._skewSamples.length >= 10) {
							// Normalize: prevent floating-point precision loss at large timestamps
							// Date.now() ~1.77e12, causes catastrophic cancellation in ΣX² in linregress
							const baseLocal = this._skewSamples[0].local;
							const baseCube = this._skewSamples[0].cube;
							const locals = this._skewSamples.map(s => s.local - baseLocal);
							const cubes = this._skewSamples.map(s => s.cube - baseCube);
							const [slope] = linregress(locals, cubes);
							const skew = Math.round((slope - 1) * 100000) / 1000; // e.g. -0.719
							setSmartCubeClockSkew(skew);
						}
					}
					// If timerRunning === true, freeze offset — BLE latency variation doesn't leak into completedAt
				}

				// Calculate calibrated timestamp
				const moveTimestamp = (event.cubeTimestamp != null && this._cubeTimeOffset !== null)
					? event.cubeTimestamp + this._cubeTimeOffset
					: Date.now();

				// A move at or below the serial of the state the tracker was last set from is
				// already part of that state. That happens when a solved state is published while
				// a recovery is still pending (FACELETS branch below), and when an in-flight move
				// lands just after the facelets packet that already counted it. Applying it again
				// left the tracker a turn ahead of the cube in the user's hands. The move still
				// goes to the app, marked stale: a solve in progress needs it in its move log, and
				// the engine skips it everywhere else.
				const stale = this._isStaleSerial(event.serial);
				if (!stale) {
					this._publishedSerial = null;
					this._trackerCube.move(event.move);
				}

				// Synchronous solved check: freeze timer display without waiting for React render.
				// A recovered stale move carries the recovery moment, not the turn's, so it must
				// not move the freeze point.
				const solvedState = getStore().getState().smartCube?.smartSolvedState;
				if (stale && event.recovered === true) {
					// Leave the freeze point as it is.
				} else if (solvedState && this._trackerCube.asString() === solvedState) {
					// Clock skew corrected freeze: display = record = GAN reference
					// This prevents "jump forward then back" effect
					const timerState = getStore().getState().timer;
					const tsaMs = timerState.timeStartedAt?.getTime();
					if (tsaMs) {
						const rawDiff = moveTimestamp - tsaMs;
						const skew = getSmartCubeClockSkew();
						const slope = (skew !== 0) ? (1 + skew / 100) : 1;
						setSmartSolveEndTime(tsaMs + rawDiff / slope);
					} else {
						setSmartSolveEndTime(moveTimestamp);
					}
				} else {
					setSmartSolveEndTime(null);
				}

				// NOTE: Driver now performs gap recovery internally (moveBuffer + requestMoveHistory).
				// Only gap-free, sequential MOVE events reach here. Holding mode unnecessary.

				// Add to queue
				this.moveQueue.push({
					move: event.move,
					timestamp: moveTimestamp,
					cubeTimestamp: event.cubeTimestamp ?? null,
					localTimestamp: event.localTimestamp ?? null,
					recovered: event.recovered === true,
					stale,
				});

				// Debounced flush
				if (this.moveFlushTimeout) {
					clearTimeout(this.moveFlushTimeout);
				}
				this.moveFlushTimeout = setTimeout(
					() => this.flushMoveQueue(),
					this.BATCH_FLUSH_DELAY
				);

				// Silence detector: request FACELETS after last move (solution detection safety)
				if (this._silenceTimeoutId) clearTimeout(this._silenceTimeoutId);
				if (this._silenceRetryId) clearTimeout(this._silenceRetryId);
				this._silenceTimeoutId = setTimeout(() => {
					this.requestFaceletsResync();
					this._silenceRetryId = setTimeout(() => {
						this.requestFaceletsResync(true);
					}, 1500);
				}, this._SILENCE_TIMEOUT);
			}

		// NOTE: SERIAL_GAP is now handled internally by the driver.
		// Driver uses moveBuffer + requestMoveHistory for gap recovery.
		// Consumer receives only gap-free MOVE events.

		} else if (event.type == 'FACELETS') {
			// A valid FACELETS state confirms the connection (Gen4 may never send full
			// HARDWARE). True even when the state itself is held back below.
			this._confirmConnectionOnce();

			// The driver is still waiting on a move-history reply, so this state already
			// contains turns the app has not been handed yet. Adopting it would look like
			// the user's scramble progress vanished, and the recovered moves would then be
			// replayed on top of a state that already includes them — the tracker ends up a
			// move or two ahead of the cube in the user's hands. Hold it back; the driver
			// publishes again once the gap closes, or writes it off after a timeout.
			//
			// A solved cube is the one state never worth holding back: it is what stops the
			// timer, and waiting out the recovery window would add that delay straight onto
			// the recorded time. The matcher is what needs shielding from a half-delivered
			// stream, and it is not running once a solve is under way.
			const solvedState = getStore().getState().smartCube?.smartSolvedState || SOLVED_FACELETS;
			if (event.pendingGap && event.facelets !== solvedState) {
				// Ask again shortly. Each answer gives the driver another chance to request the
				// missing moves and, once a request had time to come back, to write the gap off.
				// Without it a user who paused right after a lost packet waited 1.7 s for the
				// silence detector's only retry, and the scramble display froze meanwhile.
				this._scheduleGapResync();
				return;
			}

			// Publish any queued moves BEFORE this state. The state we are about to
			// report already contains them, so letting it go first would make those
			// moves look like they came afterwards — that is exactly how the last
			// scramble move ended up being treated as the first solve move.
			if (this.moveQueue.length) {
				this.flushMoveQueue();
			}

			// Synchronize tracker with physical state
			try {
				this._trackerCube = Cube.fromString(event.facelets);
				this._publishedSerial = typeof event.serial === 'number' ? event.serial : null;
			} catch (e) {
				console.error('[ZKT:GAN] FACELETS parse error:', e?.message);
			}

			// Report to Redux (safety net for SmartCube.tsx)
			this.alertCubeState(event.facelets);
		} else if (event.type == 'GYRO') {
			// Process gyroscope data
			if (event.quaternion) {
				// Old Redux dispatch - CAUSES LAG
				// this.alertGyroData(event.quaternion, event.velocity);

				// Direct Subscription - FAST
				this.gyroListeners.forEach((listener) => listener(event));
			}
		} else if (event.type == 'HARDWARE') {
			this.hardwareName = event.hardwareName;
			this.hardwareVersion = event.hardwareVersion;
			this.softwareVersion = event.softwareVersion;
			this.productDate = event.productDate;
			this.gyroSupported = event.gyroSupported;
			// Report gyroscope support status
			this.alertGyroSupported(event.gyroSupported);

			// Confirm with full hardware info when it arrives (Gen2/Gen3 always send it).
			this._confirmConnectionOnce();
		} else if (event.type == 'BATTERY') {
			this.alertBatteryLevel(event.batteryLevel);
		} else if (event.type == 'BUFFER_OVERFLOW') {
			// Gen4 move buffer overflowed (serial-wrap gap). Recover in place — pull a fresh
			// FACELETS state instead of dropping the connection.
			this.requestFaceletsResync(true);
		} else if (event.type == 'DISCONNECT') {
			if (this._handshakeTimer) {
				clearTimeout(this._handshakeTimer);
				this._handshakeTimer = null;
			}
			this.alertDisconnected();
		}
	};

	flushMoveQueue = () => {
		if (this.moveQueue.length === 0) return;

		// Copy batch and clear queue
		const batch = [...this.moveQueue];
		this.moveQueue = [];
		if (this.moveFlushTimeout) {
			clearTimeout(this.moveFlushTimeout);
			this.moveFlushTimeout = null;
		}

		// Send moves AND the resulting cube state in one dispatch. The tracker already
		// has these moves applied, so consumers never see a state that disagrees with
		// the move list.
		this.alertTurnCubeBatch(batch, this._trackerCube.asString());
	};

	/** Is a move with this serial already counted in the last adopted FACELETS state? */
	_isStaleSerial = (serial) => {
		if (this._publishedSerial == null || typeof serial !== 'number') return false;
		// Serials wrap at 256; "at or below" means within the half window behind it.
		return ((this._publishedSerial - serial) & 0xff) < 128;
	};

	_scheduleGapResync = () => {
		if (this._gapResyncId) return;
		this._gapResyncId = setTimeout(() => {
			this._gapResyncId = null;
			this.requestFaceletsResync(true);
		}, GAP_RESYNC_INTERVAL_MS);
	};

	// Tell the cube to treat its current physical position as solved. The cube tracks
	// its own state in firmware and never sees moves made while Bluetooth is off, so
	// after a reconnect it can insist on a state the cube in the user's hands left
	// long ago. Resetting app-side state alone does not survive: the next FACELETS
	// packet overwrites it with the cube's stale view.
	resetCubeState = async () => {
		if (!this.conn) return false;
		try {
			await this.conn.sendCubeCommand({ type: 'REQUEST_RESET' });
			this._trackerCube = new Cube();
			// The reset may restart the cube's serial counter; nothing before it is comparable.
			this._publishedSerial = null;
			// Pull a fresh state so Redux reflects the reset without waiting for the
			// cube's next periodic packet.
			setTimeout(() => this.requestFaceletsResync(true), 100);
			return true;
		} catch (e) {
			console.error('[ZKT:GAN] cube state reset failed:', e?.message);
			return false;
		}
	};

	requestFaceletsResync = async (force = false) => {
		if (this._resyncPending && !force) return;
		this._resyncPending = true;
		try {
			if (this.conn) {
				await this.conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
			}
		} catch (e) {
			// BLE write errors silently ignored
		} finally {
			setTimeout(() => { this._resyncPending = false; }, 100);
		}
	};

	disconnect = async () => {
		if (this._silenceTimeoutId) {
			clearTimeout(this._silenceTimeoutId);
			this._silenceTimeoutId = null;
		}
		if (this._silenceRetryId) {
			clearTimeout(this._silenceRetryId);
			this._silenceRetryId = null;
		}
		if (this._gapResyncId) {
			clearTimeout(this._gapResyncId);
			this._gapResyncId = null;
		}

		// Flush pending moves before disconnect
		if (this.moveFlushTimeout) {
			clearTimeout(this.moveFlushTimeout);
			this.flushMoveQueue();
		}

		// Reset tracker
		this._trackerCube = new Cube();
		this._publishedSerial = null;

		// Disconnect connection if exists
		if (this.conn) {
			try {
				await this.conn.disconnect();
			} catch (error) {
			}
		}
	};
}
