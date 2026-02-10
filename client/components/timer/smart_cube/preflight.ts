import { processSmartTurns, SmartTurn, matchScrambleWithCommutative } from '../../../util/smart_scramble';

export function preflightChecks(smartTurns: SmartTurn[], scramble: string, turnOffset: number = 0) {
	const relevantTurns = turnOffset > 0 ? smartTurns.slice(turnOffset) : smartTurns;
	const userMoves = processSmartTurns(relevantTurns);
	const expectedMoves = scramble.split(' ').filter(m => m.trim());

	// Use new matching function that handles commutative moves
	const { matched } = matchScrambleWithCommutative(expectedMoves, userMoves);
	return matched;
}
