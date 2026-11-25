import {TimerStore} from '../../components/timer/@types/interfaces';
import {useSelector} from 'react-redux';

export function useTimerStore<T extends keyof TimerStore>(key: T): TimerStore[T] {
	return useSelector((state: any) => (state.timer as TimerStore)[key]);
}
