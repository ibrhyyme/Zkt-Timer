import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import { TimerContext } from '../../../Timer';
import { useSettings } from '../../../../../util/hooks/useSettings';
import ScrambleMoveList, { isGreenBaseColor } from './ScrambleMoveList';

const b = block('timer-scramble');

export default function SmartScramble() {
	const { t } = useTranslation();
	const context = useContext(TimerContext);

	const { scramble, smartCanStart, smartUndoMoves, smartNeedsCubeReset, smartOutOfSync, smartMatchStatus } = context;

	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Comes from the shared solve engine. This used to be re-derived here from the raw
	// turn stream, which could disagree with the engine that actually decides when the
	// scramble is done: a stray turn after a solve painted the first move "half done"
	// while the cube sat physically solved.
	const matchStatus = smartMatchStatus || [];

	// Green-based themes: render matched moves in blue so they stand out from green text.
	const useBlueMatch = isGreenBaseColor(useSettings('text_color'));

	// Cube reports a state that is neither solved nor the scramble target (usually a
	// reconnect after the cube was turned with Bluetooth off). Matching moves against
	// the scramble is meaningless until the two agree again, so point at the fix.
	if (smartOutOfSync) {
		return <span className={b('turn', { orange: true })}>{t('smart_scramble.out_of_sync')}</span>;
	}

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

	let scrambleBody: ReactNode = (
		<ScrambleMoveList moves={expectedMoves} matchStatus={matchStatus} useBlueMatch={useBlueMatch} />
	);

	if (smartNeedsCubeReset) {
		scrambleBody = <span className={b('turn', { orange: true })}>{t('smart_cube.solve_cube_for_scramble')}</span>;
	} else if (smartCanStart) {
		scrambleBody = <span className={b('turn', { green: !useBlueMatch, blue: useBlueMatch })}>{t('smart_scramble.ready')}</span>;
	}

	return <>{scrambleBody}</>;
}
