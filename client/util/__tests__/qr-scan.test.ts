import {classifyCameraError, qrScanSupported, startQrScan} from '../qr-scan';

describe('qr-scan', () => {
	it('maps permission errors to denied', () => {
		expect(classifyCameraError('NotAllowedError')).toBe('denied');
		expect(classifyCameraError('SecurityError')).toBe('denied');
	});

	it('maps a missing or unmatched camera to no_camera', () => {
		expect(classifyCameraError('NotFoundError')).toBe('no_camera');
		expect(classifyCameraError('OverconstrainedError')).toBe('no_camera');
	});

	it('maps everything else to failed', () => {
		expect(classifyCameraError('NotReadableError')).toBe('failed');
		expect(classifyCameraError(undefined)).toBe('failed');
	});

	it('reports unsupported without touching the video element when there is no camera API', async () => {
		expect(qrScanSupported()).toBe(false);
		const result = await startQrScan({video: {} as HTMLVideoElement, onResult: () => undefined});
		expect(result).toEqual({ok: false, kind: 'unsupported', detail: ''});
	});
});
