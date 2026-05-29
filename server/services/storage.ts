import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Always uses local file system (AWS S3 support removed)
 * Files are saved to public/uploads folder
 */
export async function uploadObject(fileBuffer: Buffer, filePath: string, options: any = {}) {
	// Use local file system
	const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
	const fullPath = path.join(uploadsDir, filePath);

	// Create folder
	const dir = path.dirname(fullPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Save file
	fs.writeFileSync(fullPath, fileBuffer);

	logger.info('File uploaded to local storage', {
		path: filePath,
		localPath: fullPath
	});

	return Promise.resolve();
}

export async function deleteObject(filePath: string) {
	// Delete local file
	const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath);

	if (fs.existsSync(fullPath)) {
		fs.unlinkSync(fullPath);
		logger.info('File deleted from local storage', {
			path: filePath,
			localPath: fullPath
		});
	} else {
		logger.warn('File not found for deletion', {
			path: filePath,
			localPath: fullPath
		});
	}

	return Promise.resolve();
}
