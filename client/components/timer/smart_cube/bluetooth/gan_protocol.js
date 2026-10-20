import { Subject } from 'rxjs';
import { ModeOfOperation } from 'aes-js';

/**
 * GAN protocol layer: BLE UUIDs, keys, the Gen2/Gen3/Gen4 encrypters and protocol drivers,
 * and the notification connection that feeds them.
 *
 * Split out of gan.js because gan.js pulls in the Redux store and cannot be imported from a
 * test. Nothing here touches the store, the DOM or React, so the drivers can be fed real
 * captured BLE traffic in a unit test (see __tests__/gan_protocol.test.ts).
 *
 * Ported from gan-web-bluetooth (Andy Fedotov, MIT) and its maintained successor
 * smartcube-web-bluetooth (Pau Oliva, MIT): https://github.com/poliva/smartcube-web-bluetooth
 */

// GAN service and characteristic UUIDs
export const GAN_GEN2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
export const GAN_GEN2_COMMAND_CHARACTERISTIC = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';
export const GAN_GEN2_STATE_CHARACTERISTIC = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';

export const GAN_GEN3_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
export const GAN_GEN3_COMMAND_CHARACTERISTIC = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';
export const GAN_GEN3_STATE_CHARACTERISTIC = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';

export const GAN_GEN4_SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
export const GAN_GEN4_COMMAND_CHARACTERISTIC = '0000fff5-0000-1000-8000-00805f9b34fb';
export const GAN_GEN4_STATE_CHARACTERISTIC = '0000fff6-0000-1000-8000-00805f9b34fb';

/**
 * Gen1 (GAN 356i and the other first-generation cubes).
 *
 * Note the characteristic UUIDs: fff5 and fff6 are the SAME 16-bit UUIDs Gen4 uses for
 * its command and state characteristics. Only the service tells the two apart, which is
 * why the generation is resolved by a fixed priority order (Gen2 -> Gen3 -> Gen4 -> Gen1)
 * rather than by whichever service the adapter happens to list first.
 */
export const GAN_GEN1_DATA_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
export const GAN_GEN1_META_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
export const GAN_GEN1_VERSION_CHARACTERISTIC = '00002a28-0000-1000-8000-00805f9b34fb';
export const GAN_GEN1_HARDWARE_CHARACTERISTIC = '00002a23-0000-1000-8000-00805f9b34fb';
/** Cube state, (54 - 6) facelets, 3 bits per facelet. */
export const GAN_GEN1_STATE_CHARACTERISTIC = '0000fff2-0000-1000-8000-00805f9b34fb';
/** Move counter plus the last 6 moves. */
export const GAN_GEN1_MOVES_CHARACTERISTIC = '0000fff5-0000-1000-8000-00805f9b34fb';
/** Time offsets between the moves reported by the moves characteristic. */
export const GAN_GEN1_TIMES_CHARACTERISTIC = '0000fff6-0000-1000-8000-00805f9b34fb';
export const GAN_GEN1_BATTERY_CHARACTERISTIC = '0000fff7-0000-1000-8000-00805f9b34fb';

// List of Company Identifier Codes for GAN cubes
export const GAN_CIC_LIST = Array(256)
	.fill(undefined)
	.map((_, i) => (i << 8) | 0x01);

// Encryption keys
export const GAN_ENCRYPTION_KEYS = [
	{
		key: [0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07, 0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53],
		iv: [0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27, 0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43],
	},
	{
		key: [0x05, 0x12, 0x02, 0x45, 0x02, 0x01, 0x29, 0x56, 0x12, 0x78, 0x12, 0x76, 0x81, 0x01, 0x08, 0x03],
		iv: [0x01, 0x44, 0x28, 0x06, 0x86, 0x21, 0x22, 0x28, 0x51, 0x05, 0x08, 0x31, 0x82, 0x02, 0x21, 0x06],
	},
];

// Return current host clock timestamp with millisecond precision
export const now =
	typeof window != 'undefined' && typeof window.performance?.now == 'function'
		? () => Math.floor(window.performance.now())
		: () => Date.now();

/**
 * How long a gap in the move stream may stay open before the missing moves are written
 * off. While a gap is open the cube's facelet state is held back (it already contains
 * moves the app has not been handed), so this is also the longest the app can go without
 * a state update. Recovery replies normally arrive well inside 100ms; this is the ceiling
 * for the case where the cube never answers at all.
 */
export const GAP_RECOVERY_TIMEOUT_MS = 1500;

/**
 * A move-history request gets this long to be answered before its gap may be written off.
 *
 * The timeout above used to be the only condition. In the pause path (a packet lost just
 * before the user stops turning) the first history request goes out with the facelets
 * packet that arrives 1.7 s after the last move, and that same packet found the gap past
 * the timeout and wrote it off: the reply, a few dozen ms later, was thrown away and the
 * solve kept a hole. Now a gap is only written off once a request had time to come back.
 */
export const HISTORY_REPLY_WINDOW_MS = 300;

/** A gap is written off after this long even if no history request could be sent at all. */
export const GAP_RECOVERY_HARD_LIMIT_MS = 3000;

/**
 * Should a gap that has been open since `gapSince` be written off at time `t`?
 * `lastRequestAt` is when the latest history request for it went out, or null.
 */
export function gapExpired(gapSince, lastRequestAt, t = now()) {
	const age = t - gapSince;
	if (age > GAP_RECOVERY_HARD_LIMIT_MS) return true;
	if (age <= GAP_RECOVERY_TIMEOUT_MS) return false;
	return lastRequestAt != null && t - lastRequestAt >= HISTORY_REPLY_WINDOW_MS;
}

// ============================================================================
// ENCRYPTERS (inline from gan-web-bluetooth since they are not exported)
// ============================================================================

export class GanGen2CubeEncrypter {
	constructor(key, iv, salt) {
		if (key.length != 16) throw new Error('Key must be 16 bytes (128-bit) long');
		if (iv.length != 16) throw new Error('Iv must be 16 bytes (128-bit) long');
		if (salt.length != 6) throw new Error('Salt must be 6 bytes (48-bit) long');
		// Apply salt to key and IV
		this._key = new Uint8Array(key);
		this._iv = new Uint8Array(iv);
		for (let i = 0; i < 6; i++) {
			this._key[i] = (key[i] + salt[i]) % 0xff;
			this._iv[i] = (iv[i] + salt[i]) % 0xff;
		}
	}
	encryptChunk(buffer, offset) {
		const cipher = new ModeOfOperation.cbc(this._key, this._iv);
		const chunk = cipher.encrypt(buffer.subarray(offset, offset + 16));
		buffer.set(chunk, offset);
	}
	decryptChunk(buffer, offset) {
		const cipher = new ModeOfOperation.cbc(this._key, this._iv);
		const chunk = cipher.decrypt(buffer.subarray(offset, offset + 16));
		buffer.set(chunk, offset);
	}
	encrypt(data) {
		if (data.length < 16) throw Error('Data must be at least 16 bytes long');
		const res = new Uint8Array(data);
		this.encryptChunk(res, 0);
		if (res.length > 16) {
			this.encryptChunk(res, res.length - 16);
		}
		return res;
	}
	decrypt(data) {
		if (data.length < 16) throw Error('Data must be at least 16 bytes long');
		const res = new Uint8Array(data);
		if (res.length > 16) {
			this.decryptChunk(res, res.length - 16);
		}
		this.decryptChunk(res, 0);
		return res;
	}
}

export class GanGen3CubeEncrypter extends GanGen2CubeEncrypter { }
export class GanGen4CubeEncrypter extends GanGen2CubeEncrypter { }

// ============================================================================
// PROTOCOL MESSAGE VIEW
// ============================================================================

export class GanProtocolMessageView {
	constructor(message) {
		this.bits = Array.from(message)
			.map((byte) => (byte + 0x100).toString(2).slice(1))
			.join('');
	}
	getBitWord(startBit, bitLength, littleEndian = false) {
		if (bitLength <= 8) {
			return parseInt(this.bits.slice(startBit, startBit + bitLength), 2);
		} else if (bitLength == 16 || bitLength == 32) {
			let buf = new Uint8Array(bitLength / 8);
			for (let i = 0; i < buf.length; i++) {
				buf[i] = parseInt(this.bits.slice(8 * i + startBit, 8 * i + startBit + 8), 2);
			}
			let dv = new DataView(buf.buffer);
			return bitLength == 16 ? dv.getUint16(0, littleEndian) : dv.getUint32(0, littleEndian);
		} else {
			throw new Error('Unsupported bit word length');
		}
	}
}

// ============================================================================
// UTILS
// ============================================================================

export const sum = (arr) => arr.reduce((a, v) => a + v, 0);

export const CORNER_FACELET_MAP = [
	[8, 9, 20],
	[6, 18, 38],
	[0, 36, 47],
	[2, 45, 11],
	[29, 26, 15],
	[27, 44, 24],
	[33, 53, 42],
	[35, 17, 51],
];
export const EDGE_FACELET_MAP = [
	[5, 10],
	[7, 19],
	[3, 37],
	[1, 46],
	[32, 16],
	[28, 25],
	[30, 43],
	[34, 52],
	[23, 12],
	[21, 41],
	[50, 39],
	[48, 14],
];

export function toKociembaFacelets(cp, co, ep, eo) {
	const faces = 'URFDLB';
	const facelets = [];
	for (let i = 0; i < 54; i++) {
		facelets[i] = faces[~~(i / 9)];
	}
	for (let i = 0; i < 8; i++) {
		for (let p = 0; p < 3; p++) {
			facelets[CORNER_FACELET_MAP[i][(p + co[i]) % 3]] = faces[~~(CORNER_FACELET_MAP[cp[i]][p] / 9)];
		}
	}
	for (let i = 0; i < 12; i++) {
		for (let p = 0; p < 2; p++) {
			facelets[EDGE_FACELET_MAP[i][(p + eo[i]) % 2]] = faces[~~(EDGE_FACELET_MAP[ep[i]][p] / 9)];
		}
	}
	return facelets.join('');
}

// ============================================================================
// PROTOCOL DRIVERS
// ============================================================================

export class GanGen2ProtocolDriver {
	constructor() {
		this.lastSerial = -1;
		this.lastMoveTimestamp = 0;
		this.cubeTimestamp = 0;
	}
	createCommandMessage(command) {
		let msg = new Uint8Array(20).fill(0);
		switch (command.type) {
			case 'REQUEST_FACELETS':
				msg[0] = 0x04;
				break;
			case 'REQUEST_HARDWARE':
				msg[0] = 0x05;
				break;
			case 'REQUEST_BATTERY':
				msg[0] = 0x09;
				break;
			case 'REQUEST_RESET':
				msg.set([0x0a, 0x05, 0x39, 0x77, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
				break;
			default:
				msg = undefined;
		}
		return msg;
	}
	async handleStateEvent(conn, eventMessage) {
		const timestamp = now();
		const cubeEvents = [];
		const msg = new GanProtocolMessageView(eventMessage);
		const eventType = msg.getBitWord(0, 4);

		if (eventType == 0x01) {
			// GYRO
			let qw = msg.getBitWord(4, 16);
			let qx = msg.getBitWord(20, 16);
			let qy = msg.getBitWord(36, 16);
			let qz = msg.getBitWord(52, 16);
			let vx = msg.getBitWord(68, 4);
			let vy = msg.getBitWord(72, 4);
			let vz = msg.getBitWord(76, 4);
			cubeEvents.push({
				type: 'GYRO',
				timestamp: timestamp,
				quaternion: {
					x: ((1 - (qx >> 15) * 2) * (qx & 0x7fff)) / 0x7fff,
					y: ((1 - (qy >> 15) * 2) * (qy & 0x7fff)) / 0x7fff,
					z: ((1 - (qz >> 15) * 2) * (qz & 0x7fff)) / 0x7fff,
					w: ((1 - (qw >> 15) * 2) * (qw & 0x7fff)) / 0x7fff,
				},
				velocity: {
					x: (1 - (vx >> 3) * 2) * (vx & 0x7),
					y: (1 - (vy >> 3) * 2) * (vy & 0x7),
					z: (1 - (vz >> 3) * 2) * (vz & 0x7),
				},
			});
		} else if (eventType == 0x02) {
			// MOVE
			if (this.lastSerial != -1) {
				let serial = msg.getBitWord(4, 8);
				let diff = Math.min((serial - this.lastSerial) & 0xff, 7);
				this.lastSerial = serial;
				if (diff > 0) {
					for (let i = diff - 1; i >= 0; i--) {
						let face = msg.getBitWord(12 + 5 * i, 4);
						let direction = msg.getBitWord(16 + 5 * i, 1);
						let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
						let elapsed = msg.getBitWord(47 + 16 * i, 16);
						if (elapsed == 0) {
							elapsed = timestamp - this.lastMoveTimestamp;
						}
						this.cubeTimestamp += elapsed;
						cubeEvents.push({
							type: 'MOVE',
							serial: (serial - i) & 0xff,
							timestamp: timestamp,
							localTimestamp: i == 0 ? timestamp : null,
							cubeTimestamp: this.cubeTimestamp,
							face: face,
							direction: direction,
							move: move.trim(),
						});
					}
					this.lastMoveTimestamp = timestamp;
				}
			}
		} else if (eventType == 0x04) {
			// FACELETS
			let serial = msg.getBitWord(4, 8);
			if (this.lastSerial == -1) this.lastSerial = serial;
			let cp = [];
			let co = [];
			let ep = [];
			let eo = [];
			for (let i = 0; i < 7; i++) {
				cp.push(msg.getBitWord(12 + i * 3, 3));
				co.push(msg.getBitWord(33 + i * 2, 2));
			}
			cp.push(28 - sum(cp));
			co.push((3 - (sum(co) % 3)) % 3);
			for (let i = 0; i < 11; i++) {
				ep.push(msg.getBitWord(47 + i * 4, 4));
				eo.push(msg.getBitWord(91 + i, 1));
			}
			ep.push(66 - sum(ep));
			eo.push((2 - (sum(eo) % 2)) % 2);
			cubeEvents.push({
				type: 'FACELETS',
				serial: serial,
				timestamp: timestamp,
				facelets: toKociembaFacelets(cp, co, ep, eo),
				state: { CP: cp, CO: co, EP: ep, EO: eo },
			});
		} else if (eventType == 0x05) {
			// HARDWARE
			let hwMajor = msg.getBitWord(8, 8);
			let hwMinor = msg.getBitWord(16, 8);
			let swMajor = msg.getBitWord(24, 8);
			let swMinor = msg.getBitWord(32, 8);
			let gyroSupported = msg.getBitWord(104, 1);
			let hardwareName = '';
			for (let i = 0; i < 8; i++) {
				hardwareName += String.fromCharCode(msg.getBitWord(i * 8 + 40, 8));
			}
			cubeEvents.push({
				type: 'HARDWARE',
				timestamp: timestamp,
				hardwareName: hardwareName,
				hardwareVersion: `${hwMajor}.${hwMinor}`,
				softwareVersion: `${swMajor}.${swMinor}`,
				gyroSupported: !!gyroSupported,
			});
		} else if (eventType == 0x09) {
			// BATTERY
			let batteryLevel = msg.getBitWord(8, 8);
			cubeEvents.push({
				type: 'BATTERY',
				timestamp: timestamp,
				batteryLevel: Math.min(batteryLevel, 100),
			});
		} else if (eventType == 0x0d) {
			// DISCONNECT
			conn.disconnect();
		}
		return cubeEvents;
	}
}

// Gen3 driver — moveBuffer + requestMoveHistory (from gan-web-bluetooth reference)
export class GanGen3ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
		this.moveBuffer = [];
		this.lastLocalTimestamp = null;
		// When the current gap in the move stream opened, or null when there is none.
		this._gapSince = null;
		// When the latest move-history request for the open gap went out (see gapExpired).
		this._lastHistoryRequestAt = null;
		// Moves written off by gap timeouts this session, for telemetry.
		this.writtenOffMoves = 0;
	}

	/**
	 * Is the move stream waiting on a recovery request right now?
	 *
	 * While it is, the cube's own facelet state describes a cube that has already made
	 * moves the app has not been handed. Publishing that state would tell the app the
	 * user's scramble progress vanished, and the recovered moves would then be replayed on
	 * top of a state that already contains them. Callers hold the state back until this
	 * returns false.
	 *
	 * A gap that never closes must not silence the cube forever: once a history request had
	 * time to be answered (see gapExpired) the unfillable moves are written off and the
	 * stream re-anchors on the state in hand.
	 */
	hasPendingGap() {
		// Serial counter difference, not buffer length: moves that never reached the buffer
		// at all (the packet was lost outright, recovery is still in flight) are exactly the
		// case that matters, and the buffer is empty for those. `serial === 0` is skipped to
		// avoid the iCarry firmware quirk at the 255->0 wrap.
		const undelivered =
			this.lastSerial !== -1 && this.serial !== 0 && ((this.serial - this.lastSerial) & 0xFF) > 0;
		if (!undelivered) {
			this._gapSince = null;
			this._lastHistoryRequestAt = null;
			return false;
		}
		if (this._gapSince == null) this._gapSince = now();
		if (gapExpired(this._gapSince, this._lastHistoryRequestAt)) {
			const missing = (this.serial - this.lastSerial) & 0xFF;
			console.warn('[ZKT:MOVEBUF] Gen3 gap recovery timed out — writing off missing moves', {
				bufferLen: this.moveBuffer.length,
				missing,
			});
			this.writtenOffMoves += missing;
			this.moveBuffer = [];
			this._gapSince = null;
			this._lastHistoryRequestAt = null;
			// The facelets event being handled right now carries this serial, so treat
			// everything up to it as delivered instead of forcing a full re-sync.
			this.lastSerial = this.serial;
			return false;
		}
		return true;
	}
	createCommandMessage(command) {
		let msg = new Uint8Array(16).fill(0);
		switch (command.type) {
			case 'REQUEST_FACELETS':
				msg.set([0x68, 0x01]);
				break;
			case 'REQUEST_HARDWARE':
				msg.set([0x68, 0x04]);
				break;
			case 'REQUEST_BATTERY':
				msg.set([0x68, 0x07]);
				break;
			case 'REQUEST_RESET':
				msg.set([0x68, 0x05, 0x05, 0x39, 0x77, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0x00, 0x00, 0x00]);
				break;
			default:
				msg = undefined;
		}
		return msg;
	}

	isSerialInRange(start, end, serial, closedStart = false, closedEnd = false) {
		return ((end - start) & 0xFF) >= ((serial - start) & 0xFF)
			&& (closedStart || ((start - serial) & 0xFF) > 0)
			&& (closedEnd || ((end - serial) & 0xFF) > 0);
	}

	async requestMoveHistory(conn, serial, count) {
		if (this._historyInFlight) {
			return;
		}
		this._historyInFlight = true;
		this._lastHistoryRequestAt = now();
		const msg = new Uint8Array(16).fill(0);
		if (serial % 2 === 0) serial = (serial - 1) & 0xFF;
		if (count % 2 === 1) count++;
		count = Math.min(count, serial + 1);
		msg.set([0x68, 0x03, serial, 0, count, 0]);
		return conn.sendCommandMessage(msg).catch((e) => {
			console.warn('[ZKT:MOVEBUF] Gen3 requestMoveHistory GATT write error', e?.message);
		}).finally(() => {
			this._historyInFlight = false;
		});
	}

	async evictMoveBuffer(conn) {
		const evictedEvents = [];
		while (this.moveBuffer.length > 0) {
			const bufferHead = this.moveBuffer[0];
			const diff = this.lastSerial === -1 ? 1 : (bufferHead.serial - this.lastSerial) & 0xFF;
			if (diff > 1) {
				if (conn) await this.requestMoveHistory(conn, bufferHead.serial, diff);
				break;
			} else {
				evictedEvents.push(this.moveBuffer.shift());
				this.lastSerial = bufferHead.serial;
			}
		}
		// Recovery instead of teardown, same as Gen4: an overflow is almost always an
		// unfillable gap at the 255->0 serial wrap, and dropping the connection there is
		// what made cubes disconnect mid-session. Flush and re-sync from a full FACELETS
		// state instead.
		if (this.moveBuffer.length > 16) {
			console.warn('[ZKT:MOVEBUF] Gen3 buffer overflow — recovering via FACELETS resync', {
				bufferLen: this.moveBuffer.length,
			});
			this.moveBuffer = [];
			this.lastSerial = -1; // force a clean re-sync on the next FACELETS event
			evictedEvents.push({ type: 'BUFFER_OVERFLOW' });
		}
		// Anything still buffered is waiting on a recovery reply; note when that wait began.
		this._gapSince = this.moveBuffer.length > 0 ? this._gapSince || now() : null;
		return evictedEvents;
	}

	injectMissedMoveToBuffer(move) {
		if (move.type === 'MOVE') {
			if (this.moveBuffer.length > 0) {
				const bufferHead = this.moveBuffer[0];
				if (this.moveBuffer.some(e => e.type === 'MOVE' && e.serial === move.serial)) {
					return;
				}
				if (!this.isSerialInRange(this.lastSerial, bufferHead.serial, move.serial)) {
					return;
				}
				if (move.serial === ((bufferHead.serial - 1) & 0xFF)) {
					this.moveBuffer.unshift(move);
				}
			} else {
				if (this.isSerialInRange(this.lastSerial, this.serial, move.serial, false, true)) {
					this.moveBuffer.unshift(move);
				}
			}
		}
	}

	async checkIfMoveMissed(conn) {
		const diff = (this.serial - this.lastSerial) & 0xFF;
		if (diff > 0 && this.serial !== 0) {
			const bufferHead = this.moveBuffer[0];
			const startSerial = bufferHead ? bufferHead.serial : (this.serial + 1) & 0xFF;
			await this.requestMoveHistory(conn, startSerial, diff + 1);
		}
	}

	async handleStateEvent(conn, eventMessage) {
		const timestamp = now();
		let cubeEvents = [];
		const msg = new GanProtocolMessageView(eventMessage);
		const magic = msg.getBitWord(0, 8);
		const eventType = msg.getBitWord(8, 8);
		const dataLength = msg.getBitWord(16, 8);

		if (magic == 0x55 && dataLength > 0) {
			if (eventType == 0x01) {
				// MOVE — add to buffer, evict gap-free ones
				if (this.lastSerial != -1) {
					this.lastLocalTimestamp = timestamp;
					let cubeTimestamp = msg.getBitWord(24, 32, true);
					let serial = (this.serial = msg.getBitWord(56, 16, true));
					let direction = msg.getBitWord(72, 2);
					let face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(74, 6));
					let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
					if (face >= 0) {
						this.moveBuffer.push({
							type: 'MOVE',
							serial: serial,
							timestamp: timestamp,
							localTimestamp: timestamp,
							cubeTimestamp: cubeTimestamp,
							face: face,
							direction: direction,
							move: move.trim(),
						});
					}
					cubeEvents = await this.evictMoveBuffer(conn);
				}
			} else if (eventType == 0x06) {
				// MOVE_HISTORY — missed move response
				let startSerial = msg.getBitWord(24, 8);
				let count = (dataLength - 1) * 2;
				for (let i = 0; i < count; i++) {
					let face = [1, 5, 3, 0, 4, 2].indexOf(msg.getBitWord(32 + 4 * i, 3));
					let direction = msg.getBitWord(35 + 4 * i, 1);
					if (face >= 0) {
						let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
						this.injectMissedMoveToBuffer({
							type: 'MOVE',
							serial: (startSerial - i) & 0xFF,
							timestamp: timestamp,
							localTimestamp: null,
							cubeTimestamp: null,
							// Recovered from move history: it happened in the past, and
							// `timestamp` above is the recovery moment, not the turn.
							recovered: true,
							face: face,
							direction: direction,
							move: move.trim(),
						});
					}
				}
				cubeEvents = await this.evictMoveBuffer();
			} else if (eventType == 0x02) {
				// FACELETS
				let serial = (this.serial = msg.getBitWord(24, 16, true));

				// If serial === lastSerial, no new move → missed move cannot occur, check unnecessary
				if (this.lastSerial != -1 && serial !== this.lastSerial) {
					if (this.lastLocalTimestamp != null && (timestamp - this.lastLocalTimestamp) > 500) {
						await this.checkIfMoveMissed(conn);
					}
				}

				if (this.lastSerial == -1) this.lastSerial = serial;

				let cp = [];
				let co = [];
				let ep = [];
				let eo = [];
				for (let i = 0; i < 7; i++) {
					cp.push(msg.getBitWord(40 + i * 3, 3));
					co.push(msg.getBitWord(61 + i * 2, 2));
				}
				cp.push(28 - sum(cp));
				co.push((3 - (sum(co) % 3)) % 3);
				for (let i = 0; i < 11; i++) {
					ep.push(msg.getBitWord(77 + i * 4, 4));
					eo.push(msg.getBitWord(121 + i, 1));
				}
				ep.push(66 - sum(ep));
				eo.push((2 - (sum(eo) % 2)) % 2);
				cubeEvents.push({
					type: 'FACELETS',
					serial: serial,
					timestamp: timestamp,
					facelets: toKociembaFacelets(cp, co, ep, eo),
					state: { CP: cp, CO: co, EP: ep, EO: eo },
					// Set when moves are still buffered behind an unfilled gap: this state is
					// ahead of what the app has been given, so the consumer must not adopt it.
					pendingGap: this.hasPendingGap(),
				});
			} else if (eventType == 0x07) {
				// HARDWARE
				let swMajor = msg.getBitWord(72, 4);
				let swMinor = msg.getBitWord(76, 4);
				let hwMajor = msg.getBitWord(80, 4);
				let hwMinor = msg.getBitWord(84, 4);
				let hardwareName = '';
				for (let i = 0; i < 5; i++) {
					hardwareName += String.fromCharCode(msg.getBitWord(i * 8 + 32, 8));
				}
				cubeEvents.push({
					type: 'HARDWARE',
					timestamp: timestamp,
					hardwareName: hardwareName,
					hardwareVersion: `${hwMajor}.${hwMinor}`,
					softwareVersion: `${swMajor}.${swMinor}`,
					gyroSupported: false,
				});
			} else if (eventType == 0x10) {
				// BATTERY
				let batteryLevel = msg.getBitWord(24, 8);
				cubeEvents.push({
					type: 'BATTERY',
					timestamp: timestamp,
					batteryLevel: Math.min(batteryLevel, 100),
				});
			} else if (eventType == 0x11) {
				// DISCONNECT
				conn.disconnect();
			}
		}
		return cubeEvents;
	}
}

// Gen4 driver — moveBuffer + requestMoveHistory (from gan-web-bluetooth reference)
// Gap recovery is done directly within the driver. Consumer receives only gap-free MOVE events.
export class GanGen4ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
		this.hwInfo = {};
		this.moveBuffer = []; // FIFO buffer: holds moves until gaps are filled
		this.lastLocalTimestamp = null;
		// When the current gap in the move stream opened, or null when there is none.
		this._gapSince = null;
		// When the latest move-history request for the open gap went out (see gapExpired).
		this._lastHistoryRequestAt = null;
		// Moves written off by gap timeouts this session, for telemetry.
		this.writtenOffMoves = 0;
		// Set by the first 0xEC packet of this connection; never cleared by REQUEST_HARDWARE.
		this.gyroObserved = false;
		// A full HARDWARE event went out for the current hwInfo assembly.
		this.hardwareInfoEmitted = false;
	}

	/**
	 * Is the move stream waiting on a recovery request right now? See the Gen3 driver for
	 * why the facelet state has to be held back while it is.
	 */
	hasPendingGap() {
		// Serial counter difference, not buffer length: moves that never reached the buffer
		// at all (the packet was lost outright, recovery is still in flight) are exactly the
		// case that matters, and the buffer is empty for those. `serial === 0` is skipped to
		// avoid the iCarry firmware quirk at the 255->0 wrap.
		const undelivered =
			this.lastSerial !== -1 && this.serial !== 0 && ((this.serial - this.lastSerial) & 0xFF) > 0;
		if (!undelivered) {
			this._gapSince = null;
			this._lastHistoryRequestAt = null;
			return false;
		}
		if (this._gapSince == null) this._gapSince = now();
		if (gapExpired(this._gapSince, this._lastHistoryRequestAt)) {
			const missing = (this.serial - this.lastSerial) & 0xFF;
			console.warn('[ZKT:MOVEBUF] Gen4 gap recovery timed out — writing off missing moves', {
				bufferLen: this.moveBuffer.length,
				missing,
			});
			this.writtenOffMoves += missing;
			this.moveBuffer = [];
			this._gapSince = null;
			this._lastHistoryRequestAt = null;
			// The facelets event being handled right now carries this serial, so treat
			// everything up to it as delivered instead of forcing a full re-sync.
			this.lastSerial = this.serial;
			return false;
		}
		return true;
	}

	/**
	 * gyroSupported comes from the gyro packets themselves (smartcube-web-bluetooth
	 * 43d22f1), not from a list of model names: the list only ever knew the GAN 12 ui Maglev.
	 * The Maglev stays in it so its first HARDWARE event is right before a gyro packet lands.
	 */
	buildHardwareEvent(timestamp) {
		return {
			type: 'HARDWARE',
			timestamp: timestamp,
			hardwareName: this.hwInfo[0xfc],
			hardwareVersion: this.hwInfo[0xfe],
			softwareVersion: this.hwInfo[0xfd],
			productDate: this.hwInfo[0xfa],
			gyroSupported: this.gyroObserved || ['GAN12uiM'].indexOf(this.hwInfo[0xfc]) != -1,
		};
	}
	createCommandMessage(command) {
		let msg = new Uint8Array(20).fill(0);
		switch (command.type) {
			case 'REQUEST_FACELETS':
				msg.set([0xdd, 0x04, 0x00, 0xed, 0x00, 0x00]);
				break;
			case 'REQUEST_HARDWARE':
				this.hwInfo = {};
				this.hardwareInfoEmitted = false;
				msg.set([0xdf, 0x03, 0x00, 0x00, 0x00]);
				break;
			case 'REQUEST_BATTERY':
				msg.set([0xdd, 0x04, 0x00, 0xef, 0x00, 0x00]);
				break;
			case 'REQUEST_RESET':
				msg.set([0xd2, 0x0d, 0x05, 0x39, 0x77, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0x00, 0x00, 0x00]);
				break;
			default:
				msg = undefined;
		}
		return msg;
	}

	// Check if circular serial number (mod 256) is in [start, end] range
	isSerialInRange(start, end, serial, closedStart = false, closedEnd = false) {
		return ((end - start) & 0xFF) >= ((serial - start) & 0xFF)
			&& (closedStart || ((start - serial) & 0xFF) > 0)
			&& (closedEnd || ((end - serial) & 0xFF) > 0);
	}

	// Request missed moves from cube hardware (Gen4: 0xD1 command)
	async requestMoveHistory(conn, serial, count) {
		// GATT race condition guard: skip if previous request is still in progress
		if (this._historyInFlight) {
			return;
		}
		this._historyInFlight = true;
		this._lastHistoryRequestAt = now();
		const msg = new Uint8Array(20).fill(0);
		// Firmware constraint: odd serial + even count required
		if (serial % 2 === 0) serial = (serial - 1) & 0xFF;
		if (count % 2 === 1) count++;
		// Do not cross 255→0 boundary (firmware bug: out-of-boundary moves return 'D')
		count = Math.min(count, serial + 1);
		msg.set([0xD1, 0x04, serial, 0, count, 0]);
		return conn.sendCommandMessage(msg).catch((e) => {
			console.warn('[ZKT:MOVEBUF] Gen4 requestMoveHistory GATT write error', e?.message);
		}).finally(() => {
			this._historyInFlight = false;
		});
	}

	// Extract gap-free moves from FIFO buffer. Call requestMoveHistory if gap exists.
	async evictMoveBuffer(conn) {
		const evictedEvents = [];
		while (this.moveBuffer.length > 0) {
			const bufferHead = this.moveBuffer[0];
			const diff = this.lastSerial === -1 ? 1 : (bufferHead.serial - this.lastSerial) & 0xFF;
			if (diff > 1) {
				// Gap exists — request missed moves from cube
				if (conn) {
					await this.requestMoveHistory(conn, bufferHead.serial, diff);
				}
				break; // Stop eviction until gap is filled
			} else {
				evictedEvents.push(this.moveBuffer.shift());
				this.lastSerial = bufferHead.serial;
			}
		}
		// Recovery instead of teardown: an overflow is almost always an unfillable gap at the
		// 255->0 serial wrap (requestMoveHistory clamps count at the boundary). Dropping the
		// connection here is what made GAN Gen4 cubes disconnect after ~6-7 solves. Instead,
		// flush the buffer and emit BUFFER_OVERFLOW so the cube re-syncs from a full FACELETS state.
		if (this.moveBuffer.length > 16) {
			console.warn('[ZKT:MOVEBUF] Gen4 buffer overflow — recovering via FACELETS resync', { bufferLen: this.moveBuffer.length });
			this.moveBuffer = [];
			this.lastSerial = -1; // force a clean re-sync on the next FACELETS event
			evictedEvents.push({ type: 'BUFFER_OVERFLOW' });
		}
		// Anything still buffered is waiting on a recovery reply; note when that wait began.
		this._gapSince = this.moveBuffer.length > 0 ? this._gapSince || now() : null;
		return evictedEvents;
	}

	// Place recovered moves at correct position in buffer
	injectMissedMoveToBuffer(move) {
		if (move.type === 'MOVE') {
			if (this.moveBuffer.length > 0) {
				const bufferHead = this.moveBuffer[0];
				// Skip if same serial already exists
				if (this.moveBuffer.some(e => e.type === 'MOVE' && e.serial === move.serial)) {
					return;
				}
				// Skip if serial is outside range
				if (!this.isSerialInRange(this.lastSerial, bufferHead.serial, move.serial)) {
					return;
				}
				// If immediately before buffer head, add to front
				if (move.serial === ((bufferHead.serial - 1) & 0xFF)) {
					this.moveBuffer.unshift(move);
				}
			} else {
				// Empty buffer: move recovered from periodic FACELETS
				if (this.isSerialInRange(this.lastSerial, this.serial, move.serial, false, true)) {
					this.moveBuffer.unshift(move);
				}
			}
		}
	}

	// Check for missed moves with periodic FACELETS event
	async checkIfMoveMissed(conn) {
		const diff = (this.serial - this.lastSerial) & 0xFF;
		if (diff > 0 && this.serial !== 0) {
			const bufferHead = this.moveBuffer[0];
			const startSerial = bufferHead ? bufferHead.serial : (this.serial + 1) & 0xFF;
			await this.requestMoveHistory(conn, startSerial, diff + 1);
		}
	}

	async handleStateEvent(conn, eventMessage) {
		const timestamp = now();
		let cubeEvents = [];
		const msg = new GanProtocolMessageView(eventMessage);
		const eventType = msg.getBitWord(0, 8);
		const dataLength = msg.getBitWord(8, 8);

		if (eventType == 0x01) {
			// MOVE — add to buffer, evict gap-free ones
			if (this.lastSerial != -1) {
				this.lastLocalTimestamp = timestamp;
				// One notification can carry several 72-bit MOVE chunks: turns made within one
				// BLE connection interval (a fast double turn, a trigger, a slice) travel
				// together. Reading only the first chunk dropped every later one, which then came
				// back from MOVE_HISTORY without a cube timestamp, or not at all. Port of
				// smartcube-web-bluetooth d517e49 ("fixes GAN Gen4 timing issue"). The serial is
				// only taken from chunks that decode to a real face, so trailing garbage cannot
				// move it.
				const msgBitLen = eventMessage.length * 8;
				let off = 0;
				while (off + 72 <= msgBitLen && msg.getBitWord(off, 8) === 0x01) {
					const cubeTimestamp = msg.getBitWord(off + 16, 32, true);
					const serial = msg.getBitWord(off + 48, 16, true);
					const direction = msg.getBitWord(off + 64, 2);
					const face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(off + 66, 6));
					if (face < 0) break;
					this.serial = serial;
					this.moveBuffer.push({
						type: 'MOVE',
						serial: serial,
						timestamp: timestamp,
						localTimestamp: timestamp,
						cubeTimestamp: cubeTimestamp,
						face: face,
						direction: direction,
						move: ('URFDLB'.charAt(face) + " '".charAt(direction)).trim(),
					});
					off += 72;
				}
				// Extract gap-free moves (requestMoveHistory called automatically if gap exists)
				cubeEvents = await this.evictMoveBuffer(conn);
			}
		} else if (eventType == 0xD1) {
			// MOVE_HISTORY — missed move response from cube
			let startSerial = msg.getBitWord(16, 8);
			let count = (dataLength - 1) * 2;
			for (let i = 0; i < count; i++) {
				let face = [1, 5, 3, 0, 4, 2].indexOf(msg.getBitWord(24 + 4 * i, 3));
				let direction = msg.getBitWord(27 + 4 * i, 1);
				if (face >= 0) {
					let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
					this.injectMissedMoveToBuffer({
						type: 'MOVE',
						serial: (startSerial - i) & 0xFF,
						timestamp: timestamp,
						localTimestamp: null, // Recovered moves have no local timestamp
						cubeTimestamp: null,   // Must be estimated by interpolation
						// Recovered from move history: it happened in the past, and
						// `timestamp` above is the recovery moment, not the turn.
						recovered: true,
						face: face,
						direction: direction,
						move: move.trim(),
					});
				}
			}
			// Gap may be filled — evict again
			cubeEvents = await this.evictMoveBuffer();
		} else if (eventType == 0xed) {
			// FACELETS
			let serial = (this.serial = msg.getBitWord(16, 16, true));

			// -- DEBUG: GAN FACELETS byte analysis --
			if (this.GAN_DEBUG_FACELETS) {
				console.log('[GAN-FACELETS] Raw bits (first 128):', msg.bits.slice(0, 128));
				console.log('[GAN-FACELETS] Hardware:', this.hwInfo?.[0xfc] || 'unknown');
			}

			// Check for missed moves with periodic FACELETS (500ms debounce)
			// If serial === lastSerial, no new move → missed move cannot occur, check unnecessary
			if (this.lastSerial != -1 && serial !== this.lastSerial) {
				if (this.lastLocalTimestamp != null && (timestamp - this.lastLocalTimestamp) > 500) {
					await this.checkIfMoveMissed(conn);
				}
			}

			if (this.lastSerial == -1) this.lastSerial = serial;

			let cp = [];
			let co = [];
			let ep = [];
			let eo = [];
			for (let i = 0; i < 7; i++) {
				cp.push(msg.getBitWord(32 + i * 3, 3));
				co.push(msg.getBitWord(53 + i * 2, 2));
			}
			cp.push(28 - sum(cp));
			co.push((3 - (sum(co) % 3)) % 3);
			for (let i = 0; i < 11; i++) {
				ep.push(msg.getBitWord(69 + i * 4, 4));
				eo.push(msg.getBitWord(113 + i, 1));
			}
			ep.push(66 - sum(ep));
			eo.push((2 - (sum(eo) % 2)) % 2);

			if (this.GAN_DEBUG_FACELETS) {
				const facelets = toKociembaFacelets(cp, co, ep, eo);
				console.log('[GAN-FACELETS] CP:', cp, 'CO:', co);
				console.log('[GAN-FACELETS] EP:', ep, 'EO:', eo);
				console.log('[GAN-FACELETS] Result:', facelets);
				console.log('[GAN-FACELETS] Solved?', facelets === 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
			}

			cubeEvents.push({
				type: 'FACELETS',
				serial: serial,
				timestamp: timestamp,
				facelets: toKociembaFacelets(cp, co, ep, eo),
				state: { CP: cp, CO: co, EP: ep, EO: eo },
				// Set when moves are still buffered behind an unfilled gap: this state is
				// ahead of what the app has been given, so the consumer must not adopt it.
				pendingGap: this.hasPendingGap(),
			});
		} else if (eventType >= 0xfa && eventType <= 0xfe) {
			// HARDWARE
			switch (eventType) {
				case 0xfa:
					let year = msg.getBitWord(24, 16, true);
					let month = msg.getBitWord(40, 8);
					let day = msg.getBitWord(48, 8);
					this.hwInfo[eventType] = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
					break;
				case 0xfc:
					this.hwInfo[eventType] = '';
					for (let i = 0; i < dataLength - 1; i++) {
						this.hwInfo[eventType] += String.fromCharCode(msg.getBitWord(i * 8 + 24, 8));
					}
					break;
				case 0xfd:
					let swMajor = msg.getBitWord(24, 4);
					let swMinor = msg.getBitWord(28, 4);
					this.hwInfo[eventType] = `${swMajor}.${swMinor}`;
					break;
				case 0xfe:
					let hwMajor = msg.getBitWord(24, 4);
					let hwMinor = msg.getBitWord(28, 4);
					this.hwInfo[eventType] = `${hwMajor}.${hwMinor}`;
					break;
			}
			if (Object.keys(this.hwInfo).length == 4) {
				this.hardwareInfoEmitted = true;
				cubeEvents.push(this.buildHardwareEvent(timestamp));
			}
		} else if (eventType == 0xec) {
			// GYRO
			const firstGyroThisSession = !this.gyroObserved;
			this.gyroObserved = true;
			let qw = msg.getBitWord(16, 16);
			let qx = msg.getBitWord(32, 16);
			let qy = msg.getBitWord(48, 16);
			let qz = msg.getBitWord(64, 16);
			let vx = msg.getBitWord(80, 4);
			let vy = msg.getBitWord(84, 4);
			let vz = msg.getBitWord(88, 4);
			cubeEvents.push({
				type: 'GYRO',
				timestamp: timestamp,
				quaternion: {
					x: ((1 - (qx >> 15) * 2) * (qx & 0x7fff)) / 0x7fff,
					y: ((1 - (qy >> 15) * 2) * (qy & 0x7fff)) / 0x7fff,
					z: ((1 - (qz >> 15) * 2) * (qz & 0x7fff)) / 0x7fff,
					w: ((1 - (qw >> 15) * 2) * (qw & 0x7fff)) / 0x7fff,
				},
				velocity: {
					x: (1 - (vx >> 3) * 2) * (vx & 0x7),
					y: (1 - (vy >> 3) * 2) * (vy & 0x7),
					z: (1 - (vz >> 3) * 2) * (vz & 0x7),
				},
			});
			// The HARDWARE event that already went out said "no gyroscope"; correct it.
			if (firstGyroThisSession && this.hardwareInfoEmitted && Object.keys(this.hwInfo).length == 4) {
				cubeEvents.push(this.buildHardwareEvent(timestamp));
			}
		} else if (eventType == 0xef) {
			// BATTERY
			let batteryLevel = msg.getBitWord(8 + dataLength * 8, 8);
			cubeEvents.push({
				type: 'BATTERY',
				timestamp: timestamp,
				batteryLevel: Math.min(batteryLevel, 100),
			});
		} else if (eventType == 0xea) {
			// DISCONNECT
			conn.disconnect();
		}
		return cubeEvents;
	}
}

// ============================================================================
// CONNECTION CLASS (Adapter-based)
// ============================================================================

export class GanCubeClassicConnection {
	/**
	 * `validateDecrypted`: structural check on each decrypted payload (see the isValidGan*
	 * functions below). A packet that fails it is dropped before the driver sees it.
	 */
	constructor(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver, validateDecrypted = null) {
		this.adapter = adapter;
		this.device = device;
		this.serviceUuid = serviceUuid;
		this.commandCharUuid = commandCharUuid;
		this.stateCharUuid = stateCharUuid;
		this.encrypter = encrypter;
		this.driver = driver;
		this.validateDecrypted = validateDecrypted;
		this.events$ = new Subject();
		this._disconnected = false;

		this.onStateUpdate = async (value) => {
			if (!value || value.byteLength < 16) return;
			let cubeEvents;
			try {
				// Respect the view's own window: a DataView can sit at an offset inside a
				// larger buffer, and decrypting the whole buffer read the wrong bytes.
				const raw = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
				const decryptedMessage = this.encrypter.decrypt(raw);
				// A packet that decrypts to nothing the protocol can produce is noise or a
				// wrong MAC. Parsing it anyway turned garbage into moves; and the first
				// "valid" packet is what confirms the connection, so it must be a real one.
				if (this.validateDecrypted && !this.validateDecrypted(decryptedMessage)) return;
				cubeEvents = await this.driver.handleStateEvent(this, decryptedMessage);
			} catch (e) {
				// A corrupt frame must not reject into the BLE callback; the next one carries on.
				console.warn('[ZKT:GAN] dropping undecodable packet:', e?.message);
				return;
			}
			cubeEvents.forEach((e) => this.events$.next(e));
		};

		this.onDisconnect = async () => {
			if (this._disconnected) return;
			this._disconnected = true;
			try {
				await this.adapter.stopNotifications(this.device, this.serviceUuid, this.stateCharUuid);
			} catch (e) { }
			this.events$.next({ timestamp: now(), type: 'DISCONNECT' });
			this.events$.unsubscribe();
		};
	}

	static async create(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver, validateDecrypted = null) {
		const conn = new GanCubeClassicConnection(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver, validateDecrypted);
		await adapter.startNotifications(device, serviceUuid, stateCharUuid, conn.onStateUpdate);
		return conn;
	}

	get deviceName() {
		return this.device.name || 'GAN-XXXX';
	}

	get deviceMAC() {
		return this.device.mac || '00:00:00:00:00:00';
	}

	async sendCommandMessage(message) {
		const encryptedMessage = this.encrypter.encrypt(message);
		return this.adapter.writeCharacteristic(this.device, this.serviceUuid, this.commandCharUuid, encryptedMessage.buffer);
	}

	async sendCubeCommand(command) {
		const commandMessage = this.driver.createCommandMessage(command);
		if (commandMessage) {
			return this.sendCommandMessage(commandMessage);
		}
	}

	async disconnect() {
		await this.onDisconnect();
		try {
			await this.adapter.disconnect(this.device);
		} catch (e) { }
	}
}

// ============================================================================
// DECRYPTED PACKET VALIDATION
// ============================================================================
//
// Structural checks on a decrypted Gen2/Gen3/Gen4 payload: the header is one the protocol
// defines and the fields that can be range-checked are in range. A wrong MAC decrypts to
// noise, and noise used to be parsed anyway: a byte that happened to read as MOVE or
// FACELETS confirmed a connection that was never real, or put a phantom turn in the stream.
// Port of smartcube-web-bluetooth src/gan-gen234-packet-validate.ts (Pau Oliva, MIT).

export function isValidGanGen2Packet(e) {
	if (!e || e.length < 16) return false;
	try {
		const t = new GanProtocolMessageView(e);
		const i = t.getBitWord(0, 4);
		if (![1, 2, 4, 5, 9, 13].includes(i)) return false;
		if (i === 1) {
			// GYRO: an all-zero quaternion is not an orientation.
			const a = t.getBitWord(4, 16);
			const b = t.getBitWord(20, 16);
			const c = t.getBitWord(36, 16);
			const d = t.getBitWord(52, 16);
			if (a === 0 && b === 0 && c === 0 && d === 0) return false;
		} else if (i === 2) {
			// MOVE: seven face slots, each 0..5.
			for (let j = 0; j < 7; j++) {
				if (t.getBitWord(12 + 5 * j, 4) > 5) return false;
			}
		} else if (i === 4) {
			// FACELETS: the permutation sums bound what a real state can hold. The 12th edge
			// orientation is rebuilt from parity, so the 11 sent bits cannot be checked.
			let s = 0;
			for (let j = 0; j < 7; j++) s += t.getBitWord(12 + 3 * j, 3);
			if (s > 28) return false;
			let x = 0;
			for (let j = 0; j < 11; j++) x += t.getBitWord(47 + 4 * j, 4);
			if (x > 66) return false;
		} else if (i === 9) {
			// BATTERY
			if (t.getBitWord(8, 8) > 100) return false;
		} else if (i === 5) {
			// HARDWARE: the model name is printable ASCII or padding.
			for (let j = 0; j < 8; j++) {
				const v = t.getBitWord(8 * j + 40, 8);
				if (v !== 0 && (v < 32 || v > 126)) return false;
			}
		}
		return true;
	} catch (err) {
		return false;
	}
}

export function isValidGanGen3Packet(e) {
	if (!e || e.length < 16) return false;
	try {
		const t = new GanProtocolMessageView(e);
		const magic = t.getBitWord(0, 8);
		const type = t.getBitWord(8, 8);
		const length = t.getBitWord(16, 8);
		if (magic !== 0x55 || length === 0 || ![1, 2, 6, 7, 16, 17].includes(type)) return false;
		if (type === 1 && [2, 32, 8, 1, 16, 4].indexOf(t.getBitWord(74, 6)) < 0) return false;
		return true;
	} catch (err) {
		return false;
	}
}

export function isValidGanGen4Packet(e) {
	if (!e || e.length < 16) return false;
	try {
		const t = new GanProtocolMessageView(e);
		const type = t.getBitWord(0, 8);
		if (![0x01, 0xd1, 0xed, 0xec, 0xef, 0xea, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe].includes(type)) return false;
		if (type === 0x01 && [2, 32, 8, 1, 16, 4].indexOf(t.getBitWord(66, 6)) < 0) return false;
		return true;
	} catch (err) {
		return false;
	}
}
