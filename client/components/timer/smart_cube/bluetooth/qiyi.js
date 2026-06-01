// QiYi Smart Cube (QY-QYSC) + QiYi Tornado V4 i (XMD-TornadoV4-i) BLE protocol port
// Reference: e:/Projects/Zkt-Timer/Reference/cstimer-master/src/js/hardware/qiyicube.js (271 lines)
// 100% port: AES-128 encryption, CRC16-MODBUS, MAC discovery, hello handshake, history move recovery
//
// State tracking: cubejs instead of cstimer mathlib.CubieCube

import SmartCube from './smart_cube';
import LZString from './lz_string';
import aes128 from './ae128';
import Cube from 'cubejs';
import { setTimerParams } from '../../helpers/params';
import { requestMacFromUser } from '../mac_input/requestMacFromUser';

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

	// MAC discovery: 1) manufacturer data, 2) device name pattern, 3) cache, 4) prompt
	async resolveMac() {
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

		// 2) Device name pattern: QY-QYSC-X-XXXX or XMD-TornadoV4-i-X-XXXX
		let defaultMac = null;
		const m = /^(QY-QYSC|XMD-TornadoV4-i)-.-[0-9A-F]{4}$/.exec(this.deviceName);
		if (m) {
			defaultMac = 'CC:A3:00:00:' + this.deviceName.slice(-4, -2) + ':' + this.deviceName.slice(-2);
		}

		// 3) Cache
		const cached = localStorage.getItem(MAC_CACHE_KEY);
		if (cached) {
			return cached;
		}

		// 4) Ask the user via modal. Returns a normalized MAC or null (cancelled).
		// Not persisted here — cached only after the cube proves it's correct (_confirmConnected).
		return await requestMacFromUser({ defaultMac, deviceName: this.deviceName });
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
			try { localStorage.removeItem(MAC_CACHE_KEY); } catch (e) { /* ignore */ }
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
			try { localStorage.setItem(MAC_CACHE_KEY, this._pendingMac); } catch (e) { /* ignore */ }
		}
		this.alertConnected({
			device: {
				name: this.device.name,
				id: this.device.deviceId,
			},
		});
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
		const ts = (msg[3] << 24 | msg[4] << 16 | msg[5] << 8 | msg[6]);

		if (opcode === 0x2) { // cube hello
			this.batteryLevel = msg[35];
			this.sendMessage(msg.slice(2, 7));
			const newFacelet = this.parseFacelet(msg.slice(7, 34));
			this.prevCube = Cube.fromString(newFacelet);
			this.alertCubeState(newFacelet);
			this.alertBatteryLevel(this.batteryLevel);
		} else if (opcode === 0x3) { // state change
			this.sendMessage(msg.slice(2, 7));

			// History moves recovery — cstimer logic
			const todoMoves = [[msg[34], ts]];
			while (todoMoves.length < 10) {
				const off = 91 - 5 * todoMoves.length;
				const hisTs = (msg[off] << 24 | msg[off + 1] << 16 | msg[off + 2] << 8 | msg[off + 3]);
				const hisMv = msg[off + 4];
				if (hisTs <= this.lastTs) {
					break;
				}
				todoMoves.push([hisMv, hisTs]);
			}
			// Apply moves in old -> new order
			const batch = [];
			let curFacelet;
			for (let i = todoMoves.length - 1; i >= 0; i--) {
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
					localTimestamp: i === 0 ? locTime : null,
					completedAt: locTime,
				});
			}

			// FACELETS comparison (drift control)
			const newFacelet = this.parseFacelet(msg.slice(7, 34));
			if (newFacelet !== curFacelet) {
				console.warn('[qiyi] facelet mismatch — resync to', newFacelet);
				this.prevCube = Cube.fromString(newFacelet);
				this.alertCubeState(newFacelet);
				if (batch.length > 0) {
					this.alertTurnCubeBatch(batch);
				}
			} else {
				if (batch.length > 0) {
					this.alertTurnCubeBatch(batch);
					this.alertCubeState(curFacelet);
				}
			}

			// Battery update
			const newBatteryLevel = msg[35];
			if (newBatteryLevel !== this.batteryLevel) {
				this.batteryLevel = newBatteryLevel;
				this.alertBatteryLevel(this.batteryLevel);
			}
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
