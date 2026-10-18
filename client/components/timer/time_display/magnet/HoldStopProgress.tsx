import React, { useState } from 'react';
import block from '../../../../styles/bem';
import { HOLD_STOP_MS } from '../../../../util/magnet-start/hold_stop';
import { useHoldStopPress } from '../../../../util/magnet-start/hold_stop_store';

const b = block('time-display');

function Fill({ pressedAt }: { pressedAt: number }) {
	// The fill runs from the press, not from this render: a negative delay skips the part
	// already held, so the bar is full exactly when KeyWatcher's timeout stops the solve.
	// Fixed at mount: a changing delay would make a running animation jump.
	const [delayMs] = useState(() => -Math.min(Math.max(Date.now() - pressedAt, 0), HOLD_STOP_MS));
	return (
		<span
			className={b('hold-fill')}
			style={{ animationDuration: `${HOLD_STOP_MS}ms`, animationDelay: `${delayMs}ms` }}
		/>
	);
}

/**
 * Magnet Timer hold to stop: a bar under the digits that fills while a finger is held still
 * on the timer (KeyWatcher beginHoldStop). Zero height in the flow, so it never moves the
 * digits. Memoised: the display re-renders on every tick of a running solve.
 */
function HoldStopProgress() {
	const press = useHoldStopPress();
	if (!press) return null;
	return (
		<div className={b('hold')} aria-hidden="true">
			<div className={b('hold-track')}>
				<Fill key={press.id} pressedAt={press.pressedAt} />
			</div>
		</div>
	);
}

export default React.memo(HoldStopProgress);
