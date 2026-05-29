import pllMap from '../../../../public/trainer/pll-recognition-algs.json';
import {random_element} from './helpers';
import {randomCrossColor} from './colors';
import type {PllCase} from './scramble';

// key is a string: name/rotation, where name is case name (Aa, Jb etc) and rotation = ["" | "y" | "y2" | "y'"]
export function allPllKeys(): string[] {
	const plls = Object.keys(pllMap as Record<string, unknown>);
	const getRotationArray = (pllFirstLetter: string): string[] => {
		switch (pllFirstLetter) {
			case 'H':
				return ['']; // can position the cube in any way before solving
			case 'N':
			case 'E':
			case 'Z':
				return ['', 'y']; // y2 is the same as nothing; y' is the same as y
			default:
				return ['', 'y', 'y2', "y'"];
		}
	};
	const keys: string[] = [];
	for (const pll of plls) {
		const rots = getRotationArray(pll[0]);
		for (const rot of rots) {
			keys.push(`${pll}/${rot}`);
		}
	}
	return keys;
}

export function keyToCase(key: string, dTurn: string, colorShift: number, crossColor: string): PllCase {
	const [name, rot] = key.split('/');
	return {
		rotation: rot,
		name,
		dTurn,
		colorShift,
		crossColor,
	};
}

export function caseToKey(pllCase: PllCase): string {
	return `${pllCase.name}/${pllCase.rotation}`;
}

export const D_TURN_OPTIONS: string[] = ['', 'd', 'd2', "d'"];
export const COLOR_SHIFTS: number[] = [0, 1, 2, 3];

export function keysToCases(keys: string[], allowedCrossColors: string[], includeNoAuf: boolean = true): PllCase[] {
	const dTurns = includeNoAuf ? D_TURN_OPTIONS : D_TURN_OPTIONS.slice(1);
	return keys.map((k) =>
		keyToCase(k, random_element(dTurns), random_element(COLOR_SHIFTS), randomCrossColor(allowedCrossColors))
	);
}
