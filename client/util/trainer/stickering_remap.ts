/**
 * Stickering Mask Remapper
 *
 * cubing.js experimentalStickering parca-bazli (piece-based) calisiyor.
 * x/z rotasyonlarinda parcalar katman degistirdigi icin stickering yanlis oluyor.
 *
 * Bu modul: standart maskeyi alip, rotasyon permutasyonu uzerinden
 * pozisyon-bazli olacak sekilde remap eder.
 */

// cubing.js StickeringMask tipleri
type FaceletMeshMask = 'regular' | 'dim' | 'oriented' | 'experimentalOriented2' | 'ignored' | 'invisible' | 'mystery';
type FaceletMask = FaceletMeshMask | { mask: FaceletMeshMask; hintMask?: FaceletMeshMask } | null;
interface PieceMask { facelets: FaceletMask[] }
interface OrbitMask { pieces: (PieceMask | null)[] }
interface StickeringMask { orbits: Record<string, OrbitMask> }

const cache = new Map<string, StickeringMask>();

let kpuzzlePromise: Promise<any> | null = null;
let puzzlesModulePromise: Promise<any> | null = null;

function loadPuzzlesModule() {
	if (!puzzlesModulePromise) {
		puzzlesModulePromise = import('cubing/puzzles');
	}
	return puzzlesModulePromise;
}

function loadKPuzzle() {
	if (!kpuzzlePromise) {
		kpuzzlePromise = loadPuzzlesModule().then((m) => m.cube3x3x3.kpuzzle());
	}
	return kpuzzlePromise;
}

async function getStandardMask(name: string): Promise<StickeringMask> {
	const { cube3x3x3 } = await loadPuzzlesModule();
	return cube3x3x3.stickeringMask(name);
}

function remapMask(
	mask: StickeringMask,
	transformData: Record<string, { permutation: number[]; orientationDelta: number[] }>
): StickeringMask {
	const result: StickeringMask = { orbits: {} };

	for (const [orbitName, orbitMask] of Object.entries(mask.orbits)) {
		const orbitTransform = transformData[orbitName];
		if (!orbitTransform) {
			result.orbits[orbitName] = orbitMask;
			continue;
		}

		const { permutation } = orbitTransform;
		const newPieces = new Array(orbitMask.pieces.length).fill(null);

		for (let i = 0; i < permutation.length; i++) {
			// permutation[i] = j → pozisyon i, parca j'den geliyor
			// Pozisyon-bazli istiyoruz: pozisyon i icin mask[i] uygulanmali
			// Pozisyon i'deki parca = permutation[i] → o parcaya mask[i] atanir
			newPieces[permutation[i]] = orbitMask.pieces[i];
		}

		result.orbits[orbitName] = { pieces: newPieces };
	}

	return result;
}

/**
 * Verilen stickering ismi ve rotasyon icin remap edilmis maske dondurur.
 * Sonuclar cache'lenir. Hata durumunda null doner (fallback: maskelemesiz).
 */
export async function getRemappedMask(
	stickeringName: string,
	rotation: string
): Promise<StickeringMask | null> {
	if (!rotation || !stickeringName || stickeringName === 'full') return null;

	const key = `${stickeringName}|${rotation}`;
	const cached = cache.get(key);
	if (cached) return cached;

	try {
		const [kpuzzle, standardMask] = await Promise.all([
			loadKPuzzle(),
			getStandardMask(stickeringName),
		]);

		const transform = kpuzzle.algToTransformation(rotation);
		const remapped = remapMask(standardMask, transform.transformationData);
		cache.set(key, remapped);
		return remapped;
	} catch {
		return null;
	}
}
