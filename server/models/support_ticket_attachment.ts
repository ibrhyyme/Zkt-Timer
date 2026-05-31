import {ReadStream} from 'fs';
import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {uploadObject} from '../services/storage';
import {detectImageType, detectVideoType, getFileStreamAsBufferStream} from '../util/image';
import {logger} from '../services/logger';

export const SUPPORT_ATTACHMENT_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
	png: 'png',
	jpeg: 'jpg',
	gif: 'gif',
	webp: 'webp',
};
const VIDEO_EXT_BY_TYPE: Record<string, string> = {
	mp4: 'mp4',
	webm: 'webm',
	quicktime: 'mov',
};
const IMAGE_MIME_BY_TYPE: Record<string, string> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
};
const VIDEO_MIME_BY_TYPE: Record<string, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm',
	quicktime: 'video/quicktime',
};

export interface UploadedSupportAttachment {
	id: string;
	message_id: string;
	storage_path: string;
	mime_type: string;
	kind: 'image' | 'video';
	size_bytes: number;
	original_name: string | null;
	created_at: Date;
}

export async function uploadSupportTicketAttachment(
	messageId: string,
	fileName: string,
	fileStream: () => ReadStream,
	declaredMime: string | null
): Promise<UploadedSupportAttachment> {
	const stream = fileStream();
	const buffer = await getFileStreamAsBufferStream(stream);

	// declared MIME ile baslangic karari, magic byte ile dogrula
	const mimeLower = (declaredMime || '').toLowerCase();
	const looksLikeVideo = mimeLower.startsWith('video/');

	let kind: 'image' | 'video';
	let detectedExt: string;
	let detectedMime: string;

	if (looksLikeVideo) {
		const videoType = detectVideoType(buffer);
		if (!videoType) {
			throw new Error('Invalid video file: only MP4, WebM, QuickTime allowed');
		}
		if (buffer.length > SUPPORT_ATTACHMENT_MAX_VIDEO_BYTES) {
			throw new Error('Video too large (max 25MB)');
		}
		kind = 'video';
		detectedExt = VIDEO_EXT_BY_TYPE[videoType];
		detectedMime = VIDEO_MIME_BY_TYPE[videoType];
	} else {
		const imageType = detectImageType(buffer);
		if (!imageType) {
			throw new Error('Invalid image file: only PNG, JPEG, GIF, WebP allowed');
		}
		if (buffer.length > SUPPORT_ATTACHMENT_MAX_IMAGE_BYTES) {
			throw new Error('Image too large (max 25MB)');
		}
		kind = 'image';
		detectedExt = IMAGE_EXT_BY_TYPE[imageType];
		detectedMime = IMAGE_MIME_BY_TYPE[imageType];
	}

	const fileId = uuid();
	const path = `support_ticket_attachments/${fileId}.${detectedExt}`;

	await uploadObject(buffer, path);

	const safeOriginal = (fileName || '').slice(0, 255) || null;

	const record = await getPrisma().supportTicketAttachment.create({
		data: {
			message_id: messageId,
			storage_path: path,
			mime_type: detectedMime,
			kind,
			size_bytes: buffer.length,
			original_name: safeOriginal,
		},
	});

	logger.info('[SupportTicket] Attachment uploaded', {
		messageId,
		path,
		kind,
		size: buffer.length,
	});

	return record as UploadedSupportAttachment;
}
