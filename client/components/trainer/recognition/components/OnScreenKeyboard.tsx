/**
 * OnScreenKeyboard — mobil PLL buton grid.
 * 13 letter modu veya 21 full-name modu. 300ms button feedback.
 * Mobile viewport tespiti: <1024px ise settings ne olursa olsun zorunlu göster.
 */
import React, {useEffect, useRef, useState} from 'react';
import block from '../../../../styles/bem';
import {PLL_LETTERS} from '../../../../util/trainer/recognition/pll_constants';
import {GameState} from '../../../../util/trainer/recognition/game_constants';
import {useRecognitionContext} from '../RecognitionContext';
import {useBreakpoint} from '../hooks/useBreakpoint';

const b = block('trainer-recognition');

const FULL_NAME_ROWS: string[][] = [
	['Aa', 'Ab', 'E', 'F', 'Ga', 'Gb', 'Gc'],
	['Gd', 'H', 'Ja', 'Jb', 'Na', 'Nb', 'Ra'],
	['Rb', 'T', 'Ua', 'Ub', 'V', 'Y', 'Z'],
];

interface ButtonFeedback {
	key: string | null;
	type: 'correct' | 'wrong' | null;
}

export default function OnScreenKeyboard() {
	const {state, lastSubmission, submitAnswer} = useRecognitionContext();
	const [feedback, setFeedback] = useState<ButtonFeedback>({key: null, type: null});
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isMobileViewport = useBreakpoint('(max-width: 1023px)');

	useEffect(() => {
		if (!lastSubmission) return;
		setFeedback({key: lastSubmission.key, type: lastSubmission.type});
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			setFeedback({key: null, type: null});
		}, 300);
	}, [lastSubmission]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	// Mobilde her zaman göster; desktop'ta sadece settings true ise
	const shouldShow = isMobileViewport || state.settings.showOnScreenKeyboard;
	if (!shouldShow) return null;
	if (state.session.state !== GameState.Playing) return null;

	function buttonClass(key: string, extra?: 'fullname'): string {
		const mods: Record<string, boolean> = {};
		if (extra) mods[extra] = true;
		if (feedback.key === key && feedback.type) mods[feedback.type] = true;
		return b('keyboard-btn', mods);
	}

	function handleAnswer(answer: string, fullName: boolean = false) {
		submitAnswer(answer, fullName);
	}

	if (state.settings.fullNameMode) {
		return (
			<div className={b('keyboard')}>
				<div className={b('keyboard-fullname-stack')}>
					{FULL_NAME_ROWS.map((row, i) => (
						<div key={i} className={b('keyboard-row')}>
							{row.map((name) => (
								<button
									key={name}
									type="button"
									className={buttonClass(name, 'fullname')}
									onClick={() => handleAnswer(name, true)}
								>
									{name}
								</button>
							))}
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={b('keyboard')}>
			{PLL_LETTERS.map((letter) => (
				<button
					key={letter}
					type="button"
					className={buttonClass(letter)}
					onClick={() => handleAnswer(letter)}
				>
					{letter}
				</button>
			))}
		</div>
	);
}
