import {Readable} from 'stream';
import Jimp from 'jimp';
import {getImageBufferFromFileStream} from '../image';

/**
 * Builds a minimal EXIF APP1 segment carrying only the Orientation tag, so a plain
 * generated JPEG can stand in for a photo straight off a phone camera.
 */
function buildExifApp1(orientation: number): Buffer {
	const tiff = Buffer.concat([
		Buffer.from('4949', 'hex'), // 'II' little endian
		Buffer.from('2a00', 'hex'), // 42
		Buffer.from('08000000', 'hex'), // IFD0 offset
		Buffer.from('0100', 'hex'), // one entry
		Buffer.from('1201', 'hex'), // tag 0x0112 Orientation
		Buffer.from('0300', 'hex'), // type SHORT
		Buffer.from('01000000', 'hex'), // count 1
		Buffer.from([orientation, 0, 0, 0]),
		Buffer.from('00000000', 'hex'), // no next IFD
	]);
	const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
	const len = Buffer.alloc(2);
	len.writeUInt16BE(payload.length + 2, 0);
	return Buffer.concat([Buffer.from('ffe1', 'hex'), len, payload]);
}

async function landscapeJpegWithOrientation(orientation: number): Promise<Buffer> {
	// 200 wide x 100 tall. Orientation 6 means a viewer must render it 100x200.
	const image = new Jimp(200, 100, 0xff0000ff);
	const jpeg = await image.getBufferAsync(Jimp.MIME_JPEG);
	return Buffer.concat([jpeg.slice(0, 2), buildExifApp1(orientation), jpeg.slice(2)]);
}

function streamFactory(buffer: Buffer) {
	return () => Readable.from(buffer) as any;
}

function hasExifSegment(buffer: Buffer): boolean {
	return buffer.indexOf(Buffer.from('Exif\0\0', 'binary')) !== -1;
}

describe('getImageBufferFromFileStream EXIF handling', () => {
	it('keeps a rotated photo upright instead of writing the orientation tag back out', async () => {
		const input = await landscapeJpegWithOrientation(6);

		const output = await getImageBufferFromFileStream('photo.jpg', streamFactory(input), {
			width: 256,
			height: 256,
		});

		// Re-reading applies EXIF again if the tag survived — which is exactly the bug.
		const result = await Jimp.read(output);
		expect(result.bitmap.height).toBeGreaterThan(result.bitmap.width);
	});

	it('strips the EXIF block so GPS/device metadata never reaches a public image', async () => {
		const input = await landscapeJpegWithOrientation(6);

		const output = await getImageBufferFromFileStream('photo.jpg', streamFactory(input), {
			width: 256,
			height: 256,
		});

		expect(hasExifSegment(output)).toBe(false);
	});

	it('leaves an image without orientation metadata alone', async () => {
		const image = new Jimp(200, 100, 0x00ff00ff);
		const input = await image.getBufferAsync(Jimp.MIME_JPEG);

		const output = await getImageBufferFromFileStream('plain.jpg', streamFactory(input), {
			width: 256,
			height: 256,
		});

		const result = await Jimp.read(output);
		expect(result.bitmap.width).toBeGreaterThan(result.bitmap.height);
	});

	it('rejects a file whose bytes are not a real image', async () => {
		const notAnImage = Buffer.from('this is definitely not an image payload', 'utf8');

		await expect(
			getImageBufferFromFileStream('fake.jpg', streamFactory(notAnImage), {width: 256, height: 256})
		).rejects.toThrow(/Invalid image file/);
	});
});
