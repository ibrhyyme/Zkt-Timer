import { useCallback, useEffect, useRef } from 'react';
import type { ITimerContext } from '../Timer';
import { commitScramble, getNewScrambleAsync, resetScramble } from './scramble';
import { setTimerParam, setTimerParams } from './params';
import { virtualCubeOwnsKeyboard } from './virtual_cube';
import { appendScramble, canGoPrevious, EMPTY_SCRAMBLE_HISTORY, hasNextInHistory, ScrambleHistory } from './scramble_history';
import { useTimerStore } from '../../../util/hooks/useTimerStore';
import { getTimerStore } from '../../../util/store/getTimer';
import { useSettings } from '../../../util/hooks/useSettings';
import { getCubeTypeInfoById } from '../../../util/cubes/util';

/*
 * Scramble state shared by the timer's two layouts. Desktop shows TimerScramble; mobile
 * shows MobileTimerScramble with TimerControls. The timer swaps them at 1024px, which a
 * tablet crosses on every rotation, so nothing here may live in component state or run
 * again just because a component mounted.
 */

function readHistory(): ScrambleHistory {
	return {
		history: getTimerStore('scrambleHistory') || EMPTY_SCRAMBLE_HISTORY.history,
		index: getTimerStore('scrambleHistoryIndex') ?? EMPTY_SCRAMBLE_HISTORY.index,
	};
}

/**
 * Gives the selected cube type and subset a scramble, and clears the history, when that
 * selection changes. A layout mounting after a swap finds its bucket already served and
 * leaves the scramble alone: the solver may already have applied it to the cube.
 */
export function useScrambleForBucket(context: ITimerContext) {
	const { cubeType, scrambleSubset, timeStartedAt } = context;
	const lockedScramble = useSettings('locked_scramble');

	useEffect(() => {
		const bucket = `${cubeType}::${scrambleSubset ?? ''}`;
		if (getTimerStore('scrambleBucket') === bucket) {
			return;
		}

		setTimerParams({
			scrambleBucket: bucket,
			scrambleHistory: EMPTY_SCRAMBLE_HISTORY.history,
			scrambleHistoryIndex: EMPTY_SCRAMBLE_HISTORY.index,
		});

		if (lockedScramble && !timeStartedAt) {
			setTimerParam('scramble', lockedScramble);
			setTimerParam('scrambleLocked', true);
		} else {
			resetScramble(context);
		}
	}, [cubeType, scrambleSubset]);
}

/**
 * Previous / Next over the last few scrambles, plus their Left / Right arrow shortcuts.
 *
 * `locked` is true while navigation must not change the scramble: a running solve, a
 * locked scramble, or a smart cube that has already turned part of it.
 */
export function useScrambleHistory(context: ITimerContext, locked: boolean) {
	const { scramble, cubeType, scrambleSubset, timeStartedAt } = context;
	const smartTurnOffset = context.smartTurnOffset || 0;
	const history = useTimerStore('scrambleHistory') || EMPTY_SCRAMBLE_HISTORY.history;
	const index = useTimerStore('scrambleHistoryIndex') ?? EMPTY_SCRAMBLE_HISTORY.index;

	// Record each scramble that appears. A smart cube correction scramble
	// (smartTurnOffset > 0) is a detour on the current one, not a new entry.
	useEffect(() => {
		if (!scramble || smartTurnOffset !== 0) {
			return;
		}

		const current = readHistory();
		const next = appendScramble(current, scramble);
		if (next !== current) {
			setTimerParams({ scrambleHistory: next.history, scrambleHistoryIndex: next.index });
		}
	}, [scramble]);

	function showHistoryEntry(state: ScrambleHistory, target: number) {
		// Index first: the scramble change then finds itself at the current position and
		// is not recorded a second time.
		setTimerParam('scrambleHistoryIndex', target);
		commitScramble(state.history[target]);
	}

	const goPrevious = useCallback(() => {
		if (locked) return;

		const state = readHistory();
		if (canGoPrevious(state)) {
			showHistoryEntry(state, state.index - 1);
		}
	}, [locked]);

	const nextScrambleRef = useRef(0);
	const goNext = useCallback(() => {
		if (locked) return;

		const state = readHistory();
		if (hasNextInHistory(state)) {
			showHistoryEntry(state, state.index + 1);
			return;
		}

		const ct = getCubeTypeInfoById(cubeType);
		if (!ct) return;
		const callId = ++nextScrambleRef.current;
		commitScramble('');
		getNewScrambleAsync(ct.scramble, scrambleSubset).then((newScramble) => {
			if (callId === nextScrambleRef.current && newScramble) {
				commitScramble(newScramble);
			}
		}).catch((e) => { console.error('[scramble] next failed:', e); });
	}, [locked, cubeType, scrambleSubset]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest('input, textarea')) return;
			if (timeStartedAt) return;
			// Arrows orbit the virtual cube's camera while it is armed, so changing
			// the scramble underneath the solver would be the wrong reading of them.
			if (virtualCubeOwnsKeyboard()) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				goPrevious();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				goNext();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [goPrevious, goNext, timeStartedAt]);

	return {
		goPrevious,
		goNext,
		canGoPrevious: !locked && canGoPrevious({ history, index }),
	};
}
