// QiYi Timer (QY-Timer + QY-Adapter) BLE port — cstimer'dan satir satir port.
//
// Kaynak referanslar (birebir, kisaltma YOK):
//   Referans/cstimer-master/src/js/hardware/qiyitimer.js (247 satir, protokol)
//   Referans/cstimer-master/src/js/hardware/bluetooth.js (BluetoothTimer.CONST, waitForAdvs, findUUID)
//   Referans/cstimer-master/src/js/lib/sha256.js:107-218 (AES128 + Sbox + xtime tablolari)
//
// Onemli fark cstimer'la: cstimer JS'te global $.aes128 var; bizde shared ae128.js dosyasi
// `new` olmadan cagriliyor (qiyi.js ve moyu32.js'te de var) — strict ES module'de bu
// gercekten calisip calismadigi belirsiz, bu yuzden AES'i bu dosyaya INLINE port ediyoruz.
//
// MAC discovery sirasi cstimer init() ile birebir:
//   (1) waitForAdvs() — manufacturer data CIC 0x0504, BLE adapter destekliyorsa
//   (2) gatt.connect()
//   (3) getPrimaryService(SERVICE_UUID) → getCharacteristics
//   (4) startNotifications(readChrct)
//   (5) device name regex (defaultMac fallback)
//   (6) localStorage cache (cstimer'da yok, biz ekledik)
//   (7) prompt (cstimer'da reqMacAddr; bizde window.prompt)
//   (8) sendHello(mac)

import {Observable, Subject} from 'rxjs';
import {getBleAdapter, BleAdapter, BleDevice} from '../../../../util/ble';

// ===========================================================================
// AES-128-ECB (cstimer sha256.js:107-218 satir satir port)
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
// cstimer'in giiMacMap pattern'i: device adi bazli MAC cache. QY-Timer ve QY-Timer-V2
// gibi farkli model adlari ayri cache'lenir.
const MAC_CACHE_KEY = 'qiyi_timer_mac_map';

// ===========================================================================
// Firmware variant routing
// ===========================================================================
//
// QiYi V1 timer (eski donanim, "QY-Timer-XXXX" veya "QY-Adapter-XXXX"):
//   AES key = [0x77]*16 — cstimer qiyitimer.js'ten birebir port
//   Hello magic = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90]
//
// QiYi V2 timer (yeni donanim, "QY-Timer-V2-XXXX"):
//   AES key = [0x77]*16 — V1 ile AYNI (reverse engineer'da yakalandi)
//   Hello magic = [0, 0, 0, 0, 0, 36, 5, 0, 4, 77, 20] — yeni firmware
//
// Reverse engineering bulgulari (29 Mayis 2026, V2 timer + ex.rubik + HCI sniff):
//   - V2 protokol structure cstimer V1 ile bire bir AYNI
//   - Service UUID, characteristic UUIDs, packet framing, CRC16-MODBUS, AES key: AYNI
//   - SADECE hello magic byte'lar (data[5..10]) farkli
//   - Notify cmd 0x1003 dpId=1/dpType=1 (record time) AYNI
//   - Notify cmd 0x1003 dpId=4/dpType=4 (state change) AYNI
//   - V2 ekstra: dpId=3/dpType=2 mesajlari (muhtemelen pil seviyesi) — ignore edilebilir

type QiyiVariant = 'v1' | 'v2';

const AES_KEY: number[] = Array(16).fill(0x77); // V1 ve V2 ortak

// Hello sendMessage data icindeki ilk 11 byte (sonra reversed MAC 6 byte gelir)
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
	// cstimer: solveTime (ms) — record time event'inde dolu
	recordedTime?: QiyiTimerTime;
	// cstimer: inspectTime (ms) — record time event'inde dolu (cstimer dpId=1/dpType=1 bytes 12-15)
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
// CRC16-MODBUS (cstimer qiyitimer.js:31-40 birebir)
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
// Scan abort (UI'dan iptal icin)
// ===========================================================================

let _scanningAdapter: BleAdapter | null = null;

export function abortQiyiTimerScan(): void {
	if (_scanningAdapter?.abortScan) {
		console.log('[QiyiTimer] abortScan cagriliyor');
		_scanningAdapter.abortScan();
	}
	_scanningAdapter = null;
}

// ===========================================================================
// Module-level state — cstimer'da global. Tek QiYi connection olabilir.
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

// onReadEvent state (cstimer qiyitimer.js:84-86)
let _waitPkg = 0;
let _payloadLen = 0;
let _payloadData: number[] = [];

// ===========================================================================
// sendMessage — cstimer qiyitimer.js:42-70 birebir
// ===========================================================================

async function sendMessage(sendSN: number, ackSN: number, cmd: number, data: number[]): Promise<void> {
	if (!_adapter || !_device || !_decoder) {
		console.warn('[QiyiTimer] sendMessage: adapter/device/decoder yok');
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

	// 16-byte block'lar halinde encrypt + characteristic write
	// cstimer: ilk paket [0x00, msgLen+2, 0x40, 0x00] header'i ekler;
	//          sonraki paketler [i >> 4] block number ekler.
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
			console.error('[QiyiTimer] writeCharacteristic hatasi:', e);
			throw e;
		}
	}
	console.log('[QiyiTimer] send message to timer', fullMsg);
}

// sendHello — V1 ve V2 ortak yapi, sadece magic byte'lar variant'a gore degisik
function sendHello(mac: string, variant: QiyiVariant): Promise<void> {
	const content = helloMagicForVariant(variant).slice();
	for (let i = 5; i >= 0; i--) {
		content.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
	}
	return sendMessage(1, 0, 1, content);
}

// sendAck — cstimer qiyitimer.js:80-82 birebir
function sendAck(sendSN: number, ackSN: number, cmd: number): Promise<void> {
	return sendMessage(sendSN, ackSN, cmd, [0x00]);
}

// ===========================================================================
// onReadEvent — cstimer qiyitimer.js:88-170 birebir
// ===========================================================================

function onReadEvent(value: DataView): void {
	if (!_decoder || !_eventSubject) return;

	_notifyReceived = true;
	console.log('[QiyiTimer] onReadEvent, byteLength=', value.byteLength);
	let msg: number[] = [];
	for (let i = 0; i < value.byteLength; i++) msg[i] = value.getUint8(i);

	// Packet sequence dogrulamasi
	if (msg[0] !== _waitPkg) {
		_waitPkg = 0;
		_payloadData = [];
		if (msg[0] !== 0) return;
	}

	if (msg[0] === 0) {
		// Ilk paket: [0x00, payloadLen+2, 0x40, 0x00] header
		_payloadLen = msg[1] - 2;
		msg = msg.slice(4);
	} else {
		// Sonraki paket: [blockNum] (i >> 4)
		msg = msg.slice(1);
	}

	// 16-byte block'lari decrypt
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

	// Daha cok paket bekleniyorsa wait
	if (_payloadData.length < _payloadLen) {
		_waitPkg++;
		return;
	}

	const data = _payloadData.slice(0, _payloadLen);
	_waitPkg = 0;
	_payloadData = [];

	console.log('[QiyiTimer] receive data', data);
	const len = (data[10] << 8) | data[11];
	// CRC kontrolu: cstimer trailing 2 byte'i (data[len+12], data[len+13]) reverse edip
	// crc16modbus(data[0..len+12].concat([data[len+13], data[len+12]])) == 0 olmali
	if (crc16modbus(data.slice(0, len + 12).concat([data[len + 13], data[len + 12]])) !== 0) {
		console.warn('[QiyiTimer] crc checked error');
		return;
	}

	const sendSN = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
	const ackSN = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
	const cmd = (data[8] << 8) | data[9];
	const payload = data.slice(12, len + 12);

	if (cmd !== 0x1003) {
		console.log('[QiyiTimer] cmd != 0x1003, skip', cmd);
		return;
	}
	console.log('[QiyiTimer] receive 1003 message', payload);

	const dpId = payload[0];
	const dpType = payload[1];
	// dpLen = (payload[2] << 8) | payload[3]; — cstimer hesapliyor ama kullanmiyor

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
		// V2 pil seviyesi mesaji — dpLen=4, payload[4..7] big-endian u32 (0-100)
		if (payload.length >= 8) {
			const battery = (payload[4] << 24) | (payload[5] << 16) | (payload[6] << 8) | payload[7];
			console.log('[QiyiTimer] battery=' + battery + '%');
		}
		// UI'da pil ikonu gosterimi sonraki PR'a birakildi
	} else {
		console.log('[QiyiTimer] unknown dpId/dpType', dpId, dpType, payload);
	}
}

// ===========================================================================
// MAC discovery (cstimer qiyitimer.js:196-236 + bizim ek katmanlar)
// ===========================================================================

async function tryMacFromAdvertisement(adapter: BleAdapter, device: BleDevice): Promise<string | null> {
	if (!adapter.watchAdvertisements) {
		console.log('[QiyiTimer] watchAdvertisements bu adapter\'da yok');
		return null;
	}
	try {
		const mfData = await adapter.watchAdvertisements(device);
		if (!mfData) {
			console.log('[QiyiTimer] watchAdvertisements null donerdi');
			return null;
		}

		// cstimer getManufacturerDataBytes: DataView ise Bluefy workaround (buffer.slice(2));
		// Map ise CIC ile lookup
		let dataView: DataView | null = null;
		if (mfData instanceof DataView) {
			dataView = new DataView((mfData as DataView).buffer.slice(2));
		} else {
			for (const id of QIYI_CIC_LIST) {
				if (mfData.has(id)) {
					console.log('[QiyiTimer] CIC bulundu: 0x' + id.toString(16).padStart(4, '0'));
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
		console.warn('[QiyiTimer] tryMacFromAdvertisement hatasi:', e);
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

// cstimer giiMacMap mantigi: device adi bazli MAC cache (JSON object).
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

// cstimer reqMacAddr semantic — defaultMac otomatik kabul edilmez, sadece prompt'a initial value.
function promptForMac(defaultMac: string | null, currentMac: string | null): string | null {
	if (typeof window === 'undefined') return null;
	const initial = currentMac || defaultMac || 'xx:xx:xx:xx:xx:xx';
	const promptMsg =
		'QiYi Timer MAC adresi (format: XX:XX:XX:XX:XX:XX)\n\n' +
		'Nereden bulunur:\n' +
		'  Windows: Ayarlar > Bluetooth ve cihazlar > QY-Timer > Detaylar > Bluetooth adresi\n' +
		'  macOS:   Sistem Ayarlari > Bluetooth > cihaz sag-tik > Adresi kopyala\n' +
		'  Android: Ayarlar > Bluetooth > QY-Timer (ⓘ) > MAC adresi\n\n' +
		'Asagidaki tahmini onaylayabilir veya dogru MAC ile degistirebilirsiniz.\n' +
		'Bir kez girince cihaz adina kaydedilir, bir daha sorulmaz.';
	const userInput = window.prompt(promptMsg, initial);
	if (!userInput) return null;
	const cleaned = userInput.trim().toUpperCase().replace(/-/g, ':');
	if (!/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(cleaned)) {
		console.warn('[QiyiTimer] gecersiz MAC formati:', cleaned);
		return null;
	}
	return cleaned;
}

// ===========================================================================
// init — cstimer qiyitimer.js:193-238 birebir akis
// ===========================================================================

export async function connectQiyiTimer(): Promise<QiyiTimerConnection> {
	if (_connection) {
		console.log('[QiyiTimer] zaten baglanti var, eskiyi don');
		return _connection;
	}

	const adapter = await getBleAdapter();
	_scanningAdapter = adapter;
	_adapter = adapter;

	let device: BleDevice;
	try {
		device = await adapter.requestDevice({
			nameFilters: ['QY-Timer', 'QY-Adapter'],
			serviceFilters: [SERVICE_UUID],
			optionalServices: [SERVICE_UUID],
		});
	} catch (e) {
		_scanningAdapter = null;
		_adapter = null;
		throw e;
	}
	_scanningAdapter = null;
	_device = device;
	_deviceName = (device.name || '').trim();
	console.log('[QiyiTimer] cihaz secildi, name=' + _deviceName);

	// AES decoder — V1 ve V2 ortak [0x77]*16 key, sadece hello magic byte'lar farkli
	const variant = detectVariant(_deviceName);
	console.log('[QiyiTimer] variant=' + variant + ' device="' + _deviceName + '"');
	_decoder = new AES128(AES_KEY);

	// onReadEvent state'ini sifirla (yeniden baglanma icin)
	_waitPkg = 0;
	_payloadLen = 0;
	_payloadData = [];
	_disposed = false;

	_eventSubject = new Subject<QiyiTimerEvent>();

	// === Adim 1: waitForAdvs — MAC discovery (cstimer init:196-210) ===
	let mac = await tryMacFromAdvertisement(adapter, device);
	if (mac) {
		console.log('[QiyiTimer] init, found cube bluetooth hardware MAC = ' + mac);
		_deviceMac = mac;
	} else {
		console.log('[QiyiTimer] init, unable to automatically determine cube MAC');
	}

	// === Adim 2: GATT connect (cstimer init:212-213) ===
	try {
		console.log('[QiyiTimer] connecting to GATT server');
		await adapter.connect(device, () => {
			if (_disposed) return;
			console.warn('[QiyiTimer] hardware disconnect event');
			_disposed = true;
			_eventSubject?.next({state: QiyiTimerState.DISCONNECT});
			_eventSubject?.complete();
			_clearModuleState();
		});
	} catch (e) {
		console.error('[QiyiTimer] GATT connect hatasi:', e);
		_clearModuleState();
		throw e;
	}

	// === Adim 3-4: getPrimaryService + getCharacteristics + startNotifications ===
	// Bizim BLE adapter abstraction'i `getCharacteristic(service, char)` yapiyor — yani
	// findUUID cstimer'da gerekli cunku tum karakteristikleri tek tek aliyor, biz isim
	// ile direkt sorguluyoruz. Adapter UUID expand'ini kendi yapiyor.
	try {
		console.log('[QiyiTimer] start listening to state characteristic value updates');
		await adapter.startNotifications(device, SERVICE_UUID, CHRCT_READ, onReadEvent);
	} catch (e) {
		console.error('[QiyiTimer] startNotifications hatasi:', e);
		try {
			await adapter.disconnect(device);
		} catch (_) {
			/* ignore */
		}
		_clearModuleState();
		throw e;
	}

	// === Adim 5: Device name regex'ten defaultMac (cstimer init:230-234) ===
	const defaultMac = defaultMacFromDeviceName(_deviceName);
	if (defaultMac) {
		console.log('[QiyiTimer] device name pattern defaultMac:', defaultMac);
	}

	// === Adim 6-7: cstimer reqMacAddr semantic'i (bluetoothutil.js:760-784) ===
	//
	// 1) Eger advs ile gercek MAC bulunduysa (deviceMac dolu): direkt kullan + cache et.
	// 2) Bulunamadiysa: per-device cache var mi? Varsa kullan.
	// 3) Yine yoksa: prompt et — defaultMac (device name tahmini) prompt initial value.
	//    Kullanici "OK" basarsa default kabul edilir, edit ederse gercek MAC girilir.
	// 4) Gecerli MAC alinirsa cache'e yaz, sonraki baglantilarda otomatik kullan.
	//
	// QY-Timer-V2 gibi yeni cihazlarda device name regex'inden gelen defaultMac yanlis
	// olabilir (timer cevap vermez); bu yuzden defaultMac sessizce kullanmiyoruz.

	let finalMac: string | null = _deviceMac || null;
	const cachedMac = getCachedMacForDevice(_deviceName);

	if (!finalMac && cachedMac) {
		console.log('[QiyiTimer] cached MAC for "' + _deviceName + '" = ' + cachedMac);
		finalMac = cachedMac;
	}

	if (!finalMac) {
		// Cache de yok, kullaniciya prompt et — defaultMac initial value
		finalMac = promptForMac(defaultMac, null);
	}

	if (!finalMac) {
		console.error('[QiyiTimer] MAC adresi bulunamadi, disconnect');
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
		throw new Error('[QiyiTimer] MAC adresi alinamadi');
	}

	finalMac = finalMac.toUpperCase();
	_deviceMac = finalMac;
	setCachedMacForDevice(_deviceName, finalMac);
	console.log('[QiyiTimer] final MAC for hello:', finalMac);

	// === Adim 8: sendHello (cstimer init:236) ===
	try {
		await sendHello(finalMac, variant);
		console.log('[QiyiTimer] hello gonderildi (variant=' + variant + '), handshake bekleniyor');
		// 8s sonra hicbir notification gelmediyse uyari (MAC yanlis veya cihaz kapali)
		// _notifyReceived flag onReadEvent'te set ediliyor
		const helloAt = Date.now();
		setTimeout(() => {
			if (_eventSubject && !_disposed && !_notifyReceived) {
				console.warn(
					'[QiyiTimer] UYARI: Hello gonderildi ama 8s icinde hicbir notification yok.\n' +
					'  Olasi sebepler:\n' +
					'  1) MAC yanlis (Bluetooth ayarlarinda kontrol edin)\n' +
					'  2) Cihaz kapali/uyku modunda\n' +
					'  localStorage.removeItem("' + MAC_CACHE_KEY + '") ile cache temizleyip tekrar deneyebilirsiniz.\n' +
					'  helloAt=' + helloAt
				);
			}
		}, 8000);
	} catch (e) {
		console.error('[QiyiTimer] sendHello hatasi:', e);
		// Hello fail olursa baglantiyi temizle
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

	// Connection object'i
	_connection = {
		events$: _eventSubject.asObservable(),
		disconnect: disconnectQiyi,
	};

	return _connection;
}

// cstimer clear(isHardwareEvent) — qiyitimer.js:181-191 birebir
async function disconnectQiyi(): Promise<void> {
	if (_disposed) return;
	_disposed = true;
	console.log('[QiyiTimer] kullanici disconnect');
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
	// _decoder kalir — cstimer'da da `decoder = decoder || ...` mantigi var
	_waitPkg = 0;
	_payloadLen = 0;
	_payloadData = [];
}
