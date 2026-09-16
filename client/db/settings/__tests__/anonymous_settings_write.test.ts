/**
 * Settings of a visitor with no account stay on the device. The setSetting mutation is
 * [LOGGED_IN] gated and the offline hash it schedules belongs to an account, so sending
 * either for an anonymous visitor could only ever fail; local persistence is what their
 * settings actually run on.
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

import { gqlMutate } from '../../../components/api';
import { setSettings } from '../update';

beforeEach(() => {
	jest.clearAllMocks();
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
	const db = new Loki('settings-anon-test.db');
	mockCollection = db.addCollection('settings', {unique: ['id']});
	mockCollection.insert({id: 'inspection', local: true, value: false});
});

afterEach(() => {
	delete (global as any).localStorage;
});

describe('setSettings for an anonymous visitor', () => {
	beforeEach(() => {
		mockMe = null;
	});

	it('writes locally and sends nothing to the server', async () => {
		await setSettings({inspection: true});

		expect(mockCollection.findOne({id: 'inspection'}).value).toBe(true);
		expect(JSON.parse(store.settings)._anon.inspection).toBe(true);
		expect(gqlMutate).not.toHaveBeenCalled();
	});
});

describe('setSettings for a signed-in user', () => {
	beforeEach(() => {
		mockMe = {id: 'user-1'};
	});

	it('still writes through to the server', async () => {
		await setSettings({inspection: true});

		expect(mockCollection.findOne({id: 'inspection'}).value).toBe(true);
		expect(gqlMutate).toHaveBeenCalledTimes(1);
	});
});
