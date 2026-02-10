import React, { ReactNode, useContext } from 'react';
import block from '../../../../../styles/bem';
import { processSmartTurns, matchScrambleWithCommutative } from '../../../../../util/smart_scramble';
import { TimerContext } from '../../../Timer';

const b = block('timer-scramble');

export default function SmartScramble() {
	const context = useContext(TimerContext);

	const { smartTurns, scramble, smartCanStart, smartTurnOffset } = context;

	// Only consider turns after the offset (turns before offset are from pre-correction history)
	const offset = smartTurnOffset || 0;
	const relevantTurns = offset > 0 ? smartTurns.slice(offset) : smartTurns;

	const userMoves = processSmartTurns(relevantTurns);
	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Use matching function that handles commutative moves
	const { matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

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

	if (smartCanStart) {
		scrambleBody = <span className={b('turn', { green: true })}>Başlamaya Hazırsın</span>;
	}

	return <>{scrambleBody}</>;
}
