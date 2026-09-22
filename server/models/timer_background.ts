import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {generateRandomCode} from '../../shared/code';
import {deleteObject, uploadObject} from '../services/storage';
import {getImageBufferFromFileStream} from '../util/image';

export function getTimerBackground(user) {
	return getPrisma().timerBackground.findUnique({
		where: {
			user_id: user.id,
		},
	});
}

export async function deleteTimerBackground(background) {
	await deleteObject(background.storage_path);

	return getPrisma().timerBackground.delete({
		where: {
			id: background.id,
		},
	});
}

export function uploadTimerBackgroundWithHex(user, hex) {
	return getPrisma().timerBackground.create({
		data: {
			id: uuid(),
			hex,
			user_id: user.id,
		},
	});
}

/**
 * Video backgrounds are stored as uploaded, not transcoded.
 *
 * A server-side transcode would need ffmpeg in the image and a job queue to keep a 40 MB
 * encode off the request path, and it would buy nothing a size cap does not: the file is
 * served straight from disk by nginx and decoded by the viewer's own browser. The cap is
 * what keeps this honest, and it is enforced while reading the stream rather than after,
 * so an oversized upload never reaches memory in full.
 */
export const MAX_BACKGROUND_VIDEO_MB = 40;
const MAX_BACKGROUND_VIDEO_BYTES = MAX_BACKGROUND_VIDEO_MB * 1024 * 1024;

/** Only MP4: it is the one container both iOS and Android WebViews play without a codec pack. */
const VIDEO_EXTENSIONS = new Set(['mp4']);

export function isVideoBackgroundFile(fileName: string): boolean {
	return VIDEO_EXTENSIONS.has(String(fileName || '').split('.').pop().toLowerCase());
}

async function readStreamToBuffer(createReadStream, maxBytes: number): Promise<Buffer> {
	const stream = createReadStream();
	const chunks: Buffer[] = [];
	let total = 0;

	for await (const chunk of stream) {
		total += chunk.length;
		if (total > maxBytes) {
			// Stop pulling rather than letting the rest of the body arrive and be discarded.
			stream.destroy();
			throw new Error('FILE_TOO_LARGE');
		}
		chunks.push(chunk);
	}

	return Buffer.concat(chunks);
}

export async function uploadTimerBackgroundWithFile(user, fileName, fileStream) {
	const fileType = fileName.split('.').pop().toLowerCase();
	const name = `${generateRandomCode(10)}.${fileType}`;
	const path = `timer_backgrounds/${name}`;
	const isVideo = isVideoBackgroundFile(fileName);

	// Jimp only understands stills. Handing it an MP4 throws deep inside the decoder with a
	// message that says nothing about video, so the branch is taken on the extension first.
	const uploadBuffer = isVideo
		? await readStreamToBuffer(fileStream, MAX_BACKGROUND_VIDEO_BYTES)
		: await getImageBufferFromFileStream(fileName, fileStream, {
			height: 2000,
			width: 2000,
		});

	await uploadObject(uploadBuffer, path);

	return getPrisma().timerBackground.create({
		data: {
			id: uuid(),
			storage_path: path,
			media_type: isVideo ? 'video' : 'image',
			user_id: user.id,
		},
	});
}
