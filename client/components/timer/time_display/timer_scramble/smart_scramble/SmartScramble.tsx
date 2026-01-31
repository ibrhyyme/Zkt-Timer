import React, { ReactNode, useContext } from 'react';
import block from '../../../../../styles/bem';
import { processSmartTurns, reverseScramble, matchScrambleWithCommutative } from '../../../../../util/smart_scramble';
import { TimerContext } from '../../../Timer';

const b = block('timer-scramble');

export default function SmartScramble() {
	const context = useContext(TimerContext);

	const { smartTurns, scramble, smartCanStart } = context;

	const userMoves = processSmartTurns(smartTurns);
	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Use new matching function that handles commutative moves
	const { matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

	// Find failed moves (wrong status)
	const failedMoves: string[] = [];
	const wrongStartIdx = matchStatus.findIndex(s => s === 'wrong');
	if (wrongStartIdx >= 0) {
		// Get user moves that don't match
		const consumedCount = matchStatus.filter(s => s === 'perfect' || s === 'half').length;
		for (let i = consumedCount; i < userMoves.length; i++) {
			failedMoves.push(userMoves[i]);
		}
	}

	let scrambleBody: ReactNode = expectedMoves.map((turn, i) => {
		const status = matchStatus[i];

		let green = status === 'perfect';
		let orange = status === 'half';
		let red = status === 'wrong';

		return (
			<span
				key={`${turn}-${i}`}
				className={b('turn', {
					green,
					orange,
					red,
				})}
			>
				{turn}
			</span>
		);
	});

	if (failedMoves.length) {
		scrambleBody = reverseScramble(failedMoves).map((turn, i) => (
			<span key={`${turn}-${i}`} className={b('turn', { red: true })}>
				{turn}
			</span>
		));
	}

	if (smartCanStart) {
		scrambleBody = <span className={b('turn', { green: true })}>Başlamaya Hazırsın</span>;
	} else if (failedMoves.length > 7) {
		scrambleBody = <span className={b('turn', { red: true })}>Başlamak için küpü çöz</span>;
	}

	return <>{scrambleBody}</>;
}
