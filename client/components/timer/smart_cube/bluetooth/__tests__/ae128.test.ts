// Three cube protocols decrypt their traffic with this module (QiYi, MoYu WeiLong AI and
// GAN Gen1), and a wrong result there does not fail loudly — the packets simply never make
// sense and the cube looks unresponsive. These tests pin it to the FIPS-197 vectors so the
// implementation is verified rather than assumed.
//
// They also cover the calling convention. cstimer exposes AES128 through a factory
// (`$.aes128 = function(key) { return new AES128(key); }`), and every call site here was
// written against that: `aes128(key)`, no `new`. Exporting the bare constructor instead
// silently returned undefined and left the caller with no decoder at all.

import aes128 from '../ae128';

/** FIPS-197 Appendix B / C.1 — the standard AES-128 vector. */
const KEY = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];
const PLAINTEXT = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
const CIPHERTEXT = [0x69, 0xc4, 0xe0, 0xd8, 0x6a, 0x7b, 0x04, 0x30, 0xd8, 0xcd, 0xb7, 0x80, 0x70, 0xb4, 0xc5, 0x5a];

describe('ae128 calling convention', () => {
	it('builds a usable cipher when called as a function', () => {
		const cipher = aes128(KEY);
		expect(cipher).toBeDefined();
		expect(typeof cipher.encrypt).toBe('function');
		expect(typeof cipher.decrypt).toBe('function');
	});

	it('still works when called with new', () => {
		// A constructor call on a function that returns an object yields that object, so the
		// factory does not break any caller that reached for `new`.
		const cipher = new (aes128 as any)(KEY);
		expect(typeof cipher.encrypt).toBe('function');
	});
});

describe('ae128 against the FIPS-197 vector', () => {
	it('encrypts the standard block', () => {
		const block = PLAINTEXT.slice();
		aes128(KEY).encrypt(block);
		expect(block).toEqual(CIPHERTEXT);
	});

	it('decrypts the standard block', () => {
		const block = CIPHERTEXT.slice();
		aes128(KEY).decrypt(block);
		expect(block).toEqual(PLAINTEXT);
	});

	it('round-trips an arbitrary block', () => {
		const original = Array.from({length: 16}, (_, i) => (i * 37 + 11) & 0xff);
		const block = original.slice();
		const cipher = aes128(KEY);
		cipher.encrypt(block);
		expect(block).not.toEqual(original);
		cipher.decrypt(block);
		expect(block).toEqual(original);
	});

	it('keeps the expanded key across calls so one cipher can be reused', () => {
		// The drivers build the cipher once and reuse it for every packet; a per-call reset
		// would corrupt everything after the first.
		const cipher = aes128(KEY);
		for (let i = 0; i < 3; i++) {
			const block = PLAINTEXT.slice();
			cipher.encrypt(block);
			expect(block).toEqual(CIPHERTEXT);
		}
	});
});
