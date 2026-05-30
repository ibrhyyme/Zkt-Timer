import {v4 as uuid} from 'uuid';
import {customAlphabet} from 'nanoid';

const LOWER_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const UPPER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_ALPHABET = '0123456789';

const nanoCustom = customAlphabet(`${UPPER_ALPHABET}${LOWER_ALPHABET}${NUMBER_ALPHABET}`, 8)

// Cryptographically secure random char picker with rejection sampling to avoid
// modulo bias. Uses globalThis.crypto.getRandomValues — available natively in both
// Node 20+ and browsers, so shared/ stays dependency-free (no Node/browser import).
function secureRandomChars(charset: string, length: number): string {
	const charsetLength = charset.length;
	// Largest multiple of charsetLength that fits in a byte; bytes >= this are rejected.
	const maxValid = Math.floor(256 / charsetLength) * charsetLength;
	const result: string[] = [];
	const buffer = new Uint8Array(length * 2);
	while (result.length < length) {
		globalThis.crypto.getRandomValues(buffer);
		for (let i = 0; i < buffer.length && result.length < length; i++) {
			const byte = buffer[i];
			if (byte < maxValid) {
				result.push(charset.charAt(byte % charsetLength));
			}
		}
	}
	return result.join('');
}

export function generateRandomCode(length: number): string {
	return secureRandomChars(`${UPPER_ALPHABET}${NUMBER_ALPHABET}`, length);
}

export function generateRandomString(length: number): string {
	return secureRandomChars(`${LOWER_ALPHABET}${NUMBER_ALPHABET}`, length);
}

export function generateId(length: number = 8) {
	return nanoCustom(length);
}

export function generateUUID() {
	return uuid();
}
