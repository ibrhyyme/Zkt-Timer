export interface CubeType {
	id: string;
	name: string;
	scramble: string;
	hidden?: boolean;
	size?: number;
	default?: boolean;
}

function getCubeType(id: string, name: string, scramble: string, size?: number): CubeType {
	const data: CubeType = {
		id,
		name,
		scramble,
		default: true,
	};

	if (size) {
		data.size = size;
	}

	return data;
}

export const CUBE_TYPES: Record<string, CubeType> = {
	// WCA kategorisi — tiklanabilir, icinde tum WCA etkinlikleri
	'wca': getCubeType('wca', 'WCA', 'wca'),

	// === WCA Events ===
	'333': getCubeType('333', '3x3', '333', 3),
	'222': getCubeType('222', '2x2', '222', 2),
	'444': getCubeType('444', '4x4', '444', 4),
	'555': getCubeType('555', '5x5', '555', 5),
	'666': getCubeType('666', '6x6', '666', 6),
	'777': getCubeType('777', '7x7', '777', 7),
	clock: getCubeType('clock', 'Clock', 'clock'),
	minx: getCubeType('minx', 'Megaminx', 'minx'),
	pyram: getCubeType('pyram', 'Pyraminx', 'pyram'),
	skewb: getCubeType('skewb', 'Skewb', 'skewb'),
	sq1: getCubeType('sq1', 'Square-1', 'sq1'),

	// === 3x3 Methods ===
	'333cfop': getCubeType('333cfop', '3x3 CFOP', '333cfop', 3),
	'333roux': getCubeType('333roux', '3x3 Roux', '333roux', 3),
	'333mehta': getCubeType('333mehta', '3x3 Mehta', '333mehta', 3),
	'333zz': getCubeType('333zz', '3x3 ZZ', '333zz', 3),

	// === 4x4 Methods ===
	'444yau': getCubeType('444yau', '4x4 Yau/Hoya', '444yau', 4),

	// === 3x3 Subsets ===
	'333sub': getCubeType('333sub', '3x3 Subsets', '333sub', 3),

	// === Other ===
	other: getCubeType('other', 'Other', 'none'),
};
