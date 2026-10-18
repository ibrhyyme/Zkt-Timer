import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {generateRandomCode} from '../../shared/code';
import {deleteObject, uploadObject} from '../services/storage';
import {getImageBufferFromFileStream} from '../util/image';
import {
	TimerBackgroundTarget,
	getTimerBackgroundSlot,
	isTimerBackgroundRowEmpty,
} from '../../shared/timer_background';

export function getTimerBackground(user) {
	return getPrisma().timerBackground.findUnique({
		where: {
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

/** Stores an uploaded image or video and returns where it went. Writes no row. */
export async function storeTimerBackgroundFile(
	fileName: string,
	fileStream
): Promise<{storage_path: string; media_type: 'image' | 'video'}> {
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

	return {storage_path: path, media_type: isVideo ? 'video' : 'image'};
}

function slotFields(target: TimerBackgroundTarget, media: {storage_path: string; media_type: string} | null) {
	return target === 'mobile'
		? {mobile_storage_path: media?.storage_path ?? null, mobile_media_type: media?.media_type ?? null}
		: {storage_path: media?.storage_path ?? null, media_type: media?.media_type ?? null};
}

/**
 * Puts a stored file into one slot (desktop or mobile) of the user's row, creating the
 * row if needed, and only then removes the file it replaced. The old order (delete the
 * row, then upload) left the user with no background at all when the upload failed, and
 * would now also have thrown away the other slot.
 */
export async function setTimerBackgroundSlot(
	user,
	target: TimerBackgroundTarget,
	media: {storage_path: string; media_type: string}
) {
	const existing = await getTimerBackground(user);
	const replaced = getTimerBackgroundSlot(existing, target);

	const row = await getPrisma().timerBackground.upsert({
		where: {user_id: user.id},
		create: {id: uuid(), user_id: user.id, ...slotFields(target, media)},
		update: slotFields(target, media),
	});

	if (replaced && replaced.storage_path !== media.storage_path) {
		await deleteObject(replaced.storage_path).catch(() => {});
	}
	return row;
}

/**
 * Empties one slot. The row goes away once it holds nothing worth keeping, which is the
 * old "delete my background" behaviour for anyone who never touched the mobile switch.
 */
export async function clearTimerBackgroundSlot(user, target: TimerBackgroundTarget) {
	const existing = await getTimerBackground(user);
	if (!existing) return null;

	const removed = getTimerBackgroundSlot(existing, target);
	if (removed) {
		await deleteObject(removed.storage_path).catch(() => {});
	}

	const next = {...existing, ...slotFields(target, null)};
	if (isTimerBackgroundRowEmpty(next)) {
		await getPrisma().timerBackground.delete({where: {id: existing.id}});
	} else {
		await getPrisma().timerBackground.update({where: {id: existing.id}, data: slotFields(target, null)});
	}
	return existing;
}

/** "Use the same on mobile". Creates the row when switching off before any upload. */
export async function setTimerBackgroundMobileSame(user, same: boolean) {
	const row = await getPrisma().timerBackground.upsert({
		where: {user_id: user.id},
		create: {id: uuid(), user_id: user.id, mobile_same_as_desktop: same},
		update: {mobile_same_as_desktop: same},
	});

	if (isTimerBackgroundRowEmpty(row)) {
		await getPrisma().timerBackground.delete({where: {id: row.id}});
	}
	return row;
}
