import {useDataContext} from '../../providers/DataProvider';

export function useTrainerDb() {
	const { trainerDbChangeCounter } = useDataContext();

	return trainerDbChangeCounter;
}
