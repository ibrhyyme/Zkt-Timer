import { bucketMapKey, deriveBucket, getImportSubsets } from '../session_bucket';

describe('deriveBucket', () => {
	it('reads a plain WCA event as the wca bucket', () => {
		expect(deriveBucket('333')).toEqual({ cubeType: '333', bucketCube: '333', subset: null });
		expect(deriveBucket('wca/444')).toEqual({ cubeType: '444', bucketCube: '444', subset: null });
	});

	it('reads VARIANT_MAP ids, method cube types included', () => {
		expect(deriveBucket('333oh')).toEqual({ cubeType: '333', bucketCube: '333', subset: '333oh' });
		expect(deriveBucket('pll')).toEqual({ cubeType: '333', bucketCube: '333cfop', subset: 'pll' });
	});

	it('reads an explicit cube_type/subset pair', () => {
		expect(deriveBucket('444/RrUu')).toEqual({ cubeType: '444', bucketCube: '444', subset: 'RrUu' });
		expect(deriveBucket('333cfop/f2l')).toEqual({ cubeType: '333', bucketCube: '333cfop', subset: 'f2l' });
	});
});

describe('bucketMapKey', () => {
	it('round-trips through deriveBucket', () => {
		const cases: [string, string | null][] = [
			['wca', '333'],
			['333', null],
			['333', '333o'],
			['444', 'RrUu'],
			['333cfop', 'pll'],
			['222', '222eg0'],
		];
		for (const [ct, sub] of cases) {
			const d = deriveBucket(bucketMapKey(ct, sub));
			const expected = ct === 'wca' ? { bucketCube: sub, subset: null } : { bucketCube: ct, subset: sub };
			expect({ bucketCube: d.bucketCube, subset: d.subset }).toEqual(expected);
		}
	});
});

describe('getImportSubsets', () => {
	it('lists WCA first for a WCA event, so an empty subset no longer shows a practice subset', () => {
		const s333 = getImportSubsets('333');
		expect(s333[0]).toEqual({ id: '', label: 'WCA' });
		expect(s333.filter((s) => s.id === '')).toHaveLength(1);
		expect(s333.some((s) => s.id === '333oh')).toBe(true);

		const s222 = getImportSubsets('222');
		expect(s222[0]).toEqual({ id: '', label: 'WCA' });
		expect(s222.filter((s) => s.id === '')).toHaveLength(1);
	});

	it('leaves a method cube type list alone', () => {
		expect(getImportSubsets('333cfop').some((s) => s.id === 'pll')).toBe(true);
		expect(getImportSubsets('333cfop')[0].id).not.toBe('');
	});
});
