import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import block from '../../../styles/bem';
import { getSetting } from '../../../db/settings/query';
import { computeVirtualCubeSize } from '../../../util/virtual_cube/useVirtualCubeSize';
import {
	FOLDED_CUBE_SCALE,
	referenceDigitsWidth,
	smartCubeWidths,
	TIME_ROW_FITS,
	TimeRowFit,
	timeRowFit,
} from './time_row_fit';

const timeDisplay = block('time-display');
const smartCube = block('smart-cube');
const virtualCube = block('virtual-cube');

function px(value: string): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

function width(el: Element | null): number {
	return el ? el.getBoundingClientRect().width : 0;
}

/**
 * Measures the desktop time row (Timer.tsx `__main-time`) and says how it fits its
 * column, see time_row_fit.ts.
 *
 * Decided again when the column or the companion changes size (window, module rails,
 * the connect button turning into the battery row), never on a new digit: the digits
 * are counted at a fixed reference length, so a solve passing ten seconds does not
 * move the cube. Frozen while a solve runs (`frozen`).
 */
export function useTimeRowFit(rowRef: RefObject<HTMLElement>, frozen: boolean, layoutKey: string): TimeRowFit {
	const [fit, setFit] = useState<TimeRowFit>(TIME_ROW_FITS);
	const fitRef = useRef(fit);
	fitRef.current = fit;
	const frozenRef = useRef(frozen);
	frozenRef.current = frozen;

	const measure = useCallback(() => {
		const row = rowRef.current;
		if (!row || frozenRef.current || typeof window === 'undefined') return;

		const display = row.querySelector<HTMLElement>(`:scope > .${timeDisplay()}`);
		const digitsEl = display && display.querySelector<HTMLElement>(`h1.${timeDisplay()}`);
		if (!display || !digitsEl) return;

		const digits = Math.max(width(digitsEl), referenceDigitsWidth(px(getComputedStyle(digitsEl).fontSize)));

		const gap = px(getComputedStyle(row).columnGap);
		let companion = 0;
		let companionStacked: number | undefined;
		let companionFolded: number | undefined;
		// The smart and virtual rows have a set width.
		const available = row.clientWidth;

		const smart = row.querySelector<HTMLElement>(`:scope > .${smartCube()}`);
		const virtual = row.querySelector<HTMLElement>(`:scope > .${virtualCube()}`);

		if (smart) {
			// Folded or stacked, the cube is drawn at FOLDED_CUBE_SCALE: undo it to get its
			// size in a line.
			const measured = width(smart.querySelector(`.${smartCube('cube')}`));
			const small = fitRef.current.folded || fitRef.current.stacked;
			const cubeInLine = small ? measured / FOLDED_CUBE_SCALE : measured;
			const side = width(smart.querySelector(`.${smartCube('side')}`));
			const cube = smartCubeWidths(cubeInLine, px(getComputedStyle(smart).columnGap), side);
			companion = cube.line;
			companionStacked = cube.stacked;
			companionFolded = cube.folded;
		} else if (virtual) {
			// Its size in a row, worked out rather than read: stacked, the cube is drawn
			// smaller (computeVirtualCubeSize), and reading that back would undo the stack.
			companion = virtual.getBoundingClientRect().width > 0
				? computeVirtualCubeSize(getSetting('virtual_cube_size') as number, window.innerWidth, window.innerHeight, false, false)
				: 0;
		}

		const next = timeRowFit({ available, digits, gap, companion, companionStacked, companionFolded });
		if (next.stacked !== fitRef.current.stacked || next.folded !== fitRef.current.folded) {
			setFit(next);
		}
	}, [rowRef]);

	useEffect(() => {
		measure();
	}, [measure, frozen, layoutKey]);

	useEffect(() => {
		const row = rowRef.current;
		if (!row || typeof ResizeObserver === 'undefined') return undefined;

		// The row's width follows the column. The companion is observed for its own
		// changes (the smart cube's connect column grows once connected). The digits are
		// not observed: they change every frame of a solve.
		const observer = new ResizeObserver(() => measure());
		observer.observe(row);
		row.querySelectorAll(`:scope > .${smartCube()}, :scope > .${virtualCube()}`).forEach((el) => {
			observer.observe(el);
		});
		return () => observer.disconnect();
	}, [measure, rowRef, layoutKey]);

	return fit;
}
