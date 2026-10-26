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
import my22Fixtures from './fixtures/moyu32_my22_captures.json';
import { expand2x2Facelets, isValid2x2Facelets } from '../../../../../util/smart_cube/cube2x2';

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

	it('puts the observed address first for the 2x2 too', () => {
		expect(moyu32MacCandidatesFromName('WCU_MY22_1037')[0]).toBe('CF:30:16:01:10:37');
	});
});

// ── WCU_MY22, the Weipo V5 AI 2x2 ───────────────────────────────────────────────

interface My22Capture {
	source: string;
	scenario: string;
	name: string;
	mac: string;
	notifies: string[];
	times: number[];
	expectedMoves: string[] | null;
	expectedStates: string[] | null;
	expectedMoveCount: number;
	expectedCubeTimestampGaps: number[] | null;
}

const MY22 = (my22Fixtures as { captures: My22Capture[] }).captures;
const my22 = (scenario: string) => MY22.find((c) => c.source.includes(scenario))!;

/**
 * Replays a capture with the browser clock at the recorded receive times, so the driver's
 * clock-drift correction sees the real pauses (smartcube-web-bluetooth does the same).
 * `edit` may rewrite the decrypted packets first, re-encrypted with the cube's key.
 */
function replay2x2(capture: My22Capture, edit?: (packets: number[][]) => number[][]) {
	const adapter = { writeCharacteristic: async () => {} };
	const cube: any = new MoYu32({ name: capture.name, deviceId: 'test' }, adapter);
	const moves: any[] = [];
	const afterMoves: string[] = [];
	const reported: string[] = [];
	const gyro: any[] = [];
	let connected = 0;
	cube._sink = {
		handleConnected: async () => { connected++; },
		handleMoveBatch: (batch: any[], state: string | null) => {
			moves.push(...batch);
			if (state) afterMoves.push(state);
		},
		handleFacelets: (state: string) => reported.push(state),
		handleBattery: () => {},
		handleGyroSupported: () => {},
	};
	cube.subscribeGyro((e: any) => gyro.push(e));
	cube.initDecoder(capture.mac);
	let packets = capture.notifies.map((hex) => cube.decode(dataView(hex)));
	if (edit) packets = edit(packets);
	const times = capture.times.slice();
	while (times.length < packets.length) times.push(times[times.length - 1] ?? 0);
	const clock = jest.spyOn(Date, 'now');
	try {
		packets.forEach((plain, i) => {
			clock.mockReturnValue(times[i]);
			const bytes = Uint8Array.from(cube.encode(plain.slice()));
			cube.onStateChanged(new DataView(bytes.buffer));
		});
	} finally {
		clock.mockRestore();
	}
	return { cube, moves, afterMoves, reported, gyro, connected };
}

describe('MoYu32 WCU_MY22 (2x2) — real captures', () => {
	it('knows it is a 2x2 from its name', () => {
		const cube: any = new MoYu32({ name: 'WCU_MY22_1037', deviceId: 'test' }, {});
		expect(cube.puzzle).toBe('222');
		expect(new MoYu32({ name: 'WCU_MY32_A388', deviceId: 'test' }, {}).puzzle).toBe('333');
	});

	it('confirms on the solved 24-sticker state, reads the counter after it, streams the gyro', () => {
		const { cube, reported, gyro, connected } = replay2x2(my22('2026-10-16.json'));
		expect(connected).toBe(1);
		expect(reported).toContain(expand2x2Facelets(my22('2026-10-16.json').expectedStates![0]));
		// The counter follows the 72 sticker bits, not the 3x3 offset.
		expect(cube.prevMoveCnt).toBe(4);
		expect(gyro.length).toBeGreaterThan(0);
	});

	for (const scenario of ['T14-45-36', 'T14-56-57']) {
		describe(my22(scenario).scenario, () => {
			it('decodes the same turns as the reference', () => {
				const { moves } = replay2x2(my22(scenario));
				expect(moves.map((m) => m.turn)).toEqual(my22(scenario).expectedMoves);
			});

			it('passes on the same state after every turn', () => {
				const { afterMoves } = replay2x2(my22(scenario));
				expect(afterMoves.slice(-6)).toEqual(my22(scenario).expectedStates!.map((s) => expand2x2Facelets(s)));
			});
		});
	}

	it('stamps the turns with the cube clock the reference reads', () => {
		const capture = my22('T14-45-36');
		const { moves } = replay2x2(capture);
		const gaps = moves.slice(1).map((m, i) => m.cubeTimestamp - moves[i].cubeTimestamp);
		expect(gaps).toEqual(capture.expectedCubeTimestampGaps);
	});

	it('turns 98 mixed turns into 98 legal states', () => {
		const { moves, afterMoves } = replay2x2(my22('T14-40-37'));
		expect(moves).toHaveLength(98);
		expect(afterMoves.every((s) => isValid2x2Facelets(s))).toBe(true);
	});

	it('reads a repeated notification once', () => {
		const capture = my22('T14-45-36');
		const doubled = (packets: number[][]) => packets.flatMap((p) => (p[0] === 165 ? [p, p.slice()] : [p]));
		expect(replay2x2(capture, doubled).moves.map((m) => m.turn)).toEqual(capture.expectedMoves);
	});

	// smartcube-web-bluetooth "preserves delayed turn notifications when a requested snapshot
	// already includes them": R R' is solved, so the real solved state is replayed with R''s
	// counter just before R''s own notification.
	it('keeps a turn whose state arrived first, marked stale and applied once', () => {
		const capture = my22('T14-45-36');
		const overtaken = (packets: number[][]) => {
			const state = packets.find((p) => p[0] === 163)!.slice();
			let turns = 0;
			return packets.flatMap((p) => {
				if (p[0] !== 165 || ++turns !== 2) return [p];
				const early = state.slice();
				early[10] = p[13];
				return [early, p];
			});
		};
		const { moves, afterMoves } = replay2x2(capture, overtaken);
		expect(moves.map((m) => m.turn)).toEqual(capture.expectedMoves);
		expect(moves.filter((m) => m.stale).map((m) => m.turn)).toEqual(["R'"]);
		expect(afterMoves.slice(-6)).toEqual(capture.expectedStates!.map((s) => expand2x2Facelets(s)));
	});
});

describe('MoYu32 — company ids declared for MAC discovery', () => {
	// An unbound cube (never paired in the WCU app) advertises its MAC under CIC 0x0000.
	// Without it in the list, Web Bluetooth withholds that data and the user gets the MAC prompt.
	it('includes 0x0000 for unbound cubes, then every bound-account CIC', () => {
		expect(MoYu32.cics[0]).toBe(0x0000);
		expect(MoYu32.cics).toHaveLength(256);
		expect(MoYu32.cics[1]).toBe(0x0100);
		expect(MoYu32.cics[255]).toBe(0xff00);
	});
});
