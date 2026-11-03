import {Readable} from 'stream';
import Jimp from 'jimp';
import {getImageBufferFromFileStream, readImagePixelCount, MAX_IMAGE_PIXELS} from '../image';

function streamFactory(buffer: Buffer) {
	return () => Readable.from(buffer) as any;
}

const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];

/** PNG signature + an IHDR claiming w x h. Decoding never gets this far in the bomb cases. */
function pngHeader(w: number, h: number): Buffer {
	const ihdr = Buffer.alloc(25);
	ihdr.writeUInt32BE(13, 0);
	ihdr.write('IHDR', 4, 'ascii');
	ihdr.writeUInt32BE(w, 8);
	ihdr.writeUInt32BE(h, 12);
	ihdr[16] = 8;
	return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ihdr]);
}

/** GIF89a with a screen of sw x sh and one frame of fw x fh whose LZW stream is clear + end. */
function gif(sw: number, sh: number, fw: number, fh: number): Buffer {
	return Buffer.from([
		...Buffer.from('GIF89a', 'ascii'),
		...le16(sw), ...le16(sh), 0x80, 0x00, 0x00,
		0, 0, 0, 255, 255, 255,
		0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, // graphic control extension
		0x2c, 0, 0, 0, 0, ...le16(fw), ...le16(fh), 0x00,
		0x02, 0x01, 0x2c, 0x00,
		0x3b,
	]);
}

/** JPEG start + an APP0 segment + a baseline SOF0 claiming w x h. */
function jpegHeader(w: number, h: number): Buffer {
	const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0', 'binary'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
	const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, ...[h >> 8, h & 0xff], ...[w >> 8, w & 0xff], 0x01, 0x01, 0x11, 0x00]);
	return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(16)]);
}

describe('readImagePixelCount', () => {
	it('reads PNG dimensions from IHDR', () => {
		expect(readImagePixelCount(pngHeader(300, 200), 'png')).toBe(60000);
	});

	it('reads JPEG dimensions from the first SOF after other segments', () => {
		expect(readImagePixelCount(jpegHeader(4032, 3024), 'jpeg')).toBe(4032 * 3024);
	});

	it('takes the largest of the GIF screen and its frames', () => {
		expect(readImagePixelCount(gif(100, 100, 10, 10), 'gif')).toBe(10000);
		expect(readImagePixelCount(gif(1, 1, 20000, 20000), 'gif')).toBe(400000000);
	});

	it('matches what Jimp itself writes', async () => {
		for (const mime of [Jimp.MIME_PNG, Jimp.MIME_JPEG, Jimp.MIME_GIF]) {
			const buf = await new Jimp(123, 45, 0x112233ff).getBufferAsync(mime);
			const type = mime === Jimp.MIME_PNG ? 'png' : mime === Jimp.MIME_JPEG ? 'jpeg' : 'gif';
			expect(readImagePixelCount(buf, type)).toBe(123 * 45);
		}
	});

	it('returns null for a truncated header', () => {
		expect(readImagePixelCount(pngHeader(10, 10).slice(0, 20), 'png')).toBeNull();
		expect(readImagePixelCount(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]), 'jpeg')).toBeNull();
	});
});

describe('getImageBufferFromFileStream pixel limit', () => {
	const opts = {width: 256, height: 256};

	it('rejects a small PNG claiming 20000x20000 before decoding', async () => {
		const start = Date.now();
		await expect(getImageBufferFromFileStream('bomb.png', streamFactory(pngHeader(20000, 20000)), opts)).rejects.toThrow(
			/at most 40 megapixels/
		);
		expect(Date.now() - start).toBeLessThan(1000);
	});

	it('rejects a GIF hiding a huge frame behind a 1x1 screen', async () => {
		await expect(getImageBufferFromFileStream('bomb.gif', streamFactory(gif(1, 1, 20000, 20000)), opts)).rejects.toThrow(
			/at most 40 megapixels/
		);
	});

	it('rejects an image whose header claims zero pixels', async () => {
		await expect(getImageBufferFromFileStream('zero.png', streamFactory(pngHeader(0, 100)), opts)).rejects.toThrow(
			/unreadable image header/
		);
	});

	it('still accepts a normal image right under the limit check', async () => {
		const input = await new Jimp(640, 480, 0x00ff00ff).getBufferAsync(Jimp.MIME_PNG);
		const out = await getImageBufferFromFileStream('ok.png', streamFactory(input), opts);
		const result = await Jimp.read(out);
		expect(result.bitmap.width).toBe(256);
		expect(MAX_IMAGE_PIXELS).toBe(40_000_000);
	});
});
