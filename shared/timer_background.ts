// Desktop / mobile timer background selection, shared by the server mutations and the
// timer screen so both read one TimerBackground row the same way.
//
// The row's storage_path / media_type are the desktop background. Mobile has its own
// pair, which only counts when mobile_same_as_desktop is false. Rows written before the
// split have no mobile fields and mobile_same_as_desktop defaults to true, so phones keep
// showing the picture they showed before.

export type TimerBackgroundTarget = 'desktop' | 'mobile';

export interface TimerBackgroundRowLike {
	storage_path?: string | null;
	media_type?: string | null;
	mobile_storage_path?: string | null;
	mobile_media_type?: string | null;
	mobile_same_as_desktop?: boolean | null;
}

export interface TimerBackgroundMedia {
	storage_path: string;
	is_video: boolean;
}

/** Anything that is not exactly "mobile" means desktop, which is what old clients upload. */
export function parseTimerBackgroundTarget(value: unknown): TimerBackgroundTarget {
	return value === 'mobile' ? 'mobile' : 'desktop';
}

/** Null or missing (rows from before the split) means "same as desktop". */
export function isMobileSameAsDesktop(row: TimerBackgroundRowLike | null | undefined): boolean {
	return row?.mobile_same_as_desktop !== false;
}

/** The file stored in the slot for this target, ignoring the "same as desktop" switch. */
export function getTimerBackgroundSlot(
	row: TimerBackgroundRowLike | null | undefined,
	target: TimerBackgroundTarget
): TimerBackgroundMedia | null {
	if (!row) return null;
	const path = target === 'mobile' ? row.mobile_storage_path : row.storage_path;
	if (!path) return null;
	const mediaType = target === 'mobile' ? row.mobile_media_type : row.media_type;
	// Null media_type is an image: rows written before video backgrounds existed.
	return {storage_path: path, is_video: mediaType === 'video'};
}

/** What the timer should actually draw on this kind of screen, or null for no background. */
export function resolveTimerBackground(
	row: TimerBackgroundRowLike | null | undefined,
	target: TimerBackgroundTarget
): TimerBackgroundMedia | null {
	if (target === 'mobile' && isMobileSameAsDesktop(row)) {
		return getTimerBackgroundSlot(row, 'desktop');
	}
	return getTimerBackgroundSlot(row, target);
}

/** A row with no file in either slot and the default switch carries nothing worth keeping. */
export function isTimerBackgroundRowEmpty(row: TimerBackgroundRowLike | null | undefined): boolean {
	return !row || (!row.storage_path && !row.mobile_storage_path && isMobileSameAsDesktop(row));
}
