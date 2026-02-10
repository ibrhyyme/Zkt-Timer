import { getCubeTypeInfoById, getScrambleTypeById } from '../../../util/cubes/util';
import { Scrambow } from 'scrambow';
import { ITimerContext } from '../Timer';
import { setTimerParams } from './params';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { generate222Scramble } from '../../../util/cubes/scramble_222';


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

function generateClockScramble(): string {
	const side1Pins = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
	const side2Pins = ['U', 'R', 'D', 'L', 'ALL'];
	const finalPins = ['UR', 'DR', 'DL', 'UL'];

	const moves: string[] = [];

	const getTurn = () => {
		const val = Math.floor(Math.random() * 12) - 5; // -5, ... 6 (WCA standard is usually -5 to 6)
		if (val === 0) return null;
		return val > 0 ? `${val}+` : `${Math.abs(val)}-`;
	};

	// Side 1
	side1Pins.forEach(pin => {
		const turn = getTurn();
		if (turn) moves.push(`${pin}${turn}`);
	});

	moves.push('y2');

	// Side 2
	side2Pins.forEach(pin => {
		const turn = getTurn();
		if (turn) moves.push(`${pin}${turn}`);
	});

	// Final Pin State (Randomize which pins are UP)
	finalPins.forEach(pin => {
		if (Math.random() > 0.5) {
			moves.push(pin);
		}
	});

	return moves.join(' ');
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
