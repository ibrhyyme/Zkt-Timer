import {configure} from 'react-hotkeys';
import {getTimerStore} from '../../../util/store/getTimer';
import {virtualCubeOwnsKeyboard} from './virtual_cube';

export function configureHotkeys() {
	configure({
		ignoreTags: ['input', 'select', 'textarea'],
		// configure() runs once, but the predicate is evaluated per event, so it
		// reads live state rather than whatever was true at boot.
		ignoreEventsCondition: (e: any) => {
			if (e && e.target && ['input', 'select', 'textarea'].indexOf(e.target.localName) > -1) {
				return true;
			}

			// HOTKEY_MAP binds bare '1', '2', '3' and 'i'. On the virtual cube those
			// are S', E, a slice offset and R, and they are live during the whole
			// armed window — which is exactly when `timeStartedAt` is still null and
			// the check below would let them through.
			if (virtualCubeOwnsKeyboard()) {
				return true;
			}

			const timeStartedAt = getTimerStore('timeStartedAt');
			return timeStartedAt !== null;
		},
	});
}
