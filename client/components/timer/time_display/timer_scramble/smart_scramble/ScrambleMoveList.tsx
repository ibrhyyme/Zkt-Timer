import React, {useRef} from 'react';
import block from '../../../../../styles/bem';
import type {MatchStatus} from '../../../../../util/smart_cube/solve_engine';
import {getAnyColorStringAsRgb} from '../../../../../util/themes/theme_util';
import {currentMoveIndex, doneCount, moveDisplayState} from './scramble_move_state';

const b = block('timer-scramble');

/**
 * On green-based themes (e.g. Cyberpunk) the scramble text itself is green, so a
 * green "done" confirmation is indistinguishable from an un-matched move. Detect
 * a green base text colour and confirm in blue instead. Themes are stored as raw
 * colour values with no preset name, so the colour is inspected rather than the
 * theme name.
 *
 * Exported because both hosts need it: friendly rooms had no such guard and was
 * painting green on green.
 */
export function isGreenBaseColor(colorSetting: string): boolean {
	// getAnyColorStringAsRgb returns a {r,g,b} object (handles both "r, g, b" and hex).
	// NOT getAnyColorStringAsRgbString — that wraps it as "rgb(r, g, b)" which breaks parsing.
	const rgb = getAnyColorStringAsRgb(colorSetting);
	if (!rgb) return false;
	const {r, g, b: blue} = rgb;
	if ([r, g, blue].some((n) => Number.isNaN(n))) return false;
	return g > 140 && g >= r * 1.25 && g >= blue * 1.25;
}

interface Props {
	moves: string[];
	matchStatus: MatchStatus[];
	/**
	 * Green-based themes render the scramble text itself in green, so a green
	 * confirmation is invisible against it. The host decides, because it is the
	 * one that reads the theme setting.
	 */
	useBlueMatch: boolean;
}

/**
 * The move list of a smart-cube scramble, with the user's position in it.
 *
 * Shared by the timer and by friendly rooms. Deliberately presentational and
 * props-driven: the two hosts wrap it in very different surroundings (rooms has
 * its own oversized READY block, its own correction wording and a physical reset
 * button) and merging those would regress one of them. Only the moves are common.
 *
 * There are no timers here. A move's class follows from where it sits relative to
 * the current position, and adding the "done" class is itself what starts the
 * confirmation animation; the browser runs it to completion without anyone
 * minding it. An earlier version tracked which moves had just finished and cleared
 * them on a timer, which had to fight React tearing the timer down, the engine
 * republishing old progress, and the engine wiping the array on completion. None
 * of those are reachable now.
 *
 * The single piece of memory is the arrival baseline below, and it exists only to
 * tell a fresh confirmation apart from a replayed one.
 */
export default function ScrambleMoveList({moves, matchStatus, useBlueMatch}: Props) {
	const current = currentMoveIndex(matchStatus, moves.length);

	// Moves already finished when this list appeared must not replay their
	// confirmation.
	//
	// Correcting a wrong turn swaps the whole list out for the undo hint and back,
	// which remounts it. Every finished move then gets the done class for the
	// "first" time and the whole line lights up green at once — a burst of
	// confirmations for moves the user made a while ago. The baseline is captured
	// per mount (a remount re-reads it, which is exactly right) and re-taken when
	// the scramble itself changes.
	const movesKey = moves.join(' ');
	const baselineRef = useRef<{key: string; done: number} | null>(null);
	if (!baselineRef.current || baselineRef.current.key !== movesKey) {
		baselineRef.current = {key: movesKey, done: doneCount(matchStatus)};
	}
	const alreadyDoneOnArrival = baselineRef.current.done;

	return (
		<>
			{moves.map((turn, i) => {
				const display = moveDisplayState(i, current);
				const isDone = display === 'past';
				// Finished, but not by an action the user just took — show the end
				// state without the journey to it.
				const settled = isDone && i < alreadyDoneOnArrival;

				return (
					<span
						key={`${turn}-${i}`}
						className={b('turn', {
							orange: matchStatus[i] === 'half',
							// Off the sequence at this move. The solve engine never reports it
							// for the scramble, but the trainer does, so the list can say so.
							red: matchStatus[i] === 'wrong',
							current: display === 'current',
							done: isDone && !settled,
							'done-blue': isDone && !settled && useBlueMatch,
							settled,
						})}
					>
						{turn}
					</span>
				);
			})}
		</>
	);
}
