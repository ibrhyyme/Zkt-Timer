/**
 * A setting added in a release after a device first stored its settings. The anonymous
 * boot built its settings rows from the stored entry alone, so such a key had no row,
 * and setSettings then called LokiJS update() on a document it never stored, which
 * throws: anonymous users could not change any setting newer than their data.
 */

import Loki from 'lokijs';

let mockMe: any = null;
let mockCollection: Collection<any>;
let store: Record<string, string>;

jest.mock('../../../components/store', () => ({ getMe: () => mockMe }));
jest.mock('../init', () => ({ getSettingsDb: () => mockCollection }));
jest.mock('../../../components/api', () => ({
	gqlMutate: jest.fn(() => Promise.resolve({})),
	gqlQuery: jest.fn(() => Promise.resolve({data: {}})),
}));
jest.mock('../../../components/layout/offline', () => ({ updateOfflineHash: jest.fn() }));
jest.mock('../../../util/event_handler', () => ({ emitEvent: jest.fn() }));

import { getAllLocalSettings, setLocalSettingValue } from '../local';
import { getDefaultSettings } from '../query';
import { setSettings } from '../update';

function storedEntry(userId: string) {
	return JSON.parse(store.settings)[userId];
}

beforeEach(() => {
	store = {};
	(global as any).localStorage = {
		getItem: (key: string) => (key in store ? store[key] : null),
		setItem: (key: string, value: string) => {
			store[key] = String(value);
		},
		removeItem: (key: string) => {
			delete store[key];
		},
	};
	mockMe = null;
	const db = new Loki('settings-test.db');
	mockCollection = db.addCollection('settings', {unique: ['id']});
});

afterEach(() => {
	delete (global as any).localStorage;
});

describe('getAllLocalSettings', () => {
	it('fills in defaults for keys the stored entry predates', () => {
		// Stored by an older release: no smart_cube_time_offset, no solve list colours
		store.settings = JSON.stringify({_anon: {cube_type: '222', inspection: true}});

		const settings = getAllLocalSettings('_anon');

		expect(settings.cube_type).toBe('222');
		expect(settings.inspection).toBe(true);
		expect(settings.smart_cube_time_offset).toBe(0);
		expect('solve_time_color' in settings).toBe(true);
		expect(settings.solve_time_color).toBeNull();
	});

	it('does not write the filled-in defaults back', () => {
		store.settings = JSON.stringify({_anon: {cube_type: '222'}});

		getAllLocalSettings('_anon');

		expect(storedEntry('_anon')).toEqual({cube_type: '222'});
	});

	it('never hands out the module defaults object itself', () => {
		const settings = getAllLocalSettings('_anon');
		(settings as any).cube_type = 'mutated';

		expect(getDefaultSettings().cube_type).not.toBe('mutated');
	});
});

describe('setLocalSettingValue', () => {
	it('writes the one key into the stored entry, not a copy of every default', () => {
		store.settings = JSON.stringify({_anon: {cube_type: '222'}});

		setLocalSettingValue('smart_cube_time_offset', 0.35);

		expect(storedEntry('_anon')).toEqual({cube_type: '222', smart_cube_time_offset: 0.35});
	});
});

describe('setSettings on a key with no row', () => {
	it('inserts the row instead of throwing, and later writes update it', async () => {
		store.settings = JSON.stringify({_anon: {cube_type: '222'}});
		mockCollection.insert({id: 'cube_type', local: true, value: '222'});

		await setSettings({smart_cube_time_offset: 0.35});
		expect(mockCollection.findOne({id: 'smart_cube_time_offset'}).value).toBe(0.35);

		await setSettings({smart_cube_time_offset: 1});
		expect(mockCollection.find({id: 'smart_cube_time_offset'})).toHaveLength(1);
		expect(mockCollection.findOne({id: 'smart_cube_time_offset'}).value).toBe(1);
		expect(storedEntry('_anon').smart_cube_time_offset).toBe(1);
	});

	it('still updates an existing row in place', async () => {
		mockCollection.insert({id: 'inspection', local: true, value: false});

		await setSettings({inspection: true});

		expect(mockCollection.find({id: 'inspection'})).toHaveLength(1);
		expect(mockCollection.findOne({id: 'inspection'}).value).toBe(true);
	});
});
