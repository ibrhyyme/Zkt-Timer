/**
 * Dexie (IndexedDB) instance for PLL Recognition Trainer.
 * Referans `src/db.js` portu.
 *
 * Database: pll_trainer
 * Table: sessions (auto-id, indices: completedAt, [poolKey+sizeOption])
 */
import Dexie, {type Table} from 'dexie';

export interface RecognitionSessionRecord {
	id?: number; // auto-increment
	completedAt: Date;
	poolKey: string;
	sizeOption: number; // 0|1|2 or -1 (personalized)
	presetLabel: string;
	caseCount: number;
	totalCases: number;
	correctCount: number;
	totalTimeMs: number;
	avgTimeMs: number;
}

class RecognitionDb extends Dexie {
	sessions!: Table<RecognitionSessionRecord, number>;

	constructor() {
		super('pll_trainer');
		this.version(1).stores({
			sessions: '++id, completedAt, [poolKey+sizeOption]',
		});
	}
}

let _db: RecognitionDb | null = null;

export function getRecognitionDb(): RecognitionDb {
	if (typeof indexedDB === 'undefined') {
		throw new Error('IndexedDB unavailable (likely SSR context)');
	}
	if (!_db) _db = new RecognitionDb();
	return _db;
}

export function isRecognitionDbAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}
