export interface ScrambleType {
	name: string;
	length: number;
	id: string;
	size?: number;
}

function getCubeScramble(name: string, length: number, id: string, size?: number): ScrambleType {
	const data: ScrambleType = {
		name,
		length,
		id,
	};

	if (size) {
		data.size = size;
	}

	return data;
}

export const CUBE_SCRAMBLES: Record<string, ScrambleType> = {
	// WCA kategori
	'wca': getCubeScramble('WCA', 20, 'wca'),
	// WCA
	'222': getCubeScramble('2x2', 9, '222', 2),
	'333': getCubeScramble('3x3', 20, '333', 3),
	'444': getCubeScramble('4x4', 46, '444', 4),
	'555': getCubeScramble('5x5', 60, '555', 5),
	'666': getCubeScramble('6x6', 89, '666', 6),
	'777': getCubeScramble('7x7', 100, '777', 7),
	pyram: getCubeScramble('Pyraminx', 10, 'pyram'),
	skewb: getCubeScramble('Skewb', 8, 'skewb'),
	sq1: getCubeScramble('Square-1', 9, 'sq1'),
	clock: getCubeScramble('Clock', 36, 'clock'),
	minx: getCubeScramble('Megaminx', 10, 'minx'),
	// Methods (same scramble as base)
	'333cfop': getCubeScramble('3x3 CFOP', 20, '333cfop', 3),
	'333roux': getCubeScramble('3x3 Roux', 20, '333roux', 3),
	'333mehta': getCubeScramble('3x3 Mehta', 20, '333mehta', 3),
	'333zz': getCubeScramble('3x3 ZZ', 20, '333zz', 3),
	'444yau': getCubeScramble('4x4 Yau/Hoya', 46, '444yau', 4),
	// 3x3 Subsets
	'333sub': getCubeScramble('3x3 Subsets', 20, '333sub', 3),
	none: getCubeScramble('None', 0, 'none'),
};
