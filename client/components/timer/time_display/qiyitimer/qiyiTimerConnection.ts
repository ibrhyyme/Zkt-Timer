// QiYi Timer (QY-Timer + QY-Adapter) BLE port — ported line-by-line from cstimer.
//
// Source references (exact, no abbreviation):
//   Reference/cstimer-master/src/js/hardware/qiyitimer.js (247 lines, protocol)
//   Reference/cstimer-master/src/js/hardware/bluetooth.js (BluetoothTimer.CONST, waitForAdvs, findUUID)
//   Reference/cstimer-master/src/js/lib/sha256.js:107-218 (AES128 + Sbox + xtime tables)
//
// Key difference from cstimer: cstimer has global $.aes128 in JS; we have shared ae128.js file
// called without `new` (also in qiyi.js and moyu32.js) — in strict ES modules this
// is unclear if it works, so we INLINE port AES to this file.
//
// MAC discovery sequence matches cstimer init() exactly:
//   (1) waitForAdvs() — manufacturer data CIC 0x0504, if BLE adapter supports it
//   (2) gatt.connect()
//   (3) getPrimaryService(SERVICE_UUID) → getCharacteristics
//   (4) startNotifications(readChrct)
//   (5) device name regex (defaultMac fallback)
//   (6) localStorage cache (not in cstimer, we added it)
//   (7) prompt (cstimer has reqMacAddr; we use window.prompt)
//   (8) sendHello(mac)

import {Observable, Subject} from 'rxjs';
import {getBleAdapter, BleAdapter, BleDevice} from '../../../../util/ble';
import {requestMacFromUser} from '../../smart_cube/mac_input/requestMacFromUser';
import {setTimerParams} from '../../helpers/params';

// ===========================================================================
// AES-128-ECB (cstimer sha256.js:107-218 ported line-by-line)
// ===========================================================================

const Sbox: number[] = [
	99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118,
	202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192,
	183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21,
	4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117,
	9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132,
	83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207,
	208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168,
	81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210,
	205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115,
	96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219,
	224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121,
	231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8,
	186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138,
	112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158,
	225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223,
	140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22,
];
const SboxI: number[] = [];
const ShiftTabI: number[] = [0, 13, 10, 7, 4, 1, 14, 11, 8, 5, 2, 15, 12, 9, 6, 3];
const xtime: number[] = [];

function aesInitTables(): void {
	if (xtime.length !== 0) return;
	for (let i = 0; i < 256; i++) SboxI[Sbox[i]] = i;
	for (let i = 0; i < 128; i++) {
		xtime[i] = i << 1;
		xtime[128 + i] = (i << 1) ^ 0x1b;
	}
}

function addRoundKey(state: number[], rkey: number[]): void {
	for (let i = 0; i < 16; i++) state[i] ^= rkey[i];
}

function shiftSubAdd(state: number[], rkey: number[]): void {
	const state0 = state.slice();
	for (let i = 0; i < 16; i++) {
		state[i] = SboxI[state0[ShiftTabI[i]]] ^ rkey[i];
	}
}

function shiftSubAddI(state: number[], rkey: number[]): void {
	const state0 = state.slice();
	for (let i = 0; i < 16; i++) {
		state[ShiftTabI[i]] = Sbox[state0[i] ^ rkey[i]];
	}
}

function mixColumns(state: number[]): void {
	for (let i = 12; i >= 0; i -= 4) {
		const s0 = state[i + 0];
		const s1 = state[i + 1];
		const s2 = state[i + 2];
		const s3 = state[i + 3];
		const h = s0 ^ s1 ^ s2 ^ s3;
		state[i + 0] ^= h ^ xtime[s0 ^ s1];
		state[i + 1] ^= h ^ xtime[s1 ^ s2];
		state[i + 2] ^= h ^ xtime[s2 ^ s3];
		state[i + 3] ^= h ^ xtime[s3 ^ s0];
	}
}

function mixColumnsInv(state: number[]): void {
	for (let i = 0; i < 16; i += 4) {
		const s0 = state[i + 0];
		const s1 = state[i + 1];
		const s2 = state[i + 2];
		const s3 = state[i + 3];
		const h = s0 ^ s1 ^ s2 ^ s3;
		const xh = xtime[h];
		const h1 = xtime[xtime[xh ^ s0 ^ s2]] ^ h;
		const h2 = xtime[xtime[xh ^ s1 ^ s3]] ^ h;
		state[i + 0] ^= h1 ^ xtime[s0 ^ s1];
		state[i + 1] ^= h2 ^ xtime[s1 ^ s2];
		state[i + 2] ^= h1 ^ xtime[s2 ^ s3];
		state[i + 3] ^= h2 ^ xtime[s3 ^ s0];
	}
}

class AES128 {
	key: number[];

	constructor(key: number[]) {
		aesInitTables();
		const exKey = key.slice();
		let Rcon = 1;
		for (let i = 16; i < 176; i += 4) {
			let tmp = exKey.slice(i - 4, i);
			if (i % 16 === 0) {
				tmp = [Sbox[tmp[1]] ^ Rcon, Sbox[tmp[2]], Sbox[tmp[3]], Sbox[tmp[0]]];
				Rcon = xtime[Rcon];
			}
			for (let j = 0; j < 4; j++) {
				exKey[i + j] = exKey[i + j - 16] ^ tmp[j];
			}
		}
		this.key = exKey;
	}

	decrypt(block: number[]): number[] {
		addRoundKey(block, this.key.slice(160, 176));
		for (let i = 144; i >= 16; i -= 16) {
			shiftSubAdd(block, this.key.slice(i, i + 16));
			mixColumnsInv(block);
		}
		shiftSubAdd(block, this.key.slice(0, 16));
		return block;
	}

	encrypt(block: number[]): number[] {
		shiftSubAddI(block, this.key.slice(0, 16));
		for (let i = 16; i < 160; i += 16) {
			mixColumns(block);
			shiftSubAddI(block, this.key.slice(i, i + 16));
		}
		addRoundKey(block, this.key.slice(160, 176));
		return block;
	}
}

// ===========================================================================
// QiYi Timer constants (cstimer qiyitimer.js:5-9)
// ===========================================================================

const SERVICE_UUID = '0000fd50-0000-1000-8000-00805f9b34fb';
const UUID_SUFFIX = '-0000-1001-8001-00805f9b07d0';
const CHRCT_WRITE = '00000001' + UUID_SUFFIX;
const CHRCT_READ = '00000002' + UUID_SUFFIX;
const QIYI_CIC_LIST: number[] = [0x0504];
// cstimer's giiMacMap pattern: device name-based MAC cache. Different model names like
// QY-Timer and QY-Timer-V2 are cached separately.
const MAC_CACHE_KEY = 'qiyi_timer_mac_map';

// Time to wait for the first notification after the hello handshake. A wrong MAC means
// the encrypted hello is rejected and the timer stays silent, so if nothing arrives in
// this window we treat the connection as failed instead of faking a "connected" state.
const HANDSHAKE_TIMEOUT_MS = 7000;

// ===========================================================================
// Firmware variant routing
// ===========================================================================
//
// QiYi V1 timer (old hardware, "QY-Timer-XXXX" or "QY-Adapter-XXXX"):
//   AES key = [0x77]*16 — exact port from cstimer qiyitimer.js
//   Hello magic = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90]
//
// QiYi V2 timer (new hardware, "QY-Timer-V2-XXXX"):
//   AES key = [0x77]*16 — SAME as V1 (captured via reverse engineering)
//   Hello magic = [0, 0, 0, 0, 0, 36, 5, 0, 4, 77, 20] — new firmware
//
// Reverse engineering findings (May 29, 2026, V2 timer + ex.rubik + HCI sniff):
//   - V2 protocol structure is IDENTICAL to cstimer V1
//   - Service UUID, characteristic UUIDs, packet framing, CRC16-MODBUS, AES key: SAME
//   - ONLY hello magic bytes (data[5..10]) differ
//   - Notify cmd 0x1003 dpId=1/dpType=1 (record time) SAME
//   - Notify cmd 0x1003 dpId=4/dpType=4 (state change) SAME
//   - V2 extra: dpId=3/dpType=2 messages (likely battery level) — can be ignored

type QiyiVariant = 'v1' | 'v2';

const AES_KEY: number[] = Array(16).fill(0x77); // V1 and V2 shared

// Hello sendMessage first 11 bytes of data (then 6 bytes of reversed MAC)
const HELLO_MAGIC_V1: number[] = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90];
const HELLO_MAGIC_V2: number[] = [0, 0, 0, 0, 0, 36, 5, 0, 4, 77, 20];

function detectVariant(deviceName: string): QiyiVariant {
	return /^QY-Timer-V2-/i.test(deviceName) ? 'v2' : 'v1';
}

function helloMagicForVariant(variant: QiyiVariant): number[] {
	return variant === 'v2' ? HELLO_MAGIC_V2 : HELLO_MAGIC_V1;
}

// ===========================================================================
// QiYi Timer state enum (cstimer bluetooth.js:178-191 BluetoothTimer.CONST)
// ===========================================================================

export enum QiyiTimerState {
	DISCONNECT = 0,
	GET_SET = 1,
	HANDS_OFF = 2,
	RUNNING = 3,
	STOPPED = 4,
	IDLE = 5,
	HANDS_ON = 6,
	FINISHED = 7,
	INSPECTION = 8,
}

export interface QiyiTimerTime {
	readonly minutes: number;
	readonly seconds: number;
	readonly milliseconds: number;
	readonly asTimestamp: number;
	toString(): string;
}

export interface QiyiTimerEvent {
	state: QiyiTimerState;
	// cstimer: solveTime (ms) — filled in record time event
	recordedTime?: QiyiTimerTime;
	// cstimer: inspectTime (ms) — filled in record time event (cstimer dpId=1/dpType=1 bytes 12-15)
	inspectionTime?: QiyiTimerTime;
}

export interface QiyiTimerConnection {
	events$: Observable<QiyiTimerEvent>;
	disconnect(): Promise<void> | void;
}

function makeTimeFromMs(totalMs: number): QiyiTimerTime {
	const min = Math.floor(totalMs / 60000);
	const sec = Math.floor((totalMs % 60000) / 1000);
	const msec = totalMs % 1000;
	return {
		minutes: min,
		seconds: sec,
		milliseconds: msec,
		asTimestamp: totalMs,
		toString: () =>
			`${min.toString(10)}:${sec.toString(10).padStart(2, '0')}.${msec.toString(10).padStart(3, '0')}`,
	};
}

// ===========================================================================
// CRC16-MODBUS (cstimer qiyitimer.js:31-40 exact)
// ===========================================================================

function crc16modbus(data: number[]): number {
	let crc = 0xffff;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc & 0x1) > 0 ? (crc >> 1) ^ 0xa001 : crc >> 1;
		}
	}
	return crc;
}

// ===========================================================================
// Scan abort (cancellation from UI)
// ===========================================================================

let _scanningAdapter: BleAdapter | null = null;

export function abortQiyiTimerScan(): void {
	if (_scanningAdapter?.abortScan) {
		_scanningAdapter.abortScan();
	}
	_scanningAdapter = null;
}

// ===========================================================================
// Module-level state — global in cstimer. Only one QiYi connection possible.
// ===========================================================================

let _connection: QiyiTimerConnection | null = null;
let _adapter: BleAdapter | null = null;
let _device: BleDevice | null = null;
let _decoder: AES128 | null = null;
let _deviceName = '';
let _deviceMac = '';
let _eventSubject: Subject<QiyiTimerEvent> | null = null;
let _disposed = false;
let _notifyReceived = false;
// Resolved by the first notification — used to verify the handshake (correct MAC).
let _firstNotifyResolve: (() => void) | null = null;

// onReadEvent state (cstimer qiyitimer.js:84-86)
let _waitPkg = 0;
let _payloadLen = 0;
let _payloadData: number[] = [];

// ===========================================================================
// sendMessage — cstimer qiyitimer.js:42-70 exact
// ===========================================================================

async function sendMessage(sendSN: number, ackSN: number, cmd: number, data: number[]): Promise<void> {
	if (!_adapter || !_device || !_decoder) {
		console.warn('[QiyiTimer] sendMessage: adapter/device/decoder missing');
		return;
	}
	const msg: number[] = [];
	msg.push((sendSN >> 24) & 0xff, (sendSN >> 16) & 0xff, (sendSN >> 8) & 0xff, sendSN & 0xff);
	msg.push((ackSN >> 24) & 0xff, (ackSN >> 16) & 0xff, (ackSN >> 8) & 0xff, ackSN & 0xff);
	msg.push((cmd >> 8) & 0xff, cmd & 0xff);
	const len = data.length;
	msg.push((len >> 8) & 0xff, len & 0xff);
	const fullMsg = msg.concat(data);
	const crc = crc16modbus(fullMsg);
	fullMsg.push(crc >> 8, crc & 0xff);

	// Encrypt and write characteristic in 16-byte blocks
	// cstimer: first packet adds [0x00, msgLen+2, 0x40, 0x00] header;
	//          subsequent packets add [i >> 4] block number.
	for (let i = 0; i < fullMsg.length; i += 16) {
		const block = fullMsg.slice(i, i + 16);
		while (block.length < 16) block.push(1); // padding byte 0x01
		_decoder.encrypt(block);
		const curBlock = i === 0 ? [0x00, fullMsg.length + 2, 0x40, 0x00] : [i >> 4];
		for (let j = 0; j < 16; j++) curBlock.push(block[j]);
		try {
			await _adapter.writeCharacteristic(
				_device,
				SERVICE_UUID,
				CHRCT_WRITE,
				new Uint8Array(curBlock).buffer,
			);
		} catch (e) {
			console.error('[QiyiTimer] writeCharacteristic error:', e);
			throw e;
		}
	}
}

// sendHello — shared structure for V1 and V2, only magic bytes differ per variant
function sendHello(mac: string, variant: QiyiVariant): Promise<void> {
	const content = helloMagicForVariant(variant).slice();
	for (let i = 5; i >= 0; i--) {
		content.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
	}
	return sendMessage(1, 0, 1, content);
}

// sendAck — cstimer qiyitimer.js:80-82 exact
function sendAck(sendSN: number, ackSN: number, cmd: number): Promise<void> {
	return sendMessage(sendSN, ackSN, cmd, [0x00]);
}

// ===========================================================================
// onReadEvent — cstimer qiyitimer.js:88-170 exact
// ===========================================================================

function onReadEvent(value: DataView): void {
	if (!_decoder || !_eventSubject) return;

	_notifyReceived = true;
	if (_firstNotifyResolve) {
		_firstNotifyResolve();
		_firstNotifyResolve = null;
	}
	let msg: number[] = [];
	for (let i = 0; i < value.byteLength; i++) msg[i] = value.getUint8(i);

	// Packet sequence validation
	if (msg[0] !== _waitPkg) {
		_waitPkg = 0;
		_payloadData = [];
		if (msg[0] !== 0) return;
	}

	if (msg[0] === 0) {
		// First packet: [0x00, payloadLen+2, 0x40, 0x00] header
		_payloadLen = msg[1] - 2;
		msg = msg.slice(4);
	} else {
		// Subsequent packet: [blockNum] (i >> 4)
		msg = msg.slice(1);
	}

	// Decrypt 16-byte blocks
	for (let i = 0; i < msg.length; i += 16) {
		const block = msg.slice(i, i + 16);
		if (block.length < 16) {
			_waitPkg = 0;
			_payloadData = [];
			return;
		}
		_decoder.decrypt(block);
		_payloadData = _payloadData.concat(block);
	}

	// Wait if more packets expected
	if (_payloadData.length < _payloadLen) {
		_waitPkg++;
		return;
	}

	const data = _payloadData.slice(0, _payloadLen);
	_waitPkg = 0;
	_payloadData = [];

	const len = (data[10] << 8) | data[11];
	// CRC check: cstimer reverses trailing 2 bytes (data[len+12], data[len+13])
	// crc16modbus(data[0..len+12].concat([data[len+13], data[len+12]])) should be 0
	if (crc16modbus(data.slice(0, len + 12).concat([data[len + 13], data[len + 12]])) !== 0) {
		console.warn('[QiyiTimer] crc check error');
		return;
	}

	const sendSN = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
	const ackSN = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
	const cmd = (data[8] << 8) | data[9];
	const payload = data.slice(12, len + 12);

	if (cmd !== 0x1003) {
		return;
	}

	const dpId = payload[0];
	const dpType = payload[1];
	// dpLen = (payload[2] << 8) | payload[3]; — cstimer calculates it but doesn't use it

	if (dpId === 1 && dpType === 1) {
		// Record time — bytes 8-11 solveTime, bytes 12-15 inspectTime
		const solveTime = (payload[8] << 24) | (payload[9] << 16) | (payload[10] << 8) | payload[11];
		const inspectTime = (payload[12] << 24) | (payload[13] << 16) | (payload[14] << 8) | payload[15];
		_eventSubject.next({
			state: QiyiTimerState.STOPPED,
			recordedTime: makeTimeFromMs(solveTime),
			inspectionTime: makeTimeFromMs(inspectTime),
		});
		sendAck(ackSN + 1, sendSN, 0x1003);
	} else if (dpId === 4 && dpType === 4) {
		// Record timer status — payload[4] state index, bytes 5-8 solveTime
		const stateMap: QiyiTimerState[] = [
			QiyiTimerState.IDLE,
			QiyiTimerState.INSPECTION,
			QiyiTimerState.GET_SET,
			QiyiTimerState.RUNNING,
			QiyiTimerState.FINISHED,
			QiyiTimerState.STOPPED,
			QiyiTimerState.DISCONNECT,
		];
		const state = stateMap[payload[4]];
		const solveTime = (payload[5] << 24) | (payload[6] << 16) | (payload[7] << 8) | payload[8];
		_eventSubject.next({
			state,
			recordedTime: state === QiyiTimerState.STOPPED ? makeTimeFromMs(solveTime) : undefined,
		});
	} else if (dpId === 3 && dpType === 2) {
		// V2 battery level message — dpLen=4, payload[4..7] big-endian u32 (0-100)
		// Battery icon display in UI deferred to next PR
	} else {
		console.warn('[QiyiTimer] unknown dpId/dpType', dpId, dpType, payload);
	}
}

// ===========================================================================
// MAC discovery (cstimer qiyitimer.js:196-236 + our additions)
// ===========================================================================

async function tryMacFromAdvertisement(adapter: BleAdapter, device: BleDevice): Promise<string | null> {
	if (!adapter.watchAdvertisements) {
		return null;
	}
	try {
		const mfData = await adapter.watchAdvertisements(device);
		if (!mfData) {
			return null;
		}

		// cstimer getManufacturerDataBytes: if DataView, Bluefy workaround (buffer.slice(2));
		// if Map, lookup by CIC
		let dataView: DataView | null = null;
		if (mfData instanceof DataView) {
			dataView = new DataView((mfData as DataView).buffer.slice(2));
		} else {
			for (const id of QIYI_CIC_LIST) {
				if (mfData.has(id)) {
					dataView = mfData.get(id) || null;
					break;
				}
			}
		}

		if (dataView && dataView.byteLength >= 6) {
			const macParts: string[] = [];
			for (let i = 5; i >= 0; i--) {
				macParts.push((dataView.getUint8(i) + 0x100).toString(16).slice(1));
			}
			return macParts.join(':');
		}
	} catch (e) {
		console.warn('[QiyiTimer] tryMacFromAdvertisement error:', e);
	}
	return null;
}

function defaultMacFromDeviceName(name: string): string | null {
	// cstimer regex: /^QY-(?:Timer|Adapter).*-([0-9A-F]{4})$/
	const m = /^QY-(?:Timer|Adapter).*-([0-9A-F]{4})$/.exec(name);
	if (m) {
		const prefix = name.startsWith('QY-Adapter') ? 'CC:A8' : 'CC:A1';
		return `${prefix}:00:00:${m[1].slice(0, 2)}:${m[1].slice(2, 4)}`;
	}
	return null;
}

// cstimer giiMacMap logic: device name-based MAC cache (JSON object).
function getCachedMacForDevice(deviceName: string): string | null {
	if (!deviceName) return null;
	try {
		const raw = localStorage.getItem(MAC_CACHE_KEY);
		if (!raw) return null;
		const map = JSON.parse(raw) as Record<string, string>;
		return map[deviceName] || null;
	} catch (_) {
		return null;
	}
}

function setCachedMacForDevice(deviceName: string, mac: string): void {
	if (!deviceName) return;
	try {
		const raw = localStorage.getItem(MAC_CACHE_KEY);
		const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
		map[deviceName] = mac;
		localStorage.setItem(MAC_CACHE_KEY, JSON.stringify(map));
	} catch (_) {
		/* ignore */
	}
}

// Drop a bad cached MAC so the next attempt re-asks instead of silently failing again.
function clearCachedMacForDevice(deviceName: string): void {
	if (!deviceName) return;
	try {
		const raw = localStorage.getItem(MAC_CACHE_KEY);
		if (!raw) return;
		const map = JSON.parse(raw) as Record<string, string>;
		delete map[deviceName];
		localStorage.setItem(MAC_CACHE_KEY, JSON.stringify(map));
	} catch (_) {
		/* ignore */
	}
}

// ===========================================================================
// init — cstimer qiyitimer.js:193-238 exact flow
// ===========================================================================

export async function connectQiyiTimer(): Promise<QiyiTimerConnection> {
	if (_connection) {
		return _connection;
	}

	const adapter = await getBleAdapter();
	_scanningAdapter = adapter;
	_adapter = adapter;
	setTimerParams({smartScanDevices: []});

	let device: BleDevice;
	try {
		device = await adapter.requestDevice({
			nameFilters: ['QY-Timer', 'QY-Adapter'],
			serviceFilters: [SERVICE_UUID],
			optionalServices: [SERVICE_UUID],
			// Native: surface the live device list so the user picks the right timer.
			onScanUpdate: (devices) => setTimerParams({smartScanDevices: devices}),
		});
	} catch (e) {
		_scanningAdapter = null;
		_adapter = null;
		throw e;
	}
	_scanningAdapter = null;
	_device = device;
	_deviceName = (device.name || '').trim();
	// Device chosen — clear the picker list so it doesn't linger in the modal.
	setTimerParams({smartScanDevices: []});

	// AES decoder — V1 and V2 shared [0x77]*16 key, only hello magic bytes differ
	const variant = detectVariant(_deviceName);
	_decoder = new AES128(AES_KEY);

	// Reset onReadEvent state (for reconnection)
	_waitPkg = 0;
	_payloadLen = 0;
	_payloadData = [];
	_disposed = false;

	_eventSubject = new Subject<QiyiTimerEvent>();

	// === Step 1: waitForAdvs — MAC discovery (cstimer init:196-210) ===
	let mac = await tryMacFromAdvertisement(adapter, device);
	if (mac) {
		_deviceMac = mac;
	}

	// === Step 2: GATT connect (cstimer init:212-213) ===
	try {
		await adapter.connect(device, () => {
			if (_disposed) return;
			console.warn('[QiyiTimer] hardware disconnect event');
			_disposed = true;
			_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
			_eventSubject?.complete();
			_clearModuleState();
		});
	} catch (e) {
		console.error('[QiyiTimer] GATT connect error:', e);
		_clearModuleState();
		throw e;
	}

	// === Step 3-4: getPrimaryService + getCharacteristics + startNotifications ===
	// Our BLE adapter abstraction does `getCharacteristic(service, char)` — in other words,
	// findUUID is needed in cstimer because it gets all characteristics one by one, we
	// query by name directly. Adapter does UUID expansion itself.
	try {
		await adapter.startNotifications(device, SERVICE_UUID, CHRCT_READ, onReadEvent);
	} catch (e) {
		console.error('[QiyiTimer] startNotifications error:', e);
		try {
			await adapter.disconnect(device);
		} catch (_) {
			/* ignore */
		}
		_clearModuleState();
		throw e;
	}

	// === Step 5: Device name regex to defaultMac (cstimer init:230-234) ===
	const defaultMac = defaultMacFromDeviceName(_deviceName);

	// === Step 6-7: cstimer reqMacAddr semantic (bluetoothutil.js:760-784) ===
	//
	// 1) If real MAC found via advs (deviceMac populated): use directly + cache it.
	// 2) If not found: is there a per-device cache? Use it if present.
	// 3) Still nothing: prompt — defaultMac (device name guess) is initial prompt value.
	//    User presses "OK" to accept default, or edits to enter real MAC.
	// 4) Once valid MAC obtained, write to cache, auto-use on subsequent connections.
	//
	// On new devices like QY-Timer-V2, defaultMac from device name regex may be wrong
	// (timer won't respond); so we don't silently use defaultMac.

	let finalMac: string | null = _deviceMac || null;
	const cachedMac = getCachedMacForDevice(_deviceName);

	if (!finalMac && cachedMac) {
		finalMac = cachedMac;
	}

	if (!finalMac) {
		// No cache — ask the user via modal (returns a normalized MAC or null).
		finalMac = await requestMacFromUser({ defaultMac, deviceName: _deviceName });
	}

	if (!finalMac) {
		console.error('[QiyiTimer] MAC address not found, disconnecting');
		try {
			await adapter.stopNotifications(device, SERVICE_UUID, CHRCT_READ);
		} catch (_) {
			/* ignore */
		}
		try {
			await adapter.disconnect(device);
		} catch (_) {
			/* ignore */
		}
		_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
		_eventSubject?.complete();
		_clearModuleState();
		throw new Error('[QiyiTimer] MAC address could not be obtained');
	}

	finalMac = finalMac.toUpperCase();
	_deviceMac = finalMac;
	// NOTE: the MAC is cached only AFTER the handshake is verified below. Persisting a
	// wrong MAC here was the root cause of the "connected but not working" bug.

	// === Step 8: sendHello (cstimer init:236) ===
	try {
		await sendHello(finalMac, variant);
	} catch (e) {
		console.error('[QiyiTimer] sendHello error:', e);
		// If hello fails, clean up connection
		try {
			await adapter.stopNotifications(device, SERVICE_UUID, CHRCT_READ);
		} catch (_) {
			/* ignore */
		}
		try {
			await adapter.disconnect(device);
		} catch (_) {
			/* ignore */
		}
		_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
		_eventSubject?.complete();
		_clearModuleState();
		throw e;
	}

	// === Step 9: handshake verification ===
	// A wrong MAC means the encrypted hello is rejected and the timer never notifies.
	// Wait for the first notification; if none arrives within the window, the MAC is wrong
	// (or the timer is off/asleep). Only then is the connection considered real.
	const handshakeOk = await new Promise<boolean>((resolve) => {
		if (_notifyReceived) {
			resolve(true);
			return;
		}
		_firstNotifyResolve = () => resolve(true);
		setTimeout(() => {
			_firstNotifyResolve = null;
			resolve(_notifyReceived);
		}, HANDSHAKE_TIMEOUT_MS);
	});

	if (!handshakeOk) {
		console.warn('[QiyiTimer] handshake timeout — wrong MAC or timer off/asleep');
		clearCachedMacForDevice(_deviceName);
		try {
			await adapter.stopNotifications(device, SERVICE_UUID, CHRCT_READ);
		} catch (_) {
			/* ignore */
		}
		try {
			await adapter.disconnect(device);
		} catch (_) {
			/* ignore */
		}
		_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
		_eventSubject?.complete();
		_clearModuleState();
		throw new Error('QIYI_TIMER_WRONG_MAC');
	}

	// Verified — safe to persist the MAC for future auto-connects.
	setCachedMacForDevice(_deviceName, finalMac);

	// Connection object
	_connection = {
		events$: _eventSubject.asObservable(),
		disconnect: disconnectQiyi,
	};

	return _connection;
}

// cstimer clear(isHardwareEvent) — qiyitimer.js:181-191 exact
async function disconnectQiyi(): Promise<void> {
	if (_disposed) return;
	_disposed = true;
	if (_adapter && _device) {
		try {
			await _adapter.stopNotifications(_device, SERVICE_UUID, CHRCT_READ);
		} catch (_) {
			/* ignore */
		}
		try {
			await _adapter.disconnect(_device);
		} catch (_) {
			/* ignore */
		}
	}
	_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
	_eventSubject?.complete();
	_clearModuleState();
}

function _clearModuleState(): void {
	_connection = null;
	_adapter = null;
	_device = null;
	_deviceName = '';
	_deviceMac = '';
	_eventSubject = null;
	_notifyReceived = false;
	_firstNotifyResolve = null;
	// _decoder persists — cstimer also uses `decoder = decoder || ...` pattern
	_waitPkg = 0;
	_payloadLen = 0;
	_payloadData = [];
}
