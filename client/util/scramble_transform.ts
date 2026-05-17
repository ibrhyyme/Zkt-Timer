/**
 * Scramble Renk Transform
 *
 * Cstimer standart 3x3 scramble'lari cube'un U layer (beyaz yuz, cube ref) pieces'ini
 * permute eder. Kullanici farkli bir cross/drill rengi tercih ediyorsa scramble'i
 * conjugate ile transform ederiz: rotation + SCRAM + rotation^-1.
 *
 * Net rotation identity (cube standart orientation'da kalir), ama scramble'in etkisi
 * secilen renge denk yuze tasinir. Kullanici cube'u STANDART tutusta tutar, smart cube
 * uyumlu, klasik mode da calisir.
 *
 * Matematiksel olarak: A · SCRAM · A^(-1) (A = rotation) = SCRAM'in her face turn'unun
 * A altinda transform edilmis hali. transformMoves(SCRAM, A) bu islemi yapar.
 * Boylece cube'a ekstra cube rotation (x/y/z) eklemeden temiz face turn'lerden
 * olusan bir scramble elde edilir.
 */

import {transformMoves} from '../components/solve_info/util/cross_rotation';

export type TopColorFace = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

const TOP_COLOR_FACES: TopColorFace[] = ['U', 'D', 'F', 'B', 'R', 'L'];

export function isTopColorFace(value: unknown): value is TopColorFace {
	return typeof value === 'string' && TOP_COLOR_FACES.includes(value as TopColorFace);
}

/**
 * Selected face → U position rotation map.
 *
 * Kullanicinin drill yapmak istedigi yuzu cube'un U pozisyonuna getiren rotation.
 * Scramble standart referansta U layer permute eder. transformMoves bu rotation
 * altinda her face turn'unu donusturur — scramble'in etkisi selected face'e tasinir.
 *
 * | Renk    | Face | Rotation |
 * |---------|------|----------|
 * | Beyaz   | U    | ''       | Default, no-op
 * | Sari    | D    | x2       | Sari ust drill
 * | Kirmizi | R    | z'       | Kirmizi ust drill
 * | Turuncu | L    | z        | Turuncu ust drill
 * | Yesil   | F    | x'       | Yesil ust drill
 * | Mavi    | B    | x        | Mavi ust drill
 */
const FACE_TO_U_ROTATION: Record<TopColorFace, string> = {
	U: '',
	D: 'x2',
	R: "z'",
	L: 'z',
	F: "x'",
	B: 'x',
};

/**
 * Top color secimi hangi cube_type + subset kombinasyonlarinda gosterilir.
 * Sadece 3x3 CFOP'ta PLL/OLL/Cross Cozuldu (f2l) subset'lerinde.
 */
const TOP_COLOR_SUBSETS = new Set(['pll', 'oll', 'f2l']);

export function isTopColorAvailable(cubeType: string | null | undefined, subset: string | null | undefined): boolean {
	if (cubeType !== '333cfop') return false;
	if (!subset) return false;
	return TOP_COLOR_SUBSETS.has(subset);
}

/**
 * Standart 3x3 scramble'i secilen ust katman rengine gore transform et.
 *
 * Implementation: transformMoves(scramble, rotation) — rotation altinda her face
 * turn'u donusturur. Sonuc: yalniz face turn'lerden olusan temiz bir scramble,
 * cube'da rotation kalintisi yok.
 *
 * @param scramble  Standart cstimer scramble (ornek: "R U R' F D L'")
 * @param topColor  Kullanicinin ust katmanda tutmak istedigi yuz. null/'U' ise transform yok.
 * @returns Transform edilmis scramble. Hata durumunda orijinal scramble.
 *
 * NOT: Async imzasi geriye uyumluluk icin — eski cubing.js Alg lazy load gerekli idi.
 * Su an sync calisir ama caller'lar await ediyor; imzayi degistirmedik.
 */
export async function applyTopColorTransform(
	scramble: string,
	topColor?: TopColorFace | null
): Promise<string> {
	if (!scramble || !topColor || topColor === 'U') return scramble;
	const rot = FACE_TO_U_ROTATION[topColor];
	if (!rot) return scramble;
	try {
		const result = transformMoves(scramble, rot);
		return result || scramble;
	} catch (e) {
		console.warn('[scramble_transform] transformMoves failed, returning original:', e);
		return scramble;
	}
}
