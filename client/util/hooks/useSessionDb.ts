import {useDataContext} from '../../providers/DataProvider';

export function useSessionDb() {
	const { sessionDbChangeCounter } = useDataContext();
	
	return sessionDbChangeCounter;
}
