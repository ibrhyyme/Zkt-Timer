import 'reflect-metadata';
import {wcaCountVisible} from '../Integration.resolver';

const hidden = {user_id: 'owner', wca_show_competitions: false, wca_show_medals: false, wca_show_records: false};

describe('wcaCountVisible', () => {
	it('hides a switched-off count from anonymous visitors and other users', () => {
		expect(wcaCountVisible(hidden, null, 'medals')).toBe(false);
		expect(wcaCountVisible(hidden, {id: 'someone'}, 'records')).toBe(false);
		expect(wcaCountVisible(hidden, {id: 'someone'}, 'competitions')).toBe(false);
	});

	it('shows the owner and admins their real values', () => {
		expect(wcaCountVisible(hidden, {id: 'owner'}, 'medals')).toBe(true);
		expect(wcaCountVisible(hidden, {id: 'admin-1', admin: true}, 'records')).toBe(true);
	});

	it('shows a count whose switch is on or was never set', () => {
		expect(wcaCountVisible({user_id: 'owner', wca_show_medals: true}, null, 'medals')).toBe(true);
		expect(wcaCountVisible({user_id: 'owner'}, null, 'competitions')).toBe(true);
	});

	it('treats a row without an owner id as someone else', () => {
		expect(wcaCountVisible({wca_show_records: false} as any, {id: 'owner'}, 'records')).toBe(false);
	});
});
