import { decodeGyroSamples, encodeGyroSamples, isValidGyroPayload } from '../gyro_codec';
import capture from './fixtures/gani4_rotation_protocol.json';

describe('gyro codec', () => {
	it('round-trips a recorded stream to sensor precision, times to the millisecond', () => {
		const samples = capture.gyro.slice(0, 400).map((g) => ({ ...g, t: Math.round(g.t) }));
		const decoded = decodeGyroSamples(encodeGyroSamples(samples));
		expect(decoded).toHaveLength(samples.length);
		decoded.forEach((d, i) => {
			expect(d.t).toBe(samples[i].t);
			for (const k of ['x', 'y', 'z', 'w'] as const) expect(Math.abs(d[k] - samples[i][k])).toBeLessThan(1e-4);
		});
	});

	it('keeps a stream that starts before the first turn', () => {
		const decoded = decodeGyroSamples(encodeGyroSamples([
			{ t: -400, x: 0, y: 0, z: 0, w: 1 },
			{ t: -310, x: 0.1, y: 0, z: 0, w: 0.995 },
			{ t: 0, x: 0, y: 0, z: 0, w: 1 },
		]));
		expect(decoded.map((s) => s.t)).toEqual([-400, -310, 0]);
	});

	it('is about 13 characters a sample', () => {
		const text = encodeGyroSamples(capture.gyro.slice(0, 330))!;
		expect(text.length).toBeLessThan(330 * 14 + 20);
	});

	it('handles every base64 tail length', () => {
		for (let n = 1; n <= 4; n++) {
			const samples = Array.from({ length: n }, (_, i) => ({ t: i * 90, x: 0.5, y: -0.5, z: 0.25, w: 0.66 }));
			expect(decodeGyroSamples(encodeGyroSamples(samples))).toHaveLength(n);
		}
	});

	it('rejects malformed values instead of guessing', () => {
		expect(decodeGyroSamples(null)).toEqual([]);
		expect(decodeGyroSamples('g2;0;AAAA')).toEqual([]);
		expect(decodeGyroSamples('g1;x;AAAAAAAAAAAAAA==')).toEqual([]);
		expect(decodeGyroSamples('g1;0;!!!!')).toEqual([]);
		// Not a whole number of samples.
		expect(decodeGyroSamples('g1;0;AAAA')).toEqual([]);
		expect(isValidGyroPayload(encodeGyroSamples([{ t: 0, x: 0, y: 0, z: 0, w: 1 }]), 10)).toBe(false);
		expect(isValidGyroPayload(42, 1000)).toBe(false);
	});
});
