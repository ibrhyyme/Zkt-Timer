/**
 * A session created without a connection is not on the server until the offline queue
 * sends it. Reconciliation used to read that absence as "deleted on another device" and
 * remove it, stranding every solve timed in it.
 */

const rows: any[] = [];

const fakeCollection = {
	find: () => rows.slice(),
	insert: (doc: any) => {
		rows.push(doc);
	},
	update: (doc: any) => {
		const i = rows.findIndex((r) => r.id === doc.id);
		if (i >= 0) rows[i] = doc;
	},
	remove: (doc: any) => {
		const i = rows.findIndex((r) => r.id === doc.id);
		if (i >= 0) rows.splice(i, 1);
	},
};

jest.mock('../../lokijs', () => ({
	getLokiDb: () => ({getCollection: () => fakeCollection}),
}));
jest.mock('../../../i18n/i18n', () => ({__esModule: true, default: {t: (k: string) => k}}));

import {reconcileSessionDb} from '../init';

beforeEach(() => {
	rows.length = 0;
});

function session(id: string, extra: any = {}) {
	return {id, name: id, order: 0, ...extra};
}

describe('reconcileSessionDb', () => {
	it('removes a local session the server no longer has', () => {
		rows.push(session('kept'), session('gone'));
		reconcileSessionDb([session('kept')] as any);
		expect(rows.map((r) => r.id)).toEqual(['kept']);
	});

	it('keeps a local session whose creation is still queued', () => {
		rows.push(session('kept'), session('offline'));
		reconcileSessionDb([session('kept')] as any, new Set(['offline']));
		expect(rows.map((r) => r.id).sort()).toEqual(['kept', 'offline']);
	});

	it('still adds sessions that only the server has', () => {
		rows.push(session('offline'));
		reconcileSessionDb([session('server')] as any, new Set(['offline']));
		expect(rows.map((r) => r.id).sort()).toEqual(['offline', 'server']);
	});
});
