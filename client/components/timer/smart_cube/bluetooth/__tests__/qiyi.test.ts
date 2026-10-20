// The QiYi driver against real cube traffic: notifications recorded from a QY-QYSC-S and a
// Tornado V4 i by smartcube-web-bluetooth (Pau Oliva, MIT), with the moves that library
// decoded. The encrypted packets go into the driver exactly as the BLE adapter hands them over.

jest.mock('../../../helpers/params', () => ({ setTimerParams: () => {} }));
jest.mock('../../mac_input/requestMacFromUser', () => ({ requestMacFromUser: async () => null }));
jest.mock('../mac_cache', () => ({
	readCachedMac: () => null,
	readAnyMac: () => null,
	writeCachedMac: () => {},
	clearCachedMac: () => {},
	cubeStorageId: () => 'test',
}));

import QiYi, { qiyiMacCandidatesFromName, qiyiStateChangeMoves } from '../qiyi';
import fixtures from './fixtures/qiyi_captures.json';

interface Capture {
	name: string;
	mac: string;
	notifies: string[];
	expectedMoves: string[];
	expectedCubeTimestamps: (number | null)[];
	expectedLastFacelets: string | null;
	expectedGyroCount: number;
	expectedFirstGyro: { x: number; y: number; z: number; w: number } | null;
}

const CAPTURES = (fixtures as { captures: Capture[] }).captures;

function dataView(hex: string): DataView {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return new DataView(bytes.buffer);
}

function replay(capture: Capture) {
	const writes: ArrayBuffer[] = [];
	const adapter = { writeCharacteristic: async (_d: unknown, _s: string, _c: string, data: ArrayBuffer) => { writes.push(data); } };
	const cube: any = new QiYi({ name: capture.name, deviceId: 'test' }, adapter);
	const moves: any[] = [];
	const facelets: string[] = [];
	const gyro: any[] = [];
	cube._sink = {
		handleConnected: async () => {},
		handleMoveBatch: (batch: any[], state: string | null) => {
			moves.push(...batch);
			if (state) facelets.push(state);
		},
		handleFacelets: (state: string) => facelets.push(state),
		handleBattery: () => {},
		handleGyroSupported: () => {},
	};
	cube.subscribeGyro((e: any) => gyro.push(e));
	for (const hex of capture.notifies) cube.onCubeEvent(dataView(hex));
	return { moves, facelets, gyro, writes };
}

describe('QiYi — real captures', () => {
	for (const capture of CAPTURES) {
		describe(capture.name.trim(), () => {
			it('decodes the same moves and cube timestamps as the reference', () => {
				const { moves } = replay(capture);
				expect(moves.map((m) => m.turn)).toEqual(capture.expectedMoves.map((m) => m.replace(' ', '')));
				expect(moves.map((m) => m.cubeTimestamp)).toEqual(capture.expectedCubeTimestamps);
			});

			it('ends on the same cube state as the reference', () => {
				const { facelets } = replay(capture);
				expect(facelets[facelets.length - 1]).toBe(capture.expectedLastFacelets);
			});

			it('streams the gyroscope the way the reference does', () => {
				const { gyro } = replay(capture);
				expect(gyro).toHaveLength(capture.expectedGyroCount);
				if (capture.expectedFirstGyro) expect(gyro[0].quaternion).toEqual(capture.expectedFirstGyro);
			});

			// One ACK per hello reply and per state change that asks for it; cstimer answered
			// every state change, a write per turn mid-solve.
			it('acknowledges only the packets that ask for it', () => {
				const { writes, moves } = replay(capture);
				expect(writes.length).toBeLessThan(moves.length / 2);
			});
		});
	}
});

describe('QiYi — MAC candidates from the advertised name', () => {
	it('uses the vendor prefix of each product line', () => {
		expect(qiyiMacCandidatesFromName('QY-QYSC-S-A0E6')).toEqual(['CC:A3:00:00:A0:E6', 'CC:A3:00:01:A0:E6']);
		expect(qiyiMacCandidatesFromName('QY-QYSC-A-12AB')).toEqual(['CC:A2:00:00:12:AB']);
		// The old guess (CC:A3) was wrong for the Tornado, and its name never matched at all.
		expect(qiyiMacCandidatesFromName('XMD-TornadoV4-i-034C  ')).toEqual(['CC:A6:00:00:03:4C']);
	});

	it('knows nothing for a name that does not follow the pattern', () => {
		expect(qiyiMacCandidatesFromName('QY-Timer-1234')).toEqual([]);
	});
});

describe('QiYi — history slots', () => {
	it('reads all eleven slots, skips empty ones and returns them oldest first', () => {
		const msg = new Array(94).fill(0xff);
		msg[34] = 3; // primary move
		const slot = (i: number, ts: number, code: number) => {
			const off = 36 + 5 * i;
			msg[off] = (ts >>> 24) & 0xff;
			msg[off + 1] = (ts >>> 16) & 0xff;
			msg[off + 2] = (ts >>> 8) & 0xff;
			msg[off + 3] = ts & 0xff;
			msg[off + 4] = code;
		};
		slot(0, 100, 1); // the oldest slot cstimer never reached
		slot(10, 900, 5);
		const out = qiyiStateChangeMoves(msg, 1000);
		expect(out).toEqual([[1, 100], [5, 900], [3, 1000]]);
	});
});
