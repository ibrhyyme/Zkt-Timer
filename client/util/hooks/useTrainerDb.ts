import {useTrainerDbChangeCounter} from '../../providers/DataProvider';

export function useTrainerDb() {
	const trainerDbChangeCounter = useTrainerDbChangeCounter();

	return trainerDbChangeCounter;
}
