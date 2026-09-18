import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../styles/bem';
import './LiveAnalysisSlot.scss';

const b = block('live-analysis-slot');

/**
 * The id SmartCube renders its phase ladder into. One per page: a module is keyed by
 * its type, so it can only be placed once.
 */
export const LIVE_ANALYSIS_SLOT_ID = 'zt-live-analysis-slot';

/** Type size the measured scale multiplies, and the range it may land in. */
const BASE_FONT_PX = 20;
const MIN_FONT_PX = 13;
const MAX_FONT_PX = 56;

/**
 * The size below which shrinking to fit stops being worth it.
 *
 * Height and width are not treated the same. Overflowing sideways hides digits, so the
 * width always wins and the type shrinks as far as it must. Running out of height only
 * means the last phases are below the fold, and a card too short for eight rows at a
 * readable size should scroll rather than shrink them to nothing. Card too small, scroll
 * bar; that is the same rule the module columns already follow.
 */
const READABLE_FONT_PX = 28;

/** Matches the gap between the ladder and the move count in the stylesheet. */
const SIDE_GAP_PX = 10;

/** Recognition split on its own line under the phase, instead of in front of it. */
const STACKED_CLASS = 'zt-live-analysis-slot--split-stacked';
/** Split hidden, for the width half of the measurement only. */
const MEASURE_CLASS = 'zt-live-analysis-slot--measuring';

/**
 * The body of the live phase analysis module.
 *
 * It draws nothing itself. SmartCube owns the cube's start state and its move stream and
 * renders the ladder in here; lifting that state out to satisfy the module system would
 * mean every move re-rendering the whole timer page, which is the cost this screen was
 * rebuilt to avoid.
 *
 * What it does own is the size. The ladder is written for a full-screen display, and no
 * fixed size fits a card the user can resize: it reads as lost in a wide column and
 * overflows a narrow one. So the content is measured and scaled to fill whichever runs
 * out first, the width or the height. A percentage-of-width rule cannot do this, because
 * the rows differ in length with the analysis mode and the recognition split.
 */
export default function LiveAnalysisSlot() {
	const { t } = useTranslation();
	const rootRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef<HTMLDivElement>(null);

	const fit = useCallback(() => {
		const root = rootRef.current;
		const target = targetRef.current;
		if (!root || !target) return;

		const ladder = target.querySelector<HTMLElement>('.live-analysis');
		if (!ladder || !ladder.querySelector('.live-analysis__row')) return;

		// Measure at scale 1 every time. Measuring on top of the previous scale compounds
		// rounding and the size creeps between renders.
		root.style.setProperty('--zt-live-scale', '1');

		const availableHeight = root.clientHeight;
		if (!availableHeight) return;

		/**
		 * How big the type can get in one arrangement.
		 *
		 * Width is measured from what the longest row WANTS (`max-content`), not from a
		 * row's scrollWidth: the rows are full-width flex boxes, so scrollWidth always
		 * reports the width of the column and every card looked "already full".
		 */
		const measure = (stacked: boolean) => {
			root.classList.toggle(STACKED_CLASS, stacked);

			// Stacked, the recognition split has its own line, so it no longer decides how
			// wide a row has to be. Hidden for this measurement only.
			root.classList.toggle(MEASURE_CLASS, stacked);
			// `flex` has to go with the width: the ladder is a flex item that grows, and a
			// grown item is exactly as wide as the column no matter what its content wants.
			// Without this the measurement reported the column's width every time and the
			// type never grew.
			ladder.style.flex = '0 0 auto';
			ladder.style.width = 'max-content';
			const naturalWidth = ladder.getBoundingClientRect().width;
			ladder.style.width = '';
			ladder.style.flex = '';
			root.classList.remove(MEASURE_CLASS);

			const contentHeight = target.scrollHeight;
			const rowWidth = target.clientWidth;
			if (!naturalWidth || !contentHeight || !rowWidth) return 0;

			// The move count sits beside the ladder and grows with the same scale, so it is
			// part of the width equation rather than a fudge factor: at scale s the row
			// needs naturalWidth*s + statsWidth*s + gap, and that must fit. Treating it as
			// a flat margin let a wide card scale past the point where the numbers still
			// fitted, and the ladder overflowed sideways.
			const stats = target.querySelector<HTMLElement>('.zt-smart-stats');
			const besideTheLadder = getComputedStyle(target).flexDirection === 'row';
			const statsWidth = stats && besideTheLadder ? stats.getBoundingClientRect().width : 0;
			const gap = besideTheLadder ? SIDE_GAP_PX : 0;

			const widthScale = ((rowWidth - gap) * 0.99) / (naturalWidth + statsWidth);
			const heightScale = availableHeight / contentHeight;

			return Math.min(widthScale, Math.max(heightScale, READABLE_FONT_PX / BASE_FONT_PX));
		};

		// Two arrangements, and the card decides between them. With the recognition split
		// inline, a row is about half as long again, so in a narrow column the numbers are
		// squeezed no matter how tall the card is. Moving the split onto its own line buys
		// width and spends height, which is the right trade in a tall card and the wrong
		// one in a short strip. Measuring both is the only way to know which card this is.
		const inlineScale = measure(false);
		const stackedScale = measure(true);
		const stacked = stackedScale > inlineScale;

		root.classList.toggle(STACKED_CLASS, stacked);

		const scale = stacked ? stackedScale : inlineScale;
		if (!scale) return;

		const size = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, Math.floor(BASE_FONT_PX * scale)));
		root.style.setProperty('--zt-live-scale', String(size / BASE_FONT_PX));
	}, []);

	useEffect(() => {
		const root = rootRef.current;
		const target = targetRef.current;
		if (!root || !target || typeof ResizeObserver === 'undefined') return undefined;

		fit();

		// The card is observed, never the content: observing the content would see the
		// resize its own new size caused and chase itself. Content changes (a new solve,
		// a different analysis mode, the recognition split toggled) come in as mutations.
		const resize = new ResizeObserver(fit);
		resize.observe(root);

		const mutation = new MutationObserver(fit);
		mutation.observe(target, { childList: true, subtree: true, characterData: true });

		return () => {
			resize.disconnect();
			mutation.disconnect();
		};
	}, [fit]);

	return (
		<div className={b()} ref={rootRef}>
			<div id={LIVE_ANALYSIS_SLOT_ID} className={b('target')} ref={targetRef} />
			<span className={b('hint')}>{t('timer_tiles.live_analysis_hint')}</span>
		</div>
	);
}
