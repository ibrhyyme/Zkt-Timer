import SmartCube from './smart_cube';
import { isEqual } from 'lodash';
import LZString from './lz_string';
import aes128 from './ae128';
import { Subject } from 'rxjs';
import { ModeOfOperation } from 'aes-js';
import { isNative } from '../../../../util/platform';
import Cube from 'cubejs';

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

// Simplified Gen3 driver (subset of functionality)
class GanGen3ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
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
	async handleStateEvent(conn, eventMessage) {
		const timestamp = now();
		const cubeEvents = [];
		const msg = new GanProtocolMessageView(eventMessage);
		const magic = msg.getBitWord(0, 8);
		const eventType = msg.getBitWord(8, 8);
		const dataLength = msg.getBitWord(16, 8);

		if (magic == 0x55 && dataLength > 0) {
			if (eventType == 0x01) {
				// MOVE
				if (this.lastSerial != -1) {
					let cubeTimestamp = msg.getBitWord(24, 32, true);
					let serial = (this.serial = msg.getBitWord(56, 16, true));

					// Seri boşluk kontrolü - kaçırılmış hamle algılama (8-bit wrap: 255→0)
					const gap = (serial - this.lastSerial) & 0xFF;
					if (gap > 1) {
						cubeEvents.push({
							type: 'SERIAL_GAP',
							serial: serial,
							lastSerial: this.lastSerial,
							missedCount: gap - 1,
							timestamp: timestamp,
						});
					}

					let direction = msg.getBitWord(72, 2);
					let face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(74, 6));
					let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
					if (face >= 0) {
						cubeEvents.push({
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
					// lastSerial'ı HER ZAMAN güncelle (face < 0 olsa bile cascading gap önlemek için)
					this.lastSerial = serial;
				}
			} else if (eventType == 0x02) {
				// FACELETS
				let serial = (this.serial = msg.getBitWord(24, 16, true));
				this.lastSerial = serial;
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

// Simplified Gen4 driver
class GanGen4ProtocolDriver {
	constructor() {
		this.serial = -1;
		this.lastSerial = -1;
		this.hwInfo = {};
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
	async handleStateEvent(conn, eventMessage) {
		const timestamp = now();
		const cubeEvents = [];
		const msg = new GanProtocolMessageView(eventMessage);
		const eventType = msg.getBitWord(0, 8);
		const dataLength = msg.getBitWord(8, 8);

		if (eventType == 0x01) {
			// MOVE
			if (this.lastSerial != -1) {
				let cubeTimestamp = msg.getBitWord(16, 32, true);
				let serial = (this.serial = msg.getBitWord(48, 16, true));

				// Seri boşluk kontrolü - kaçırılmış hamle algılama (8-bit wrap: 255→0)
				const gap = (serial - this.lastSerial) & 0xFF;
				if (gap > 1) {
					cubeEvents.push({
						type: 'SERIAL_GAP',
						serial: serial,
						lastSerial: this.lastSerial,
						missedCount: gap - 1,
						timestamp: timestamp,
					});
				}

				let direction = msg.getBitWord(64, 2);
				let face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(66, 6));
				let move = 'URFDLB'.charAt(face) + " '".charAt(direction);
				if (face >= 0) {
					cubeEvents.push({
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
				// lastSerial'ı HER ZAMAN güncelle (face < 0 olsa bile cascading gap önlemek için)
				this.lastSerial = serial;
			}
		} else if (eventType == 0xed) {
			// FACELETS
			let serial = (this.serial = msg.getBitWord(16, 16, true));
			this.lastSerial = serial;
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
		// Kayıp hamle kurtarma sistemi
		this._trackerCube = new Cube(); // BLE'den alınan tüm hamleleri takip eder
		this._holdingForResync = false; // SERIAL_GAP sonrası hamle tutma modu
		this._heldMoveEvents = []; // Bekletilen hamle event'leri
		this._holdTimeoutId = null; // Zaman aşımı güvenliği
		// Sessizlik algılayıcı: son hamleden 1.5s sonra FACELETS iste
		// Son çözme hamlesi BLE'den düşerse bile timer'ın durmasını sağlar
		this._silenceTimeoutId = null;
		this._SILENCE_TIMEOUT = 500; // 0.5 saniye
		// Otomatik kalibrasyon: ilk FACELETS = çözülmüş durum referansı
		this._ganInitialFacelets = null;
		// cubeTimestamp → Date.now() kalibrasyon ofseti
		this._cubeTimeOffset = null;
		// SERIAL_GAP tespit zamanı (inferred move timestamp için)
		this._gapDetectedAt = null;
		// Bekleyen FACELETS istek sayacı (stale yanıt filtreleme)
		this._pendingFaceletsRequests = 0;
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
					if (this._cubeTimeOffset === null) {
						this._cubeTimeOffset = localNow - event.cubeTimestamp;
					} else {
						// Drift kontrolü: 2 saniyeden fazla sapma varsa yeniden kalibre et
						const expectedLocal = event.cubeTimestamp + this._cubeTimeOffset;
						if (Math.abs(localNow - expectedLocal) > 2000) {
							this._cubeTimeOffset = localNow - event.cubeTimestamp;
						}
					}
				}

				// Kalibre edilmiş timestamp hesapla
				const moveTimestamp = (event.cubeTimestamp != null && this._cubeTimeOffset !== null)
					? event.cubeTimestamp + this._cubeTimeOffset
					: Date.now();

				// Tracker küpü HER ZAMAN güncelle (kayıp hamle hesaplaması için)
				this._trackerCube.move(event.move);

				if (this._holdingForResync) {
					// SERIAL_GAP sonrası FACELETS bekleniyor - hamleyi beklet
					event._receivedAt = moveTimestamp;
					this._heldMoveEvents.push(event);
					return;
				}

				// Normal işlem: queue'ya ekle
				this.moveQueue.push({
					move: event.move,
					timestamp: moveTimestamp
				});

				// Debounced flush - 8ms içinde gelen tüm hamleler batch'lenir
				if (this.moveFlushTimeout) {
					clearTimeout(this.moveFlushTimeout);
				}
				this.moveFlushTimeout = setTimeout(
					() => this.flushMoveQueue(),
					this.BATCH_FLUSH_DELAY
				);

				// Sessizlik algılayıcı: son hamleden 1.5s sonra FACELETS iste
				// Son çözme hamlesi BLE'den düşerse bile timer'ın durmasını sağlar
				if (this._silenceTimeoutId) clearTimeout(this._silenceTimeoutId);
				this._silenceTimeoutId = setTimeout(() => {
					this.requestFaceletsResync();
				}, this._SILENCE_TIMEOUT);
			} else {
			}
		} else if (event.type == 'SERIAL_GAP') {

			if (this._holdingForResync) {
				// Zaten bekleniyor - ek boşluk, FACELETS yanıtını bekle
				return;
			}

			// Bekleyen hamleleri hemen flush et (gap öncesi hamleler)
			if (this.moveFlushTimeout) {
				clearTimeout(this.moveFlushTimeout);
			}
			this.flushMoveQueue();

			// Hamle tutma modunu başlat
			this._holdingForResync = true;
			this._heldMoveEvents = [];
			this._gapDetectedAt = Date.now();

			// Bekleyen sessizlik timer'ını iptal et
			// Stale FACELETS yanıtının resync FACELETS'i ile çakışmasını önler
			if (this._silenceTimeoutId) {
				clearTimeout(this._silenceTimeoutId);
				this._silenceTimeoutId = null;
			}

			// Zaman aşımı güvenliği - 2 saniye içinde FACELETS gelmezse FACELETS tekrar iste
			if (this._holdTimeoutId) clearTimeout(this._holdTimeoutId);
			this._holdTimeoutId = setTimeout(() => {
				if (this._holdingForResync) {
					this._holdingForResync = false;
					// Held hamleleri ATIL - FACELETS geldiğinde doğru durum alınacak
					this._heldMoveEvents = [];
					// Tekrar FACELETS iste
					this.requestFaceletsResync();
				}
			}, 2000);

			// FACELETS isteği ile küpün gerçek durumunu al
			// force=true: debounce'u atla (sessizlik timer'ı zaten bir istek göndermiş olabilir)
			this.requestFaceletsResync(true);
		} else if (event.type == 'FACELETS') {
			// Bekleyen FACELETS istek sayacını güncelle
			this._pendingFaceletsRequests = Math.max(0, this._pendingFaceletsRequests - 1);

			if (this._holdingForResync) {
				// Stale FACELETS kontrolü: hala bekleyen yanıtlar varsa bu eski bir yanıt
				// Sessizlik timer'ı SERIAL_GAP'ten önce FACELETS istemiş olabilir
				// ve o eski yanıt resync yanıtımızdan önce gelmiş olabilir
				if (this._pendingFaceletsRequests > 0) {
					return; // Holding mode'da kal, resync işleme
				}

				// Zaman aşımı timer'ını temizle (doğru resync yanıtı alındı)
				if (this._holdTimeoutId) {
					clearTimeout(this._holdTimeoutId);
					this._holdTimeoutId = null;
				}

				this._holdingForResync = false;

				const faceletsState = event.facelets;
				const trackerState = this._trackerCube.asString();

				if (trackerState !== faceletsState) {
					// Kayıp hamle(ler) var - matematiksel olarak hesapla
					// tracker = preGap * heldMoves (kayıp hamle yok)
					// FACELETS = preGap * kayıpHamle * heldMoves (fiziksel sıra)
					try {
						// Adım 1: Held hamleleri tracker'dan geri al → preGap durumu
						const preGapCube = Cube.fromString(trackerState);
						for (let i = this._heldMoveEvents.length - 1; i >= 0; i--) {
							preGapCube.move(invertMove(this._heldMoveEvents[i].move));
						}

						// Adım 2: Held hamleleri FACELETS'den geri al → preGap + kayıp durumu
						const postMissedCube = Cube.fromString(faceletsState);
						for (let i = this._heldMoveEvents.length - 1; i >= 0; i--) {
							postMissedCube.move(invertMove(this._heldMoveEvents[i].move));
						}

						// Adım 3: preGap'e 18 hamle uygula, postMissed'e eşleşeni bul
						const possibleMoves = [
							'U', "U'", 'U2', 'R', "R'", 'R2',
							'D', "D'", 'D2', 'L', "L'", 'L2',
							'F', "F'", 'F2', 'B', "B'", 'B2'
						];
						const preGapState = preGapCube.asString();
						const postMissedState = postMissedCube.asString();
						let foundMove = null;
						for (const move of possibleMoves) {
							const test = Cube.fromString(preGapState);
							test.move(move);
							if (test.asString() === postMissedState) {
								foundMove = move;
								break;
							}
						}

						if (foundMove) {
							// Sentetik MOVE olarak queue'ya ekle (held hamlelerden ÖNCE)
							// Gap tespit zamanını kullan (FACELETS RTT gecikmesi yerine)
							this.moveQueue.push({ move: foundMove, timestamp: this._gapDetectedAt || Date.now() });
						} else {
						}
					} catch (e) {
					}

					// Tracker'ı fiziksel duruma düzelt
					try {
						this._trackerCube = Cube.fromString(faceletsState);
					} catch (e) {
					}
				}

				// Held hamleleri dispatch et (cubejs doğru takip edebilsin)
				// FACELETS resync useEffect kaldırıldı, bu yüzden double-counting yok
				// cubejs sadece smartTurns'deki hamlelerle güncellenir
				for (const heldEvent of this._heldMoveEvents) {
					this.moveQueue.push({
						move: heldEvent.move,
						// Orijinal varış zamanını kullan (FACELETS RTT gecikmesi yerine)
						timestamp: heldEvent._receivedAt || Date.now(),
					});
				}
				this._heldMoveEvents = [];

				// Sentetik + held hamleleri flush et
				if (this.moveFlushTimeout) clearTimeout(this.moveFlushTimeout);
				this.flushMoveQueue();
			} else {
				// Zaman aşımı timer'ını temizle (holding değilse de temizle)
				if (this._holdTimeoutId) {
					clearTimeout(this._holdTimeoutId);
					this._holdTimeoutId = null;
				}

				// Holding değil - tracker'ı fiziksel duruma senkronize et
				try {
					this._trackerCube = Cube.fromString(event.facelets);
				} catch (e) {
				}
			}

			// Otomatik kalibrasyon: ilk FACELETS'i çözülmüş durum referansı olarak kaydet
			if (!this._ganInitialFacelets) {
				this._ganInitialFacelets = event.facelets;
			}


			// Redux'a her durumda bildir (SmartCube.tsx'deki güvenlik ağı için)
			this.alertCubeState(event.facelets);

			// NOT: FACELETS sonrası yeniden polling YAPILMIYOR
			// Sessizlik timer'ı sadece MOVE event'lerinden başlatılıyor (satır ~980)
			// Bu, stale FACELETS yanıtının SERIAL_GAP resync'i ile çakışmasını önler
			// ve idle durumda sürekli SOLVED dispatch spam'ini engeller
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
		this._pendingFaceletsRequests++;
		try {
			if (this.conn) {
				await this.conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
			}
		} catch (e) {
			this._pendingFaceletsRequests = Math.max(0, this._pendingFaceletsRequests - 1);
		} finally {
			setTimeout(() => { this._resyncPending = false; }, 100);
		}
	};

	disconnect = async () => {
		// Held hamleleri temizle (dispatch etme - double-counting önle)
		if (this._holdingForResync) {
			this._holdingForResync = false;
			this._heldMoveEvents = [];
		}
		if (this._holdTimeoutId) {
			clearTimeout(this._holdTimeoutId);
			this._holdTimeoutId = null;
		}
		if (this._silenceTimeoutId) {
			clearTimeout(this._silenceTimeoutId);
			this._silenceTimeoutId = null;
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
