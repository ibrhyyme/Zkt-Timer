import {colord} from 'colord';
import {random_element} from './helpers';
import type {ColorScheme, FaceColor} from './cube_display';

export const CubeColors = ['white', 'yellow', 'blue', 'green', 'orange', 'red'] as const;

export type CubeColorName = typeof CubeColors[number];

export function colorNameByLetter(l: string): CubeColorName | undefined {
	return CubeColors.find((color) => color[0] === l);
}

export const DefaultAllowedCrossColors: string[] = ['w'];

export function randomCrossColor(allowedCrossColors: string[]): string {
	return random_element(allowedCrossColors.length === 0 ? DefaultAllowedCrossColors : allowedCrossColors);
}

export function mutateColorScheme(baseScheme: ColorScheme): ColorScheme {
	const mutated: Partial<ColorScheme> = {};
	for (const face of Object.keys(baseScheme) as (keyof ColorScheme)[]) {
		const {value, name}: FaceColor = baseScheme[face];
		const hsv = colord(value).toHsv();
		hsv.h = (hsv.h + (Math.random() * 12 - 6) + 360) % 360;
		hsv.s = Math.min(100, Math.max(5, hsv.s + (Math.random() * 12 - 6)));
		hsv.v = Math.min(100, Math.max(15, hsv.v + (Math.random() * 12 - 6)));
		mutated[face] = {value: colord(hsv).toHex(), name};
	}
	return mutated as ColorScheme;
}
