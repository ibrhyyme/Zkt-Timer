import * as fs from 'fs';
import * as path from 'path';
import {SolverResult} from '../../../util/cross-solver/types';
import {solveCross, solveXCross} from '../../../util/cross-solver/cross-solver';
import {
	colorNeutralMode,
	isShortcutBucket,
	allPunchIds,
	pickPunch,
	pickShortcut,
	pickTone,
	punchAudioPath,
	punchIosFileName,
	VOICE_LANGS,
	voiceLang,
} from '../pick';

function r(face: string, moveCount: number, rotation = 'z2'): SolverResult {
	return {face, rotation, solution: Array.from({length: moveCount}, () => 'R '), moveCount};
}

const FACES = ['D', 'U', 'L', 'R', 'F', 'B'];
const all = (counts: Record<string, number>): SolverResult[] => FACES.map((f) => r(f, counts[f] ?? 7));

describe('isShortcutBucket', () => {
	it('takes full random-state 3x3 buckets only', () => {
		expect(isShortcutBucket('wca', '333')).toBe(true);
		expect(isShortcutBucket('333', null)).toBe(true);
		expect(isShortcutBucket('333', '333o')).toBe(true);
		expect(isShortcutBucket('333', '333oh')).toBe(true);

		expect(isShortcutBucket('wca', '222')).toBe(false);
		expect(isShortcutBucket('333', '333ni')).toBe(false);
		expect(isShortcutBucket('333', '333fm')).toBe(false);
		expect(isShortcutBucket('333', '2gen')).toBe(false);
		expect(isShortcutBucket('333cfop', 'pll')).toBe(false);
		expect(isShortcutBucket('333cfop', null)).toBe(false);
		expect(isShortcutBucket(null, null)).toBe(false);
	});
});

describe('colorNeutralMode', () => {
	it('falls back to none for anything unknown', () => {
		expect(colorNeutralMode('dual')).toBe('dual');
		expect(colorNeutralMode('six')).toBe('six');
		expect(colorNeutralMode('none')).toBe('none');
		expect(colorNeutralMode(undefined)).toBe('none');
		expect(colorNeutralMode('rainbow')).toBe('none');
	});
});

describe('pickShortcut', () => {
	it('reports nothing on an ordinary scramble', () => {
		expect(pickShortcut(all({U: 6}), all({U: 7}), 'none')).toBeNull();
	});

	it('finds a 4-move white cross without colour neutral', () => {
		const f = pickShortcut(all({U: 4}), all({U: 7}), 'none');
		expect(f).toMatchObject({step: 'cross', face: 'U', moveCount: 4});
		expect(f.moves).toBe('z2 R R R R');
	});

	it('ignores a short cross on a face the user does not start from', () => {
		expect(pickShortcut(all({U: 6, F: 3}), all({U: 7, F: 5}), 'none')).toBeNull();
	});

	it('prefers the XCross over the cross', () => {
		const f = pickShortcut(all({U: 3}), all({U: 5}), 'none');
		expect(f).toMatchObject({step: 'xcross', moveCount: 5});
	});

	it('tightens the cross limit as the face pool grows', () => {
		// 4 moves is rare on one face (5%), common on six (29%).
		expect(pickShortcut(all({U: 4}), all({}), 'none')).not.toBeNull();
		expect(pickShortcut(all({U: 4}), all({}), 'dual')).toBeNull();
		expect(pickShortcut(all({U: 4}), all({}), 'six')).toBeNull();
		expect(pickShortcut(all({U: 3}), all({}), 'six')).not.toBeNull();
	});

	it('tightens the XCross limit on six faces', () => {
		expect(pickShortcut(all({}), all({R: 5}), 'six')).toBeNull();
		expect(pickShortcut(all({}), all({R: 4}), 'six')).toMatchObject({step: 'xcross', face: 'R'});
	});

	it('takes the shorter face and, on a tie, the white one', () => {
		expect(pickShortcut(all({U: 3, D: 2}), all({}), 'dual')).toMatchObject({face: 'D', moveCount: 2});
		expect(pickShortcut(all({U: 3, D: 3}), all({}), 'dual')).toMatchObject({face: 'U'});
	});

	it('never calls a solved cross (0 moves) a shortcut', () => {
		expect(pickShortcut(all({U: 0}), all({U: 0}), 'none')).toBeNull();
	});

	it('works on the real solver output', () => {
		// Only R and F touch the white (U) cross here, so undoing them is a two-move cross.
		const scramble = 'D R F';
		const f = pickShortcut(solveCross(scramble), Array.from({length: 6}, (_, i) => solveXCross(scramble, i)), 'none');
		expect(f).not.toBeNull();
		expect(f.face).toBe('U');
		expect(f.moveCount).toBeLessThanOrEqual(5);
		expect(f.moves.startsWith('z2 ')).toBe(true);
	});
});

describe('pickTone', () => {
	const history = [12, 13, 14, 12, 13];

	it('says DNF on a DNF', () => {
		expect(pickTone({time: -1, dnf: true}, history)).toBe('dnf');
	});

	it('stays plain without enough history', () => {
		expect(pickTone({time: 10}, [12, 13])).toBe('plain');
	});

	it('assumes it was seen when faster than the recent mean', () => {
		expect(pickTone({time: 10}, history)).toBe('spotted');
	});

	it('assumes it was missed when not faster', () => {
		expect(pickTone({time: 15}, history)).toBe('missed');
	});
});

describe('pickPunch', () => {
	it('stays within the variants of the tone', () => {
		expect(pickPunch('missed', () => 0)).toBe('missed_1');
		expect(pickPunch('missed', () => 0.9999)).toBe('missed_3');
		expect(pickPunch('dnf', () => 0.5)).toBe('dnf_2');
	});

	it('has no punch (and no voice) without history', () => {
		expect(pickPunch('plain')).toBeNull();
	});
});

describe('voiceLang', () => {
	it('maps i18n languages onto the recorded ones', () => {
		expect(voiceLang('tr')).toBe('tr');
		expect(voiceLang('en-US')).toBe('en');
		expect(voiceLang('zh_CN')).toBe('zh');
		expect(voiceLang('de')).toBeNull();
		expect(voiceLang(undefined)).toBeNull();
	});
});

const ROOT = path.join(__dirname, '..', '..', '..', '..');

describe('shortcut_hint translations', () => {
	for (const lang of VOICE_LANGS) {
		it(`${lang}: has the fact, every punch, both steps and the settings`, () => {
			const file = path.join(ROOT, 'client', 'i18n', 'locales', lang, 'translation.json');
			const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
			const block = locale.shortcut_hint;

			expect(block.fact).toContain('{{n}}');
			expect(block.fact).toContain('{{step}}');
			expect(block.fact_short).toContain('{{n}}');
			expect(block.fact_short).toContain('{{step}}');
			expect(Object.keys(block.punch).sort()).toEqual(allPunchIds().sort());
			for (const id of allPunchIds()) {
				expect(block.punch[id].trim().length).toBeGreaterThan(0);
			}
			expect(block.step.cross.trim().length).toBeGreaterThan(0);
			expect(block.step.xcross.trim().length).toBeGreaterThan(0);
			expect(block.pro_shows_moves.trim().length).toBeGreaterThan(0);
			for (const key of ['shortcut_hint', 'shortcut_hint_desc', 'shortcut_hint_voice', 'shortcut_hint_voice_desc']) {
				expect(locale.timer_settings[key].trim().length).toBeGreaterThan(0);
			}
		});
	}
});

// Every punch the card can show must have its recording, or the voice goes silent for it.
describe('shortcut_hint recordings', () => {
	for (const lang of VOICE_LANGS) {
		it(`${lang}: has a clip for every punch`, () => {
			for (const id of allPunchIds()) {
				const file = path.join(ROOT, 'public', punchAudioPath(lang, id));
				expect(fs.existsSync(file)).toBe(true);
				expect(fs.statSync(file).size).toBeGreaterThan(1000);
				// The iOS bundle copy (the native player reads only from the app bundle) must
				// be the same recording, or iPhone users hear an older take.
				const ios = path.join(ROOT, 'ios', 'App', 'App', 'audio', `${punchIosFileName(lang, id)}.mp3`);
				expect(fs.existsSync(ios)).toBe(true);
				expect(fs.readFileSync(ios).equals(fs.readFileSync(file))).toBe(true);
			}
		});
	}
});
