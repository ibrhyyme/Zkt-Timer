// Content the landing page shows that is not copy: chapter imagery, store ratings,
// sticker colours. Kept out of the components so a refresh of the screenshots or the
// ratings is a one-file change.

/**
 * Store ratings as each store showed them on the date below. Google Play has no API
 * for this, so both figures are pinned by hand with the day they were read. They move
 * slowly, and a count that has since grown still reads true.
 */
export const STORE_RATINGS = {
	appStore: {rating: 4.7, count: 39},
	googlePlay: {rating: 4.9, count: 49},
	checkedOn: '2026-09-30',
};

/** The six sticker colours, WCA orientation (white top, green front). */
export const STICKER = {
	U: '#f4f4f5',
	F: '#1fbf4d',
	R: '#e8303c',
	D: '#ffd400',
	L: '#ff7a1a',
	B: '#246bfd',
} as const;

export type Face = keyof typeof STICKER;

/**
 * The colour of a soft field behind a step (the chapter screen, the active app card).
 * The white sticker would not show on the white page, so its field takes the cube's
 * plastic grey instead.
 */
export function stickerTint(face: Face): string {
	return face === 'U' ? '#8a93a3' : STICKER[face];
}

export type ChapterId = 'timer' | 'smart' | 'hands' | 'stats' | 'trainer' | 'together';

export interface Chapter {
	id: ChapterId;
	face: Face;
	/** 1920x1080 still. */
	image: string;
	/** Pro-only features get a tag so the page never promises them to everyone. */
	pro?: boolean;
}

const V2 = '/public/welcome/v2';

// Every image here is a real screen from the app, except the hands chapter: Drop to
// Stop and Magnet Timer have no screen worth showing, so that one is a frame of the
// animation that explains them (the film itself left the page on 2026-10-27). Timer,
// smart cube and stats come from the owner's own account (the September 2026 promo
// shoot); the trainer grid and the battle round were captured live on 2026-09-30.
export const CHAPTERS: Chapter[] = [
	{id: 'timer', face: 'U', image: `${V2}/stage-timer.webp`},
	{id: 'smart', face: 'F', image: `${V2}/stage-smart.webp`},
	{id: 'hands', face: 'R', image: `${V2}/stage-hands.webp`, pro: true},
	{id: 'stats', face: 'D', image: `${V2}/stage-stats.webp`},
	{id: 'trainer', face: 'L', image: `${V2}/stage-trainer.webp`},
	{id: 'together', face: 'B', image: `${V2}/stage-battle.webp`},
];

/** The characters a heading scrambles through before it settles: cube notation. */
export const NOTATION_CHARS = "RUFLDB'2";
