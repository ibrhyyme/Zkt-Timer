import {getSetting} from '../../db/settings/query';
import {soundAllowed, soundsEnabled} from '../sounds';

jest.mock('../../db/settings/query', () => ({getSetting: jest.fn()}));

const mocked = getSetting as jest.Mock;

function settings(values: Record<string, unknown>) {
	mocked.mockImplementation((key: string) => values[key]);
}

describe('timer sounds', () => {
	it('plays a sound when its own switch and the master switch are both on', () => {
		settings({sounds_enabled: true, shortcut_hint_voice: true});
		expect(soundAllowed('shortcut_hint_voice')).toBe(true);
	});

	it('silences every sound when the master switch is off', () => {
		settings({sounds_enabled: false, shortcut_hint_voice: true, play_inspection_sound: true, smart_cube_scramble_sound: true});
		expect(soundAllowed('shortcut_hint_voice')).toBe(false);
		expect(soundAllowed('play_inspection_sound')).toBe(false);
		expect(soundAllowed('smart_cube_scramble_sound')).toBe(false);
		expect(soundsEnabled()).toBe(false);
	});

	it('silences one sound by its own switch and leaves the others alone', () => {
		settings({sounds_enabled: true, shortcut_hint_voice: false, smart_cube_scramble_sound: true});
		expect(soundAllowed('shortcut_hint_voice')).toBe(false);
		expect(soundAllowed('smart_cube_scramble_sound')).toBe(true);
	});

	it('treats a device that never stored the master switch as on', () => {
		settings({smart_cube_scramble_sound: true});
		expect(soundAllowed('smart_cube_scramble_sound')).toBe(true);
	});
});
