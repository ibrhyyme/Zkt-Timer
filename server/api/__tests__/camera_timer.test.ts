// The Kamera Timer's brain is private and admin-only while it is tested: the handler must
// never serve it to anyone else, never leave its folder, and keep the edge cache out of it.

import fs from 'fs';
import os from 'os';
import path from 'path';

const getMe = jest.fn();
jest.mock('../../util/auth', () => ({getMe: (...a: any[]) => getMe(...a)}));

import {cameraTimerCacheControl, cameraTimerHandler, resolveCameraTimerFile} from '../camera_timer';

const DIR = path.join(os.tmpdir(), 'zkt-camera-timer-test');

function mockRes() {
	const res: any = {headers: {} as Record<string, string>, statusCode: 200, headersSent: false};
	res.status = jest.fn((code: number) => {
		res.statusCode = code;
		return res;
	});
	res.setHeader = jest.fn((k: string, v: string) => {
		res.headers[k] = v;
	});
	let done: () => void;
	res.finished = new Promise<void>((resolve) => (done = resolve));
	res.end = jest.fn(() => done());
	res.sendFile = jest.fn((_file: string, _opts: any, cb?: (e?: any) => void) => {
		cb?.();
		done();
	});
	return res;
}

beforeAll(() => {
	fs.mkdirSync(path.join(DIR, 'mp-0.10.35', 'wasm'), {recursive: true});
	fs.writeFileSync(path.join(DIR, 'manifest.json'), '{"v":1,"brain":"brain-abc123.js"}');
	fs.writeFileSync(path.join(DIR, 'brain-abc123.js'), 'self.onmessage=()=>{}');
	fs.writeFileSync(path.join(DIR, 'mp-0.10.35', 'wasm', 'vision_wasm_internal.wasm'), 'x');
	fs.writeFileSync(path.join(DIR, '.env'), 'SECRET=1');
	process.env.CAMERA_TIMER_DIR = DIR;
});

afterAll(() => {
	delete process.env.CAMERA_TIMER_DIR;
	fs.rmSync(DIR, {recursive: true, force: true});
});

beforeEach(() => getMe.mockReset());

describe('resolveCameraTimerFile', () => {
	it('resolves the brain, the manifest and MediaPipe files inside the folder', () => {
		expect(resolveCameraTimerFile(DIR, 'brain-abc123.js')).toBe(path.join(DIR, 'brain-abc123.js'));
		expect(resolveCameraTimerFile(DIR, 'manifest.json')).toBe(path.join(DIR, 'manifest.json'));
		expect(resolveCameraTimerFile(DIR, 'mp-0.10.35/wasm/vision_wasm_internal.wasm')).toBe(
			path.join(DIR, 'mp-0.10.35', 'wasm', 'vision_wasm_internal.wasm')
		);
	});

	it('refuses anything outside the folder, dotfiles and unknown types', () => {
		for (const bad of [
			'../secrets.json',
			'mp-0.10.35/../../x.js',
			'%2e%2e/%2e%2e/etc/passwd.json',
			'..\\..\\x.js',
			'.env',
			'mp-0.10.35/.hidden/a.js',
			'notes.txt',
			'',
			'%E0%A4%A',
			'brain.js\0.png',
		]) {
			expect(resolveCameraTimerFile(DIR, bad)).toBeNull();
		}
	});

	it('keeps the manifest out of every cache and lets versioned files stay', () => {
		expect(cameraTimerCacheControl(path.join(DIR, 'manifest.json'))).toBe('private, no-store');
		expect(cameraTimerCacheControl(path.join(DIR, 'brain-abc123.js'))).toMatch(/^private, max-age=\d+, immutable$/);
	});
});

describe('cameraTimerHandler', () => {
	it('answers 403 to signed-out users and members, without touching the disk', async () => {
		for (const me of [null, {id: 'u1', admin: false}]) {
			getMe.mockResolvedValueOnce(me);
			const res = mockRes();
			await cameraTimerHandler({params: {0: 'brain-abc123.js'}} as any, res);
			await res.finished;
			expect(res.statusCode).toBe(403);
			expect(res.sendFile).not.toHaveBeenCalled();
		}
	});

	it('treats a failing session lookup as signed out', async () => {
		getMe.mockRejectedValueOnce(new Error('db down'));
		const res = mockRes();
		await cameraTimerHandler({params: {0: 'manifest.json'}} as any, res);
		await res.finished;
		expect(res.statusCode).toBe(403);
	});

	it('serves an admin the file with its type and a private cache header', async () => {
		getMe.mockResolvedValueOnce({id: 'a1', admin: true});
		const res = mockRes();
		await cameraTimerHandler({params: {0: 'mp-0.10.35/wasm/vision_wasm_internal.wasm'}} as any, res);
		await res.finished;
		expect(res.sendFile).toHaveBeenCalledTimes(1);
		expect(res.headers['Content-Type']).toBe('application/wasm');
		expect(res.headers['Cache-Control']).toMatch(/^private/);
	});

	it('answers 404 for a missing file and for a path outside the folder', async () => {
		for (const p of ['brain-missing.js', '../package.json', '.env']) {
			getMe.mockResolvedValueOnce({id: 'a1', admin: true});
			const res = mockRes();
			await cameraTimerHandler({params: {0: p}} as any, res);
			await res.finished;
			expect(res.statusCode).toBe(404);
			expect(res.sendFile).not.toHaveBeenCalled();
		}
	});
});
