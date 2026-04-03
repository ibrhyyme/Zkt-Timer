import { getCubeTypeInfoById, getScrambleTypeById } from '../../../util/cubes/util';
import { Scrambow } from 'scrambow';
import { ITimerContext } from '../Timer';
import { setTimerParams } from './params';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { generate222Scramble } from '../../../util/cubes/scramble_222';
import { generateCornersScramble } from '../../../util/cubes/scramble_333_corners';
import { generateClockScramble } from '../../../util/cubes/scramble_clock';


export function getNewScramble(scrambleTypeId: string, seed?: number, subset?: string) {
	const scrambleType = getScrambleTypeById(scrambleTypeId);

	if (!scrambleType || scrambleType.id === 'none') {
		return '';
	}

	const scrambleLength = scrambleType.length;

	let scrambowType = scrambleType.id;
	let blindThree = false;
	if (scrambowType === '333bl') {
		scrambowType = '333';
		blindThree = true;
	}



	// Use subset if provided, otherwise default to mapped type
	// Security check: If subset is provided, ensure it matches the base type
	let typeToUse = scrambowType;
	if (subset && !subset.startsWith('h_')) {
		// Validation: Verify this subset actually belongs to the current cube type
		const allowedSubsets = getSubsetsForCube(scrambowType);
		const isValid = allowedSubsets.some(s => s.id === subset);

		if (isValid) {
			typeToUse = subset;
		} else {
			console.warn(`Invalid subset '${subset}' for cube type '${scrambowType}', falling back to default.`);
		}
	}

	// Custom 2x2 subset scrambler (ported from cstimer)
	if (scrambowType === '222' && subset) {
		return generate222Scramble(subset);
	}

	// Custom corners-only scrambler (cubejs Kociemba solver)
	if (scrambowType === '333' && subset === 'corners') {
		return generateCornersScramble();
	}

	// Custom WCA Clock Scrambler
	if (scrambowType === 'clock' && !subset) {
		return generateClockScramble();
	}

	let scrambo = new Scrambow(typeToUse);

	if (!['pyram', 'clock', 'skewb'].includes(scrambowType) && !subset) {
		scrambo = scrambo.setLength(scrambleLength);
	}

	if (seed) {
		scrambo = scrambo.setSeed(seed);
	}

	const scrambleOb = scrambo.get();

	let scramble = scrambleOb[0].scramble_string;
	scramble = scramble.replace(/\s+/g, ' ').trim();
	if (scrambowType === '222' && scramble.split(' ').length <= 5 && !subset) {
		return getNewScramble(scrambowType, seed, subset);
	}

	if (blindThree) {
		scramble += ' ' + getBlindWideMove();
	}

	return scramble;
}

function getBlindWideMove() {
	const moves = ['Uw', 'Lw', 'Rw', 'Fw'];
	const move = moves[Math.floor(Math.random() * moves.length)];
	const randState = Math.random();

	if (randState < 0.33) {
		return `${move}'`;
	} else if (randState < 0.66) {
		return `${move}2`;
	}

	return move;
}

// Pre-generate: solve sirasinda yeni karistirmayi arka planda hazirla
let _preGeneratedScramble: string | null = null;
let _preGeneratedForType: string | null = null;

export function preGenerateScramble(cubeType: string, subset?: string) {
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return;

	_preGeneratedScramble = null;
	_preGeneratedForType = cubeType;

	setTimeout(() => {
		// Kup tipi solve sirasinda degismis olabilir — kontrol et
		if (_preGeneratedForType !== cubeType) return;
		_preGeneratedScramble = getNewScramble(ct.scramble, undefined, subset);
	}, 100);
}

export function consumePreGeneratedScramble(cubeType: string): string | null {
	if (_preGeneratedScramble && _preGeneratedForType === cubeType) {
		const scramble = _preGeneratedScramble;
		_preGeneratedScramble = null;
		_preGeneratedForType = null;
		return scramble;
	}
	return null;
}

export function resetScramble(context: ITimerContext) {
	const { cubeType, scrambleLocked, customScrambleFunc, scrambleSubset } = context;
	const ct = getCubeTypeInfoById(cubeType);

	let newScramble;
	if (customScrambleFunc) {
		newScramble = customScrambleFunc(context);
	} else if (scrambleLocked) {
		return;
	} else {
		newScramble = getNewScramble(ct.scramble, undefined, scrambleSubset);
	}

	setTimerParams({
		scramble: newScramble,
		originalScramble: newScramble,
		smartTurnOffset: 0,
	});
}
