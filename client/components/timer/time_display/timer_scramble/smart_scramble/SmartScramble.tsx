import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import { processSmartTurns, matchScrambleWithCommutative } from '../../../../../util/smart_scramble';
import { TimerContext } from '../../../Timer';
import { useSettings } from '../../../../../util/hooks/useSettings';
import { getAnyColorStringAsRgb } from '../../../../../util/themes/theme_util';

const b = block('timer-scramble');

// On green-based themes (e.g. Cyberpunk) the scramble text itself is green, so a green
// "matched" highlight is indistinguishable from un-matched moves. Detect a green base
// text color and switch matched moves to blue instead. Themes are stored as raw color
// values (no preset name), so we inspect the color rather than the theme name.
function isGreenBaseColor(colorSetting: string): boolean {
	// getAnyColorStringAsRgb returns a {r,g,b} object (handles both "r, g, b" and hex).
	// NOT getAnyColorStringAsRgbString — that wraps it as "rgb(r, g, b)" which breaks parsing.
	const rgb = getAnyColorStringAsRgb(colorSetting);
	if (!rgb) return false;
	const { r, g, b } = rgb;
	if ([r, g, b].some((n) => Number.isNaN(n))) return false;
	return g > 140 && g >= r * 1.25 && g >= b * 1.25;
}

export default function SmartScramble() {
	const { t } = useTranslation();
	const context = useContext(TimerContext);

	const { smartTurns, scramble, smartCanStart, smartTurnOffset, smartUndoMoves, smartNeedsCubeReset } = context;

	// Only consider turns after the offset (turns before offset are from pre-correction history)
	const offset = smartTurnOffset || 0;
	const relevantTurns = offset > 0 ? smartTurns.slice(offset) : smartTurns;

	const userMoves = processSmartTurns(relevantTurns);
	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Use matching function that handles commutative moves
	const { matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

	// Green-based themes: render matched moves in blue so they stand out from green text.
	const useBlueMatch = isGreenBaseColor(useSettings('text_color'));

	// 8+ wrong moves — reset cube message (fallback — if correction fails)
	if (smartUndoMoves?.length === 1 && smartUndoMoves[0] === 'TOO_MANY') {
		return <span className={b('turn', { red: true })}>{t('smart_scramble.too_many_wrong')}</span>;
	}

	// If undo moves exist — hide algorithm, show only undo moves (centered)
	if (smartUndoMoves?.length && !smartCanStart) {
		return (
			<span className={b('undo-move')}>
				{smartUndoMoves.join(' ')}
			</span>
		);
	}

	let scrambleBody: ReactNode = expectedMoves.map((turn, i) => {
		const status = matchStatus[i];

		const perfect = status === 'perfect';
		const green = perfect && !useBlueMatch;
		const blue = perfect && useBlueMatch;
		const orange = status === 'half';

		return (
			<span
				key={`${turn}-${i}`}
				className={b('turn', {
					green,
					blue,
					orange,
				})}
			>
				{turn}
			</span>
		);
	});

	if (smartNeedsCubeReset) {
		scrambleBody = <span className={b('turn', { orange: true })}>{t('smart_cube.solve_cube_for_scramble')}</span>;
	} else if (smartCanStart) {
		scrambleBody = <span className={b('turn', { green: !useBlueMatch, blue: useBlueMatch })}>{t('smart_scramble.ready')}</span>;
	}

	return <>{scrambleBody}</>;
}
