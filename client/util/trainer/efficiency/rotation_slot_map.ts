/**
 * XCross slot + rotation hizalama.
 *
 * Sorun: cross solver rotation token'larini (z2/y/x) state'e UYGULAMIYOR
 * (parse-scramble.ts negatif p → solver move loop atliyor). Solver raw scramble'i
 * cozer, slot MUTLAK pozisyonda (XCROSS_SLOTS idx: FR=0, FL=1, BL=2, BR=3 = cstimer
 * corner DFR/DLF/DBL/DRB). Ama twisty player rotation'i GORSEL uyguluyor (setupAlg =
 * rotation + raw) → kullanicinin gordugu slot, mutlak slot'tan rotation kadar kayik.
 *
 * Cozum: kullanicinin SECTIGI (gorsel) slot'u, solver'in MUTLAK slot index'ine remap
 * et (rotation⁻¹). Boylece twisty rotation goruntusunde kullanicinin istedigi slot
 * cozulur. Solver/parse-scramble/twisty'ye DOKUNULMAZ — sadece index remap.
 *
 * map[userSlotIdx] = solverSlotIdx.
 *
 * z2: AMPIRIK dogrulandi (kullanici testi). Rotation'siz BL→BR, BR→FR... seklinde
 * gorsel kayma (mutlak slot bir sonraki gorsel pozisyonda). Telafi: her secimi bir
 * onceki mutlak idx'e ata → idx0→3, idx1→0, idx2→1, idx3→2 = [3,0,1,2].
 *   BL(idx2)→solver1(FL): z2 gorsel FL→BL ⇒ kullanici BL gorur ✓
 *   BR(idx3)→solver2(BL): z2 gorsel BL→BR ⇒ kullanici BR gorur ✓
 *
 * Diger rotation'lar (y/x/z kombinasyonlari): kullanici kullanip kayma bildirirse
 * AMPIRIK olarak eklenir. Tanimsiz rotation → identity (remap yok) + twisty ile test.
 * (cubejs/quaternion ile programatik hesap kullanici-perspektifi/kamera nedeniyle
 * guvenilmez cikti — ampirik gozlem esas alindi.)
 */
export const ROTATION_SLOT_MAP: Record<string, number[]> = {
	'': [0, 1, 2, 3], // None — identity
	z2: [3, 0, 1, 2], // ampirik (kullanici dogruladi)
};

export function remapSlot(slotIdx: number, rotation: string): number {
	if (slotIdx < 0 || slotIdx > 3) return slotIdx; // gecersiz slot → dokunma (savunma)
	const map = ROTATION_SLOT_MAP[rotation];
	if (!map) return slotIdx; // tanimsiz rotation → identity (test sonrasi eklenir)
	return map[slotIdx] ?? slotIdx;
}
