// MoYu Timer — cstimer "MoYuTimer" mode'unun React wrapper'i.
//
// cstimer'da MoYu Timer ayri bir timer mode olarak listeleniyor (timer.js
// PROPERTY_ENTERING_STR: 'timer|typing|stackmat|MoYuTimer|...'), kodu paylasiyor:
// hardware/stackmat.js icinde curTimer === 'm' iken sample_rate = 8000 Hz ve
// bitAnalyzer = appendBitMoyu (24-bit BCD) kullaniliyor.
//
// Bizim port'umuzda ortak StackMat component'i `mode` prop'u alir; MoYuTimer
// sadece <StackMat mode="m" /> render eder. Audio dispatch ve inspection
// callback'leri aynidir.

import React from 'react';
import StackMat from '../stackmat/StackMat';

export default function MoYuTimer() {
	return <StackMat mode="m" />;
}
