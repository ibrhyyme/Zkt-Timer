import {useSolveDbChangeCounter} from '../../providers/DataProvider';

export function useSolveDb() {
	const solveDbChangeCounter = useSolveDbChangeCounter();

	return solveDbChangeCounter;
}
