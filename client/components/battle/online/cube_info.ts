import type {BattleCubeInfo} from '../../../../shared/battle/events';
import {smartCubePuzzleFromName} from '../../../../shared/smart_cube/puzzle';

/**
 * Which cube is on the line, as Online Battle needs to know it (design 4.3, Q2).
 *
 * The queue only takes cubes that stamp their moves with their own clock: solve time and
 * every cheat check rest on that clock (design 4.7). GAN (v1 included), QiYi and MoYu32 /
 * WeiLong V10 AI do; Giiker, Particula and the old MoYu do not, the connection manager
 * stamps their moves with the phone clock (`handleMove`).
 *
 * Derived from the advertised name with the same prefixes and the same order as
 * `createCubeForDevice` in `timer/smart_cube/bluetooth/connect.js`. That function builds a
 * protocol object for each branch, so it cannot be called just to read a brand; the test
 * next to this file runs both over a list of names so the two tables cannot drift.
 */

export type BattleCubeBrand = 'gan' | 'qiyi' | 'moyu32' | 'giiker' | 'particula' | 'moyu' | 'unknown';

const CLOCK_BRANDS: readonly BattleCubeBrand[] = ['gan', 'qiyi', 'moyu32'];

export function battleCubeBrand(deviceName: string | null | undefined): BattleCubeBrand {
	const name = deviceName || '';
	const lower = name.toLowerCase();
	if (name.startsWith('Gi') || name.startsWith('Mi Smart Magic Cube') || name.startsWith('Hi-')) return 'giiker';
	if (lower.startsWith('gan') || name.startsWith('MG') || name.startsWith('AiCube')) return 'gan';
	if (name.startsWith('GoCube') || name.startsWith('Rubiks')) return 'particula';
	if (name.startsWith('MHC')) return 'moyu';
	if (name.startsWith('WCU_MY3') || name.startsWith('WCU_MY22') || name.startsWith('^S')) return 'moyu32';
	if (name.startsWith('QY-QYSC') || name.startsWith('XMD-TornadoV4-i')) return 'qiyi';
	return 'unknown';
}

/**
 * `hasClock` is what the queue checks, client and server (server/battle/queue.ts), so a cube
 * that cannot play gets it false and meets the existing "this cube is not supported" path.
 * Battle is a 3x3 event: the 2x2 models (GAN 251 UI, MoYu WCU_MY22) carry a clock but
 * cannot play.
 */
export function battleCubeInfo(deviceName: string | null | undefined): BattleCubeInfo {
	const brand = battleCubeBrand(deviceName);
	const playable = smartCubePuzzleFromName(deviceName) === '333';
	return {brand, hasClock: playable && CLOCK_BRANDS.includes(brand)};
}
