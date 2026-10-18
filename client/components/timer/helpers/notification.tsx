import React from 'react';
import { NOTIFICATION_TIMEOUT, setTimer, stopTimer } from './timers';
import block from '../../../styles/bem';
import { setTimerParam, setTimerParams } from './params';
import Tag, { TagProps } from '../../common/tag/Tag';
import { getTimerStore } from '../../../util/store/getTimer';

const b = block('timer-notif');

const HIDE_NOTIF_TIMEOUT = 3000;
// The fade-out animation length (`.zt-timer-notif--out`, Timer.scss: 0.3s) plus a frame.
const HIDE_NOTIF_FADE_MS = 350;

// This is for the notification that shows up above the scramble
export function displayTimerAlert(tagProps: TagProps, dontHide?: boolean) {
	setTimerParams({
		notification: (
			<div className={b({ static: dontHide })}>
				<Tag glow {...tagProps} />
			</div>
		),
	});

	stopTimer(NOTIFICATION_TIMEOUT);

	if (dontHide) {
		return;
	}

	setTimer(
		NOTIFICATION_TIMEOUT,
		setTimeout(() => {
			const notification = getTimerStore('notification');

			if (!notification) {
				return;
			}

			const fading = React.cloneElement(notification, {
				className: b({ out: true }),
			});
			setTimerParams({ notification: fading });

			// Dropped once the fade has played. Safe on both layouts: desktop draws it
			// absolutely over the scramble, and mobile now draws it in an out-of-flow
			// layer over the time (Timer.tsx `__notification-zone`, feedback 2.1-a), so
			// removing it moves nothing. It never caught taps anyway (`pointer-events:
			// none` in Timer.scss). Only this fading copy is removed: a newer badge shown
			// in the meantime is a different element and stays.
			setTimer(
				NOTIFICATION_TIMEOUT,
				setTimeout(() => {
					if (getTimerStore('notification') === fading) {
						setTimerParam('notification', null);
					}
				}, HIDE_NOTIF_FADE_MS)
			);
		}, HIDE_NOTIF_TIMEOUT)
	);
}

export function removeTimerNotifications() {
	setTimerParam('notification', null);
}
