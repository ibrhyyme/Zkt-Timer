import {SmartCubeStore, TimerStore} from '../@types/interfaces';
import {setSmartCubeParamsAction, setTimerParamsAction} from '../../../actions/timer';
import {getStore} from '../../store';

export function setTimerParam<T extends keyof TimerStore>(key: T, value: TimerStore[T]) {
	setTimerParams({
		[key]: value,
	});
}

export function setTimerParams(value: Partial<TimerStore>) {
	const dispatch = getStore()?.dispatch;
	if (!dispatch) {
		return;
	}

	dispatch(setTimerParamsAction(value));
}

/**
 * Writes the smart cube connection slice.
 *
 * Kept next to setTimerParams so the two read the same at call sites, but pointed at a
 * slice RESET_TIMER_PARAMS cannot touch. Only the connection manager should call this;
 * see client/util/smart_cube/connection_manager.ts.
 */
export function setSmartCubeParams(value: Partial<SmartCubeStore>) {
	const dispatch = getStore()?.dispatch;
	if (!dispatch) {
		return;
	}

	dispatch(setSmartCubeParamsAction(value));
}
