/**
 * Smart Cube Simulation Test
 *
 * SmartCube.tsx'deki state machine'i pure fonksiyonlarla simule eder.
 * React/Redux yok — sadece cubejs, IncrementalCompressor, matchScrambleWithCommutative.
 *
 * Her senaryo detayli log uretir: hamle, match durumu, undo, correction, restore.
 */

import Cube from 'cubejs';
import {
	IncrementalCompressor,
	matchScrambleWithCommutative,
	invertMove,
	SmartTurn,
} from '../smart_scramble';
import { getReverseTurns } from '../solve/turns';

// ── CONSTANTS ──
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ── SIMULATOR ──

class SmartCubeSimulator {
	// Fiziksel kup (BLE'den gelen durum)
	physicalCube: Cube;
	// Sanal kup (her hamle event'inde senkron guncellenir)
	cubejs: Cube;
	// Hamle sikistirici
	compressor: IncrementalCompressor;

	// State
	scramble: string;
	originalScramble: string;
	smartTurnOffset: number;
	smartTurns: SmartTurn[];
	targetFacelets: string;
	smartUndoMoves: string[] | null;
	smartCanStart: boolean;
	timeStartedAt: Date | null;
	initialSyncDone: boolean;
	scrambleCompletedAt: Date | null;
	connected: boolean;

	// Log
	log: string[];

	constructor(scramble: string) {
		this.physicalCube = new Cube();
		this.cubejs = new Cube();
		this.compressor = new IncrementalCompressor();

		this.scramble = scramble;
		this.originalScramble = scramble;
		this.smartTurnOffset = 0;
		this.smartTurns = [];
		this.smartUndoMoves = null;
		this.smartCanStart = false;
		this.timeStartedAt = null;
		this.initialSyncDone = false;
		this.scrambleCompletedAt = null;
		this.connected = false;
		this.log = [];

		// Hedef durumu hesapla (orijinal scramble sonucu)
		const targetCube = new Cube();
		scramble.split(' ').filter(m => m.trim()).forEach(m => targetCube.move(m));
		this.targetFacelets = targetCube.asString();

		this.emit('INIT', `scramble: ${scramble} | target: ${this.targetFacelets.slice(0, 20)}...`);
	}

	private emit(tag: string, msg: string) {
		const line = `[${tag.padEnd(8)}] ${msg}`;
		this.log.push(line);
		// eslint-disable-next-line no-console
		console.log(line);
	}

	// ── BLE Baglanti ──

	connect(physicalState?: string) {
		this.connected = true;

		if (physicalState) {
			this.physicalCube = Cube.fromString(physicalState);
		}
		// else: physicalCube olduğu gibi kalır (default: solved)

		const facelets = this.physicalCube.asString();
		this.emit('CONNECT', `facelets: ${facelets.slice(0, 20)}... | solved: ${facelets === SOLVED}`);

		this.initialSync();
	}

	disconnect() {
		this.connected = false;
		this.initialSyncDone = false;
		this.emit('DISCONN', 'BLE baglanti kesildi | initialSyncDone reset');
	}

	// ── Initial Sync (SmartCube.tsx:476-570) ──

	private initialSync() {
		const facelets = this.physicalCube.asString();

		// Guard: zaten yapildi
		if (this.initialSyncDone) {
			this.emit('SYNC', 'SKIP — initialSyncDone=true');
			return;
		}

		// Guard: correction mode'dayken reconnect (SmartCube.tsx:481-482)
		if (this.originalScramble && this.scramble !== this.originalScramble) {
			this.emit('SYNC', 'SKIP — correction mode guard (scramble !== originalScramble)');
			return;
		}

		this.initialSyncDone = true;

		// Kup cozukse sync gerekmez
		if (facelets === SOLVED) {
			this.emit('SYNC', 'Kup COZULMUS — sync gerekmez');
			return;
		}

		this.emit('SYNC', `Kup KARISIK — correction hesaplaniyor...`);

		// Fiziksel durumu coz (current → solved)
		const currentCube = Cube.fromString(facelets);
		const solveStr = currentCube.solve();
		const toCurrentMoves: string[] = solveStr
			? getReverseTurns(solveStr) as string[]
			: [];

		this.emit('SYNC', `toCurrentMoves: [${toCurrentMoves.join(' ')}]`);

		// cubejs'i fiziksel duruma sync et
		this.cubejs = Cube.fromString(facelets);

		// Kup zaten hedef durumda mi?
		if (facelets === this.targetFacelets) {
			this.emit('SYNC', 'Kup zaten hedef durumda — scramble tamamlandi');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		// Correction path hesapla (sync — Worker yok)
		// diffCube = S^-1 x U
		const cachedInverse = getReverseTurns(this.scramble);
		const diffCube = new Cube();
		for (const m of cachedInverse) diffCube.move(m);
		for (const m of toCurrentMoves) diffCube.move(m);

		if (diffCube.asString() === SOLVED) {
			this.emit('SYNC', 'diffCube SOLVED — correction gerekmez');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		const solution = diffCube.solve();
		const correctionMoves = solution
			? solution.trim().split(' ').filter(m => m.trim())
			: [];

		if (correctionMoves.length === 0) {
			this.emit('SYNC', 'Correction bos — kup hedefte');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		// Yeni scramble = correction path
		const newScramble = correctionMoves.join(' ');
		this.originalScramble = this.scramble;
		this.scramble = newScramble;
		this.smartTurnOffset = 0;
		this.compressor.reset();

		this.emit('SYNC', `correction path: ${newScramble}`);
		this.emit('SYNC', `originalScramble: ${this.originalScramble} | scramble: ${this.scramble}`);
	}

	// ── Hamle ──

	move(turn: string) {
		if (!this.connected) {
			this.emit('ERROR', `Kup bagli degil — hamle reddedildi: ${turn}`);
			return;
		}

		// Fiziksel kup + sanal kup guncelle
		this.physicalCube.move(turn);
		this.cubejs.move(turn);

		// SmartTurn kaydet
		this.smartTurns.push({ turn, time: Date.now() });

		const facelets = this.physicalCube.asString();
		const cubejsState = this.cubejs.asString();

		// Timer calisiyorsa → solve kontrolu
		if (this.timeStartedAt) {
			this.emit('MOVE', `${turn} | cubejs: ${cubejsState.slice(0, 15)}... | solving`);
			this.checkSolved();
			return;
		}

		// Scramble tamamlanmis, ilk hamle → timer baslat
		if (this.scrambleCompletedAt) {
			this.emit('MOVE', `${turn} | TIMER START (scramble onceden tamamlandi)`);
			this.timeStartedAt = new Date();
			this.smartCanStart = false;
			this.scrambleCompletedAt = null;
			return;
		}

		// Scramble fazinda — match kontrolu
		this.emit('MOVE', `${turn} | facelets: ${facelets.slice(0, 15)}...`);

		// FACELETS restore kontrolu (SmartCube.tsx:395-406)
		this.checkFaceletsRestore();

		// FACELETS scramble safety net
		if (facelets === this.targetFacelets) {
			this.emit('FACELETS', 'Fiziksel kup HEDEFTE — scramble tamamlandi');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			this.smartUndoMoves = null;
			return;
		}

		// Move matcher
		this.checkForStart();
	}

	// ── Move Matcher (SmartCube.tsx:651-772) ──

	private checkForStart() {
		if (!this.scramble) return;

		const offset = this.smartTurnOffset || 0;
		const relevantTurns = offset > 0 ? this.smartTurns.slice(offset) : this.smartTurns;

		const userMoves = this.compressor.processNew(relevantTurns);
		const expectedMoves = this.scramble.split(' ').filter(m => m.trim());
		const { matched, matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

		this.emit('MATCH', `user: [${userMoves.join(' ')}] | expected: [${expectedMoves.join(' ')}]`);
		this.emit('MATCH', `matched: ${matched} | status: [${matchStatus.join(', ')}]`);

		if (matched) {
			// cubejs dogrulama
			const cubejsState = this.cubejs.asString();
			if (cubejsState !== this.targetFacelets) {
				this.emit('MATCH', `MATCHED ama cubejs UYUSMUYOR — FACELETS bekle`);
				return;
			}

			this.emit('MATCH', 'SCRAMBLE TAMAMLANDI');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			this.smartUndoMoves = null;
			return;
		}

		if (matchStatus.includes('wrong')) {
			const firstWrongIdx = matchStatus.indexOf('wrong');
			const wrongUserMoves = userMoves.slice(firstWrongIdx);

			if (wrongUserMoves.length > 7) {
				this.emit('WRONG', `${wrongUserMoves.length} yanlis hamle — TOO_MANY`);
				this.smartUndoMoves = ['TOO_MANY'];
			} else {
				const undoSequence = wrongUserMoves.slice().reverse().map(invertMove);
				this.emit('WRONG', `undo: [${undoSequence.join(' ')}] | wrong_count: ${wrongUserMoves.length}`);
				this.smartUndoMoves = undoSequence;
			}
		} else if (matchStatus.includes('half')) {
			this.emit('HALF', 'Yarim esleme — undo temizlendi');
			this.smartUndoMoves = null;
		} else {
			// Hepsi perfect veya pending
			this.smartUndoMoves = null;
		}
	}

	// ── FACELETS Restore (SmartCube.tsx:395-406) ──

	private checkFaceletsRestore() {
		const facelets = this.physicalCube.asString();

		if (
			facelets === SOLVED &&
			this.originalScramble &&
			this.scramble !== this.originalScramble
		) {
			this.emit('RESTORE', `Kup correction sirasinda cozuldu — orijinal scramble restore`);
			this.emit('RESTORE', `${this.scramble} → ${this.originalScramble}`);

			this.scramble = this.originalScramble;
			this.smartTurnOffset = this.smartTurns.length;
			this.smartUndoMoves = null;
			this.compressor.reset();
		}
	}

	// ── Solve Detection ──

	private checkSolved() {
		const cubejsState = this.cubejs.asString();
		const facelets = this.physicalCube.asString();

		if (cubejsState === SOLVED || facelets === SOLVED) {
			const elapsed = this.timeStartedAt
				? (Date.now() - this.timeStartedAt.getTime()) / 1000
				: 0;
			this.emit('SOLVED', `cubejs=${cubejsState === SOLVED} facelets=${facelets === SOLVED} | ${elapsed.toFixed(2)}s`);
			this.timeStartedAt = null;
			this.smartCanStart = false;
		}
	}

	// ── Timer ──

	startTimer() {
		if (!this.scrambleCompletedAt && !this.smartCanStart) {
			this.emit('ERROR', 'Timer baslatilamaz — scramble tamamlanmadi');
			return;
		}
		this.timeStartedAt = new Date();
		this.smartCanStart = false;
		this.scrambleCompletedAt = null;
		this.emit('TIMER', 'Timer baslatildi');
	}

	// ── Toplu Hamle (kolaylik) ──

	moves(turns: string) {
		turns.split(' ').filter(m => m.trim()).forEach(m => this.move(m));
	}

	// ── Kupu tamamen coz (fiziksel + sanal) ──

	solveCube() {
		const solution = this.physicalCube.solve();
		if (solution && solution.trim()) {
			this.emit('ACTION', `Kup cozuluyor: ${solution}`);
			solution.trim().split(' ').filter(m => m.trim()).forEach(m => this.move(m));
		} else {
			this.emit('ACTION', 'Kup zaten cozulmus');
		}
	}

	// ── State ozeti ──

	status(): string {
		return [
			`scramble: "${this.scramble}"`,
			`originalScramble: "${this.originalScramble}"`,
			`offset: ${this.smartTurnOffset}`,
			`turns: ${this.smartTurns.length}`,
			`undo: ${this.smartUndoMoves ? `[${this.smartUndoMoves.join(' ')}]` : 'null'}`,
			`canStart: ${this.smartCanStart}`,
			`timer: ${this.timeStartedAt ? 'running' : 'stopped'}`,
			`connected: ${this.connected}`,
			`syncDone: ${this.initialSyncDone}`,
			`physical: ${this.physicalCube.asString() === SOLVED ? 'SOLVED' : this.physicalCube.asString().slice(0, 15) + '...'}`,
			`cubejs: ${this.cubejs.asString() === SOLVED ? 'SOLVED' : this.cubejs.asString().slice(0, 15) + '...'}`,
		].join(' | ');
	}
}

// ── TESTS ──

beforeAll(() => {
	Cube.initSolver();
}, 30000); // Solver init 2-5 saniye surebilir

describe('Smart Cube Simulation', () => {

	// ── Senaryo 1: Normal Akis ──
	test('Cozuk kup + dogru scramble takibi', () => {
		console.log('\n=== SENARYO 1: Normal Akis ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect(); // SOLVED kup

		// Dogru hamleler
		sim.move('R');
		sim.move('U');
		sim.move('F2');

		expect(sim.smartCanStart).toBe(true);
		expect(sim.scrambleCompletedAt).not.toBeNull();
		expect(sim.smartUndoMoves).toBeNull();

		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 2: Yanlis Hamle + Undo ──
	test('Yanlis hamle → undo → devam', () => {
		console.log('\n=== SENARYO 2: Yanlis Hamle + Undo ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect();

		sim.move('R');  // Dogru
		sim.move('L');  // YANLIS (beklenen: U)

		expect(sim.smartUndoMoves).toEqual(["L'"]);

		// Geri al
		sim.move("L'");

		// Devam
		sim.move('U');
		sim.move('F2');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 3: TOO_MANY (8+) ──
	test('8+ yanlis hamle → TOO_MANY', () => {
		console.log('\n=== SENARYO 3: TOO_MANY ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect();
		sim.move('R');  // Dogru

		// 8+ yanlis hamle
		const wrongMoves = ['L', 'D', 'B', 'L', 'D', 'B', 'L', 'D'];
		wrongMoves.forEach(m => sim.move(m));

		expect(sim.smartUndoMoves).toEqual(['TOO_MANY']);
		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 4: Karisik Kup + Correction ──
	test('Karisik kup baglama → correction path → tamamlama', () => {
		console.log('\n=== SENARYO 4: Karisik Kup + Correction ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Fiziksel kupu karistir
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		// Correction path hesaplandi — orijinal scramble korundu
		expect(sim.originalScramble).toBe('R U');
		expect(sim.scramble).not.toBe('R U'); // Correction path farkli olmali

		console.log('Correction path:', sim.scramble);

		// Correction'i takip et
		const correctionMoves = sim.scramble.split(' ').filter(m => m.trim());
		correctionMoves.forEach(m => sim.move(m));

		// Kup hedef duruma ulasti mi?
		const targetCube = new Cube();
		'R U'.split(' ').forEach(m => targetCube.move(m));

		expect(sim.physicalCube.asString()).toBe(targetCube.asString());
		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 5: Correction + Kupu Coz → Restore ──
	test('Correction → TOO_MANY → kupu coz → orijinal restore', () => {
		console.log('\n=== SENARYO 5: Correction + Restore ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Karisik kup bagla
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		const correctionPath = sim.scramble;
		console.log('Correction path:', correctionPath);

		// Yanlis hamleler yap (8+ → TOO_MANY)
		const wrongMoves = ['L', 'D', 'B', 'L', 'D', 'B', 'L', 'D', 'B'];
		wrongMoves.forEach(m => sim.move(m));
		expect(sim.smartUndoMoves).toEqual(['TOO_MANY']);

		// Kupu tamamen coz
		sim.solveCube();

		// Orijinal scramble restore edildi mi?
		expect(sim.scramble).toBe('R U');
		expect(sim.originalScramble).toBe('R U');
		expect(sim.smartUndoMoves).toBeNull();
		expect(sim.physicalCube.asString()).toBe(SOLVED);

		console.log('STATUS after restore:', sim.status());

		// Simdi orijinal scramble'i takip et
		sim.move('R');
		sim.move('U');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS after scramble:', sim.status());
	});

	// ── Senaryo 6: BLE Reconnect During Correction ──
	test('Correction mode → disconnect → reconnect → yeni sync yok', () => {
		console.log('\n=== SENARYO 6: BLE Reconnect ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Karisik kup bagla
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		const correctionPathBefore = sim.scramble;
		console.log('Correction path (1st connect):', correctionPathBefore);

		// BLE kopma + tekrar baglama
		sim.disconnect();
		expect(sim.initialSyncDone).toBe(false); // Disconnect resetler

		// Ayni fiziksel durumla tekrar baglan
		sim.connect(sim.physicalCube.asString());

		// Correction mode guard — yeni sync CALISMADI
		expect(sim.scramble).toBe(correctionPathBefore); // Ayni correction path
		console.log('Correction path (2nd connect):', sim.scramble);
		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 7: Komutatif Esleme ──
	test('Komutatif ciftler: U D → D U', () => {
		console.log('\n=== SENARYO 7: Komutatif Esleme ===\n');
		const sim = new SmartCubeSimulator('U D R');

		sim.connect();

		// Ters sira: D once, U sonra (komutatif)
		sim.move('D');
		sim.move('U');
		sim.move('R');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 8: Half Match ──
	test('Half match: R yerine R2', () => {
		console.log('\n=== SENARYO 8: Half Match ===\n');
		const sim = new SmartCubeSimulator('R U');

		sim.connect();

		sim.move('R2'); // Half — beklenen R ama R2 yapildi

		// Half match → undo yok, ama tamamlanmamis
		expect(sim.smartCanStart).toBe(false);
		expect(sim.smartUndoMoves).toBeNull(); // Half → undo gosterilmez

		console.log('STATUS:', sim.status());
	});

	// ── Senaryo 9: Tam Akis (scramble → solve → bitis) ──
	test('Tam akis: scramble → timer → solve', () => {
		console.log('\n=== SENARYO 9: Tam Akis ===\n');
		const sim = new SmartCubeSimulator('R U');

		sim.connect();

		// Scramble takip et
		sim.move('R');
		sim.move('U');
		expect(sim.smartCanStart).toBe(true);

		// Ilk hamle timer baslatir
		sim.move("U'"); // Solve baslangiçi
		expect(sim.timeStartedAt).not.toBeNull();

		// Solve devam
		sim.move("R'");

		// cubejs ve fiziksel kup SOLVED olmali
		expect(sim.physicalCube.asString()).toBe(SOLVED);
		expect(sim.cubejs.asString()).toBe(SOLVED);
		expect(sim.timeStartedAt).toBeNull(); // Timer durdu

		console.log('STATUS:', sim.status());
	});
});
