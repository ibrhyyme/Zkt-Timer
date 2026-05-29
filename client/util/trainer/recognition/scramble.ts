import pllMap from '../../../../public/trainer/pll-recognition-algs.json';

const pllAlgs = pllMap as Record<string, Record<string, string>>;

export const noCubePuzzleMask: Record<string, number[]> = {
	U: [0, 1, 2, 3, 4, 5, 6, 7, 8],
	F: [0, 1, 2, 3, 4, 5, 6, 7, 8],
	B: [0, 1, 2, 3, 4, 5, 6, 7, 8],
	R: [0, 1, 2, 3, 4, 5, 6, 7, 8],
	L: [0, 1, 2, 3, 4, 5, 6, 7, 8],
	D: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function crossColorToCubeRotation(c: string): string {
	// sr-puzzlegen default orientation is yellow top blue front
	switch (c) {
		case 'y': return 'x2';
		case 'b': return "x'";
		case 'r': return 'z';
		case 'g': return 'x';
		case 'o': return "z'";
		case 'w': return '';
		default:
			console.error('crossColorToCubeRotation: invalid color', c);
			return '';
	}
}

export function inverseScramble(s: string): string {
	const arr = s.split(' ');
	return arr
		.map((it) => {
			if (it.length === 0) return '';
			if (it[it.length - 1] === '2') return it;
			if (it[it.length - 1] === "'") return it.slice(0, -1);
			return `${it}'`;
		})
		.reverse()
		.join(' ');
}

export interface PllCase {
	name: string;
	rotation: string;
	dTurn: string;
	colorShift: number;
	crossColor: string;
}

// crossColorOverride - belirtilirse pllCase.crossColor yerine kullanilir
export function scrambleForCase(pllCase: PllCase | null, crossColorOverride?: string): string {
	if (!pllCase) return '';
	const crossColor = crossColorOverride ? crossColorOverride[0].toLowerCase() : pllCase.crossColor;
	const solution = pllAlgs[pllCase.name]?.['noAuf'] || '';
	const crossColorChange = crossColorToCubeRotation(crossColor);
	const colorShift = 'y '.repeat(parseInt(String(pllCase.colorShift))).trim();
	const inversedRotation = inverseScramble(pllCase.rotation);
	return `${crossColorChange} ${colorShift} ${pllCase.dTurn} ${solution} ${inversedRotation} `
		.replace(/\s+/g, ' ')
		.trim();
}
