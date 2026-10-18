import type { DeviceProfile } from '../../../util/device-profile';

/**
 * Which timer inputs a device offers, in which order, and what a stored `timer_type`
 * means on this device. One pure module for the desktop dropdown (TimerTypePicker), the
 * mobile grid (TimerTypeGrid), the settings screen and the settings read layer, so the
 * pickers cannot drift apart again (they used to list the inputs in two different orders
 * with two different names).
 *
 * No imports beyond types: `client/db/settings/query.ts` reads `effectiveTimerType` from
 * here, so this file must never import the settings layer back.
 */

/** Stored `timer_type` values. Kept in step with AllSettings['timer_type']. */
export type StoredTimerType = 'keyboard' | 'smart' | 'stackmat' | 'gantimer' | 'qiyitimer' | 'virtual' | 'magnet';

/**
 * What a picker shows. Two choices map onto something that is not a timer_type:
 * `manual` is the manual_entry mode, and `qiyiwired` is the QiYi wired timer, which runs on
 * the StackMat engine (same 1200 Hz signal, same jack, same stored device id). The brand
 * only picks the label and which of the two desktop options is checked.
 */
export type TimerChoice =
	| 'keyboard'
	| 'smart'
	| 'manual'
	| 'magnet'
	| 'virtual'
	| 'gantimer'
	| 'qiyitimer'
	| 'stackmat'
	| 'qiyiwired';

export type WiredBrand = 'stackmat' | 'qiyi';

/** The mobile grid has 8 cells; the last one is Quick Settings. */
export const GRID_TIMER_CELLS = 7;

/** Wired timers need an audio jack and a desktop browser: never on phones, tablets or the app. */
export function wiredOffered(device: DeviceProfile): boolean {
	return !device.native && !device.touchFirst;
}

/** The magnetometer stream exists only in the app. Whether the binary ships it is the probe's call. */
export function magnetOfferedOnDevice(device: DeviceProfile): boolean {
	return device.native;
}

export interface ChoiceListInput {
	device: DeviceProfile;
	/** The MagnetDetector probe succeeded (false while it runs, and on old binaries). */
	magnetAvailable: boolean;
	/** Friendly rooms run their own timer overlay, which has no magnet path. */
	inRoom: boolean;
	layout: 'dropdown' | 'grid';
}

/**
 * The inputs to offer, in the owner's order (most used first):
 *   dropdown: Keyboard, Smart Cube, Manual Entry, Virtual Cube, GAN Timer, QiYi Timer,
 *             StackMat, QiYi wired   (desktop web)
 *   grid:     Touch, Smart Cube, Manual Entry, Magnet Timer, Virtual Cube, GAN Timer,
 *             QiYi Timer, + Quick Settings   (phones, the app)
 * A tablet in landscape gets the dropdown with the phone's inputs (Magnet in the app, no
 * wired). A narrow desktop window gets the grid; with no Magnet there it fills the free cell
 * with one wired entry so desktop users keep it.
 */
export function timerChoices(input: ChoiceListInput): TimerChoice[] {
	const list: TimerChoice[] = ['keyboard', 'smart', 'manual'];
	if (magnetOfferedOnDevice(input.device) && input.magnetAvailable && !input.inRoom) {
		list.push('magnet');
	}
	list.push('virtual', 'gantimer', 'qiyitimer');
	if (wiredOffered(input.device)) {
		if (input.layout === 'dropdown') {
			list.push('stackmat', 'qiyiwired');
		} else if (list.length < GRID_TIMER_CELLS) {
			list.push('stackmat');
		}
	}
	return list;
}

/**
 * What a stored `timer_type` means on this device. Read side only: the stored value is
 * never rewritten, so a phone does not overwrite the choice a desktop synced, and mobile web
 * does not overwrite the Magnet Timer the app synced (both share `mobile_prefs`). An input
 * the device cannot run reads as the touch/keyboard timer.
 */
export function effectiveTimerType<T extends string>(stored: T, device: DeviceProfile): T | 'keyboard' {
	if (stored === 'stackmat' && !wiredOffered(device)) return 'keyboard';
	if (stored === 'magnet' && !magnetOfferedOnDevice(device)) return 'keyboard';
	return stored;
}

/** The engine value a choice selects (rooms' allow-lists and Pro gates speak engine values). */
export function choiceEngineType(choice: TimerChoice): StoredTimerType | 'manual' {
	if (choice === 'qiyiwired') return 'stackmat';
	return choice;
}

export interface ActiveChoiceInput {
	/** Already effective (see effectiveTimerType). */
	timerType: string;
	manualEntry: boolean;
	wiredBrand: WiredBrand | null | undefined;
	/** Pro (or admin) and the probe has not failed. */
	magnetUsable: boolean;
	inRoom: boolean;
	/** The list on screen, so a brand that has no row of its own lands on the row that exists. */
	offered: TimerChoice[];
}

/** Which row or cell is checked. Always one of `offered`. */
export function activeChoice(i: ActiveChoiceInput): TimerChoice {
	let choice: TimerChoice;
	if (i.manualEntry) {
		choice = 'manual';
	} else if (i.timerType === 'stackmat') {
		choice = i.wiredBrand === 'qiyi' ? 'qiyiwired' : 'stackmat';
		if (!i.offered.includes(choice) && i.offered.includes('stackmat')) choice = 'stackmat';
	} else if (i.timerType === 'magnet' && (!i.magnetUsable || i.inRoom)) {
		choice = 'keyboard';
	} else {
		choice = i.timerType as TimerChoice;
	}
	return i.offered.includes(choice) ? choice : 'keyboard';
}

export interface MagnetTimerInput {
	timerType: string;
	manualEntry: boolean;
	/** canUseMagnetStart(me). */
	allowed: boolean;
	/** undefined while the probe runs, null when it failed. */
	caps: unknown | null | undefined;
}

/**
 * The Magnet Timer owns the start and stop (touch neither starts nor stops). A Magnet
 * selection that lost Pro, or whose probe failed, falls back to the touch timer so the page
 * never sits on an input that cannot start. A probe still in flight counts as available,
 * like reversed use, so the first tap after opening the app is not taken as a touch start.
 */
export function magnetTimerOwnsInput(i: MagnetTimerInput): boolean {
	return i.timerType === 'magnet' && !i.manualEntry && i.allowed && i.caps !== null;
}
