import {generateRandomCode} from '../../shared/code';
import {deleteObject, uploadObject} from '../services/storage';
import {getPrisma} from '../database';
import {v4 as uuid} from 'uuid';
import {getImageBufferFromFileStream, ImageFileToBuffer} from '../util/image';
import {logger} from '../services/logger';

export function getImageById(id) {
	return getPrisma().image.findUnique({
		where: {
			id,
		},
	});
}

export async function deleteImage(image) {
	try {
		await deleteObject(image.storage_path);

		return getPrisma().image.delete({
			where: {
				id: image.id,
			},
		});
	} catch (e) {
		logger.warn('Could not find image to delete.', {
			image,
			error: e,
		});
	}
}

export async function uploadImageWithFile(user, fileName, fileStream, options: ImageFileToBuffer) {
	const fileType = fileName.split('.').pop().toLowerCase();
	const name = `${generateRandomCode(10)}.${fileType}`;
	const path = `images/${name}`;

	const uploadBuffer = await getImageBufferFromFileStream(fileName, fileStream, options);
	
	// Development ortamında local file system'e kaydet
	const isDev = process.env.ENV === 'development';
	if (isDev) {
		const fs = require('fs');
		const uploadPath = `./public/uploads/${path}`;
		
		// uploads klasörünü oluştur
		const dir = uploadPath.substring(0, uploadPath.lastIndexOf('/'));
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		
		// Dosyayı local'e kaydet
		fs.writeFileSync(uploadPath, uploadBuffer);
		logger.info(`Image saved locally in development: ${uploadPath}`);
	} else {
		await uploadObject(uploadBuffer, path);
	}

	return getPrisma().image.create({
		data: {
			storage_path: path,
			user_id: user.id,
		},
	});
}
