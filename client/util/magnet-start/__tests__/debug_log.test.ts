import { MagnetDetector } from '../detector';
import { detectorConfigFor } from '../config';
import {
	fixtureSamples,
	liftsOf,
	loadFixture,
	MagnetFixture,
	runDetector,
	toBatches,
} from '../testing/load_fixture';

type Log = typeof import('../debug_log').magnetDebugLog;

function freshLog(): Log {
	let log: Log;
	jest.isolateModules(() => {
		log = require('../debug_log').magnetDebugLog;
	});
	return log;
}

describe('magnet debug log', () => {
	it('keeps only the newest 300 entries', () => {
		const log = freshLog();
		for (let i = 0; i < 350; i++) log.record('near', { i });
		const entries = log.getEntries();
		expect(entries).toHaveLength(300);
		expect((entries[0].data as any).i).toBe(50);
		expect((entries[299].data as any).i).toBe(349);
	});

	it('exports lift windows that replay as fixtures with the same lift', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const samples = fixtureSamples(fx);

		// What the phone saw: run the detector and let the log cut windows the way the
		// service does (3 s before the onset, 1 s after).
		const log = freshLog();
		log.setPlatform('android');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const seen = [];
		for (const batch of toBatches(samples)) {
			log.addSamples(batch);
			for (const e of det.push(batch)) {
				if (e.type !== 'lift') continue;
				seen.push(e);
				log.captureAround({
					label: 'lift',
					centerT: e.onset,
					beforeMs: 3000,
					afterMs: 1000,
					onset: e.onset,
					confirmedAt: e.t,
					nearDelta: e.delta,
					far: det.getFar(),
				});
			}
		}
		log.flushPending();

		const doc = log.buildExport({ platform: 'android', capabilities: null, config: null, far: fx.far });
		expect(doc.windows).toHaveLength(seen.length);

		// Every window is a valid fixture; those whose rest before the lift was short enough
		// to include the placement replay to exactly one lift at the same onset.
		let replayed = 0;
		for (const w of doc.windows) {
			const asFixture = w as unknown as MagnetFixture;
			expect(asFixture.kind).toBe('magnet-fixture');
			expect(asFixture.labels.lifts).toHaveLength(1);

			const replay = liftsOf(runDetector(new MagnetDetector(detectorConfigFor('android'), asFixture.far), fixtureSamples(asFixture, 0)));
			if (!replay.length) continue;
			replayed++;
			expect(replay).toHaveLength(1);
			expect(Math.abs(replay[0].onset - asFixture.labels.lifts[0].onsetRef)).toBeLessThanOrEqual(10);
		}
		expect(replayed).toBeGreaterThanOrEqual(4);
	});

	it('clears entries and windows', () => {
		const log = freshLog();
		log.record('lift', { latencyMs: 60 });
		log.clear();
		expect(log.getEntries()).toHaveLength(0);
		expect(log.getWindowCount()).toBe(0);
	});
});
