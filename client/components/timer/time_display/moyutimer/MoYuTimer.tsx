// MoYu Timer — React wrapper for cstimer "MoYuTimer" mode.
//
// In cstimer, MoYu Timer is listed as a separate timer mode (timer.js
// PROPERTY_ENTERING_STR: 'timer|typing|stackmat|MoYuTimer|...'), sharing code:
// in hardware/stackmat.js when curTimer === 'm', sample_rate = 8000 Hz and
// bitAnalyzer = appendBitMoyu (24-bit BCD) is used.
//
// In our port, the shared StackMat component accepts a `mode` prop; MoYuTimer
// just renders <StackMat mode="m" />. Audio dispatch and inspection
// callbacks are the same.

import React from 'react';
import StackMat from '../stackmat/StackMat';

export default function MoYuTimer() {
	return <StackMat mode="m" />;
}
