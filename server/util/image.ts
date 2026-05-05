import Jimp from 'jimp';
import {BufferListStream} from 'bl';
import {ReadStream} from 'fs';

export interface ImageFileToBuffer {
	width: number; // -1 for auto
	height: number; // -1 for auto
	quality?: number; // Default is 80
}

// Magic byte (file signature) check — extension spoofing'i engeller.
// Saldirgan ".jpg.exe" gibi dosya yuklerse, ilk birkac byte'a bakarak gercek tipi tespit ederiz.
function detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'gif' | 'webp' | null {
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

export async function getImageBufferFromFileStream(
	fileName: string,
	fileStream: () => ReadStream,
	options: ImageFileToBuffer
): Promise<Buffer> {
	const readStream = fileStream();
	const bufferStream = await getFileStreamAsBufferStream(readStream);

	// Magic byte ile gercek tip tespit — extension spoofing koruma
	const detected = detectImageType(bufferStream);
	if (!detected) {
		throw new Error('Invalid image file: only PNG, JPEG, GIF, WebP allowed');
	}

	let mimeType: string = Jimp.MIME_PNG;
	if (detected === 'gif') {
		mimeType = Jimp.MIME_GIF;
	} else if (detected === 'jpeg') {
		mimeType = Jimp.MIME_JPEG;
	}
	// WebP icin Jimp PNG olarak yeniden encode eder — guvenli

	const img = await Jimp.read(bufferStream);
	return await img
		.scaleToFit(options.width, options.height)
		.quality(options.quality || 80)
		.getBufferAsync(mimeType);
}

async function getFileStreamAsBufferStream(readStream: ReadStream): Promise<Buffer> {
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
