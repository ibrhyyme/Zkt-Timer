/**
 * MoYu BLE API v1: the request/response channel of the MoYu MHC cubes, on characteristics
 * 0x1001 (write) and 0x1002 (notify). Requests and responses are split into 20-byte frames.
 * It is how the cube's own sticker state, battery, firmware info and a state reset are read
 * and written; the turn stream itself arrives separately on 0x1003.
 *
 * Port of smartcube-web-bluetooth src/smartcube/protocols/moyu-v1.ts (Pau Oliva, MIT),
 * written against a plain `write(bytes)` function so it runs on the app's BLE adapters.
 */

const CMD_TIME = 1;
const CMD_HARDWARE = 2;
const CMD_BATTERY = 3;
const CMD_CUBE_STATE = 10;

const RESPONSE_TIMEOUT_MS = 5000;

/** Sticker id 0..5 to its centre's colour letter (MoYu face order D, L, B, R, F, U). */
const STICKER_ID_TO_COLOR = 'DLBRFU';

/** MoYu face index x cell (0..8) to the URFDLB facelet index (U 0-8, R 9-17, ...). */
const MOYU_CELL_TO_STD = [
	[27, 28, 29, 30, 31, 32, 33, 34, 35],
	[44, 43, 42, 41, 40, 39, 38, 37, 36],
	[53, 52, 51, 50, 49, 48, 47, 46, 45],
	[17, 16, 15, 14, 13, 12, 11, 10, 9],
	[26, 25, 24, 23, 22, 21, 20, 19, 18],
	[0, 1, 2, 3, 4, 5, 6, 7, 8],
];

export const MOYU_V1_SOLVED_STICKERS = [0, 1, 2, 3, 4, 5].map((face) => new Array(9).fill(face));

/** The state payload: 54 stickers at 4 bits each, then six 4-bit face angles from byte 27. */
export function moyuV1ParseCubeState(view) {
	const stickers = [];
	for (let s = 0; s < 6; s++) {
		const row = [];
		for (let a = 0; a < 9; a++) {
			const byte = view.getUint8(Math.floor((9 * s + a) / 2));
			row.push((byte >> ((9 * s + a) % 2 === 0 ? 0 : 4)) & 15);
		}
		stickers.push(row);
	}
	const angles = [];
	for (let s = 0; s < 6; s++) {
		const byte = view.getUint8(27 + Math.floor(s / 2));
		angles.push((byte >> (s % 2 === 0 ? 0 : 4)) & 15);
	}
	return { stickers, angles };
}

export function moyuV1EncodeCubeState(stickers, angles) {
	const out = new Uint8Array(30);
	for (let s = 0; s < 6; s++) {
		for (let r = 0; r < 9; r++) {
			const index = Math.floor((9 * s + r) / 2);
			out[index] |= (15 & stickers[s][r]) << ((9 * s + r) % 2 === 0 ? 0 : 4);
		}
	}
	for (let s = 0; s < 6; s++) {
		out[27 + Math.floor(s / 2)] |= (15 & angles[s]) << (s % 2 === 0 ? 0 : 4);
	}
	return out;
}

/** 54-character URFDLB facelet string, '?' where a sticker id is out of range. */
export function moyuStickersToFacelets(stickers) {
	const chars = new Array(54).fill('?');
	for (let face = 0; face < 6; face++) {
		for (let p = 0; p < 9; p++) {
			const id = stickers[face][p] & 15;
			chars[MOYU_CELL_TO_STD[face][p]] = id < 6 ? STICKER_ID_TO_COLOR[id] : '?';
		}
	}
	return chars.join('');
}

export class MoyuV1Client {
	/** `write(Uint8Array)`: one GATT write to the 0x1001 characteristic. */
	constructor(write) {
		this.write = write;
		this.lastId = 0;
		this.sendCount = -1;
		this.incomplete = [];
		this.waiters = [];
	}

	/** Feed every 0x1002 notification here. */
	onReadNotification(view) {
		if (!view || view.byteLength < 2) return;
		const index = view.getUint8(1) & 15;
		const total = view.getUint8(1) >> 4;
		this.incomplete.push({ index, payload: new Uint8Array(view.buffer, view.byteOffset + 2, Math.max(0, view.byteLength - 2)) });
		if (total <= 0 || index !== total - 1) return;

		const parts = this.incomplete.sort((a, b) => a.index - b.index);
		this.incomplete = [];
		const merged = new Uint8Array(parts.reduce((n, p) => n + p.payload.length, 0));
		let offset = 0;
		for (const p of parts) {
			merged.set(p.payload, offset);
			offset += p.payload.length;
		}
		if (merged.length < 1) return;
		const header = merged[0];
		const command = header & 15;
		const success = ((header >> 4) & 1) === 1;
		const id = (header >> 5) & 7;
		const i = this.waiters.findIndex((w) => w.command === command && w.id === id);
		if (i < 0) return;
		const waiter = this.waiters.splice(i, 1)[0];
		clearTimeout(waiter.timeout);
		if (!success) {
			waiter.reject(new Error(`MoYu v1 command ${command} failed`));
			return;
		}
		waiter.resolve(new DataView(merged.buffer, 1, merged.length - 1));
	}

	async send(command, payload) {
		this.lastId = (this.lastId + 1) % 8;
		const id = this.lastId;
		const header = command | ((payload ? 1 : 0) << 4) | (id << 5);
		const body = new Uint8Array(1 + (payload ? payload.length : 0));
		body[0] = header;
		if (payload) body.set(payload, 1);

		const result = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				const i = this.waiters.findIndex((w) => w.command === command && w.id === id);
				if (i >= 0) this.waiters.splice(i, 1);
				reject(new Error(`MoYu v1 command ${command} timeout`));
			}, RESPONSE_TIMEOUT_MS);
			this.waiters.push({ command, id, resolve, reject, timeout });
		});

		const parts = Math.ceil(body.length / 18);
		for (let i = 0; i < parts; i++) {
			const frame = new Uint8Array(20);
			this.sendCount = (this.sendCount + 1) % 256;
			frame[0] = this.sendCount;
			frame[1] = i | (parts << 4);
			frame.set(body.subarray(18 * i, 18 * (i + 1)), 2);
			await this.write(frame);
		}
		return result;
	}

	async getCubeState() {
		return moyuV1ParseCubeState(await this.send(CMD_CUBE_STATE));
	}

	async setCubeState(stickers = MOYU_V1_SOLVED_STICKERS, angles = [0, 0, 0, 0, 0, 0]) {
		await this.send(CMD_CUBE_STATE, moyuV1EncodeCubeState(stickers, angles));
	}

	async getBatteryPercent() {
		const v = await this.send(CMD_BATTERY);
		return v.getUint16(2, true);
	}

	async getHardwareInfo() {
		const v = await this.send(CMD_HARDWARE);
		return { bootCount: v.getUint32(16, true), major: v.getUint8(20), minor: v.getUint8(21), patch: v.getUint16(22, true) };
	}

	async getTime() {
		const v = await this.send(CMD_TIME);
		return { seconds: v.getUint16(0, true), counter: v.getUint16(2, true) };
	}

	dispose() {
		for (const w of this.waiters) clearTimeout(w.timeout);
		this.waiters = [];
		this.incomplete = [];
	}
}
