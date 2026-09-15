import {useSessionDbChangeCounter} from '../../providers/DataProvider';

export function useSessionDb() {
	const sessionDbChangeCounter = useSessionDbChangeCounter();
	
	return sessionDbChangeCounter;
}
