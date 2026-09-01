import fileDownload from 'js-file-download';
import {isNative} from './platform';

/**
 * Hands a generated file to the user, on web and inside the native shell.
 *
 * The browser recipe (blob URL + a synthetic `<a download>` click, which is what
 * js-file-download and jsPDF's own `save()` do) silently does nothing in the Capacitor
 * WebView: no file, no error, no feedback. Every export in the app went through that
 * path, so on mobile the export and PDF buttons looked broken.
 *
 * Natively the file is written to the cache directory and opened in the system viewer,
 * from where the user can share or keep it. Cache is deliberate: it needs no storage
 * permission, `android/app/src/main/res/xml/file_paths.xml` already exposes it, and the
 * OS is free to reclaim the file once the user is done with it.
 */
export async function saveFile(data: Blob | string, fileName: string, mimeType: string): Promise<void> {
	if (!isNative()) {
		fileDownload(data, fileName, mimeType);
		return;
	}

	try {
		const [{Filesystem, Directory, Encoding}, {FileViewer}] = await Promise.all([
			import('@capacitor/filesystem'),
			import('@capacitor/file-viewer'),
		]);

		const path = sanitiseFileName(fileName);

		// Text goes as UTF-8 so Turkish characters survive; anything binary has to be
		// base64, which is how the plugin distinguishes the two.
		const written =
			typeof data === 'string'
				? await Filesystem.writeFile({path, data, directory: Directory.Cache, encoding: Encoding.UTF8})
				: await Filesystem.writeFile({path, data: await blobToBase64(data), directory: Directory.Cache});

		await FileViewer.openDocumentFromLocalPath({path: written.uri});
	} catch (e) {
		console.warn('[SaveFile] native save failed, falling back to browser download:', e);
		// Worst case this is the pre-existing behaviour, which is no worse than before.
		fileDownload(data, fileName, mimeType);
	}
}

/** Strips what a filesystem path cannot carry; the name is otherwise left alone. */
function sanitiseFileName(fileName: string): string {
	return fileName.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'download';
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => {
			const result = String(reader.result || '');
			// readAsDataURL gives "data:<mime>;base64,<payload>"; the plugin wants the payload.
			const comma = result.indexOf(',');
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.readAsDataURL(blob);
	});
}
