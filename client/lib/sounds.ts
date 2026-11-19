import {getSetting} from '../db/settings/query';

type SoundSetting = 'play_inspection_sound' | 'shortcut_hint_voice' | 'smart_cube_scramble_sound';

/**
 * Whether one of the timer's sounds may play: its own setting and the master "all
 * sounds" switch (sounds_enabled) both have to allow it. Read at the moment of playing,
 * so a switch flipped mid-session takes effect on the next sound.
 */
export function soundAllowed(key: SoundSetting): boolean {
	return Boolean(getSetting(key)) && soundsEnabled();
}

/** The master switch alone, for sounds with no setting of their own (battle, room games). */
export function soundsEnabled(): boolean {
	return getSetting('sounds_enabled') !== false;
}
