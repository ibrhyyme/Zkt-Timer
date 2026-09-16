import {RootStateOrAny, useSelector} from 'react-redux';
import {SmartCubeStore} from '../../components/timer/@types/interfaces';
import {getStore} from '../../components/store';

/**
 * Reads one field of the smart cube connection slice.
 *
 * The twin of useTimerStore, pointed at reducers/smart_cube.ts. Field by field rather than
 * whole-slice on purpose: the facelets string changes on every turn, and a component that
 * only shows the battery percentage should not re-render for it.
 */
export function useSmartCubeStore<T extends keyof SmartCubeStore>(key: T): SmartCubeStore[T] {
	return useSelector((state: RootStateOrAny) => (state.smartCube as SmartCubeStore)?.[key]);
}

/** Same field, read once at a single moment (no subscription). */
export function getSmartCubeStore<T extends keyof SmartCubeStore>(key: T): SmartCubeStore[T] {
	const slice = (getStore()?.getState()?.smartCube || {}) as SmartCubeStore;
	return slice[key];
}
