import {S3Client} from '@aws-sdk/client-s3-node/S3Client';
import {PutObjectCommand, PutObjectInput} from '@aws-sdk/client-s3-node/commands/PutObjectCommand';
import {DeleteObjectCommand} from '@aws-sdk/client-s3-node/commands/DeleteObjectCommand';
import {logger} from './logger';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'zkttimer';

const isDev = process.env.ENV === 'development';
const s3 = isDev ? undefined : new S3Client({region: 'us-west-2'});

export async function uploadObject(fileBuffer: Buffer, filePath: string, options: Partial<PutObjectInput> = {}) {
	if (isDev) {
		// Development ortamında local dosya sistemi kullan
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
			env: process.env.ENV,
			path: filePath,
			localPath: fullPath
		});
		return Promise.resolve();
	}
	const params: PutObjectInput = {
		Bucket: BUCKET_NAME,
		Key: filePath,
		Body: fileBuffer,
		...options
	};

	const command = new PutObjectCommand(params);
	return s3.send(command);
}

export async function deleteObject(filePath: string) {
	if (isDev) {
		// Development ortamında local dosyayı sil
		const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath);
		
		if (fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
			logger.info('File deleted from local storage', {
				env: process.env.ENV,
				path: filePath,
				localPath: fullPath
			});
		} else {
			logger.warn('File not found for deletion', {
				env: process.env.ENV,
				path: filePath,
				localPath: fullPath
			});
		}
		return Promise.resolve();
	}
	const params = {
		Bucket: BUCKET_NAME,
		Key: filePath
	};

	const command = new DeleteObjectCommand(params);
	return s3.send(command);
}
