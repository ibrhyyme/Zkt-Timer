/**
 * Megaminx random-state scramble generator.
 * Ported from cstimer scramble/megaminx.js (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Registers: mgmso (Megaminx random-state)
 */

import { rn, rndPerm } from '../lib/mathlib';
import { registerGenerator } from '../registry';
import { MgmCubie, solveMgmCubie } from '../solvers/megaminx-solver';

function getMegaScramble(): string {
	const cc = new MgmCubie();
	cc.corn = rndPerm(20, true);
	cc.edge = rndPerm(30, true);
	let chksum = 60;
	for (let i = 0; i < 19; i++) {
		const t = rn(3);
		cc.twst[i] = t;
		chksum -= t;
	}
	cc.twst[19] = chksum % 3;
	let flipsum = 0;
	for (let i = 0; i < 29; i++) {
		const t = rn(2);
		cc.flip[i] = t;
		flipsum ^= t;
	}
	cc.flip[29] = flipsum;
	return solveMgmCubie(cc, true);
}

registerGenerator('mgmso', () => getMegaScramble());
