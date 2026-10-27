import 'reflect-metadata';

// Prisma select consistency for trainer algorithm sets (design trainer-sets 4.1, 4.8): every
// field of the GraphQL set types comes out of a row read with the select constants. A field
// added to server/schemas/AlgSet.schema.ts without its column in server/models/alg_set.ts
// comes back null here.

import {getMetadataStorage} from 'type-graphql/dist/metadata/getMetadataStorage';
import {AlgSet, AlgSetItem, AlgSetOwner, AlgSetSummary} from '../../schemas/AlgSet.schema';
import {
	ALG_SET_ITEM_SELECT,
	ALG_SET_OWNER_SELECT,
	ALG_SET_SUMMARY_SELECT,
	toAlgSet,
	toAlgSetItem,
	toAlgSetOwner,
	toAlgSetSummary,
} from '../../models/alg_set';

function graphqlFields(target: Function): string[] {
	const storage = getMetadataStorage();
	const targets: Function[] = [];
	for (let t: any = target; t && t !== Function.prototype && t !== Object; t = Object.getPrototypeOf(t)) targets.push(t);
	return Array.from(new Set(storage.fields.filter((f) => targets.includes(f.target)).map((f) => f.name)));
}

const SAMPLE_DATE = new Date('2026-10-06T00:00:00Z');

/** A row holding exactly the selected columns, each with a non empty value. */
function rowFromSelect(select: Record<string, any>): any {
	const row: any = {};
	for (const key of Object.keys(select)) {
		const value = select[key];
		if (value === true) {
			if (key.endsWith('_at') || key === 'banned_until') row[key] = SAMPLE_DATE;
			else if (key === 'categories') row[key] = ',OLL,';
			else if (key === 'puzzles') row[key] = ',333,';
			else if (key === 'banned_forever') row[key] = false;
			else if (key === 'verified') row[key] = true;
			else if (key.endsWith('_count') || key === 'position') row[key] = 3;
			else row[key] = `${key}-value`;
		} else if (value && typeof value === 'object' && value.select) {
			const nested = rowFromSelect(value.select);
			row[key] = 'take' in value || key === 'items' ? [nested] : nested;
		}
	}
	return row;
}

function expectAllPresent(out: Record<string, unknown>, fields: string[], skip: string[] = []) {
	for (const field of fields) {
		if (skip.includes(field)) continue;
		expect({field, value: out[field]}).toEqual({field, value: expect.anything()});
	}
}

describe('alg set select constants cover the GraphQL fields', () => {
	it('AlgSetItem', () => {
		const out = toAlgSetItem(rowFromSelect(ALG_SET_ITEM_SELECT));
		expectAllPresent(out, graphqlFields(AlgSetItem));
	});

	it('AlgSetOwner', () => {
		const out = toAlgSetOwner(rowFromSelect(ALG_SET_OWNER_SELECT));
		expectAllPresent(out, graphqlFields(AlgSetOwner));
		// Ban columns are read for the access rule, never returned.
		expect(out).not.toHaveProperty('banned_forever');
		expect(out).not.toHaveProperty('banned_until');
	});

	it('AlgSetSummary (owner view, so hidden can be true)', () => {
		const row = rowFromSelect(ALG_SET_SUMMARY_SELECT);
		const out = toAlgSetSummary(row, {id: row.user_id});
		expectAllPresent(out, graphqlFields(AlgSetSummary));
		expect(out.hidden).toBe(true);
		expect(out.preview).toHaveLength(1);
	});

	it('AlgSet (items come from the field resolver)', () => {
		const row = rowFromSelect(ALG_SET_SUMMARY_SELECT);
		const out = toAlgSet(row, {id: row.user_id}, false);
		expectAllPresent(out, graphqlFields(AlgSet), ['items']);
		expect(out).not.toHaveProperty('items');
	});

	it('the owner select never loads integrations or private columns (B-11)', () => {
		expect(Object.keys(ALG_SET_OWNER_SELECT).sort()).toEqual(
			['banned_forever', 'banned_until', 'id', 'profile', 'username', 'verified'].sort()
		);
	});
});
