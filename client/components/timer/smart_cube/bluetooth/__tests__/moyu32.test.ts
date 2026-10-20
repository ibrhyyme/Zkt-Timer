// The MoYu32 (WeiLong AI) driver against real cube traffic: notifications recorded from a
// WCU_MY32 and a WCU_MY33 by smartcube-web-bluetooth (Pau Oliva, MIT), with the moves that
// library decoded. The encrypted packets go into the driver exactly as the adapter hands them.

jest.mock('../../../helpers/params', () => ({ setTimerParams: () => {} }));
jest.mock('../../mac_input/requestMacFromUser', () => ({ requestMacFromUser: async () => null }));
jest.mock('../mac_cache', () => ({
	readCachedMac: () => null,
	readAnyMac: () => null,
	writeCachedMac: () => {},
	clearCachedMac: () => {},
	cubeStorageId: () => 'test',
}));

import MoYu32, { isValidMoyu32Packet, moyu32MacCandidatesFromName } from '../moyu32';
import fixtures from './fixtures/moyu32_captures.json';

interface Capture {
	name: string;
	mac: string;
	notifies: string[];
	expectedMoves: string[];
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
	const adapter = { writeCharacteristic: async () => {} };
	const cube: any = new MoYu32({ name: capture.name, deviceId: 'test' }, adapter);
	const moves: any[] = [];
	const facelets: string[] = [];
	const gyro: any[] = [];
	let connected = 0;
	cube._sink = {
		handleConnected: async () => { connected++; },
		handleMoveBatch: (batch: any[], state: string | null) => {
			moves.push(...batch);
			if (state) facelets.push(state);
		},
		handleFacelets: (state: string) => facelets.push(state),
		handleBattery: () => {},
		handleGyroSupported: () => {},
	};
	cube.subscribeGyro((e: any) => gyro.push(e));
	cube.initDecoder(capture.mac);
	const decodedAll: number[][] = [];
	for (const hex of capture.notifies) {
		decodedAll.push(cube.decode(dataView(hex)));
		cube.onStateChanged(dataView(hex));
	}
	return { moves, facelets, gyro, connected, decodedAll };
}

// The reference's recorder subscribed only after its connect() returned, and a MoYu32 starts
// streaming during the start-up burst: the first move or the first few orientation packets of
// some captures are missing from its event list (WCU_MY33: the cube reports U' at counter 212
// and again at 213, the reference lists one). The driver sees every packet, so the reference
// is compared against the tail of what the driver produced.
describe('MoYu32 — real captures', () => {
	CAPTURES.forEach((capture, index) => {
		describe(`${capture.name} #${index + 1}`, () => {
			it('decodes the same moves as the reference', () => {
				const { moves } = replay(capture);
				const turns = moves.map((m) => m.turn);
				expect(turns.length - capture.expectedMoves.length).toBeLessThanOrEqual(1);
				expect(turns.slice(turns.length - capture.expectedMoves.length)).toEqual(capture.expectedMoves);
			});

			it('ends on the same cube state as the reference', () => {
				const { facelets } = replay(capture);
				expect(facelets[facelets.length - 1]).toBe(capture.expectedLastFacelets);
			});

			it('streams the gyroscope the way the reference does', () => {
				const { gyro } = replay(capture);
				const offset = gyro.length - capture.expectedGyroCount;
				expect(offset).toBeGreaterThanOrEqual(0);
				expect(offset).toBeLessThanOrEqual(10);
				if (capture.expectedFirstGyro) {
					const q = gyro[offset].quaternion;
					const e = capture.expectedFirstGyro;
					for (const k of ['x', 'y', 'z', 'w'] as const) expect(q[k]).toBeCloseTo(e[k], 6);
				}
			});

			// The sanity check is the reference's MAC-probe heuristic. It is only asked about
			// state packets (the first one confirms the connection), so those must all pass.
			it('confirms the connection, and every real state packet passes the sanity check', () => {
				const { connected, decodedAll } = replay(capture);
				expect(connected).toBe(1);
				const states = decodedAll.filter((d) => d[0] === 163);
				expect(states.length).toBeGreaterThan(0);
				expect(states.filter((d) => !isValidMoyu32Packet(d))).toHaveLength(0);
			});
		});
	});

	it('does not confirm a connection on packets decrypted with the wrong MAC', () => {
		const capture = CAPTURES[0];
		const { connected } = replay({ ...capture, mac: 'CF:30:16:01:A3:88' });
		expect(connected).toBe(0);
	});
});

describe('MoYu32 — MAC candidates from the advertised name', () => {
	it('puts the observed address first for each line', () => {
		expect(moyu32MacCandidatesFromName('WCU_MY32_A388')[0]).toBe('CF:30:16:00:A3:88');
		expect(moyu32MacCandidatesFromName('WCU_MY33_AF9E')[0]).toBe('CF:30:16:02:AF:9E');
		expect(moyu32MacCandidatesFromName('WCU_MY33_AF9E')).toHaveLength(3);
	});

	it('offers nothing for the 2x2, which the app does not support', () => {
		expect(moyu32MacCandidatesFromName('WCU_MY22_1037')).toEqual([]);
	});
});
