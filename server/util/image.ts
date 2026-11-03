import Jimp from 'jimp';
import {BufferListStream} from 'bl';
import {ReadStream} from 'fs';

export interface ImageFileToBuffer {
	width: number; // -1 for auto
	height: number; // -1 for auto
	quality?: number; // Default is 80
}

// Magic byte (file signature) check — prevents extension spoofing.
// If an attacker uploads a file like ".jpg.exe", we detect the real type by examining the first few bytes.
export function detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'gif' | 'webp' | null {
	if (buffer.length < 12) return null;
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
		return 'png';
	}
	// JPEG: FF D8 FF
	if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
		return 'jpeg';
	}
	// GIF: 47 49 46 38 (GIF8)
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
		return 'gif';
	}
	// WebP: RIFF....WEBP (52 49 46 46 ?? ?? ?? ?? 57 45 42 50)
	if (
		buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
		buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
	) {
		return 'webp';
	}
	return null;
}

// Jimp decodes with pure JS (pngjs, omggif, jpeg-js) synchronously on the main thread,
// and the cost follows the pixel count the header claims, not the file size. Measured
// 2026-11-03: a 380 KB PNG or a 50-byte GIF claiming 20000x20000 froze the process for
// ~21 s and took 2+ GB. jpeg-js already stops near 47 MP on its own (maxMemoryUsageInMB);
// 40 MP gives every format the same ceiling and still admits an 8K (33 MP) wallpaper.
export const MAX_IMAGE_PIXELS = 40_000_000;

/**
 * Reads the pixel area the decoder would allocate, straight from the file header,
 * without decoding. Returns null when the header cannot be parsed. For GIF the largest
 * of the logical screen and every frame descriptor counts: omggif sizes its buffers per
 * frame, so a 1x1 screen holding a 20000x20000 frame is still a bomb.
 */
export function readImagePixelCount(buffer: Buffer, type: 'png' | 'jpeg' | 'gif'): number | null {
	if (type === 'png') {
		if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
		return buffer.readUInt32BE(16) * buffer.readUInt32BE(20);
	}

	if (type === 'gif') {
		if (buffer.length < 13) return null;
		let max = buffer.readUInt16LE(6) * buffer.readUInt16LE(8);
		let i = 13;
		if (buffer[10] & 0x80) i += 3 * (1 << ((buffer[10] & 0x07) + 1));
		const skipSubBlocks = () => {
			while (i < buffer.length && buffer[i] !== 0) i += buffer[i] + 1;
			i++;
		};
		while (i < buffer.length) {
			const block = buffer[i];
			if (block === 0x3b) break;
			if (block === 0x21) {
				i += 2;
				skipSubBlocks();
			} else if (block === 0x2c) {
				if (i + 10 > buffer.length) return null;
				max = Math.max(max, buffer.readUInt16LE(i + 5) * buffer.readUInt16LE(i + 7));
				const flags = buffer[i + 9];
				i += 10;
				if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
				i++; // LZW minimum code size
				skipSubBlocks();
			} else {
				break; // malformed tail: keep what was read, the decoder will reject the rest
			}
		}
		return max;
	}

	// JPEG: walk the segments up to the first start-of-frame marker.
	let i = 2;
	while (i + 9 < buffer.length) {
		if (buffer[i] !== 0xff) return null;
		const marker = buffer[i + 1];
		if (marker === 0xff) {
			i++;
			continue;
		}
		if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
			return buffer.readUInt16BE(i + 5) * buffer.readUInt16BE(i + 7);
		}
		if (marker === 0xda || marker === 0xd9) return null; // scan or end before any frame header
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			i += 2;
			continue;
		}
		i += 2 + buffer.readUInt16BE(i + 2);
	}
	return null;
}

export async function getImageBufferFromFileStream(
	fileName: string,
	fileStream: () => ReadStream,
	options: ImageFileToBuffer
): Promise<Buffer> {
	const readStream = fileStream();
	const bufferStream = await getFileStreamAsBufferStream(readStream);

	// Detect real type via magic byte — protection against extension spoofing
	const detected = detectImageType(bufferStream);
	if (!detected) {
		throw new Error('Invalid image file: only PNG, JPEG, GIF, WebP allowed');
	}

	// WebP is left to Jimp, which has no WebP decoder and rejects it before allocating.
	if (detected !== 'webp') {
		const pixels = readImagePixelCount(bufferStream, detected);
		if (pixels === null || pixels === 0) {
			throw new Error('Invalid image file: unreadable image header');
		}
		if (pixels > MAX_IMAGE_PIXELS) {
			throw new Error('Image too large: at most 40 megapixels allowed');
		}
	}

	let mimeType: string = Jimp.MIME_PNG;
	if (detected === 'gif') {
		mimeType = Jimp.MIME_GIF;
	} else if (detected === 'jpeg') {
		mimeType = Jimp.MIME_JPEG;
	}

	const img = await Jimp.read(bufferStream);

	// Jimp already rotates the pixels to match the EXIF orientation while reading, but
	// jpeg-js writes the original EXIF block straight back out (encoder writeAPP1). The
	// orientation tag then tells the viewer to rotate a second time, which is why photos
	// taken on a phone came out on their side. Dropping the block keeps the rotation Jimp
	// applied and, as a bonus, strips GPS/device metadata from a publicly served image.
	(img as any)._exif = null;
	delete (img.bitmap as any).exifBuffer;

	return await img
		.scaleToFit(options.width, options.height)
		.quality(options.quality || 80)
		.getBufferAsync(mimeType);
}

// Video magic byte detection. Extension spoofing protection like images.
// mp4/quicktime: offset 4-7 'ftyp', next 4 bytes brand
// webm/matroska: 1A 45 DF A3
export function detectVideoType(buffer: Buffer): 'mp4' | 'webm' | 'quicktime' | null {
	if (buffer.length >= 12 &&
		buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
		const brand = buffer.slice(8, 12).toString('ascii');
		// QuickTime brand: 'qt  '
		if (brand.startsWith('qt')) return 'quicktime';
		return 'mp4';
	}
	if (buffer.length >= 4 &&
		buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
		return 'webm';
	}
	return null;
}

export async function getFileStreamAsBufferStream(readStream: ReadStream): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		readStream.pipe(
			BufferListStream((err: any, data: any) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			}) as any
		);
	});
}
