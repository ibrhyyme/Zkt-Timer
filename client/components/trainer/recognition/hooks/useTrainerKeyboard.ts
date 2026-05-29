/**
 * useTrainerKeyboard — PLL letter state machine.
 * Reference: port of `composables/useTrainerKeyboard.js`.
 *
 * Rules:
 *   - Ignore if modal open or note input focused
 *   - fullNameMode + pending prefix → wait for suffix (validPllSuffixes)
 *   - Escape → pause, Space → resume, A-Z → submitAnswer
 *   - Help keys (-, F1, ?, s, S, /) → giveUpOnCase
 *   - Shift+C → cheat (debug)
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {useKeydown} from './useKeydown';
import {
	isHelpKey,
	isPllLetter,
	isSingleLetterPll,
	isTwoLetterPllPrefix,
	validPllSuffixes,
} from '../../../../util/trainer/recognition/pll_constants';
import {useRecognitionContext, useCurrentCase} from '../RecognitionContext';

export function useTrainerKeyboard(): {pendingKey: string | null} {
	const {state, pausePlay, resumePlay, submitAnswer, giveUpOnCase} = useRecognitionContext();
	const currentCase = useCurrentCase();
	const [pendingKey, setPendingKey] = useState<string | null>(null);

	// Clear pendingKey when case changes
	useEffect(() => {
		setPendingKey(null);
	}, [currentCase]);

	const fullNameMode = state.settings.fullNameMode;
	const showResultsModal = state.session.showResultsModal;

	// Ref for latest values (useKeydown dependencies)
	const stateRef = useRef({fullNameMode, showResultsModal, pendingKey, currentCase});
	useEffect(() => {
		stateRef.current = {fullNameMode, showResultsModal, pendingKey, currentCase};
	}, [fullNameMode, showResultsModal, pendingKey, currentCase]);

	const handler = useCallback(
		(e: KeyboardEvent) => {
			const {fullNameMode: fNM, showResultsModal: sRM, pendingKey: pK, currentCase: cC} = stateRef.current;

			// Modal open or note input focused
			if (
				document.querySelector('.modal.show') ||
				sRM ||
				document.querySelector('.noteInput:focus') ||
				document.querySelector('input:focus, textarea:focus')
			) {
				return;
			}

			const withModifiers = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;

			// fullNameMode + pendingKey buffer mode
			if (fNM && pK) {
				if (!withModifiers && e.key === 'Escape') {
					setPendingKey(null);
					pausePlay();
					e.preventDefault();
					return;
				}
				if (!withModifiers && e.key === 'Backspace') {
					setPendingKey(null);
					e.preventDefault();
					return;
				}
				if (!withModifiers && isHelpKey(e.key)) {
					setPendingKey(null);
					giveUpOnCase();
					e.preventDefault();
					return;
				}
				if (!withModifiers) {
					const suffix = e.key.toLowerCase();
					const suffixes = validPllSuffixes[pK];
					if (suffixes && suffixes.includes(suffix)) {
						const fullName = pK + suffix;
						submitAnswer(fullName, true);
						setPendingKey(null);
						e.preventDefault();
						return;
					}
					e.preventDefault();
					return;
				}
			}

			// Default mode
			if (!withModifiers && e.key === 'Escape') {
				setPendingKey(null);
				pausePlay();
				e.preventDefault();
				return;
			}
			if (!withModifiers && e.key === ' ') {
				resumePlay();
				e.preventDefault();
				return;
			}
			if (!withModifiers && isPllLetter(e.key.toUpperCase())) {
				const letter = e.key.toUpperCase();
				if (fNM) {
					if (isSingleLetterPll(letter)) {
						submitAnswer(letter, true);
					} else if (isTwoLetterPllPrefix(letter)) {
						setPendingKey(letter);
					}
				} else {
					submitAnswer(letter);
				}
				e.preventDefault();
				return;
			}
			if (!withModifiers && isHelpKey(e.key)) {
				giveUpOnCase();
				e.preventDefault();
				return;
			}
			if (e.shiftKey && e.key === 'C' && !e.altKey && !e.ctrlKey && !e.metaKey && cC) {
				if (fNM) {
					submitAnswer(cC.name, true);
				} else {
					submitAnswer(cC.name[0]);
				}
				e.preventDefault();
				return;
			}
		},
		[pausePlay, resumePlay, submitAnswer, giveUpOnCase]
	);

	useKeydown(handler);

	return {pendingKey};
}
