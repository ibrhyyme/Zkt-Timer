import { processSmartTurns, SmartTurn, matchScrambleWithCommutative } from '../../../util/smart_scramble';

export function preflightChecks(smartTurns: SmartTurn[], scramble: string) {
	const userMoves = processSmartTurns(smartTurns);
	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Use new matching function that handles commutative moves
	const { matched } = matchScrambleWithCommutative(expectedMoves, userMoves);
	return matched;
}
