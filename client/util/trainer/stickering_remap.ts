/**
 * Stickering Mask Remapper
 *
 * cubing.js experimentalStickering parca-bazli (piece-based) calisiyor.
 * x/z rotasyonlarinda parcalar katman degistirdigi icin stickering yanlis oluyor.
 *
 * Bu modul: standart maskeyi alip, rotasyon permutasyonu uzerinden
 * pozisyon-bazli olacak sekilde remap eder.
 *
 * Ayrica cubing.js'in bazi stickering mask hatalarini duzeltir:
 * - F2L: Center'lari dim yerine regular yapar (recognition icin renkli gerekli)
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

/**
 * cubing.js mask'indeki 'oriented'/'experimentalOriented2' gibi
 * ozel facelet tiplerini 'regular' ile degistirir.
 * cubingapp referansinda sadece 'regular' (renkli) ve 'dim' (soluk) var.
 */
function normalizeMask(mask: StickeringMask): StickeringMask {
	const result: StickeringMask = { orbits: {} };
	for (const [name, orbit] of Object.entries(mask.orbits)) {
		result.orbits[name] = {
			pieces: orbit.pieces.map((piece) => {
				if (!piece) return null;
				return {
					facelets: piece.facelets.map((facelet): FaceletMask => {
						if (facelet === null) return null;
						const value = typeof facelet === 'object' ? facelet.mask : facelet;
						if (value === 'dim' || value === 'invisible' || value === 'ignored') return facelet;
						return 'regular';
					}),
				};
			}),
		};
	}
	return result;
}

/**
 * Bir piece'in TUM facelet'lerini verilen degerle degistirir.
 * normalizeMask sonrasi cagrilir (zaten yeni obje olusturulmus).
 */
function overridePieceFacelets(piece: PieceMask | null, value: FaceletMeshMask): PieceMask | null {
	if (!piece) return null;
	return { facelets: piece.facelets.map(() => value as FaceletMask) };
}

/**
 * F2L fixup: Tum 6 center'i 'regular' yapar.
 * cubing.js F2L stickering center'lari dim yapiyor,
 * ama kullanicinin ust katman rengini gorebilmesi icin
 * center'lar renkli olmali.
 */
function fixF2LCenters(mask: StickeringMask): StickeringMask {
	const result: StickeringMask = { orbits: {} };
	for (const [orbitName, orbit] of Object.entries(mask.orbits)) {
		if (orbitName === 'CENTERS') {
			result.orbits[orbitName] = {
				pieces: orbit.pieces.map((p) => overridePieceFacelets(p, 'regular'))
			};
		} else {
			result.orbits[orbitName] = orbit;
		}
	}
	return result;
}

/**
 * Stickering-specific fixup fonksiyonlari.
 * normalizeMask sonrasi, remapMask oncesi uygulanir.
 */
const STICKERING_FIXUPS: Record<string, (mask: StickeringMask) => StickeringMask> = {
	F2L: fixF2LCenters,
};

const FACELET_COUNT: Record<string, number> = { EDGES: 2, CORNERS: 3, CENTERS: 1 };

/**
 * Belirtilen orbit'lerdeki piece index'lerini 'regular' (renkli) yapar.
 * Efficiency XCross icin: Cross mask + secili slot edge/corner'i renkli.
 * normalize/fixup sonrasi, remap ONCESI cagrilir (index'ler mutlak/rotation-oncesi).
 */
function applyExtraRegular(mask: StickeringMask, extra: Record<string, number[]>): StickeringMask {
	const result: StickeringMask = { orbits: {} };
	for (const [orbitName, orbit] of Object.entries(mask.orbits)) {
		const idxs = extra[orbitName];
		if (!idxs || !idxs.length) {
			result.orbits[orbitName] = orbit;
			continue;
		}
		const set = new Set(idxs);
		result.orbits[orbitName] = {
			pieces: orbit.pieces.map((p, i) => {
				if (!set.has(i)) return p;
				const n = p ? p.facelets.length : (FACELET_COUNT[orbitName] || 1);
				return { facelets: new Array(n).fill('regular') as FaceletMask[] };
			}),
		};
	}
	return result;
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

		const { permutation, orientationDelta } = orbitTransform;
		const newPieces = new Array(orbitMask.pieces.length).fill(null);

		for (let i = 0; i < permutation.length; i++) {
			const sourcePiece = orbitMask.pieces[i];
			if (!sourcePiece) {
				newPieces[permutation[i]] = null;
				continue;
			}

			const delta = orientationDelta[i];
			const n = sourcePiece.facelets.length;

			if (delta === 0 || n <= 1) {
				newPieces[permutation[i]] = sourcePiece;
			} else {
				const rotated: FaceletMask[] = new Array(n);
				for (let f = 0; f < n; f++) {
					rotated[f] = sourcePiece.facelets[(f - delta + n) % n];
				}
				newPieces[permutation[i]] = { facelets: rotated };
			}
		}

		result.orbits[orbitName] = { pieces: newPieces };
	}

	return result;
}

/**
 * Verilen stickering ismi ve rotasyon icin islenmis maske dondurur.
 * F2L ile ayni akis: cubing.js standart mask → normalize → fixup → remap.
 * Sonuclar cache'lenir. Hata durumunda null doner (fallback: string stickering).
 */
export async function getRemappedMask(
	stickeringName: string,
	rotation: string,
	extraRegular?: Record<string, number[]>
): Promise<StickeringMask | null> {
	if (!stickeringName || stickeringName === 'full') return null;

	const key = `${stickeringName}|${rotation || 'none'}|${extraRegular ? JSON.stringify(extraRegular) : ''}`;
	const cached = cache.get(key);
	if (cached) return cached;

	try {
		const standardMask = await getStandardMask(stickeringName);
		let mask = normalizeMask(standardMask);

		const fixup = STICKERING_FIXUPS[stickeringName];
		if (fixup) {
			mask = fixup(mask);
		}

		if (extraRegular) {
			mask = applyExtraRegular(mask, extraRegular);
		}

		if (rotation) {
			const kpuzzle = await loadKPuzzle();
			const transform = kpuzzle.algToTransformation(rotation);
			mask = remapMask(mask, transform.transformationData);
		}

		// Sinirsiz buyumeyi onle (tip×rotation×slot kombinasyonu) — basit FIFO bound
		if (cache.size >= 64) {
			const firstKey = cache.keys().next().value;
			if (firstKey !== undefined) cache.delete(firstKey);
		}
		cache.set(key, mask);
		return mask;
	} catch (err) {
		console.error(`[stickering_remap] getRemappedMask error:`, err);
		return null;
	}
}
