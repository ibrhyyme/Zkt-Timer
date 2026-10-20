// QiYi Smart Cube (QY-QYSC) + QiYi Tornado V4 i (XMD-TornadoV4-i) BLE protocol port
// Reference: e:/Projects/Zkt-Timer/Reference/cstimer-master/src/js/hardware/qiyicube.js (271 lines)
// 100% port: AES-128 encryption, CRC16-MODBUS, MAC discovery, hello handshake, history move recovery
//
// Extended from smartcube-web-bluetooth src/smartcube/protocols/qiyi.ts (Pau Oliva, MIT):
// gyroscope packets, all 11 history slots, the cube's own "needs ACK" flag, the sync
// confirmation packet, and name-derived MAC candidates that are tried before asking the user.
//
// State tracking: cubejs instead of cstimer mathlib.CubieCube

import SmartCube from './smart_cube';
import LZString from './lz_string';
import aes128 from './ae128';
import Cube from 'cubejs';
import { setTimerParams } from '../../helpers/params';
import { requestMacFromUser } from '../mac_input/requestMacFromUser';
import { macFromNativeDeviceId } from '../../../../util/ble/native-mac';
import { readCachedMac, readAnyMac, writeCachedMac, clearCachedMac, cubeStorageId } from './mac_cache';

const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const SERVICE_UUID = '0000fff0' + UUID_SUFFIX;
const CHRCT_UUID_CUBE = '0000fff6' + UUID_SUFFIX;

// Same as cstimer — QiYi CIC list
const QIYI_CIC_LIST = [0x0504];

// cstimer KEYS — LZString compressed AES-128 key
const KEYS = ['NoDg7ANAjGkEwBYCc0xQnADAVgkzGAzHNAGyRTanQi5QIFyHrjQMQgsC6QA'];

const MAC_CACHE_KEY = 'qiyi_cube_mac';

// Time to wait for the first valid (CRC-passing) packet after the hello handshake.
// If nothing decrypts within this window the MAC is wrong (or the cube is asleep),
// so we tear the connection down instead of showing a fake "connected" state.
const HANDSHAKE_TIMEOUT_MS = 7000;

// How long one name-derived MAC candidate gets to answer before the next one is tried.
const MAC_PROBE_TIMEOUT_MS = 3000;
// The hello is repeated this often during a probe: a cube still waking up misses the first.
const MAC_PROBE_HELLO_INTERVAL_MS = 300;

/**
 * MAC addresses a QiYi cube's advertised name points to, most likely first. The vendor
 * prefix differs per line: CC:A2 for the A series, CC:A3 for the S series (some batches use
 * 00:01 in the middle), CC:A6 for the Tornado V4 i. Confirmed against real captures
 * (QY-QYSC-S-A0E6 = CC:A3:00:00:A0:E6, XMD-TornadoV4-i-034C = CC:A6:00:00:03:4C).
 * From smartcube-web-bluetooth src/smartcube/attachment/mac-candidates.ts.
 */
export function qiyiMacCandidatesFromName(deviceName) {
	const name = (deviceName || '').trim();
	const out = [];
	const a = /^QY-QYSC-A-([0-9A-Fa-f]{4})$/.exec(name);
	if (a) out.push(macWithTail('CC:A2:00:00', a[1]));
	const s = /^QY-QYSC-S-([0-9A-Fa-f]{4})$/.exec(name);
	if (s) out.push(macWithTail('CC:A3:00:00', s[1]), macWithTail('CC:A3:00:01', s[1]));
	const xmd = /^XMD-TornadoV4-i-([0-9A-Fa-f]{4})$/.exec(name);
	if (xmd) out.push(macWithTail('CC:A6:00:00', xmd[1]));
	// Any other single-letter series: cstimer's original guess.
	const other = /^QY-QYSC-.-([0-9A-Fa-f]{4})$/.exec(name);
	if (other && !out.length) out.push(macWithTail('CC:A3:00:00', other[1]));
	return out;
}

function macWithTail(head, tail) {
	const t = tail.toUpperCase();
	return `${head}:${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

/**
 * Every move a state-change packet carries: the primary one plus the 11 history slots
 * (bytes 36..90, 5 bytes each), oldest first, without empty (all 0xFF) slots or repeats.
 * cstimer walked the slots backwards and stopped at nine; a burst that lost more than
 * that came back short. From smartcube-web-bluetooth src/smartcube/protocols/qiyi.ts.
 */
export function qiyiStateChangeMoves(msg, headerTs) {
	const out = [[msg[34], headerTs]];
	for (let i = 0; i < 11; i++) {
		const off = 36 + 5 * i;
		if (off + 5 > msg.length) break;
		let empty = true;
		for (let j = 0; j < 5; j++) {
			if (msg[off + j] !== 0xff) {
				empty = false;
				break;
			}
		}
		if (empty) continue;
		out.push([msg[off + 4], readTimestamp(msg, off)]);
	}
	out.sort((x, y) => x[1] - y[1]);
	const seen = new Set();
	return out.filter(([code, ts]) => {
		const key = code + ',' + ts;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Big-endian uint32 at `off` (header timestamp at 3, history slots at 36 + 5i). */
function readTimestamp(msg, off) {
	return ((msg[off] << 24) | (msg[off + 1] << 16) | (msg[off + 2] << 8) | msg[off + 3]) >>> 0;
}

// cstimer crc16modbus() — 1:1 port
function crc16modbus(data) {
	let crc = 0xFFFF;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc & 0x1) > 0 ? (crc >> 1) ^ 0xa001 : crc >> 1;
		}
	}
	return crc;
}

export default class QiYi extends SmartCube {
	device;
	adapter;

	static SERVICE_UUID = SERVICE_UUID;
	static opServices = [SERVICE_UUID];
	static cics = QIYI_CIC_LIST;

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;

		this.deviceName = device.name?.trim() || '';
		this.deviceMac = null;
		this.decoder = null;

		this.curCube = Cube.fromString(SOLVED_FACELET);
		this.prevCube = Cube.fromString(SOLVED_FACELET);
		this.prevMoves = [];
		this.lastTs = 0;
		this.batteryLevel = 0;

		// Handshake confirmation state — connection is only "real" once the cube
		// answers with a packet that actually decrypts (proves the MAC is correct).
		this._connected = false;
		this._handshakeTimer = null;
		this._pendingMac = null;
	}

	// Gyro-equipped QiYi cubes (the Tornado V4 i streams it) send quaternion packets.
	subscribeGyro = (callback) => this._addGyroListener(callback);

	getDecoder() {
		if (!this.decoder) {
			this.decoder = aes128(JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[0])));
		}
		return this.decoder;
	}

	// cstimer sendMessage() — 1:1 port
	async sendMessage(content) {
		const msg = [0xfe];
		msg.push(4 + content.length); // length = 1 (op) + cont.length + 2 (crc)
		for (let i = 0; i < content.length; i++) {
			msg.push(content[i]);
		}
		const crc = crc16modbus(msg);
		msg.push(crc & 0xff, crc >> 8);
		const npad = (16 - msg.length % 16) % 16;
		for (let i = 0; i < npad; i++) {
			msg.push(0);
		}
		const encMsg = [];
		const decoder = this.getDecoder();
		for (let i = 0; i < msg.length; i += 16) {
			const block = msg.slice(i, i + 16);
			decoder.encrypt(block);
			for (let j = 0; j < 16; j++) {
				encMsg[i + j] = block[j];
			}
		}
		return this.adapter.writeCharacteristic(
			this.device,
			SERVICE_UUID,
			CHRCT_UUID_CUBE,
			new Uint8Array(encMsg).buffer
		);
	}

	// cstimer sendHello() — 1:1 port
	async sendHello(mac) {
		if (!mac) {
			throw new Error('[qiyi] empty mac');
		}
		const content = [0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00];
		for (let i = 5; i >= 0; i--) {
			content.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
		}
		return this.sendMessage(content);
	}

	// MAC discovery without asking anyone: 0) native deviceId (Android), 1) manufacturer
	// data, 2) cache. Null when none of them knows. Name candidates and the prompt are init's.
	async resolveMac() {
		// 0) Capacitor Android: deviceId IS the BLE MAC address — the most reliable source.
		// Manufacturer-data scans are unreliable on Android (issue #235), so without this the
		// name-default guess is used and is wrong on V2 hardware. iOS/web return null here.
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
						for (const id of QIYI_CIC_LIST) {
							if (mfData.has(id)) {
								dataView = mfData.get(id);
								break;
							}
						}
					}
					if (dataView && dataView.byteLength >= 6) {
						const mac = [];
						for (let i = 5; i >= 0; i--) {
							mac.push((dataView.getUint8(i) + 0x100).toString(16).slice(1));
						}
						const macStr = mac.join(':').toUpperCase();
						return macStr;
					}
				}
			} catch (e) {
				console.warn('[qiyi] watchAdvertisements error:', e);
			}
		}

		// 2) Cache. Keyed by device: one shared entry per brand meant a second cube of
		// the same brand always started with the first one's MAC and failed to connect.
		return readCachedMac(MAC_CACHE_KEY, cubeStorageId(this.device)) || null;
	}

	/**
	 * Try each MAC the advertised name points to: send the hello with it and wait for a
	 * packet that passes CRC. The cube only answers a hello that carries its own MAC, so an
	 * answer proves the candidate. Returns the MAC that worked, or null.
	 *
	 * Before this the name-derived guess was only the prompt's default, and for the A series
	 * and the Tornado V4 i the guess itself was wrong (CC:A3 for every line).
	 */
	async probeNameCandidates() {
		for (const mac of qiyiMacCandidatesFromName(this.deviceName)) {
			this._pendingMac = mac;
			this.deviceMac = mac;
			const deadline = Date.now() + MAC_PROBE_TIMEOUT_MS;
			while (!this._connected && Date.now() < deadline) {
				try {
					await this.sendHello(mac);
				} catch (e) {
					// A write that fails is retried on the next round.
				}
				await new Promise((r) => setTimeout(r, MAC_PROBE_HELLO_INTERVAL_MS));
			}
			if (this._connected) return mac;
		}
		return null;
	}

	async init() {
		await this.adapter.connect(this.device, () => {
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
			CHRCT_UUID_CUBE,
			(value) => this.onCubeEvent(value)
		);

		setTimerParams({ smartCubeConnectStep: 'reading_service' });

		// Get MAC and send hello
		this.deviceMac = await this.resolveMac();
		if (!this.deviceMac) {
			// No source knew it: try the addresses the name points to before asking the user.
			if (await this.probeNameCandidates()) return;
			// Ask the user via modal. Returns a normalized MAC or null (cancelled).
			// Not persisted here — cached only after the cube proves it's correct (_confirmConnected).
			const candidates = qiyiMacCandidatesFromName(this.deviceName);
			this.deviceMac = await requestMacFromUser({
				defaultMac: candidates[0] || readAnyMac(MAC_CACHE_KEY),
				deviceName: this.deviceName,
			});
		}
		if (!this.deviceMac) {
			throw new Error('[qiyi] Could not obtain MAC address, connection not possible');
		}
		// Treat the MAC as unverified until the cube answers (see _confirmConnected).
		this._pendingMac = this.deviceMac;

		// Handshake with hello message. We do NOT mark the connection as established
		// here — alertConnected fires only when the first packet actually decrypts.
		await this.sendHello(this.deviceMac);
		this._startHandshakeWatchdog();
	}

	// Wrong MAC => packets never decrypt/CRC-pass => the cube stays silent. Tear the
	// connection down, drop the bad cached MAC, and surface a clear error.
	_startHandshakeWatchdog() {
		if (this._handshakeTimer) clearTimeout(this._handshakeTimer);
		this._handshakeTimer = setTimeout(() => {
			this._handshakeTimer = null;
			if (this._connected) return;
			console.warn('[qiyi] handshake timeout — wrong MAC or cube unresponsive');
			// Forget only this cube's entry; other cubes keep theirs.
			clearCachedMac(MAC_CACHE_KEY, cubeStorageId(this.device));
			try { this.adapter.disconnect(this.device); } catch (e) { /* ignore */ }
			this.alertScanError('wrong_mac');
		}, HANDSHAKE_TIMEOUT_MS);
	}

	// Called on the first packet that decrypts and passes CRC — proof the MAC is right.
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
		// Not every QiYi has a gyroscope; the first quaternion packet says otherwise.
		if (!this._gyroSeen) this.alertGyroSupported(false);
	}

	/**
	 * Quaternion packet (0xCC 0x10) from a gyro-equipped cube. Its own CRC covers bytes
	 * 0..13. Components are int16 / 1000; mapped onto GAN's frame (x, -z, y, w) the way
	 * smartcube-web-bluetooth does, so the 3D view needs no per-brand case.
	 */
	handleQuaternionPacket(msg) {
		if (msg.length < 16) return;
		if (crc16modbus(msg.slice(0, 14)) !== (msg[14] | (msg[15] << 8))) return;
		const int16 = (i) => {
			const v = (msg[i] << 8) | msg[i + 1];
			return v > 32767 ? v - 65536 : v;
		};
		const ax = int16(6) / 1000;
		const ay = int16(8) / 1000;
		const az = int16(10) / 1000;
		const aw = int16(12) / 1000;
		this._emitGyro({ timestamp: Date.now(), quaternion: { x: ax, y: -az, z: ay, w: aw } });
	}

	// cstimer onCubeEvent() — 1:1 port
	onCubeEvent(value) {
		const encMsg = [];
		for (let i = 0; i < value.byteLength; i++) {
			encMsg[i] = value.getUint8(i);
		}
		const decoder = this.getDecoder();
		const msg = [];
		for (let i = 0; i < encMsg.length; i += 16) {
			const block = encMsg.slice(i, i + 16);
			decoder.decrypt(block);
			for (let j = 0; j < 16; j++) {
				msg[i + j] = block[j];
			}
		}
		if (msg[0] === 0xcc && msg[1] === 0x10) {
			this.handleQuaternionPacket(msg);
			return;
		}
		const trimmed = msg.slice(0, msg[1]);
		if (trimmed.length < 3 || crc16modbus(trimmed) !== 0) {
			console.warn('[qiyi] crc check error');
			return;
		}
		// A decrypting, CRC-valid packet proves the MAC is correct — confirm the connection.
		this._confirmConnected();
		this.parseCubeData(trimmed);
	}

	// cstimer parseCubeData() — 1:1 port (state tracking with cubejs)
	parseCubeData(msg) {
		const locTime = Date.now();
		if (msg[0] !== 0xfe) {
			console.warn('[qiyi] error cube data', msg);
			return;
		}
		const opcode = msg[2];
		const ts = readTimestamp(msg, 3);

		if (opcode === 0x2) { // cube hello
			this.batteryLevel = msg[35];
			this.sendMessage(msg.slice(2, 7));
			const newFacelet = this.parseFacelet(msg.slice(7, 34));
			this.prevCube = Cube.fromString(newFacelet);
			this.alertCubeState(newFacelet);
			this.alertBatteryLevel(this.batteryLevel);
		} else if (opcode === 0x3) { // state change
			// The cube says per packet whether it wants an acknowledgement (byte 91). cstimer
			// acknowledged every move, a GATT write per turn in the middle of a solve; in real
			// traffic one packet in thirty asks for it, and the cube carries on without the
			// rest (smartcube-web-bluetooth captures, QY-QYSC-S and Tornado V4 i).
			if (msg.length > 91 && msg[91] !== 0) {
				this.sendMessage(msg.slice(2, 7));
			}

			// History moves recovery: the primary move plus every history slot newer than the
			// last move we already have, oldest first.
			const todoMoves = qiyiStateChangeMoves(msg, ts).filter(
				([code, moveTs]) => code >= 1 && code <= 12 && moveTs > this.lastTs
			);
			// Apply moves in old -> new order
			const batch = [];
			let curFacelet = this.prevCube.asString();
			for (let i = 0; i < todoMoves.length; i++) {
				const axis = [4, 1, 3, 0, 2, 5][(todoMoves[i][0] - 1) >> 1];
				const power = [0, 2][todoMoves[i][0] & 1];
				const moveStr = 'URFDLB'.charAt(axis) + " 2'".charAt(power);
				const cubejsMove = moveStr.replace(' ', ''); // " 2'" -> "" / "2" / "'"

				this.prevCube.move(cubejsMove);
				this.prevMoves.unshift(moveStr);
				this.prevMoves = this.prevMoves.slice(0, 8);
				curFacelet = this.prevCube.asString();

				batch.push({
					turn: cubejsMove,
					cubeTimestamp: Math.trunc(todoMoves[i][1] / 1.6),
					localTimestamp: i === todoMoves.length - 1 ? locTime : null,
					completedAt: locTime,
				});
			}
			if (todoMoves.length > 0) {
				this.lastTs = todoMoves[todoMoves.length - 1][1];
			}

			// FACELETS comparison (drift control)
			const newFacelet = this.parseFacelet(msg.slice(7, 34));
			// Moves and the state they produce go out in ONE dispatch. Publishing the
			// state on its own first (as the mismatch branch used to) lets a consumer
			// see the new state before the moves, which makes the last scramble move
			// look like the first move of the solve.
			if (newFacelet !== curFacelet) {
				console.warn('[qiyi] facelet mismatch — resync to', newFacelet);
				this.prevCube = Cube.fromString(newFacelet);
				if (batch.length > 0) {
					this.alertTurnCubeBatch(batch, newFacelet);
				} else {
					this.alertCubeState(newFacelet);
				}
			} else {
				if (batch.length > 0) {
					this.alertTurnCubeBatch(batch, curFacelet);
				}
			}

			// Battery update
			const newBatteryLevel = msg[35];
			if (newBatteryLevel !== this.batteryLevel) {
				this.batteryLevel = newBatteryLevel;
				this.alertBatteryLevel(this.batteryLevel);
			}
			return;
		} else if (opcode === 0x4) { // sync confirmation: the cube now considers itself solved
			if (msg[1] !== 38) return;
			this.prevCube = Cube.fromString(SOLVED_FACELET);
			this.alertCubeState(SOLVED_FACELET);
		} else {
			// Unknown opcode: its "timestamp" bytes mean nothing, and moving lastTs on them
			// would make the next packet's history look older than it is.
			return;
		}
		this.lastTs = ts;
	}

	// cstimer parseFacelet() — 1:1 port
	// Input: 27-byte msg (54 facelets, 4 bit/facelet)
	parseFacelet(faceMsg) {
		const ret = [];
		for (let i = 0; i < 54; i++) {
			ret.push('LRDUFB'.charAt(faceMsg[i >> 1] >> (i % 2 << 2) & 0xf));
		}
		return ret.join('');
	}
}
