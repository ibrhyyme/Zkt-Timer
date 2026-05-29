/**
 * Guide lookup coverage regression testi.
 *
 * Eski build-time script (generate-pll-recognition-guide-lookup.mjs) yerine gecer:
 * guide_lookup.ts modul yuklenirken runtime'da buildLookupTable() calistirir;
 * bu test o ciktinin 73/73 PLL (case, rotation) kapsamasini garanti eder.
 * Guide datasi (pll-guide-data.json) degisirse ve kapsama bozulursa burada yakalanir.
 */
import {getFullLookupTable} from '../guide_lookup';
import {allPllKeys} from '../pll_cases';

describe('PLL recognition guide lookup', () => {
	const table = getFullLookupTable();
	const keys = allPllKeys();

	it('73 PLL (case, rotation) anahtarinin tamamini kapsar', () => {
		expect(keys.length).toBe(73);
		expect(Object.keys(table).length).toBe(73);
	});

	it('her anahtari gecerli bir guide grup + satira esler', () => {
		for (const key of keys) {
			const entry = table[key];
			expect(entry).toBeDefined();
			expect(typeof entry.groupId).toBe('string');
			expect(entry.groupId.length).toBeGreaterThan(0);
			expect(entry.rowIndex).toBeGreaterThanOrEqual(0);
		}
	});
});
