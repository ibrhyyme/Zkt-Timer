import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Her zaman yerel dosya sistemini kullanır (AWS S3 desteği kaldırıldı)
 * Dosyalar public/uploads klasörüne kaydedilir
 */
export async function uploadObject(fileBuffer: Buffer, filePath: string, options: any = {}) {
	// Yerel dosya sistemini kullan
	const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
	const fullPath = path.join(uploadsDir, filePath);

	// Klasörü oluştur
	const dir = path.dirname(fullPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Dosyayı kaydet
	fs.writeFileSync(fullPath, fileBuffer);

	logger.info('File uploaded to local storage', {
		path: filePath,
		localPath: fullPath
	});

	return Promise.resolve();
}

export async function deleteObject(filePath: string) {
	// Yerel dosyayı sil
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
