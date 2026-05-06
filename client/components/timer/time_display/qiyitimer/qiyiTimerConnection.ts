// QiYi Timer (QY-Timer + QY-Adapter) BLE port'u
// Referans: e:/Projects/Zkt-Timer/Referans/cstimer-master/src/js/hardware/qiyitimer.js (247 satir)
// %100 port: AES-128 encryption (key: Array(16).fill(0x77)), CRC16-MODBUS, MAC discovery,
// multi-packet sendMessage/onReadEvent, hello handshake, state mapping

import {Observable, Subject} from 'rxjs';
import {getBleAdapter, BleAdapter, BleDevice} from '../../../../util/ble';
import aes128 from '../../smart_cube/bluetooth/ae128';

const SERVICE_UUID = '0000fd50-0000-1000-8000-00805f9b34fb';
const UUID_SUFFIX = '-0000-1001-8001-00805f9b07d0';
const CHRCT_WRITE = '00000001' + UUID_SUFFIX;
const CHRCT_READ = '00000002' + UUID_SUFFIX;

const QIYI_CIC_LIST = [0x0504];
const MAC_CACHE_KEY = 'qiyi_timer_mac';

// cstimer state enum: BluetoothTimer.CONST
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
	recordedTime?: QiyiTimerTime;
}

export interface QiyiTimerConnection {
	events$: Observable<QiyiTimerEvent>;
	disconnect(): void;
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

// cstimer crc16modbus() — bire bir port
function crc16modbus(data: number[]): number {
	let crc = 0xFFFF;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc & 0x1) > 0 ? (crc >> 1) ^ 0xa001 : crc >> 1;
		}
	}
	return crc;
}

let _scanningAdapter: BleAdapter | null = null;

export function abortQiyiTimerScan(): void {
	if (_scanningAdapter?.abortScan) {
		console.log('[BLE] QiyiTimer: abortScan cagriliyor');
		_scanningAdapter.abortScan();
	}
	_scanningAdapter = null;
}

async function resolveQiyiTimerMac(adapter: BleAdapter, device: BleDevice): Promise<string | null> {
	// 1) Manufacturer data'dan otomatik MAC
	if (adapter.watchAdvertisements) {
		try {
			const mfData = await adapter.watchAdvertisements(device);
			if (mfData) {
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
					const mac: string[] = [];
					for (let i = 5; i >= 0; i--) {
						mac.push((dataView.getUint8(i) + 0x100).toString(16).slice(1));
					}
					const macStr = mac.join(':').toUpperCase();
					console.log('[QiyiTimer] MAC otomatik bulundu:', macStr);
					return macStr;
				}
			}
		} catch (e) {
			console.warn('[QiyiTimer] watchAdvertisements hatasi:', e);
		}
	}

	// 2) Device name pattern: QY-Timer-...-XXXX veya QY-Adapter-...-XXXX
	let defaultMac: string | null = null;
	const m = /^QY-(?:Timer|Adapter).*-([0-9A-F]{4})$/.exec(device.name || '');
	if (m) {
		const prefix = (device.name || '').startsWith('QY-Adapter') ? 'CC:A8' : 'CC:A1';
		defaultMac = `${prefix}:00:00:${m[1].slice(0, 2)}:${m[1].slice(2, 4)}`;
		console.log('[QiyiTimer] Default MAC device name pattern:', defaultMac);
	}

	// 3) Cache
	const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(MAC_CACHE_KEY) : null;
	if (cached) {
		return cached;
	}

	// 4) Prompt
	const promptMsg = 'QiYi Timer: Otomatik MAC adresi bulunamadi.\nLutfen timer MAC adresini girin (ornek: CC:A1:00:00:AB:CD):';
	const userInput = typeof window !== 'undefined' ? window.prompt(promptMsg, defaultMac || '') : null;
	if (userInput) {
		const cleaned = userInput.trim().toUpperCase();
		try { localStorage.setItem(MAC_CACHE_KEY, cleaned); } catch (_) { /* ignore */ }
		return cleaned;
	}
	return null;
}

export async function connectQiyiTimer(): Promise<QiyiTimerConnection> {
	const adapter = await getBleAdapter();
	_scanningAdapter = adapter;

	let device: BleDevice;
	try {
		device = await adapter.requestDevice({
			nameFilters: ['QY-Timer', 'QY-Adapter'],
			serviceFilters: [SERVICE_UUID],
			optionalServices: [SERVICE_UUID],
		});
	} finally {
		_scanningAdapter = null;
	}

	const eventSubject = new Subject<QiyiTimerEvent>();
	let disposed = false;

	// cstimer aes128 instance (key Array(16).fill(0x77))
	const decoder: any = aes128(Array(16).fill(0x77));

	// cstimer sendMessage() — bire bir port (multi-packet, encryption)
	async function sendMessage(sendSN: number, ackSN: number, cmd: number, data: number[]): Promise<void> {
		const msg: number[] = [];
		msg.push((sendSN >> 24) & 0xff, (sendSN >> 16) & 0xff, (sendSN >> 8) & 0xff, sendSN & 0xff);
		msg.push((ackSN >> 24) & 0xff, (ackSN >> 16) & 0xff, (ackSN >> 8) & 0xff, ackSN & 0xff);
		msg.push((cmd >> 8) & 0xff, cmd & 0xff);
		const len = data.length;
		msg.push((len >> 8) & 0xff, len & 0xff);
		const payload = msg.concat(data);
		const crc = crc16modbus(payload);
		payload.push(crc >> 8, crc & 0xff);

		for (let i = 0; i < payload.length; i += 16) {
			const block = payload.slice(i, i + 16);
			while (block.length < 16) {
				block.push(1);
			}
			decoder.encrypt(block);
			const curBlock = i === 0 ? [0x00, payload.length + 2, 0x40, 0x00] : [i >> 4];
			for (let j = 0; j < 16; j++) {
				curBlock.push(block[j]);
			}
			await adapter.writeCharacteristic(
				device,
				SERVICE_UUID,
				CHRCT_WRITE,
				new Uint8Array(curBlock).buffer
			);
		}
		console.log('[QiyiTimer] send message', payload);
	}

	function sendHello(mac: string): Promise<void> {
		const content = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90];
		for (let i = 5; i >= 0; i--) {
			content.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
		}
		return sendMessage(1, 0, 1, content);
	}

	function sendAck(sendSN: number, ackSN: number, cmd: number): Promise<void> {
		return sendMessage(sendSN, ackSN, cmd, [0x00]);
	}

	// cstimer onReadEvent() — bire bir port (multi-packet reassembly + decrypt + parse)
	let waitPkg = 0;
	let payloadLen = 0;
	let payloadData: number[] = [];

	function onReadEvent(value: DataView): void {
		console.log('[QiyiTimer] onReadEvent');
		const msgArr: number[] = [];
		for (let i = 0; i < value.byteLength; i++) {
			msgArr[i] = value.getUint8(i);
		}

		if (msgArr[0] !== waitPkg) {
			waitPkg = 0;
			payloadData = [];
			if (msgArr[0] !== 0) {
				return;
			}
		}

		let body: number[];
		if (msgArr[0] === 0) {
			payloadLen = msgArr[1] - 2;
			body = msgArr.slice(4);
		} else {
			body = msgArr.slice(1);
		}

		for (let i = 0; i < body.length; i += 16) {
			const block = body.slice(i, i + 16);
			if (block.length < 16) {
				waitPkg = 0;
				payloadData = [];
				return;
			}
			decoder.decrypt(block);
			payloadData = payloadData.concat(block);
		}

		if (payloadData.length < payloadLen) {
			waitPkg++;
			return;
		}

		const data = payloadData.slice(0, payloadLen);
		waitPkg = 0;
		payloadData = [];

		console.log('[QiyiTimer] receive data', data);
		const len = (data[10] << 8) | data[11];
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
		console.log('[QiyiTimer] receive 1003 message', payload);
		const dpId = payload[0];
		const dpType = payload[1];

		if (dpId === 1 && dpType === 1) {
			// Record time
			const solveTime = (payload[8] << 24) | (payload[9] << 16) | (payload[10] << 8) | payload[11];
			eventSubject.next({
				state: QiyiTimerState.STOPPED,
				recordedTime: makeTimeFromMs(solveTime),
			});
			sendAck(ackSN + 1, sendSN, 0x1003);
		} else if (dpId === 4 && dpType === 4) {
			// Record timer status
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
			eventSubject.next({
				state,
				recordedTime: state === QiyiTimerState.STOPPED ? makeTimeFromMs(solveTime) : undefined,
			});
		} else {
			console.log('[QiyiTimer] unknown data', payload);
		}
	}

	const disconnectAction = async () => {
		if (disposed) return;
		disposed = true;
		try {
			await adapter.stopNotifications(device, SERVICE_UUID, CHRCT_READ);
		} catch (_) { /* ignore */ }
		try {
			await adapter.disconnect(device);
		} catch (_) { /* ignore */ }
		eventSubject.next({state: QiyiTimerState.DISCONNECT});
		eventSubject.complete();
	};

	await adapter.connect(device, () => {
		if (disposed) return;
		disposed = true;
		eventSubject.next({state: QiyiTimerState.DISCONNECT});
		eventSubject.complete();
	});

	await adapter.startNotifications(device, SERVICE_UUID, CHRCT_READ, onReadEvent);

	// MAC cozumle ve hello gonder
	const mac = await resolveQiyiTimerMac(adapter, device);
	if (!mac) {
		await disconnectAction();
		throw new Error('[QiyiTimer] MAC adresi alinamadi, baglanti mumkun degil');
	}
	await sendHello(mac);

	return {
		events$: eventSubject.asObservable(),
		disconnect: disconnectAction,
	};
}
