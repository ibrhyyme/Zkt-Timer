/**
 * Compact text form of a recorded gyroscope stream (`smart_gyro`), for the realistic replay.
 *
 * `g1;<first ms>;<base64>`: the first sample's time on the solve's timeline (the same base as
 * smart_turns, so it can be negative: the stream starts a little before the first turn), then
 * 10 bytes a sample: uint16 ms since the previous sample, and x, y, z, w as int16 / 32767,
 * little-endian, in the drivers' device frame (GAN: +X red, +Y blue, +Z white).
 *
 * About 13 characters a sample, ~4 KB for a 30 s solve at a GAN i4's 11 Hz; the same stream as
 * JSON objects (acubemy stores it that way) is ~30 KB. Int16 keeps a component to 3e-5, far
 * finer than the sensor, so the stream can also be detected again later.
 *
 * Pure: no Buffer, no btoa. Shared by the client (encode at save, decode in the replay), the
 * server (validation) and tests.
 */
import type { GyroSample } from './gyro_rotations';

const VERSION = 'g1';
const BYTES_PER_SAMPLE = 10;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
		out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
		out += i + 2 < bytes.length ? B64[n & 63] : '=';
	}
	return out;
}

function fromBase64(text: string): Uint8Array | null {
	const clean = text.replace(/=+$/, '');
	const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
	let bits = 0;
	let value = 0;
	let o = 0;
	for (const ch of clean) {
		const d = B64.indexOf(ch);
		if (d < 0) return null;
		value = (value << 6) | d;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			out[o++] = (value >> bits) & 255;
		}
	}
	return out.subarray(0, o);
}

const toInt16 = (v: number) => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));

/** `samples` on the solve's timeline (ms from the same base as the turns), in time order. */
export function encodeGyroSamples(samples: GyroSample[]): string | null {
	if (!samples.length) return null;
	const bytes = new Uint8Array(samples.length * BYTES_PER_SAMPLE);
	const view = new DataView(bytes.buffer);
	const first = Math.round(samples[0].t);
	let prev = first;
	samples.forEach((s, i) => {
		const t = Math.round(s.t);
		const o = i * BYTES_PER_SAMPLE;
		// A gap past 65 s cannot happen inside a solve; clamped rather than wrapped.
		view.setUint16(o, Math.max(0, Math.min(65535, t - prev)), true);
		view.setInt16(o + 2, toInt16(s.x), true);
		view.setInt16(o + 4, toInt16(s.y), true);
		view.setInt16(o + 6, toInt16(s.z), true);
		view.setInt16(o + 8, toInt16(s.w), true);
		prev = t;
	});
	return `${VERSION};${first};${toBase64(bytes)}`;
}

/** Empty for anything that is not a well-formed stream: the replay then plays without it. */
export function decodeGyroSamples(text: string | null | undefined): GyroSample[] {
	if (!text) return [];
	const [version, firstText, data] = text.split(';');
	const first = Number(firstText);
	if (version !== VERSION || !Number.isFinite(first) || data === undefined) return [];
	const bytes = fromBase64(data);
	if (!bytes || bytes.length % BYTES_PER_SAMPLE !== 0) return [];
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const out: GyroSample[] = [];
	let t = first;
	for (let o = 0; o < bytes.length; o += BYTES_PER_SAMPLE) {
		t += view.getUint16(o, true);
		out.push({
			t,
			x: view.getInt16(o + 2, true) / 32767,
			y: view.getInt16(o + 4, true) / 32767,
			z: view.getInt16(o + 6, true) / 32767,
			w: view.getInt16(o + 8, true) / 32767,
		});
	}
	return out;
}

/** Whether a client-sent value has the shape and the size this format allows. */
export function isValidGyroPayload(text: unknown, maxChars: number): boolean {
	return typeof text === 'string' && text.length <= maxChars && decodeGyroSamples(text).length > 0;
}
