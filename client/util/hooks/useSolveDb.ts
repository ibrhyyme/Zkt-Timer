import {useDataContext} from '../../providers/DataProvider';

export function useSolveDb() {
	const { solveDbChangeCounter } = useDataContext();

	return solveDbChangeCounter;
}
