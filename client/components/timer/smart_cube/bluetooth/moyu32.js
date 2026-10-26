// MoYu WeiLong AI 2024 (WCU_MY3) BLE protocol port
// Reference: e:/Projects/Zkt-Timer/Reference/cstimer-master/src/js/hardware/moyu32cube.js (392 lines)
// 100% port: encryption (GAN Gen2/3 schema), MAC discovery, message parsing, time correction
//
// Extended from smartcube-web-bluetooth src/smartcube/protocols/moyu32.ts (Pau Oliva, MIT):
// the doubled start-up burst cheaper V10 AI boards need, the gyroscope, re-anchoring on every
// state packet, periodic battery reads, name-derived MAC candidates tried before asking the
// user, and the decrypted-packet sanity check that keeps a wrong MAC from confirming.
//
// State tracking: cubejs (used throughout the project) instead of cstimer mathlib.CubieCube
// AES + LZString project's ./ae128 + ./lz_string (API compatible with cstimer)

import SmartCube from './smart_cube';
import LZString from './lz_string';
import aes128 from './ae128';
import { setTimerParams } from '../../helpers/params';
import { requestMacFromUser } from '../mac_input/requestMacFromUser';
import { macFromNativeDeviceId } from '../../../../util/ble/native-mac';
import Cube from 'cubejs';
import { readCachedMac, readAnyMac, writeCachedMac, clearCachedMac, cubeStorageId } from './mac_cache';
import { expand2x2Facelets, isValid2x2Facelets, normalizeFacelets, Frame2x2 } from '../../../../util/smart_cube/cube2x2';
import { isMoyuMy22Name } from '../../../../../shared/smart_cube/puzzle';

const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const SERVICE_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb0';
const CHRT_UUID_READ = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const CHRT_UUID_WRITE = '0783b03e-7735-b5a0-1760-a305d2795cb2';

// cstimer KEYS — LZString compressed key/iv pairs
const KEYS = [
	'NoJgjANGYJwQrADgjEUAMBmKAWCP4JNIRswt81Yp5DztE1EB2AXSA',
	'NoRg7ANAzArNAc1IigFgqgTB9MCcE8cAbBCJpKgeaSAAxTSPxgC6QA',
];

// CICs 0x(01..=FF)00 — same as cstimer
const MOYU32_CIC_LIST = Array(255).fill(undefined).map((_, i) => (i + 1) << 8);

const MAC_CACHE_KEY = 'moyu32_cube_mac';

// Time to wait for the first real cube state after the initial requests. If the cube
// never answers with a valid facelet state the MAC is wrong (decryption is garbage),
// so we tear the connection down instead of faking a "connected" state.
const HANDSHAKE_TIMEOUT_MS = 7000;

// How long one name-derived MAC candidate gets before the next one is tried.
const MAC_PROBE_TIMEOUT_MS = 2000;

/** Opcode 172 with byte 2 set: start streaming orientation packets (msgType 171). */
const ENABLE_GYRO_PAYLOAD = [172, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/**
 * MAC addresses a WCU name points to, most likely first. The fourth byte differs per
 * hardware line; confirmed on real cubes (WCU_MY32_A388 = CF:30:16:00:A3:88,
 * WCU_MY33_AF9E = CF:30:16:02:AF:9E, the 2x2 WCU_MY22_1037 = CF:30:16:01:10:37).
 * From smartcube-web-bluetooth mac-candidates.ts.
 */
export function moyu32MacCandidatesFromName(deviceName) {
	const name = (deviceName || '').trim();
	const lines = [
		[/^WCU_MY32_([0-9A-Fa-f]{4})$/, ['00', '01', '02']],
		[/^WCU_MY33_([0-9A-Fa-f]{4})$/, ['02', '01', '00']],
		[/^WCU_MY22_([0-9A-Fa-f]{4})$/, ['01', '00', '02']],
	];
	for (const [pattern, mids] of lines) {
		const m = pattern.exec(name);
		if (m) {
			const t = m[1].toUpperCase();
			return mids.map((mid) => `CF:30:16:${mid}:${t.slice(0, 2)}:${t.slice(2, 4)}`);
		}
	}
	return [];
}

/**
 * Does this decrypted payload look like something a MoYu32 cube sends? A wrong MAC decrypts
 * to noise whose first byte is 163 one time in 256, and that used to be taken as the cube's
 * first state: the connection was confirmed, the wrong MAC cached, and the noise adopted as
 * the cube's position. Port of smartcube-web-bluetooth packet-sanity.ts.
 */
export function isValidMoyu32Packet(bytes) {
	if (!bytes || bytes.length < 20) return false;
	let zeros = 0;
	let ffs = 0;
	for (let i = 0; i < 20; i++) {
		if (bytes[i] === 0) zeros++;
		else if (bytes[i] === 255) ffs++;
	}
	if (zeros > 14 || ffs > 14 || new Set(bytes.slice(0, 20)).size > 18) return false;
	let bits = '';
	for (let i = 0; i < bytes.length; i++) bits += (bytes[i] + 256).toString(2).slice(1);
	if (bits.length < 160) return false;
	const type = parseInt(bits.slice(0, 8), 2);
	if (![161, 163, 164, 165, 171].includes(type)) return false;
	if (type === 164 && parseInt(bits.slice(8, 16), 2) > 100) return false;
	if (type === 161) {
		for (let k = 0; k < 8; k++) {
			const v = parseInt(bits.slice(8 + 8 * k, 16 + 8 * k), 2);
			if (v !== 0 && (v < 32 || v > 126)) return false;
		}
	}
	if (type === 165) {
		let codes = 0;
		for (let j = 0; j < 5; j++) {
			const v = parseInt(bits.slice(96 + 5 * j, 101 + 5 * j), 2);
			if (v <= 11) codes++;
			else if (v < 31) return false;
		}
		if (codes === 0) return false;
		let allZero = true;
		let allMax = true;
		for (let r = 0; r < codes; r++) {
			const v = parseInt(bits.slice(8 + 16 * r, 24 + 16 * r), 2);
			if (v !== 0) allZero = false;
			if (v !== 65535) allMax = false;
		}
		if (allZero || allMax) return false;
	}
	if (type === 163) {
		const body = bits.slice(8, 152);
		const ones = (body.match(/1/g) || []).length;
		if (ones > 0.9 * body.length || body.length - ones > 0.9 * body.length) return false;
	}
	return true;
}

function valuedArray(n, val) {
	const arr = [];
	for (let i = 0; i < n; i++) {
		arr.push(typeof val === 'function' ? val(i) : val);
	}
	return arr;
}

export default class MoYu32 extends SmartCube {
	device;
	adapter;

	static SERVICE_UUID = SERVICE_UUID;
	static opServices = [SERVICE_UUID];
	static cics = MOYU32_CIC_LIST;

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;

		// cstimer module-state equivalents
		this.deviceName = device.name?.trim() || '';
		this.deviceMac = null;
		this.decoder = null;

		// The Weipo V5 AI (WCU_MY22) is a 2x2 on this protocol: four stickers a face in the
		// state packet, six 3-bit turns (F, U, R only) in the move packet. Port of
		// smartcube-web-bluetooth moyu32.ts `cubeSize === 2`.
		this.puzzle = isMoyuMy22Name(this.deviceName) ? '222' : '333';
		this.frame = this.puzzle === '222' ? new Frame2x2() : null;
		// 2x2 only: counter of the state the tracker holds. A requested state can overtake
		// the turn notification it already contains, so it is kept apart from prevMoveCnt.
		this.stateMoveCnt = -1;

		this.prevMoves = [];
		this.timeOffs = [];
		this.prevCube = Cube.fromString(SOLVED_FACELET);
		this.curCube = Cube.fromString(SOLVED_FACELET);
		this.latestFacelet = SOLVED_FACELET;
		this.deviceTime = 0;
		this.deviceTimeOffset = 0;
		this.moveCnt = -1;
		this.prevMoveCnt = -1;
		this.batteryLevel = 0;

		// Handshake confirmation state — connection is only "real" once the cube
		// answers with a valid state packet (proves the MAC is correct).
		this._connected = false;
		this._handshakeTimer = null;
		this._pendingMac = null;
		// Orientation packets are only switched on once someone wants them (see subscribeGyro).
		this._gyroEnabled = false;
	}

	subscribeGyro = (callback) => this._addGyroListener(callback);

	// Called by the base class whenever a gyro listener comes or goes. The cube has no
	// documented "off" command, so the stream is switched on with the first listener and left.
	_onGyroSubscribersChanged = (count) => {
		if (count === 0 || this._gyroEnabled || !this.decoder || !this._connected) return;
		this._gyroEnabled = true;
		this.sendRequest(ENABLE_GYRO_PAYLOAD.slice())
			.then(() => this.requestCubeStatus())
			.catch(() => { this._gyroEnabled = false; });
	};

	// Polled by the connection manager while a page shows the cube (cstimer getBatteryLevel).
	// Without it the level was read once at connect and never again.
	updateBattery = () => this.requestCubePower();

	// cstimer getKeyAndIv() — 1:1 port
	getKeyAndIv(value) {
		const key = JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[0]));
		const iv = JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[1]));
		for (let i = 0; i < 6; i++) {
			key[i] = (key[i] + value[5 - i]) % 255;
			iv[i] = (iv[i] + value[5 - i]) % 255;
		}
		return [key, iv];
	}

	// cstimer initDecoder() — 1:1 port
	initDecoder(mac) {
		const value = [];
		for (let i = 0; i < 6; i++) {
			value.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
		}
		const keyiv = this.getKeyAndIv(value);
		this.decoder = aes128(keyiv[0]);
		this.decoder.iv = keyiv[1];
	}

	// cstimer decode() — 1:1 port
	decode(value) {
		const ret = [];
		for (let i = 0; i < value.byteLength; i++) {
			ret[i] = value.getUint8(i);
		}
		if (this.decoder == null) {
			return ret;
		}
		const iv = this.decoder.iv || [];
		if (ret.length > 16) {
			const offset = ret.length - 16;
			const block = this.decoder.decrypt(ret.slice(offset));
			for (let i = 0; i < 16; i++) {
				ret[i + offset] = block[i] ^ (~~iv[i]);
			}
		}
		this.decoder.decrypt(ret);
		for (let i = 0; i < 16; i++) {
			ret[i] ^= (~~iv[i]);
		}
		return ret;
	}

	// cstimer encode() — 1:1 port
	encode(ret) {
		if (this.decoder == null) {
			return ret;
		}
		const iv = this.decoder.iv || [];
		for (let i = 0; i < 16; i++) {
			ret[i] ^= ~~iv[i];
		}
		this.decoder.encrypt(ret);
		if (ret.length > 16) {
			const offset = ret.length - 16;
			const block = ret.slice(offset);
			for (let i = 0; i < 16; i++) {
				block[i] ^= ~~iv[i];
			}
			this.decoder.encrypt(block);
			for (let i = 0; i < 16; i++) {
				ret[i + offset] = block[i];
			}
		}
		return ret;
	}

	async sendRequest(req) {
		const encodedReq = this.encode(req.slice());
		console.log('[Moyu32] sendRequest', req, encodedReq);
		return this.adapter.writeCharacteristic(
			this.device,
			SERVICE_UUID,
			CHRT_UUID_WRITE,
			new Uint8Array(encodedReq).buffer
		);
	}

	sendSimpleRequest(opcode) {
		const req = valuedArray(20, 0);
		req[0] = opcode;
		return this.sendRequest(req);
	}

	requestCubeInfo() { return this.sendSimpleRequest(161); }
	requestCubeStatus() { return this.sendSimpleRequest(163); }
	requestCubePower() { return this.sendSimpleRequest(164); }

	// MAC discovery without asking anyone: 0) native deviceId (Android), 1) manufacturer
	// data, 2) cache. Null when none of them knows. Name candidates and the prompt are init's.
	async resolveMac() {
		// 0) Capacitor Android: deviceId IS the BLE MAC address — the most reliable source.
		// Manufacturer-data scans are unreliable on Android (issue #235), so without this the
		// name-default guess is used. iOS/web return null here.
		const nativeMac = macFromNativeDeviceId(this.device.deviceId);
		if (nativeMac) {
			return nativeMac;
		}

		// 1) Automatic MAC from manufacturer data
		if (this.adapter.watchAdvertisements) {
			try {
				const mfData = await this.adapter.watchAdvertisements(this.device);
				if (mfData) {
					let dataView = null;
					if (mfData instanceof DataView) {
						dataView = new DataView(mfData.buffer.slice(2));
					} else {
						// Every company id the advertisement carries, not only the 0x__00 ones
						// cstimer lists: smartcube-web-bluetooth reads whichever is present.
						const ids = [...MOYU32_CIC_LIST.filter((id) => mfData.has(id)), ...mfData.keys()];
						for (const id of ids) {
							const candidate = mfData.get(id);
							if (candidate && candidate.byteLength >= 6) {
								console.log('[Moyu32] CIC found: 0x' + id.toString(16).padStart(4, '0'));
								dataView = candidate;
								break;
							}
						}
					}
					if (dataView && dataView.byteLength >= 6) {
						const mac = [];
						for (let i = 0; i < 6; i++) {
							mac.push((dataView.getUint8(dataView.byteLength - i - 1) + 0x100).toString(16).slice(1));
						}
						const macStr = mac.join(':').toUpperCase();
						console.log('[Moyu32] MAC auto-discovered:', macStr);
						return macStr;
					}
				}
			} catch (e) {
				console.warn('[Moyu32] watchAdvertisements error:', e);
			}
		}

		// 2) Cache. Keyed by device: one shared entry per brand meant a second cube of the
		// same brand always started with the first one's MAC and failed.
		return readCachedMac(MAC_CACHE_KEY, cubeStorageId(this.device)) || null;
	}

	/**
	 * The start-up requests. Some MoYu32 boards (the cheaper V10 AI) only begin sending state
	 * once they have received this burst twice (smartcube-web-bluetooth 2026-04-17).
	 */
	async sendInitBurst() {
		for (let round = 0; round < 2; round++) {
			await this.requestCubeInfo();
			await this.requestCubeStatus();
			await this.requestCubePower();
		}
	}

	/**
	 * Try each MAC the advertised name points to: decrypt with it, send the start-up burst,
	 * and see whether a plausible state comes back. Returns the MAC that worked, or null.
	 * Before this the name-derived guess was only the prompt's default, and only for MY32.
	 */
	async probeNameCandidates() {
		for (const mac of moyu32MacCandidatesFromName(this.deviceName)) {
			this.initDecoder(mac);
			this.deviceMac = mac;
			this._pendingMac = mac;
			try {
				await this.sendInitBurst();
			} catch (e) {
				continue;
			}
			const deadline = Date.now() + MAC_PROBE_TIMEOUT_MS;
			while (!this._connected && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 100));
			}
			if (this._connected) return mac;
		}
		return null;
	}

	async init() {
		console.log('[Moyu32] init started, device:', this.deviceName);

		await this.adapter.connect(this.device, () => {
			console.log('[Moyu32] disconnect');
			if (this._handshakeTimer) {
				clearTimeout(this._handshakeTimer);
				this._handshakeTimer = null;
			}
			this.alertDisconnected();
		});

		setTimerParams({ smartCubeConnectStep: 'paired' });

		// Start notification
		await this.adapter.startNotifications(
			this.device,
			SERVICE_UUID,
			CHRT_UUID_READ,
			(value) => this.onStateChanged(value)
		);

		setTimerParams({ smartCubeConnectStep: 'reading_service' });

		// Get MAC
		this.deviceMac = await this.resolveMac();
		if (!this.deviceMac) {
			// No source knew it: try the addresses the name points to before asking the user.
			if (await this.probeNameCandidates()) return;
			// Ask the user via modal. Returns a normalized MAC or null (cancelled).
			// Not persisted here — cached only after the cube proves it's correct (_confirmConnected).
			this.decoder = null;
			const candidates = moyu32MacCandidatesFromName(this.deviceName);
			this.deviceMac = await requestMacFromUser({
				defaultMac: candidates[0] || readAnyMac(MAC_CACHE_KEY),
				deviceName: this.deviceName,
			});
		}
		if (!this.deviceMac) {
			throw new Error('[Moyu32] Could not obtain MAC address, connection not possible');
		}
		console.log('[Moyu32] MAC in use:', this.deviceMac);
		this.initDecoder(this.deviceMac);
		// Treat the MAC as unverified until the cube answers (see _confirmConnected).
		this._pendingMac = this.deviceMac;

		// Same initial request order as cstimer: info -> status -> power, sent twice.
		// We do NOT mark the connection as established here — alertConnected fires
		// only when the first valid state packet arrives (see initCubeState).
		await this.sendInitBurst();
		this._startHandshakeWatchdog();
	}

	// Wrong MAC => decryption is garbage => no valid state packet ever arrives. Tear the
	// connection down, drop the bad cached MAC, and surface a clear error.
	_startHandshakeWatchdog() {
		if (this._handshakeTimer) clearTimeout(this._handshakeTimer);
		this._handshakeTimer = setTimeout(() => {
			this._handshakeTimer = null;
			if (this._connected) return;
			console.warn('[Moyu32] handshake timeout — wrong MAC or cube unresponsive');
			// Forget only this cube's entry; other cubes keep theirs.
			clearCachedMac(MAC_CACHE_KEY, cubeStorageId(this.device));
			try { this.adapter.disconnect(this.device); } catch (e) { /* ignore */ }
			this.alertScanError('wrong_mac');
		}, HANDSHAKE_TIMEOUT_MS);
	}

	// Called on the first valid cube state — proof the MAC is right.
	_confirmConnected() {
		if (this._connected) return;
		this._connected = true;
		if (this._handshakeTimer) {
			clearTimeout(this._handshakeTimer);
			this._handshakeTimer = null;
		}
		if (this._pendingMac) {
			writeCachedMac(MAC_CACHE_KEY, cubeStorageId(this.device), this._pendingMac);
		}
		this.alertConnected({
			device: {
				name: this.device.name,
				id: this.device.deviceId,
			},
		});
		// Gyro-less until orientation packets say otherwise (after subscribeGyro enables them).
		if (!this._gyroSeen) this.alertGyroSupported(false);
		// A page may have subscribed before the MAC was proven; switch the stream on now.
		this._onGyroSubscribersChanged(this._gyroListeners.length);
	}

	onStateChanged(value) {
		if (this.decoder == null) {
			return;
		}
		this.parseData(value);
	}

	initCubeState() {
		console.log('[Moyu32] initialising cube state, facelet:', this.latestFacelet);
		// First valid state means the MAC decrypted correctly — confirm the connection.
		this._confirmConnected();
		this.alertCubeState(this.latestFacelet);
		this.prevCube = Cube.fromString(this.latestFacelet);
		this.prevMoveCnt = this.moveCnt;
	}

	// cstimer parseData() — 1:1 port, plus gyro and re-anchoring (see the file header)
	parseData(value) {
		const locTime = Date.now();
		let decoded = this.decode(value);

		// Until the cube has proven the MAC, only a state packet that looks like real cube data
		// counts: anything else decrypted with a wrong key is noise (a bogus battery level, a
		// bogus orientation), and the first real state is what confirms the connection anyway.
		if (!this._connected && (decoded[0] !== 163 || !isValidMoyu32Packet(decoded))) {
			return;
		}

		if ((decoded[0] | 0) === 171) {
			this.parseGyroData(decoded, locTime);
			return;
		}

		// cstimer's bit-string conversion
		const bits = [];
		for (let i = 0; i < decoded.length; i++) {
			bits.push((decoded[i] + 256).toString(2).slice(1));
		}
		const bitStr = bits.join('');

		const msgType = parseInt(bitStr.slice(0, 8), 2);

		if (msgType === 161) { // info
			console.log('[Moyu32] hardware info event', bitStr);
			let devName = '';
			for (let i = 0; i < 8; i++) {
				devName += String.fromCharCode(parseInt(bitStr.slice(8 + i * 8, 16 + i * 8), 2));
			}
			const hardwareVersion = parseInt(bitStr.slice(88, 96), 2) + '.' + parseInt(bitStr.slice(96, 104), 2);
			const softwareVersion = parseInt(bitStr.slice(72, 80), 2) + '.' + parseInt(bitStr.slice(80, 88), 2);
			console.log('[Moyu32] HW Version:', hardwareVersion, '| SW Version:', softwareVersion, '| Device:', devName);
		} else if (msgType === 163) { // state (facelets)
			if (this.frame) {
				this.parseState2x2(bitStr);
				return;
			}
			const moveCnt = parseInt(bitStr.slice(152, 160), 2);
			const facelet = this.parseFacelet(bitStr.slice(8, 152));
			if (this.prevMoveCnt === -1) { // initial state
				this.moveCnt = moveCnt;
				this.latestFacelet = facelet;
				this.initCubeState();
				return;
			}
			// Every later state re-anchors the tracker and the move counter, as
			// smartcube-web-bluetooth does. cstimer ignored them, so a burst that lost more
			// moves than the history holds left the tracker wrong for the rest of the session.
			let cube;
			try {
				cube = Cube.fromString(facelet);
			} catch (e) {
				return;
			}
			this.moveCnt = moveCnt;
			this.prevMoveCnt = moveCnt;
			this.latestFacelet = facelet;
			this.prevCube = cube;
			this.alertCubeState(facelet);
		} else if (msgType === 164) { // battery
			this.batteryLevel = parseInt(bitStr.slice(8, 16), 2);
			console.log('[Moyu32] battery:', this.batteryLevel);
			this.alertBatteryLevel(this.batteryLevel);
		} else if (msgType === 165) { // move
			if (this.frame) {
				this.parseMoves2x2(bitStr, locTime);
				return;
			}
			this.moveCnt = parseInt(bitStr.slice(88, 96), 2);
			if (this.moveCnt === this.prevMoveCnt || this.prevMoveCnt === -1) {
				return;
			}
			this.timeOffs = [];
			this.prevMoves = [];
			let invalidMove = false;
			for (let i = 0; i < 5; i++) {
				const m = parseInt(bitStr.slice(96 + i * 5, 101 + i * 5), 2);
				this.timeOffs[i] = parseInt(bitStr.slice(8 + i * 16, 24 + i * 16), 2);
				this.prevMoves[i] = 'FBUDLR'.charAt(m >> 1) + " '".charAt(m & 1);
				if (m >= 12) {
					this.prevMoves[i] = 'U ';
					invalidMove = true;
				}
			}
			if (!invalidMove) {
				this.updateMoveTimes(locTime);
			}
		}
	}

	/**
	 * MY22 state packet: four stickers a face (72 bits from bit 8), the move counter right after.
	 * Unlike the 3x3, a later state does not move prevMoveCnt: a state the app asked for can
	 * arrive before the turn notifications it already contains, and those must still be read.
	 */
	parseState2x2(bitStr) {
		const moveCnt = parseInt(bitStr.slice(80, 88), 2);
		const facelets = expand2x2Facelets(this.parseFacelet2x2(bitStr.slice(8, 80)));
		if (!isValid2x2Facelets(facelets)) return;
		const state = this.frame.adopt(facelets);
		this.moveCnt = moveCnt;
		this.stateMoveCnt = moveCnt;
		this.latestFacelet = state;
		if (this.prevMoveCnt === -1) {
			this.initCubeState();
			return;
		}
		this.prevCube = Cube.fromString(state);
		this.alertCubeState(state);
	}

	/**
	 * MY22 move packet: six 16-bit time offsets, the counter at bit 104, then six 3-bit turns,
	 * latest first. 0/1 = F/F', 2/3 = U/U', 4/5 = R/R' (smartcube-web-bluetooth, confirmed on
	 * a capture of R R' U U' F F'); a slot the packet does not advance over may hold 7.
	 */
	parseMoves2x2(bitStr, locTime) {
		this.moveCnt = parseInt(bitStr.slice(104, 112), 2);
		if (this.moveCnt === this.prevMoveCnt || this.prevMoveCnt === -1) return;
		const advance = (this.moveCnt - this.prevMoveCnt) & 0xff;
		// An old notification arriving late; replaying it would run most of a counter cycle.
		if (advance >= 128) return;
		const codes = [];
		this.timeOffs = [];
		this.prevMoves = [];
		for (let i = 0; i < 6; i++) {
			codes[i] = parseInt(bitStr.slice(112 + i * 3, 115 + i * 3), 2);
			this.timeOffs[i] = parseInt(bitStr.slice(8 + i * 16, 24 + i * 16), 2);
			this.prevMoves[i] = 'FUR'.charAt(codes[i] >> 1) + " '".charAt(codes[i] & 1);
		}
		if (codes.some((code, i) => i < Math.min(advance, 6) && code >= 6)) return;
		this.updateMoveTimes(locTime);
	}

	/** MY22 sticker bits: twelve a face, no centre, faces in FBUDLR order on the wire. */
	parseFacelet2x2(faceletBits) {
		const state = [];
		const faces = [2, 5, 0, 3, 4, 1]; // parse in URFDLB order, from FBUDLR
		for (let i = 0; i < 6; i++) {
			const face = faceletBits.slice(faces[i] * 12, 12 + faces[i] * 12);
			for (let j = 0; j < 4; j++) {
				state.push('FBUDLR'.charAt(parseInt(face.slice(j * 3, 3 + j * 3), 2)));
			}
		}
		return state.join('');
	}

	/**
	 * Orientation packet (msgType 171): four little-endian int32 at 1, 5, 9, 13 scaled by
	 * 2^30, normalised. From smartcube-web-bluetooth moyu32.ts; cstimer had it disabled.
	 */
	parseGyroData(decoded, timestamp) {
		const dv = new DataView(Uint8Array.from(decoded).buffer);
		const scale = 1073741824;
		let w = dv.getInt32(1, true) / scale;
		let x = dv.getInt32(5, true) / scale;
		let y = dv.getInt32(9, true) / scale;
		let z = dv.getInt32(13, true) / scale;
		const len = Math.hypot(w, x, y, z);
		if (len > 0) {
			w /= len;
			x /= len;
			y /= len;
			z /= len;
		}
		this._emitGyro({ timestamp, quaternion: { x, y, z, w } });
	}

	// cstimer updateMoveTimes() — 1:1 port + adaptation to our Redux pipeline
	updateMoveTimes(locTime) {
		let moveDiff = (this.moveCnt - this.prevMoveCnt) & 0xff;
		if (moveDiff > 1) {
			console.log('[Moyu32] BLE event lost, moveDiff =', moveDiff);
		}
		this.prevMoveCnt = this.moveCnt;
		if (moveDiff > this.prevMoves.length) {
			// More moves happened than the packet's history holds. The rest cannot be replayed,
			// so ask for the cube's state and re-anchor on it (see the 163 branch).
			this.requestCubeStatus().catch(() => {});
			moveDiff = this.prevMoves.length;
		}
		let calcTs = this.deviceTime + this.deviceTimeOffset;
		for (let i = moveDiff - 1; i >= 0; i--) {
			calcTs += this.timeOffs[i];
		}
		if (!this.deviceTime || Math.abs(locTime - calcTs) > 2000) {
			console.log('[Moyu32] time adjust', locTime - calcTs, '@', locTime);
			this.deviceTime += locTime - calcTs;
		}

		// Batch moves together
		const batch = [];
		for (let i = moveDiff - 1; i >= 0; i--) {
			const moveRaw = this.prevMoves[i]; // example: "R " or "R'"
			let cubejsMove = moveRaw.replace(' ', ''); // " '" -> "'" / ""
			// 2x2: a turn the last state report already holds goes out marked stale and is not
			// applied a second time (smartcube-web-bluetooth `applyToState`).
			let stale = false;
			if (this.frame) {
				const serial = (this.moveCnt - i) & 0xff;
				const ahead = (serial - this.stateMoveCnt) & 0xff;
				stale = !(ahead > 0 && ahead < 128);
				cubejsMove = this.frame.move(cubejsMove, stale);
				if (!stale) this.stateMoveCnt = serial;
			}
			if (!stale) this.prevCube.move(cubejsMove);
			this.deviceTime += this.timeOffs[i];

			batch.push({
				turn: cubejsMove,
				cubeTimestamp: this.deviceTime,
				localTimestamp: i === 0 ? locTime : null,
				completedAt: this.deviceTime,
				...(stale ? { stale: true } : {}),
			});
			console.log('[Moyu32] move', moveRaw, 'tsOff:', this.timeOffs[i]);
		}
		this.deviceTimeOffset = locTime - this.deviceTime;

		// Push moves and the resulting cube state to Redux in ONE dispatch — two
		// dispatches let the state land before the moves that produced it.
		if (batch.length > 0) {
			this.alertTurnCubeBatch(batch, normalizeFacelets(this.prevCube.asString(), this.puzzle));
		}
	}

	// cstimer parseFacelet() — 1:1 port
	// Input: 144-bit string (24 bit / face, 6 faces) — face order FBUDLR
	parseFacelet(faceletBits) {
		const state = [];
		const faces = [2, 5, 0, 3, 4, 1]; // parse in URFDLB order, from FBUDLR
		for (let i = 0; i < 6; i++) {
			const face = faceletBits.slice(faces[i] * 24, 24 + faces[i] * 24);
			for (let j = 0; j < 8; j++) {
				state.push('FBUDLR'.charAt(parseInt(face.slice(j * 3, 3 + j * 3), 2)));
				if (j === 3) {
					state.push('FBUDLR'.charAt(faces[i]));
				}
			}
		}
		return state.join('');
	}
}
