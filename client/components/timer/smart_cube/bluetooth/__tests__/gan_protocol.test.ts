// The GAN protocol layer against real cube traffic. The captures are BLE notifications
// recorded from physical GAN cubes by smartcube-web-bluetooth (Pau Oliva, MIT), together
// with the events that library decoded from them. Replaying them through OUR encrypter,
// packet validator and drivers proves the port decodes what the reference decodes, and
// that the validator never throws away a packet a real cube sent.

import {
	GAN_ENCRYPTION_KEYS,
	GanGen2CubeEncrypter,
	GanGen4CubeEncrypter,
	GanGen2ProtocolDriver,
	GanGen4ProtocolDriver,
	GanProtocolMessageView,
	isValidGanGen2Packet,
	isValidGanGen3Packet,
	isValidGanGen4Packet,
	gapExpired,
	GAP_RECOVERY_TIMEOUT_MS,
	GAP_RECOVERY_HARD_LIMIT_MS,
	HISTORY_REPLY_WINDOW_MS,
	GAN_251_ENCRYPTION_KEY,
	GAN_251_COMMAND_CHARACTERISTIC_ALT,
	GAN_GEN4_SERVICE,
	GAN_GEN4_COMMAND_CHARACTERISTIC,
	GAN_GEN4_STATE_CHARACTERISTIC,
	GanCubeClassicConnection,
} from '../gan_protocol';
import fixtures from './fixtures/gan_captures.json';
import Cube from 'cubejs';
import LZString from '../lz_string';
import { canonical2x2 } from '../../../../../util/smart_cube/cube2x2';
import { DEFAULT_SOLVED_STATE } from '../../../../../util/smart_cube/facelets';

interface Capture {
	source: string;
	name: string;
	mac: string;
	protocol: string;
	notifies: string[];
	expectedMoves: string[];
	expectedCubeTimestamps: (number | null)[];
	expectedLastFacelets: string | null;
}

const CAPTURES = (fixtures as { captures: Capture[] }).captures;

function saltFromMac(mac: string): Uint8Array {
	return new Uint8Array(mac.split(':').map((h) => parseInt(h, 16)).reverse());
}

function hexBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

const mockConn = { sendCommandMessage: async () => {}, disconnect: () => {} };

async function replay(capture: Capture, validated = true) {
	const key = GAN_ENCRYPTION_KEYS[0];
	const gen4 = capture.protocol === 'gan-gen4';
	const encrypter = gen4
		? new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), saltFromMac(capture.mac))
		: new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), saltFromMac(capture.mac));
	const driver: any = gen4 ? new GanGen4ProtocolDriver() : new GanGen2ProtocolDriver();
	const validate = gen4 ? isValidGanGen4Packet : isValidGanGen2Packet;
	const events: any[] = [];
	for (const hex of capture.notifies) {
		const plain = encrypter.decrypt(hexBytes(hex));
		if (validated && !validate(plain)) continue;
		events.push(...(await driver.handleStateEvent(mockConn, plain)));
	}
	return events;
}

/** What a consumer acts on: everything except the timestamps the replay itself stamps. */
const meaningful = (events: any[]) =>
	events
		.filter((e) => e.type !== 'GYRO')
		.map(({ timestamp, localTimestamp, ...rest }) => rest);

describe('GAN protocol — real captures', () => {
	it('has the captures to replay', () => {
		expect(CAPTURES.length).toBeGreaterThanOrEqual(5);
	});

	for (const capture of CAPTURES) {
		describe(`${capture.name} (${capture.protocol})`, () => {
			it('decodes the same moves and cube timestamps as the reference', async () => {
				const events = await replay(capture);
				const moves = events.filter((e) => e.type === 'MOVE');
				expect(moves.map((m) => m.move)).toEqual(capture.expectedMoves);
				expect(moves.map((m) => m.cubeTimestamp ?? null)).toEqual(capture.expectedCubeTimestamps);
			});

			it('ends on the same cube state as the reference', async () => {
				const events = await replay(capture);
				const facelets = events.filter((e) => e.type === 'FACELETS');
				expect(facelets.length > 0 ? facelets[facelets.length - 1].facelets : null).toBe(capture.expectedLastFacelets);
			});

			// Gen4 hardware replies include packet types (0xF5, 0xF6, 0xFF) the driver has no
			// use for, and the validator drops those. It must never drop anything else.
			it('drops nothing the driver would have acted on', async () => {
				expect(meaningful(await replay(capture, true))).toEqual(meaningful(await replay(capture, false)));
			});
		});
	}
});

/** A decrypted Gen4 payload with the given MOVE chunks packed back to back. */
function gen4MovePacket(chunks: { face: number; dir: number; serial: number; ts: number }[]): Uint8Array {
	const bits: string[] = [];
	const put = (value: number, width: number) => bits.push(value.toString(2).padStart(width, '0'));
	const putLE = (value: number, bytes: number) => {
		for (let i = 0; i < bytes; i++) put((value >> (8 * i)) & 0xff, 8);
	};
	const FACE_BITS = [2, 32, 8, 1, 16, 4];
	for (const c of chunks) {
		put(0x01, 8); // event type
		put(0x07, 8); // data length (unused by the parser)
		putLE(c.ts, 4);
		putLE(c.serial, 2);
		put(c.dir, 2);
		put(FACE_BITS[c.face], 6);
	}
	const flat = bits.join('').padEnd(160, '0');
	const out = new Uint8Array(20);
	for (let i = 0; i < 20; i++) out[i] = parseInt(flat.slice(i * 8, i * 8 + 8), 2);
	return out;
}

/** A decrypted Gen4 FACELETS payload for a solved cube at the given serial. */
function gen4FaceletsPacket(serial: number): Uint8Array {
	const bits = new Array(160).fill('0');
	const put = (offset: number, value: number, width: number) => {
		const s = value.toString(2).padStart(width, '0');
		for (let i = 0; i < width; i++) bits[offset + i] = s[i];
	};
	put(0, 0xed, 8);
	put(8, 0x13, 8);
	put(16, serial & 0xff, 8);
	put(24, (serial >> 8) & 0xff, 8);
	for (let i = 0; i < 7; i++) put(32 + i * 3, i, 3); // corner permutation, orientation 0
	for (let i = 0; i < 11; i++) put(69 + i * 4, i, 4); // edge permutation, orientation 0
	const out = new Uint8Array(20);
	for (let i = 0; i < 20; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8).join(''), 2);
	return out;
}

describe('GAN Gen4 — several moves in one notification', () => {
	it('reads every MOVE chunk, not only the first', async () => {
		const driver: any = new GanGen4ProtocolDriver();
		const sent: Uint8Array[] = [];
		const conn = { sendCommandMessage: async (m: Uint8Array) => { sent.push(m); }, disconnect: () => {} };
		await driver.handleStateEvent(conn, gen4FaceletsPacket(10));

		// U then U' landing inside one connection interval: one notification, two chunks.
		const events = await driver.handleStateEvent(conn, gen4MovePacket([
			{ face: 0, dir: 0, serial: 11, ts: 5000 },
			{ face: 0, dir: 1, serial: 12, ts: 5040 },
		]));

		const moves = events.filter((e: any) => e.type === 'MOVE');
		expect(moves.map((m: any) => m.move)).toEqual(['U', "U'"]);
		// Both carry the cube's own clock: neither had to come back from move history.
		expect(moves.map((m: any) => m.cubeTimestamp)).toEqual([5000, 5040]);
		expect(sent).toHaveLength(0);
	});

	it('still accepts a single-move notification', async () => {
		const driver: any = new GanGen4ProtocolDriver();
		await driver.handleStateEvent(mockConn, gen4FaceletsPacket(10));
		const events = await driver.handleStateEvent(mockConn, gen4MovePacket([{ face: 1, dir: 0, serial: 11, ts: 7000 }]));
		expect(events.filter((e: any) => e.type === 'MOVE').map((m: any) => m.move)).toEqual(['R']);
	});
});

describe('GAN packet validation', () => {
	it('accepts a Gen4 MOVE with a real face and rejects one without', () => {
		expect(isValidGanGen4Packet(gen4MovePacket([{ face: 2, dir: 0, serial: 1, ts: 1 }]))).toBe(true);
		const bad = gen4MovePacket([{ face: 2, dir: 0, serial: 1, ts: 1 }]);
		bad[8] = (bad[8] & 0xc0) | 0x3f; // face field 0b111111 maps to no face
		expect(isValidGanGen4Packet(bad)).toBe(false);
	});

	it('rejects Gen4 packet types the protocol does not define', () => {
		const p = new Uint8Array(20);
		p[0] = 0x42;
		expect(isValidGanGen4Packet(p)).toBe(false);
	});

	it('rejects a Gen3 packet without its magic byte', () => {
		const p = new Uint8Array(16);
		p[0] = 0x54;
		p[1] = 0x02;
		p[2] = 0x10;
		expect(isValidGanGen3Packet(p)).toBe(false);
		p[0] = 0x55;
		expect(isValidGanGen3Packet(p)).toBe(true);
	});

	it('rejects a Gen2 battery level over 100', () => {
		const p = new Uint8Array(20);
		p[0] = 0x90; // type 9
		p[1] = 101;
		expect(isValidGanGen2Packet(p)).toBe(false);
		p[1] = 80;
		expect(isValidGanGen2Packet(p)).toBe(true);
	});

	it('rejects anything shorter than a block', () => {
		expect(isValidGanGen4Packet(new Uint8Array(15))).toBe(false);
		expect(new GanProtocolMessageView(new Uint8Array([0xff])).getBitWord(0, 8)).toBe(255);
	});
});

describe('GAN gap write-off', () => {
	const opened = 10_000;

	it('keeps a fresh gap open', () => {
		expect(gapExpired(opened, opened + 100, opened + 500)).toBe(false);
	});

	// The bug: the pause path's only history request went out with the same facelets packet
	// that found the gap past its timeout, so it was written off in the instant its recovery
	// was asked for.
	it('does not write a gap off while its history request is still in the air', () => {
		const t = opened + GAP_RECOVERY_TIMEOUT_MS + 200;
		expect(gapExpired(opened, t - 5, t)).toBe(false);
	});

	it('writes it off once a request had time to come back', () => {
		const t = opened + GAP_RECOVERY_TIMEOUT_MS + 400;
		expect(gapExpired(opened, t - HISTORY_REPLY_WINDOW_MS, t)).toBe(true);
	});

	it('writes it off after the hard limit even if no request ever went out', () => {
		expect(gapExpired(opened, null, opened + GAP_RECOVERY_TIMEOUT_MS + 100)).toBe(false);
		expect(gapExpired(opened, null, opened + GAP_RECOVERY_HARD_LIMIT_MS + 1)).toBe(true);
	});
});

// ── GAN 251 UI (2x2) ─────────────────────────────────────────────────────────
//
// Neither reference has a capture of a 251 (cstimer keeps no fixtures, smartcube-web-bluetooth
// recorded none), so these pin the port against cstimer gancube.js `is251` and the library's 2x2
// Gen4 driver: the key, the corners-only state, both move packings and the skipped gaps.

const MAC_251 = 'AB:12:CD:34:EF:56';
const SOLVED_CP = [0, 1, 2, 3, 4, 5, 6];
const SOLVED_CO = [0, 0, 0, 0, 0, 0, 0];

/** A decrypted Gen4 FACELETS payload with the given corners and junk in the edge bits. */
function gen4CornerPacket(serial: number, cp: number[], co: number[]): Uint8Array {
	const bits = new Array(160).fill('0');
	const put = (offset: number, value: number, width: number) => {
		const s = value.toString(2).padStart(width, '0');
		for (let i = 0; i < width; i++) bits[offset + i] = s[i];
	};
	put(0, 0xed, 8);
	put(8, 0x13, 8);
	put(16, serial & 0xff, 8);
	put(24, (serial >> 8) & 0xff, 8);
	for (let i = 0; i < 7; i++) {
		put(32 + i * 3, cp[i], 3);
		put(53 + i * 2, co[i], 2);
	}
	for (let i = 0; i < 11; i++) put(69 + i * 4, 15, 4); // not a permutation: must be ignored
	const out = new Uint8Array(20);
	for (let i = 0; i < 20; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8).join(''), 2);
	return out;
}

/** cstimer's second packing: one-hot face at bit 64, power at bit 70 (both in byte 8). */
function gen4MovePacketB(face: number, power: number, serial: number, ts: number): Uint8Array {
	const packet = gen4MovePacket([{ face: 0, dir: 0, serial, ts }]);
	const FACE_BITS = [2, 32, 8, 1, 16, 4];
	packet[8] = (FACE_BITS[face] << 2) | power;
	return packet;
}

function cornersOf(moves: string[]): { cp: number[]; co: number[]; facelets: string } {
	const cube = new Cube();
	for (const m of moves) cube.move(m);
	const { cp, co } = cube.toJSON();
	return { cp, co, facelets: cube.asString() };
}

describe('GAN 251 UI — key', () => {
	it("is cstimer's KEYS[6] and KEYS[7]", () => {
		// gancube.js: v2initKey(true, false, 2) reads KEYS[2 + 2 * 2] and KEYS[3 + 2 * 2].
		const key = JSON.parse(LZString.decompressFromEncodedURIComponent('NoDhBoEYFYCZwJwHZyzuAzJVGBsqZF8YEoMMDsEJIEAGcaaHcAFlYF0g'));
		const iv = JSON.parse(LZString.decompressFromEncodedURIComponent('NoRgTA7ANAnNYAYAcUliiE0QwMxQFZo1UoAWANlTKjBg1xXAVnoggF0g'));
		expect(key).toEqual(GAN_251_ENCRYPTION_KEY.key);
		expect(iv).toEqual(GAN_251_ENCRYPTION_KEY.iv);
	});

	it('decrypts what it encrypts, salted with the MAC', () => {
		const key = GAN_251_ENCRYPTION_KEY;
		const enc = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), saltFromMac(MAC_251));
		const plain = gen4CornerPacket(3, SOLVED_CP, SOLVED_CO);
		const cipher = enc.encrypt(plain.slice());
		expect(Array.from(cipher)).not.toEqual(Array.from(plain));
		expect(Array.from(enc.decrypt(cipher))).toEqual(Array.from(plain));
	});
});

describe('GAN 251 UI — state', () => {
	it('reads the corners, ignores the edge bits, and reports from DBL', async () => {
		const driver: any = new GanGen4ProtocolDriver(2);
		const { cp, co, facelets } = cornersOf(['R', "U'", 'F2', 'R']);
		const events = await driver.handleStateEvent(mockConn, gen4CornerPacket(5, cp, co));
		expect(events.find((e: any) => e.type === 'FACELETS').facelets).toBe(canonical2x2(facelets));
	});

	it('reads a solved cube seen from a drifted core as solved', async () => {
		const driver: any = new GanGen4ProtocolDriver(2);
		const { cp, co } = cornersOf(['y', 'x']);
		const events = await driver.handleStateEvent(mockConn, gen4CornerPacket(5, cp, co));
		expect(events.find((e: any) => e.type === 'FACELETS').facelets).toBe(DEFAULT_SOLVED_STATE);
	});
});

describe('GAN 251 UI — moves', () => {
	async function started(cubeSize = 2) {
		const driver: any = new GanGen4ProtocolDriver(cubeSize);
		const sent: Uint8Array[] = [];
		const conn = { sendCommandMessage: async (m: Uint8Array) => { sent.push(m); }, disconnect: () => {} };
		await driver.handleStateEvent(conn, cubeSize === 2 ? gen4CornerPacket(10, SOLVED_CP, SOLVED_CO) : gen4FaceletsPacket(10));
		const send = async (packet: Uint8Array) =>
			(await driver.handleStateEvent(conn, packet)).filter((e: any) => e.type === 'MOVE').map((e: any) => e.move);
		return { driver, sent, send };
	}

	it('keeps U, R and F, and reads a D-layer turn as the U layer seen from DBL', async () => {
		const { send } = await started();
		expect(await send(gen4MovePacket([{ face: 1, dir: 0, serial: 11, ts: 100 }]))).toEqual(['R']);
		expect(await send(gen4MovePacket([{ face: 3, dir: 1, serial: 12, ts: 200 }]))).toEqual(["U'"]);
	});

	it('reads the second packing when the first does not decode', async () => {
		const { send } = await started();
		expect(await send(gen4MovePacketB(2, 1, 11, 100))).toEqual(["F'"]);
	});

	it('reads a power of 2 as a half turn', async () => {
		const { send } = await started();
		expect(await send(gen4MovePacketB(0, 2, 11, 100))).toEqual(['U2']);
	});

	it('skips a gap instead of asking for move history', async () => {
		const { driver, sent, send } = await started();
		expect(await send(gen4MovePacket([{ face: 0, dir: 0, serial: 14, ts: 100 }]))).toEqual(['U']);
		expect(sent).toHaveLength(0);
		expect(driver.writtenOffMoves).toBe(3);
	});

	it('reads the next turn in the frame a state report set up', async () => {
		const driver: any = new GanGen4ProtocolDriver(2);
		await driver.handleStateEvent(mockConn, gen4CornerPacket(10, SOLVED_CP, SOLVED_CO));
		// The cube turned D (serial 11) and only its state report arrived.
		const afterD = cornersOf(['D']);
		await driver.handleStateEvent(mockConn, gen4CornerPacket(11, afterD.cp, afterD.co));
		const events = await driver.handleStateEvent(mockConn, gen4MovePacket([{ face: 1, dir: 0, serial: 12, ts: 200 }]));
		const move = events.find((e: any) => e.type === 'MOVE').move;
		const seenFromDbl = new Cube();
		seenFromDbl.move('U'); // D, seen from DBL
		seenFromDbl.move(move);
		const device = new Cube();
		device.move('D');
		device.move('R');
		expect(canonical2x2(seenFromDbl.asString())).toBe(canonical2x2(device.asString()));
	});

	it('leaves the 3x3 driver as it was', async () => {
		const { send } = await started(3);
		expect(await send(gen4MovePacket([{ face: 3, dir: 1, serial: 11, ts: 100 }]))).toEqual(["D'"]);
	});
});

describe('GAN 251 UI — command characteristic', () => {
	function connection(adapter: any, driver: any, key = GAN_251_ENCRYPTION_KEY) {
		const enc = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), saltFromMac(MAC_251));
		return new GanCubeClassicConnection(adapter, {}, GAN_GEN4_SERVICE, GAN_GEN4_COMMAND_CHARACTERISTIC, GAN_GEN4_STATE_CHARACTERISTIC, enc, driver) as any;
	}

	it('falls back to fff7 when fff5 is not there, and stays on it', async () => {
		const writes: string[] = [];
		const adapter = {
			writeCharacteristic: async (_d: any, _s: string, uuid: string) => {
				writes.push(uuid);
				if (uuid === GAN_GEN4_COMMAND_CHARACTERISTIC) throw new Error('No Characteristics matching UUID');
			},
		};
		const conn = connection(adapter, new GanGen4ProtocolDriver(2));
		conn.altCommandCharUuid = GAN_251_COMMAND_CHARACTERISTIC_ALT;
		await conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
		await conn.sendCubeCommand({ type: 'REQUEST_BATTERY' });
		expect(writes).toEqual([GAN_GEN4_COMMAND_CHARACTERISTIC, GAN_251_COMMAND_CHARACTERISTIC_ALT, GAN_251_COMMAND_CHARACTERISTIC_ALT]);
	});

	it('still fails for a cube with no fallback', async () => {
		const adapter = { writeCharacteristic: async () => { throw new Error('gatt'); } };
		const conn = connection(adapter, new GanGen4ProtocolDriver(), GAN_ENCRYPTION_KEYS[0]);
		await expect(conn.sendCubeCommand({ type: 'REQUEST_FACELETS' })).rejects.toThrow('gatt');
	});
});
