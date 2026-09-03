import {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {setGeneral} from '../../actions/general';
import {useGeneral} from './useGeneral';
import {isMobileViewport} from '../is-mobile-viewport';

/**
 * Keeps the global `mobile_mode` flag in step with the viewport.
 *
 * Inside the App shell this is handled by HeaderNav and Nav, so pages there never
 * need it. The landing shell has neither, which left `mobile_mode` stuck at false
 * for every page it hosts — and anything gated on it (the edge drawer notches, for
 * one) simply never rendered there.
 *
 * The same threshold currently lives in HeaderNav.windowResize and Nav; those two
 * copies should be folded into this hook rather than a third being written.
 */
export function useMobileModeSync() {
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	useEffect(() => {
		if (typeof window === 'undefined') return;

		function sync() {
			const shouldBeMobile = isMobileViewport();
			if (shouldBeMobile !== mobileMode) {
				dispatch(setGeneral('mobile_mode', shouldBeMobile));
			}
		}

		sync();
		window.addEventListener('resize', sync);
		return () => window.removeEventListener('resize', sync);
	}, [dispatch, mobileMode]);
}
