import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import { processSmartTurns, matchScrambleWithCommutative } from '../../../../../util/smart_scramble';
import { TimerContext } from '../../../Timer';

const b = block('timer-scramble');

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

	// 8+ yanlis hamle — kupu coz mesaji (fallback — correction basarisiz olursa)
	if (smartUndoMoves?.length === 1 && smartUndoMoves[0] === 'TOO_MANY') {
		return <span className={b('turn', { red: true })}>{t('smart_scramble.too_many_wrong')}</span>;
	}

	// Undo moves varsa — algoritmayı gizle, sadece undo hamleleri goster (ortali)
	if (smartUndoMoves?.length && !smartCanStart) {
		return (
			<span className={b('undo-move')}>
				{smartUndoMoves.join(' ')}
			</span>
		);
	}

	let scrambleBody: ReactNode = expectedMoves.map((turn, i) => {
		const status = matchStatus[i];

		const green = status === 'perfect';
		const orange = status === 'half';

		return (
			<span
				key={`${turn}-${i}`}
				className={b('turn', {
					green,
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
		scrambleBody = <span className={b('turn', { green: true })}>{t('smart_scramble.ready')}</span>;
	}

	return <>{scrambleBody}</>;
}
