// GAN Gen1 is the one cube generation we own no hardware for, so these tests are the only
// verification the port gets. They pin the parsing and bookkeeping against the numbers in
// cstimer's `gancube.js` v1 path — every expectation below is derived from that reference,
// not from our own implementation, so a drift shows up as a failure rather than as a cube
// that silently reports the wrong moves.

import GanGen1ProtocolDriver, {
	isSupportedGen1Version,
	GAN_GEN1_STATE_CHECK_INTERVAL,
} from '../gan_v1_driver';
import { DEFAULT_SOLVED_STATE } from '../../../../../util/smart_cube/facelets';

/** The cube reports its moves in a 20-byte payload: counter at 12, last six moves at 13..18. */
function movePayload(moveCnt: number, moves: number[]): number[] {
	const value = new Array(20).fill(0);
	value[12] = moveCnt;
	for (let i = 0; i < 6; i++) {
		value[13 + i] = moves[i] ?? 0;
	}
	return value;
}

describe('GAN Gen1 — firmware gating', () => {
	it('accepts the version range cstimer covers', () => {
		expect(isSupportedGen1Version(0x010008)).toBe(true);
		expect(isSupportedGen1Version(0x0100ff)).toBe(true);
		expect(isSupportedGen1Version(0x0101ff)).toBe(true);
	});

	it('rejects versions outside it', () => {
		// At or below the floor cstimer treats as unsupported.
		expect(isSupportedGen1Version(0x010007)).toBe(false);
		// Wrong major: this is a Gen2-era firmware, it must not be driven as Gen1.
		expect(isSupportedGen1Version(0x020000)).toBe(false);
		// Third key slot does not exist; the mask rules it out before we ever index KEYS.
		expect(isSupportedGen1Version(0x010200)).toBe(false);
	});

	it('refuses to build a decoder for a version with no key', () => {
		const driver = new GanGen1ProtocolDriver();
		const hardware = new DataView(new Uint8Array(6).buffer);
		// (version >> 8) & 0xff == 2 -> no third entry in GAN_V1_KEYS
		expect(driver.initDecoder(0x010200, hardware)).toBe(false);
		expect(driver.decoder).toBe(null);
	});

	it('builds a decoder for a supported version', () => {
		const driver = new GanGen1ProtocolDriver();
		const hardware = new DataView(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer);
		expect(driver.initDecoder(0x010008, hardware)).toBe(true);
		expect(driver.decoder).not.toBe(null);
	});
});

describe('GAN Gen1 — move parsing', () => {
	it('reports no advance when the counter is unchanged', () => {
		const driver = new GanGen1ProtocolDriver();
		driver.prevMoveCnt = 7;
		expect(driver.parseMoves(movePayload(7, [0, 0, 0, 0, 0, 0]))).toBe(false);
	});

	it('decodes the six move slots newest-first', () => {
		const driver = new GanGen1ProtocolDriver();
		// cstimer: face = URFDLB[m/3], suffix = " 2'"[m % 3]. Slot 18 is the newest move,
		// and the unshift in the port puts it at index 0.
		expect(driver.parseMoves(movePayload(6, [0, 1, 2, 3, 4, 5]))).toBe(true);
		expect(driver.prevMoves).toEqual(["R'", 'R2', 'R ', "U'", 'U2', 'U ']);
		expect(driver.moveCnt).toBe(6);
	});

	it('maps every face and direction the way cstimer does', () => {
		const driver = new GanGen1ProtocolDriver();
		// m = face * 3 + direction, faces in URFDLB order.
		driver.parseMoves(movePayload(1, [0, 3, 6, 9, 12, 15]));
		expect(driver.prevMoves).toEqual(['B ', 'L ', 'D ', 'F ', 'R ', 'U ']);
	});
});

describe('GAN Gen1 — time offset parsing', () => {
	it('reads nine little-endian offsets newest-first', () => {
		const driver = new GanGen1ProtocolDriver();
		const value = new Array(20).fill(0);
		// cstimer: off = value[i*2 + 1] | value[i*2 + 2] << 8, unshifted so the newest lands first.
		value[1] = 0x10;
		value[2] = 0x00; // first pair -> 16
		value[3] = 0x00;
		value[4] = 0x01; // second pair -> 256
		driver.parseTimeOffsets(value);
		expect(driver.timeOffs).toHaveLength(9);
		// The two we filled were read first, so they end up at the tail after the unshifts.
		expect(driver.timeOffs[8]).toBe(16);
		expect(driver.timeOffs[7]).toBe(256);
	});
});

describe('GAN Gen1 — facelet unpacking', () => {
	it('unpacks a solved cube', () => {
		const driver = new GanGen1ProtocolDriver();
		// 48 facelets at 3 bits, six centres implied by face index. Byte order follows
		// cstimer's `value[i ^ 1]` interleave, so a solved cube is this specific layout.
		const solved = [
			0x00, 0x00, 0x24, 0x00, 0x49, 0x92, 0x24, 0x49, 0x6d,
			0x92, 0xdb, 0xb6, 0x49, 0x92, 0xb6, 0x24, 0x6d, 0xdb,
		];
		expect(driver.parseFacelets(solved)).toBe(DEFAULT_SOLVED_STATE);
	});

	it('places the centre of each face from the face index, not the payload', () => {
		const driver = new GanGen1ProtocolDriver();
		// All-zero payload: every unpacked facelet reads as 'U', but the centres still come
		// from the face position, which is what proves the centre insertion at j == 12.
		const facelets = driver.parseFacelets(new Array(18).fill(0));
		expect(facelets).toHaveLength(54);
		expect(facelets[4]).toBe('U');
		expect(facelets[13]).toBe('R');
		expect(facelets[22]).toBe('F');
		expect(facelets[31]).toBe('D');
		expect(facelets[40]).toBe('L');
		expect(facelets[49]).toBe('B');
	});
});

describe('GAN Gen1 — state read bookkeeping', () => {
	it('treats the first read as the initial sync and adopts the counter', () => {
		const driver = new GanGen1ProtocolDriver();
		driver.parseMoves(movePayload(42, [0, 0, 0, 0, 0, 0]));
		expect(driver.applyStateRead()).toBe(true);
		// Adopting the counter is what stops the cube's pre-connection moves from being
		// replayed as if the user had just made them.
		expect(driver.prevMoveCnt).toBe(42);
		expect(driver.movesFromLastCheck).toBe(0);
	});

	it('treats later reads as ordinary re-syncs', () => {
		const driver = new GanGen1ProtocolDriver();
		driver.parseMoves(movePayload(42, [0, 0, 0, 0, 0, 0]));
		driver.applyStateRead();
		driver.parseMoves(movePayload(43, [0, 0, 0, 0, 0, 0]));
		expect(driver.applyStateRead()).toBe(false);
		expect(driver.prevMoveCnt).toBe(42);
	});

	it('asks for a state read before any move has been seen', () => {
		expect(new GanGen1ProtocolDriver().needsStateCheck).toBe(true);
	});
});

describe('GAN Gen1 — move timing', () => {
	function primedDriver() {
		const driver = new GanGen1ProtocolDriver();
		driver.parseMoves(movePayload(0, [0, 0, 0, 0, 0, 0]));
		driver.applyStateRead(); // initial sync: prevMoveCnt = 0
		return driver;
	}

	it('emits one event per new move, oldest first', () => {
		const driver = primedDriver();
		driver.parseMoves(movePayload(2, [0, 0, 0, 0, 3, 0])); // newest = 'U ', before it 'R '
		driver.timeOffs = [100, 200, 0, 0, 0, 0, 0, 0, 0];

		const events = driver.updateMoveTimes(10_000);

		expect(events.map((e) => e.move)).toEqual(['R', 'U']);
		expect(events.every((e) => e.type === 'MOVE')).toBe(true);
	});

	it('stamps only the newest move with a local timestamp', () => {
		const driver = primedDriver();
		driver.parseMoves(movePayload(2, [0, 0, 0, 0, 3, 0]));
		driver.timeOffs = [100, 200, 0, 0, 0, 0, 0, 0, 0];

		const events = driver.updateMoveTimes(10_000);

		// The older move of a batch was not observed when it happened, so claiming a local
		// time for it would feed the timing fit a point that never existed.
		expect(events[0].localTimestamp).toBe(null);
		expect(events[1].localTimestamp).toBe(10_000);
	});

	it('walks the cube clock forward so the newest move lands on local time', () => {
		const driver = primedDriver();
		driver.parseMoves(movePayload(2, [0, 0, 0, 0, 3, 0]));
		driver.timeOffs = [100, 200, 0, 0, 0, 0, 0, 0, 0];

		const events = driver.updateMoveTimes(10_000);

		// cstimer's adjustment: with no prior device time the clock is pulled so the last
		// move coincides with now, and the earlier one sits its own offset behind.
		expect(events[1].cubeTimestamp).toBe(10_000);
		expect(events[0].cubeTimestamp).toBe(9_900);
	});

	it('numbers moves with the cube serial, wrapping at a byte', () => {
		const driver = new GanGen1ProtocolDriver();
		driver.parseMoves(movePayload(255, [0, 0, 0, 0, 0, 0]));
		driver.applyStateRead();
		driver.parseMoves(movePayload(1, [0, 0, 0, 0, 3, 0]));
		driver.timeOffs = new Array(9).fill(10);

		const events = driver.updateMoveTimes(10_000);

		expect(events.map((e) => e.serial)).toEqual([0, 1]);
	});

	it('forces a state read when more moves happened than the cube can report', () => {
		const driver = primedDriver();
		// The cube only ever hands back six moves; a jump of ten means four are gone for good.
		driver.parseMoves(movePayload(10, [0, 0, 0, 0, 0, 0]));
		driver.timeOffs = new Array(9).fill(10);

		const events = driver.updateMoveTimes(10_000);

		expect(events).toHaveLength(6);
		// Re-anchor on the cube's own state rather than carry a tracker we know is wrong.
		expect(driver.movesFromLastCheck).toBe(GAN_GEN1_STATE_CHECK_INTERVAL);
		expect(driver.needsStateCheck).toBe(true);
	});

	it('does not re-emit moves once the counter is consumed', () => {
		const driver = primedDriver();
		driver.parseMoves(movePayload(1, [0, 0, 0, 0, 0, 0]));
		driver.timeOffs = new Array(9).fill(10);
		expect(driver.updateMoveTimes(10_000)).toHaveLength(1);

		// Same counter again: cstimer bails in parseMoves, so nothing reaches updateMoveTimes.
		expect(driver.parseMoves(movePayload(1, [0, 0, 0, 0, 0, 0]))).toBe(false);
	});
});
