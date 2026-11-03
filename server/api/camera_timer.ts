import fs from 'fs';
import path from 'path';
import {Request, Response} from 'express';
import {getMe} from '../util/auth';

/**
 * Serves the Kamera Timer's brain: one worker file, MediaPipe's runtime and the hand model.
 *
 * Private, like the trainer library: it is built outside this repo, uploaded to the server by
 * hand and mounted read-only at data/camera-timer (docker-compose volume). This repo keeps only
 * the screen, the camera and the timer wiring (client/util/camera-timer). Without the folder
 * (a fresh checkout, a server before the upload) the manifest answers 404 and the client simply
 * does not offer the input.
 *
 * Admins only while the Kamera Timer is in its first test (owner, 2026-11-03). The same rule as
 * canUseCameraTimer on the client: whoever cannot use the input does not get the files either.
 *
 * The folder also holds ~30 MB of MediaPipe files. They stay out of public/ and dist/ on
 * purpose: both are copied into the native bundle and the OTA zip, and the input is desktop only.
 */

const ROOT = path.join(__dirname, '..', '..');

export function cameraTimerDir(): string {
	return process.env.CAMERA_TIMER_DIR || path.join(ROOT, 'data', 'camera-timer');
}

const CONTENT_TYPES: Record<string, string> = {
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	// MediaPipe compiles its runtime with instantiateStreaming, which refuses any other type.
	'.wasm': 'application/wasm',
	'.task': 'application/octet-stream',
	'.json': 'application/json; charset=utf-8',
};

/**
 * The file a request names inside the brain folder, or null: outside the folder, a dotfile,
 * or a type the brain does not have. Pure, so the traversal rules are tested without disk.
 */
export function resolveCameraTimerFile(dir: string, requested: string): string | null {
	let rel: string;
	try {
		rel = decodeURIComponent(requested || '');
	} catch (e) {
		return null;
	}
	rel = rel.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!rel || rel.includes('\0') || rel.split('/').some((part) => part.startsWith('.'))) return null;
	const base = path.resolve(dir);
	const file = path.resolve(base, rel);
	if (!file.startsWith(base + path.sep)) return null;
	if (!CONTENT_TYPES[path.extname(file).toLowerCase()]) return null;
	return file;
}

/**
 * The manifest names the current brain and is never cached; every other file carries its
 * version in its name (brain-<hash>.js, mp-<version>/), so it can be kept for good. Private
 * in both cases: the files are per user (admins), never for the edge cache.
 */
export function cameraTimerCacheControl(file: string): string {
	return path.basename(file) === 'manifest.json' ? 'private, no-store' : 'private, max-age=31536000, immutable';
}

export async function cameraTimerHandler(req: Request, res: Response) {
	let me = null;
	try {
		// getMe is typed against express-serve-static-core's Request (same object), as in iap_sync.
		me = await getMe(req as any);
	} catch (e) {
		me = null;
	}
	if (!me?.admin) {
		res.status(403).end();
		return;
	}

	const file = resolveCameraTimerFile(cameraTimerDir(), (req.params as any)[0]);
	if (!file) {
		res.status(404).end();
		return;
	}

	fs.stat(file, (err, stat) => {
		if (err || !stat.isFile()) {
			res.status(404).end();
			return;
		}
		res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file).toLowerCase()]);
		res.setHeader('Cache-Control', cameraTimerCacheControl(file));
		res.sendFile(file, {cacheControl: false, dotfiles: 'deny'}, (sendErr) => {
			if (sendErr && !res.headersSent) res.status(404).end();
		});
	});
}
