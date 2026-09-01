import fileDownload from 'js-file-download';
import i18n from '../i18n/i18n';
import {isNative} from './platform';
import {toastError} from './toast';

/**
 * Hands a generated file to the user, on web and inside the native shell.
 *
 * The browser recipe (blob URL + a synthetic `<a download>` click, which is what
 * js-file-download and jsPDF's own `save()` do) silently does nothing in the Capacitor
 * WebView: no file, no error, no feedback. Every export in the app went through that
 * path, so on mobile the export and PDF buttons looked broken.
 *
 * Natively the file is written to the cache directory and then handed to the OS. Cache
 * is deliberate: it needs no storage permission, `android/app/src/main/res/xml/file_paths.xml`
 * already exposes it to the FileProvider that both the viewer and the share sheet use,
 * and the OS is free to reclaim the file once the user is done with it.
 */
export async function saveFile(data: Blob | string, fileName: string, mimeType: string): Promise<void> {
	if (!isNative()) {
		fileDownload(data, fileName, mimeType);
		return;
	}

	let uri: string;

	try {
		const {Filesystem, Directory, Encoding} = await import('@capacitor/filesystem');
		const path = sanitiseFileName(fileName);

		// Text goes as UTF-8 so Turkish characters survive; anything binary has to be
		// base64, which is how the plugin distinguishes the two.
		const written =
			typeof data === 'string'
				? await Filesystem.writeFile({path, data, directory: Directory.Cache, encoding: Encoding.UTF8})
				: await Filesystem.writeFile({path, data: await blobToBase64(data), directory: Directory.Cache});

		uri = written.uri;
	} catch (e) {
		console.warn('[SaveFile] write failed:', e);
		// Nothing was written, so there is no file to open. Fall back to the browser
		// path, which is no worse than the behaviour this replaced.
		fileDownload(data, fileName, mimeType);
		return;
	}

	if (await openInViewer(uri)) return;
	if (await openInShareSheet(uri, fileName)) return;

	// The file exists on disk but nothing would display it. Say so rather than
	// leaving the user staring at a button that did nothing.
	console.warn('[SaveFile] file written but no handler opened it:', uri);
	toastError(i18n.t('save_file.open_failed'));
}

/**
 * Opens the file in the system document viewer.
 *
 * Both path spellings are attempted because the two sides disagree: Filesystem returns
 * a `file://` URI, while the viewer's underlying library takes a plain filesystem path.
 * Which one a given plugin version accepts is not worth a build cycle to find out, and
 * the wrong one costs one failed call.
 */
async function openInViewer(uri: string): Promise<boolean> {
	let FileViewer: typeof import('@capacitor/file-viewer')['FileViewer'];
	try {
		({FileViewer} = await import('@capacitor/file-viewer'));
	} catch (e) {
		console.warn('[SaveFile] file-viewer plugin unavailable:', e);
		return false;
	}

	for (const path of [stripFileScheme(uri), uri]) {
		try {
			await FileViewer.openDocumentFromLocalPath({path});
			return true;
		} catch (e) {
			console.warn(`[SaveFile] viewer rejected path "${path}":`, e);
		}
	}

	return false;
}

/**
 * Share sheet fallback. Not just a consolation prize: it also covers the case where the
 * device has no app registered for the file type, since from there the user can still
 * save it somewhere or send it on.
 */
async function openInShareSheet(uri: string, fileName: string): Promise<boolean> {
	try {
		const {Share} = await import('@capacitor/share');
		await Share.share({title: fileName, files: [uri]});
		return true;
	} catch (e) {
		// A cancelled share sheet also lands here, which is fine: the user saw it, and
		// the toast that follows is a harmless extra.
		console.warn('[SaveFile] share sheet failed:', e);
		return false;
	}
}

/** `file:///data/...` -> `/data/...`; anything else is returned untouched. */
function stripFileScheme(uri: string): string {
	return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
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
