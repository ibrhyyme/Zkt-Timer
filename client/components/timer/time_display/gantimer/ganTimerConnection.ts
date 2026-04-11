import {Observable, Subject} from 'rxjs';
import {getBleAdapter, BleAdapter, BleDevice} from '../../../../util/ble';

const GAN_TIMER_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const GAN_TIMER_TIME_CHARACTERISTIC = '0000fff2-0000-1000-8000-00805f9b34fb';
const GAN_TIMER_STATE_CHARACTERISTIC = '0000fff5-0000-1000-8000-00805f9b34fb';

export enum GanTimerState {
	DISCONNECT = 0,
	GET_SET = 1,
	HANDS_OFF = 2,
	RUNNING = 3,
	STOPPED = 4,
	IDLE = 5,
	HANDS_ON = 6,
	FINISHED = 7,
}

export interface GanTimerTime {
	readonly minutes: number;
	readonly seconds: number;
	readonly milliseconds: number;
	readonly asTimestamp: number;
	toString(): string;
}

export interface GanTimerEvent {
	state: GanTimerState;
	recordedTime?: GanTimerTime;
}

export interface GanTimerRecordedTimes {
	displayTime: GanTimerTime;
	previousTimes: [GanTimerTime, GanTimerTime, GanTimerTime];
}

export interface GanTimerConnection {
	events$: Observable<GanTimerEvent>;
	getRecordedTimes(): Promise<GanTimerRecordedTimes>;
	disconnect(): void;
}

function makeTime(min: number, sec: number, msec: number): GanTimerTime {
	return {
		minutes: min,
		seconds: sec,
		milliseconds: msec,
		asTimestamp: 60000 * min + 1000 * sec + msec,
		toString: () =>
			`${min.toString(10)}:${sec.toString(10).padStart(2, '0')}.${msec.toString(10).padStart(3, '0')}`,
	};
}

function makeTimeFromRaw(data: DataView, offset: number): GanTimerTime {
	const min = data.getUint8(offset);
	const sec = data.getUint8(offset + 1);
	const msec = data.getUint16(offset + 2, true);
	return makeTime(min, sec, msec);
}

function crc16ccit(buff: ArrayBuffer): number {
	const dataView = new DataView(buff);
	let crc = 0xffff;
	for (let i = 0; i < dataView.byteLength; ++i) {
		crc ^= dataView.getUint8(i) << 8;
		for (let j = 0; j < 8; ++j) {
			crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1;
		}
	}
	return crc & 0xffff;
}

function validateEventData(data: DataView): boolean {
	try {
		if (data?.byteLength === 0 || data.getUint8(0) !== 0xfe) {
			return false;
		}
		const eventCRC = data.getUint16(data.byteLength - 2, true);
		const calculatedCRC = crc16ccit(data.buffer.slice(2, data.byteLength - 2));
		return eventCRC === calculatedCRC;
	} catch (err) {
		return false;
	}
}

function buildTimerEvent(data: DataView): GanTimerEvent {
	const evt: GanTimerEvent = {
		state: data.getUint8(3),
	};
	if (evt.state === GanTimerState.STOPPED) {
		evt.recordedTime = makeTimeFromRaw(data, 4);
	}
	return evt;
}

let _scanningAdapter: BleAdapter | null = null;

export function abortGanTimerScan(): void {
	if (_scanningAdapter?.abortScan) {
		console.log('[BLE] GanTimer: abortScan cagriliyor');
		_scanningAdapter.abortScan();
	}
	_scanningAdapter = null;
}

export async function connectGanTimer(): Promise<GanTimerConnection> {
	const adapter = await getBleAdapter();
	_scanningAdapter = adapter;

	let device: BleDevice;
	try {
		device = await adapter.requestDevice({
			nameFilters: ['GAN', 'gan', 'Gan'],
			serviceFilters: [GAN_TIMER_SERVICE],
			optionalServices: [GAN_TIMER_SERVICE],
		});
	} finally {
		_scanningAdapter = null;
	}

	const eventSubject = new Subject<GanTimerEvent>();
	let disposed = false;

	const disconnectAction = async () => {
		if (disposed) return;
		disposed = true;
		try {
			await adapter.stopNotifications(device, GAN_TIMER_SERVICE, GAN_TIMER_STATE_CHARACTERISTIC);
		} catch (_) {
			// ignore
		}
		try {
			await adapter.disconnect(device);
		} catch (_) {
			// ignore
		}
		eventSubject.next({state: GanTimerState.DISCONNECT});
		eventSubject.complete();
	};

	await adapter.connect(device, () => {
		if (disposed) return;
		disposed = true;
		eventSubject.next({state: GanTimerState.DISCONNECT});
		eventSubject.complete();
	});

	await adapter.startNotifications(
		device,
		GAN_TIMER_SERVICE,
		GAN_TIMER_STATE_CHARACTERISTIC,
		(value: DataView) => {
			if (validateEventData(value)) {
				eventSubject.next(buildTimerEvent(value));
			} else {
				console.warn('[BLE] GanTimer: gecersiz event verisi alindi');
			}
		},
	);

	const getRecordedTimesAction = async (): Promise<GanTimerRecordedTimes> => {
		const data = await adapter.readCharacteristic(
			device,
			GAN_TIMER_SERVICE,
			GAN_TIMER_TIME_CHARACTERISTIC,
		);
		if (data?.byteLength >= 16) {
			return {
				displayTime: makeTimeFromRaw(data, 0),
				previousTimes: [
					makeTimeFromRaw(data, 4),
					makeTimeFromRaw(data, 8),
					makeTimeFromRaw(data, 12),
				],
			};
		}
		throw new Error('Invalid time characteristic value received from Timer');
	};

	return {
		events$: eventSubject.asObservable(),
		getRecordedTimes: getRecordedTimesAction,
		disconnect: disconnectAction,
	};
}
