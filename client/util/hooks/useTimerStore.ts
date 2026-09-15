import {TimerStore} from '../../components/timer/@types/interfaces';
import {RootStateOrAny, useSelector} from 'react-redux';

export function useTimerStore<T extends keyof TimerStore>(key: T): TimerStore[T] {
	return useSelector((state: RootStateOrAny) => (state.timer as TimerStore)[key]);
}

/**
 * Whether the smart cube has recorded any turn. A boolean on purpose: it changes on the
 * first turn and when the list is cleared, where the list itself changes on every turn.
 */
export function useHasSmartTurns(): boolean {
	return useSelector((state: RootStateOrAny) => ((state.timer as TimerStore).smartTurns?.length ?? 0) > 0);
}
