import SmartCube from './smart_cube';
import { isEqual } from 'lodash';
import LZString from './lz_string';
import aes128 from './ae128';
import { Subject } from 'rxjs';
import { ModeOfOperation } from 'aes-js';
import { isNative } from '../../../../util/platform';
import Cube from 'cubejs';
import { getStore } from '../../../store';
import { setSmartSolveEndTime, setSmartCubeClockSkew, getSmartCubeClockSkew } from '../../helpers/events';

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

// Hamle ters çevirme: R → R', R' → R, R2 → R2
function invertMove(move) {
	if (move.endsWith("'")) return move.slice(0, -1);
	if (move.endsWith('2')) return move;
	return move + "'";
}

// GAN service and characteristic UUIDs
const GAN_GEN2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
const GAN_GEN2_COMMAND_CHARACTERISTIC = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';
const GAN_GEN2_STATE_CHARACTERISTIC = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';

const GAN_GEN3_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_GEN3_COMMAND_CHARACTERISTIC = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_GEN3_STATE_CHARACTERISTIC = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';

const GAN_GEN4_SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
const GAN_GEN4_COMMAND_CHARACTERISTIC = '0000fff5-0000-1000-8000-00805f9b34fb';
const GAN_GEN4_STATE_CHARACTERISTIC = '0000fff6-0000-1000-8000-00805f9b34fb';

// List of Company Identifier Codes for GAN cubes
const GAN_CIC_LIST = Array(256)
	.fill(undefined)
	.map((_, i) => (i << 8) | 0x01);

// Encryption keys
const GAN_ENCRYPTION_KEYS = [
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
const now =
	typeof window != 'undefined' && typeof window.performance?.now == 'function'
		? () => Math.floor(window.performance.now())
		: () => Date.now();

// ============================================================================
// ENCRYPTERS (inline from gan-web-bluetooth since they are not exported)
// ============================================================================

class GanGen2CubeEncrypter {
	constructor(key, iv, salt) {
		if (key.length != 16) throw new Error('Key must be 16 bytes (128-bit) long');
		if (iv.length != 16) throw new Error('Iv must be 16 bytes (128-bit) long');
		if (salt.length != 6) throw new Error('Salt must be 6 bytes (48-bit) long');
		// Apply salt to key and iv
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

class GanGen3CubeEncrypter extends GanGen2CubeEncrypter { }
class GanGen4CubeEncrypter extends GanGen2CubeEncrypter { }

// ============================================================================
// PROTOCOL MESSAGE VIEW
// ============================================================================

class GanProtocolMessageView {
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

const sum = (arr) => arr.reduce((a, v) => a + v, 0);

const CORNER_FACELET_MAP = [
	[8, 9, 20],
	[6, 18, 38],
	[0, 36, 47],
	[2, 45, 11],
	[29, 26, 15],
	[27, 44, 24],
	[33, 53, 42],
	[35, 17, 51],
];
const EDGE_FACELET_MAP = [
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

function toKociembaFacelets(cp, co, ep, eo) {
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

class GanGen2ProtocolDriver {
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

// Gen3 driver — moveBuffer + requestMoveHistory (gan-web-bluetooth referansından)
class GanGen3ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
		this.moveBuffer = [];
		this.lastLocalTimestamp = null;
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
		const msg = new Uint8Array(16).fill(0);
		if (serial % 2 === 0) serial = (serial - 1) & 0xFF;
		if (count % 2 === 1) count++;
		count = Math.min(count, serial + 1);
		msg.set([0x68, 0x03, serial, 0, count, 0]);
		return conn.sendCommandMessage(msg).catch((e) => {
			console.warn('[ZKT:MOVEBUF] Gen3 requestMoveHistory GATT yazma hatasi', e?.message);
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
		if (conn && this.moveBuffer.length > 16) {
			console.error('[ZKT:MOVEBUF] Gen3 buffer overflow! Baglanti kesiliyor.', { bufferLen: this.moveBuffer.length });
			conn.disconnect();
		}
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
				// MOVE — buffer'a ekle, gap-free olanları evict et
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
				// MOVE_HISTORY — kaçırılmış hamle yanıtı
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

				// serial === lastSerial ise yeni hamle yok → kayip hamle olamaz, kontrol gereksiz
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

// Gen4 driver — moveBuffer + requestMoveHistory (gan-web-bluetooth referansından)
// Gap recovery doğrudan driver içinde yapılır. Consumer'a sadece gap-free MOVE event'leri gönderilir.
class GanGen4ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
		this.hwInfo = {};
		this.moveBuffer = []; // FIFO buffer: gap'ler doldurulana kadar hamleleri tutar
		this.lastLocalTimestamp = null;
	}
	createCommandMessage(command) {
		let msg = new Uint8Array(20).fill(0);
		switch (command.type) {
			case 'REQUEST_FACELETS':
				msg.set([0xdd, 0x04, 0x00, 0xed, 0x00, 0x00]);
				break;
			case 'REQUEST_HARDWARE':
				this.hwInfo = {};
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

	// Dairesel serial numarasının (mod 256) [start, end] aralığında olup olmadığını kontrol eder
	isSerialInRange(start, end, serial, closedStart = false, closedEnd = false) {
		return ((end - start) & 0xFF) >= ((serial - start) & 0xFF)
			&& (closedStart || ((start - serial) & 0xFF) > 0)
			&& (closedEnd || ((end - serial) & 0xFF) > 0);
	}

	// Küp donanımından kaçırılan hamleleri ister (Gen4: 0xD1 komutu)
	async requestMoveHistory(conn, serial, count) {
		// GATT race condition guard: onceki istek hala devam ediyorsa atla
		if (this._historyInFlight) {
			return;
		}
		this._historyInFlight = true;
		const msg = new Uint8Array(20).fill(0);
		// Firmware kısıtı: tek serial + çift count gerekli
		if (serial % 2 === 0) serial = (serial - 1) & 0xFF;
		if (count % 2 === 1) count++;
		// 255→0 sınırını geçme (firmware bug'ı: sınır ötesi hamleler 'D' olarak dönüyor)
		count = Math.min(count, serial + 1);
		msg.set([0xD1, 0x04, serial, 0, count, 0]);
		return conn.sendCommandMessage(msg).catch((e) => {
			console.warn('[ZKT:MOVEBUF] Gen4 requestMoveHistory GATT yazma hatasi', e?.message);
		}).finally(() => {
			this._historyInFlight = false;
		});
	}

	// FIFO buffer'dan gap-free hamleleri çıkar. Gap varsa requestMoveHistory çağır.
	async evictMoveBuffer(conn) {
		const evictedEvents = [];
		while (this.moveBuffer.length > 0) {
			const bufferHead = this.moveBuffer[0];
			const diff = this.lastSerial === -1 ? 1 : (bufferHead.serial - this.lastSerial) & 0xFF;
			if (diff > 1) {
				// Gap var — kaçırılan hamleleri küpten iste
				if (conn) {
					await this.requestMoveHistory(conn, bufferHead.serial, diff);
				}
				break; // Gap doldurulana kadar eviction durdur
			} else {
				evictedEvents.push(this.moveBuffer.shift());
				this.lastSerial = bufferHead.serial;
			}
		}
		// Güvenlik: buffer çok büyürse bağlantıyı kes (bir şeyler yanlış gitti)
		if (conn && this.moveBuffer.length > 16) {
			console.error('[ZKT:MOVEBUF] Gen4 buffer overflow! Baglanti kesiliyor.', { bufferLen: this.moveBuffer.length });
			conn.disconnect();
		}
		return evictedEvents;
	}

	// Kurtarılan hamleleri buffer'ın doğru pozisyonuna yerleştirir
	injectMissedMoveToBuffer(move) {
		if (move.type === 'MOVE') {
			if (this.moveBuffer.length > 0) {
				const bufferHead = this.moveBuffer[0];
				// Aynı serial zaten varsa atla
				if (this.moveBuffer.some(e => e.type === 'MOVE' && e.serial === move.serial)) {
					return;
				}
				// Serial aralık dışındaysa atla
				if (!this.isSerialInRange(this.lastSerial, bufferHead.serial, move.serial)) {
					return;
				}
				// Buffer head'in hemen öncesiyse başa ekle
				if (move.serial === ((bufferHead.serial - 1) & 0xFF)) {
					this.moveBuffer.unshift(move);
				}
			} else {
				// Boş buffer: periyodik FACELETS ile kurtarılan hamle
				if (this.isSerialInRange(this.lastSerial, this.serial, move.serial, false, true)) {
					this.moveBuffer.unshift(move);
				}
			}
		}
	}

	// Periyodik FACELETS event'i ile kaçırılan hamle kontrolü
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
			// MOVE — buffer'a ekle, gap-free olanları evict et
			if (this.lastSerial != -1) {
				this.lastLocalTimestamp = timestamp;
				let cubeTimestamp = msg.getBitWord(16, 32, true);
				let serial = (this.serial = msg.getBitWord(48, 16, true));
				let direction = msg.getBitWord(64, 2);
				let face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(66, 6));
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
				// Gap-free hamleleri çıkar (gap varsa requestMoveHistory otomatik çağrılır)
				cubeEvents = await this.evictMoveBuffer(conn);
			}
		} else if (eventType == 0xD1) {
			// MOVE_HISTORY — küpten gelen kaçırılmış hamle yanıtı
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
						localTimestamp: null, // Kurtarılan hamlelerin yerel zaman damgası yok
						cubeTimestamp: null,   // Enterpolasyon ile tahmin edilmeli
						face: face,
						direction: direction,
						move: move.trim(),
					});
				}
			}
			// Gap dolmuş olabilir — tekrar evict et
			cubeEvents = await this.evictMoveBuffer();
		} else if (eventType == 0xed) {
			// FACELETS
			let serial = (this.serial = msg.getBitWord(16, 16, true));

			// -- DEBUG: GAN FACELETS byte analizi --
			if (this.GAN_DEBUG_FACELETS) {
				console.log('[GAN-FACELETS] Raw bits (first 128):', msg.bits.slice(0, 128));
				console.log('[GAN-FACELETS] Hardware:', this.hwInfo?.[0xfc] || 'unknown');
			}

			// Periyodik FACELETS ile kaçırılan hamle kontrolü (500ms debounce)
			// serial === lastSerial ise yeni hamle yok → kayip hamle olamaz, kontrol gereksiz
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
				cubeEvents.push({
					type: 'HARDWARE',
					timestamp: timestamp,
					hardwareName: this.hwInfo[0xfc],
					hardwareVersion: this.hwInfo[0xfe],
					softwareVersion: this.hwInfo[0xfd],
					productDate: this.hwInfo[0xfa],
					gyroSupported: ['GAN12uiM'].indexOf(this.hwInfo[0xfc]) != -1,
				});
			}
		} else if (eventType == 0xec) {
			// GYRO
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

class GanCubeClassicConnection {
	constructor(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver) {
		this.adapter = adapter;
		this.device = device;
		this.serviceUuid = serviceUuid;
		this.commandCharUuid = commandCharUuid;
		this.stateCharUuid = stateCharUuid;
		this.encrypter = encrypter;
		this.driver = driver;
		this.events$ = new Subject();
		this._disconnected = false;

		this.onStateUpdate = async (value) => {
			if (value && value.byteLength >= 16) {
				const decryptedMessage = this.encrypter.decrypt(new Uint8Array(value.buffer));
				const cubeEvents = await this.driver.handleStateEvent(this, decryptedMessage);
				cubeEvents.forEach((e) => this.events$.next(e));
			}
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

	static async create(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver) {
		const conn = new GanCubeClassicConnection(adapter, device, serviceUuid, commandCharUuid, stateCharUuid, encrypter, driver);
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

export default class GAN extends SmartCube {
	device;
	adapter;

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;
		this.gyroListeners = [];
		// Move batching properties
		this.moveQueue = [];
		this.moveFlushTimeout = null;
		this.BATCH_FLUSH_DELAY = 8; // 8ms - daha responsive (live analysis için)
		// FACELETS resync flag
		this._resyncPending = false;
		// Küp durumu takibi
		this._trackerCube = new Cube(); // BLE'den alınan tüm hamleleri takip eder
		this.GAN_DEBUG_FACELETS = false; // true yaparak FACELETS byte'larini logla
		// Sessizlik algılayıcı: son hamleden sonra FACELETS iste (çözüm algılama güvenliği)
		this._silenceTimeoutId = null;
		this._silenceRetryId = null;
		this._SILENCE_TIMEOUT = 200; // 0.2 saniye
		// cubeTimestamp kalibrasyon (artik ganInitialFacelets kullanilmiyor — solved detection sadece smartSolvedState)
		// cubeTimestamp → Date.now() kalibrasyon ofseti
		this._cubeTimeOffset = null;
		// Clock skew: (localTimestamp, cubeTimestamp) çiftleri — pre-solve hamlelerden toplanır
		this._skewSamples = [];
		this._SKEW_WINDOW = 50; // Son N örnek
	}

	subscribeGyro(callback) {
		this.gyroListeners.push(callback);
		return () => {
			this.gyroListeners = this.gyroListeners.filter((cb) => cb !== callback);
		};
	}

	retryCount = 0;

	customMacAddressProvider = async (device, isFallbackCall) => {
		const CACHE_KEY = 'gan_cube_mac';
		const cachedMac = localStorage.getItem(CACHE_KEY);

		// Capacitor Android: deviceId is the MAC address
		if (isNative() && device.deviceId && device.deviceId.includes(':')) {
			localStorage.setItem(CACHE_KEY, device.deviceId);
			return device.deviceId;
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
			// If fallback (and we exhausted retries), prompt user
			macAddress = prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:', cachedMac || '');
		} else {
			// On native, watchAdvertisements won't work, skip the prompt about chrome flags
			if (isNative()) {
				macAddress = null;
			} else {
				macAddress =
					this.adapter.watchAdvertisements
						? null
						: prompt(
							'Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:',
							cachedMac || ''
						);
			}
		}

		if (macAddress) {
			const cleanedMac = macAddress.trim().toUpperCase();
			localStorage.setItem(CACHE_KEY, cleanedMac);
			return cleanedMac;
		}
		return macAddress;
	};

	/**
	 * Connect to GAN cube using the already-selected BleDevice
	 */
	connectWithExistingDevice = async (device, macAddressProvider) => {
		// Retrieve cube MAC address needed for key salting
		let mac =
			(macAddressProvider && (await macAddressProvider(device, false))) ||
			(await autoRetrieveMacAddress(this.adapter, device)) ||
			(macAddressProvider && (await macAddressProvider(device, true)));

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

		// Connect via adapter and get device primary services
		await this.adapter.connect(device, () => {
			// onDisconnect callback
			if (this.conn) {
				this.conn.onDisconnect();
			}
		});
		const services = await this.adapter.getServices(device);

		let conn = null;

		// Resolve type of connected cube device and setup appropriate encryption / protocol driver
		for (const serviceUUID of services) {
			const svcLower = serviceUUID.toLowerCase();
			if (svcLower === GAN_GEN2_SERVICE) {
				const key = device.name?.startsWith('AiCube') ? GAN_ENCRYPTION_KEYS[1] : GAN_ENCRYPTION_KEYS[0];
				const encrypter = new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
				const driver = new GanGen2ProtocolDriver();
				conn = await GanCubeClassicConnection.create(this.adapter, device, svcLower, GAN_GEN2_COMMAND_CHARACTERISTIC, GAN_GEN2_STATE_CHARACTERISTIC, encrypter, driver);
				break;
			} else if (svcLower === GAN_GEN3_SERVICE) {
				const key = GAN_ENCRYPTION_KEYS[0];
				const encrypter = new GanGen3CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
				const driver = new GanGen3ProtocolDriver();
				conn = await GanCubeClassicConnection.create(this.adapter, device, svcLower, GAN_GEN3_COMMAND_CHARACTERISTIC, GAN_GEN3_STATE_CHARACTERISTIC, encrypter, driver);
				break;
			} else if (svcLower === GAN_GEN4_SERVICE) {
				const key = GAN_ENCRYPTION_KEYS[0];
				const encrypter = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
				const driver = new GanGen4ProtocolDriver();
				conn = await GanCubeClassicConnection.create(this.adapter, device, svcLower, GAN_GEN4_COMMAND_CHARACTERISTIC, GAN_GEN4_STATE_CHARACTERISTIC, encrypter, driver);
				break;
			}
		}

		if (!conn) {
			throw new Error("Can't find target BLE services - wrong or unsupported cube device model");
		}

		return conn;
	};

	init = async () => {
		// Use the existing device instead of calling connectGanCube which triggers a new requestDevice
		this.conn = await this.connectWithExistingDevice(this.device, async (device, isFallback) => {
			const mac = await this.customMacAddressProvider(device, isFallback);
			return mac;
		});

		this.conn.events$.subscribe(this.handleCubeEvent);

		await this.conn.sendCubeCommand({ type: 'REQUEST_BATTERY' });
		await this.conn.sendCubeCommand({ type: 'REQUEST_HARDWARE' });
		await this.conn.sendCubeCommand({ type: 'REQUEST_FACELETS' }); // Tracker'ı fiziksel durumla senkronize et

		// Not: alertConnected artık HARDWARE event'i alındıktan sonra çağrılıyor
	};

	handleCubeEvent = (event) => {
		if (event.type == 'MOVE') {
			if (event.move) {
				// cubeTimestamp kalibrasyonu: küp dahili saatini yerel zamana eşle
				if (event.cubeTimestamp != null) {
					const localNow = Date.now();
					const newOffset = localNow - event.cubeTimestamp;
					const timerRunning = !!getStore().getState().timer.timeStartedAt;

					if (this._cubeTimeOffset === null) {
						this._cubeTimeOffset = newOffset;
					} else if (!timerRunning) {
						// Solve sırasında offset güncelleme — drift'i önle
						const diff = Math.abs(newOffset - this._cubeTimeOffset);
						if (diff > 2000) {
							this._cubeTimeOffset = newOffset;
							this._skewSamples = []; // Büyük sıçramada sample'ları sıfırla
						} else {
							this._cubeTimeOffset = this._cubeTimeOffset * 0.9 + newOffset * 0.1;
						}

						// Clock skew hesaplama: pre-solve hamlelerden (local, cube) çiftleri topla
						this._skewSamples.push({ local: localNow, cube: event.cubeTimestamp });
						if (this._skewSamples.length > this._SKEW_WINDOW) {
							this._skewSamples.shift();
						}
						if (this._skewSamples.length >= 10) {
							// Normalize: büyük timestamp'lerde floating-point hassasiyet kaybını önle
							// Date.now() ~1.77e12, linregress'te ΣX² catastrophic cancellation yapar
							const baseLocal = this._skewSamples[0].local;
							const baseCube = this._skewSamples[0].cube;
							const locals = this._skewSamples.map(s => s.local - baseLocal);
							const cubes = this._skewSamples.map(s => s.cube - baseCube);
							const [slope] = linregress(locals, cubes);
							const skew = Math.round((slope - 1) * 100000) / 1000; // ör. -0.719
							setSmartCubeClockSkew(skew);
						}
					}
					// timerRunning === true ise offset freeze — BLE latency varyasyonu completedAt'lere sızmaz
				}

				// Kalibre edilmiş timestamp hesapla
				const moveTimestamp = (event.cubeTimestamp != null && this._cubeTimeOffset !== null)
					? event.cubeTimestamp + this._cubeTimeOffset
					: Date.now();

				// Tracker küpü güncelle
				this._trackerCube.move(event.move);

				// Senkron solved check: React render beklemeden timer display'i dondur
				const solvedState = getStore().getState().timer.smartSolvedState;
				if (solvedState && this._trackerCube.asString() === solvedState) {
					// Clock skew düzeltmeli freeze: display = kayıt = GAN referans
					// Böylece "ileri git → geri gel" efekti olmaz
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

				// NOT: Driver artık gap recovery'yi dahili olarak yapıyor (moveBuffer + requestMoveHistory).
				// Buraya sadece gap-free, sıralı MOVE event'leri gelir. Holding mode gereksiz.

				// Queue'ya ekle
				this.moveQueue.push({
					move: event.move,
					timestamp: moveTimestamp,
					cubeTimestamp: event.cubeTimestamp ?? null,
					localTimestamp: event.localTimestamp ?? null,
				});

				// Debounced flush
				if (this.moveFlushTimeout) {
					clearTimeout(this.moveFlushTimeout);
				}
				this.moveFlushTimeout = setTimeout(
					() => this.flushMoveQueue(),
					this.BATCH_FLUSH_DELAY
				);

				// Sessizlik algılayıcı: son hamleden sonra FACELETS iste (çözüm algılama güvenliği)
				if (this._silenceTimeoutId) clearTimeout(this._silenceTimeoutId);
				if (this._silenceRetryId) clearTimeout(this._silenceRetryId);
				this._silenceTimeoutId = setTimeout(() => {
					this.requestFaceletsResync();
					this._silenceRetryId = setTimeout(() => {
						this.requestFaceletsResync(true);
					}, 1500);
				}, this._SILENCE_TIMEOUT);
			}

		// NOT: SERIAL_GAP artık driver tarafından dahili olarak işleniyor.
		// Driver moveBuffer + requestMoveHistory kullanarak gap recovery yapar.
		// Consumer'a sadece gap-free MOVE event'leri gönderilir.

		} else if (event.type == 'FACELETS') {
			const trackerState = this._trackerCube.asString();
			const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
			const isSolved = event.facelets === SOLVED;

			// Tracker'ı fiziksel duruma senkronize et
			try {
				this._trackerCube = Cube.fromString(event.facelets);
			} catch (e) {
				console.error('[ZKT:GAN] FACELETS parse hatasi:', e?.message);
			}

			// NOT: ganInitialFacelets kaldirildi — solved detection sadece smartSolvedState kullanir

			// Redux'a bildir (SmartCube.tsx güvenlik ağı için)
			this.alertCubeState(event.facelets);
		} else if (event.type == 'GYRO') {
			// Jiroskop verilerini işle
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
			// Jiroskop desteği durumunu bildir
			this.alertGyroSupported(event.gyroSupported);

			// HARDWARE bilgisi alındıktan sonra bağlantıyı tamamla
			const deviceId = this.conn?.deviceMAC || this.device?.deviceId || 'unknown';
			const dummyServer = {
				device: {
					name: this.hardwareName || this.device?.name || 'GAN Cube',
					id: deviceId,
				},
			};
			this.alertConnected(dummyServer);
		} else if (event.type == 'BATTERY') {
			this.alertBatteryLevel(event.batteryLevel);
		} else if (event.type == 'DISCONNECT') {
			this.alertDisconnected();
		}
	};

	flushMoveQueue = () => {
		if (this.moveQueue.length === 0) return;

		// Batch'i kopyala ve queue'yu temizle
		const batch = [...this.moveQueue];
		this.moveQueue = [];
		this.moveFlushTimeout = null;

		// Tek batch olarak Redux'a gönder
		this.alertTurnCubeBatch(batch);
	};

	requestFaceletsResync = async (force = false) => {
		if (this._resyncPending && !force) return;
		this._resyncPending = true;
		try {
			if (this.conn) {
				await this.conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
			}
		} catch (e) {
			// BLE yazma hatası sessizce yutulur
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

		// Flush pending moves before disconnect
		if (this.moveFlushTimeout) {
			clearTimeout(this.moveFlushTimeout);
			this.flushMoveQueue();
		}

		// Tracker sıfırla
		this._trackerCube = new Cube();

		// Disconnect connection if exists
		if (this.conn) {
			try {
				await this.conn.disconnect();
			} catch (error) {
			}
		}
	};
}
