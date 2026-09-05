import LZString from './lz_string';
import aes128 from './ae128';

/**
 * GAN Gen1 protocol driver — a 1:1 port of cstimer's `gancube.js` v1 path (`getKey`,
 * `decode`, `checkState`, `updateMoveTimes` and the `loopRead` parsing).
 *
 * First-generation cubes (GAN 356i and friends) predate the notification-based protocols:
 * nothing is pushed, every value is read on demand. `GanCubeV1PollingConnection` in
 * `gan.js` owns the polling; this file owns the parsing and the bookkeeping and touches no
 * BLE, no Redux and no DOM.
 *
 * It lives outside `gan.js` for one reason: `gan.js` pulls in the Redux store, so it cannot
 * be imported from a test. Gen1 is the one generation we have no cube for, which makes unit
 * tests the only verification the port gets — see `__tests__/gan_v1_driver.test.ts`.
 *
 * The events it produces have the same shape as the Gen2/3/4 drivers', so
 * `GAN.handleCubeEvent` consumes a Gen1 cube without knowing it is one.
 */

/**
 * Gen1 encryption keys, taken verbatim from cstimer (`gancube.js` KEYS[0] and KEYS[1]).
 *
 * Gen1 derives its AES key from the cube's own hardware characteristic rather than from a
 * MAC address, which is why a Gen1 cube connects without ever asking the user for a MAC.
 * `initDecoder` picks the entry by firmware version and salts it with those 6 bytes.
 */
export const GAN_V1_KEYS = [
	'NoRgnAHANATADDWJYwMxQOxiiEcfYgSK6Hpr4TYCs0IG1OEAbDszALpA',
	'NoNg7ANATFIQnARmogLBRUCs0oAYN8U5J45EQBmFADg0oJAOSlUQF0g',
];

/**
 * How many moves may pass before the cube's own facelet state is read back.
 *
 * Gen1 has no state notification: the state characteristic is polled, and cstimer only
 * pays for that read every 50 moves. Same figure here so the traffic on the wire matches
 * the reference implementation.
 */
export const GAN_GEN1_STATE_CHECK_INTERVAL = 50;

/** A MOVE event, shaped exactly like the ones the Gen2/3/4 drivers emit. */
export interface GanGen1MoveEvent {
	type: 'MOVE';
	serial: number;
	timestamp: number;
	localTimestamp: number | null;
	cubeTimestamp: number;
	move: string;
}

/**
 * Is this firmware one the key derivation covers? cstimer supports exactly this range;
 * anything else uses a key scheme we do not have.
 */
export function isSupportedGen1Version(version: number): boolean {
	return version > 0x010007 && (version & 0xfffe00) == 0x010000;
}

export default class GanGen1ProtocolDriver {
	decoder: any = null;
	/** Last 6 moves as reported by the cube, newest first (cstimer `prevMoves`). */
	prevMoves: string[] = [];
	/** Inter-move time offsets, newest first (cstimer `timeOffs`). */
	timeOffs: number[] = [];
	deviceTime = 0;
	deviceTimeOffset = 0;
	moveCnt = -1;
	prevMoveCnt = -1;
	/**
	 * Starts high so the very first poll reads the cube's state instead of waiting
	 * 50 moves for it. cstimer uses the same 1000.
	 */
	movesFromLastCheck = 1000;

	/**
	 * cstimer `getKey()` — 1:1 port.
	 *
	 * The key is chosen by firmware version and salted with the 6 bytes of the hardware
	 * characteristic. No MAC address is involved, which is why a Gen1 cube never prompts
	 * for one. Returns false when the firmware has no key entry.
	 */
	initDecoder(version: number, hardwareValue: DataView): boolean {
		const compressed = GAN_V1_KEYS[(version >> 8) & 0xff];
		if (!compressed) {
			return false;
		}
		const key = JSON.parse(LZString.decompressFromEncodedURIComponent(compressed));
		for (let i = 0; i < 6; i++) {
			key[i] = (key[i] + hardwareValue.getUint8(5 - i)) & 0xff;
		}
		this.decoder = aes128(key);
		return true;
	}

	/**
	 * cstimer `decode()` — 1:1 port.
	 *
	 * Gen1 never sets an IV, so the `iv` terms below are always zero and the XORs are
	 * no-ops. They are kept so this reads as the reference implementation does; dropping
	 * them would make a later diff against cstimer harder, not the code faster.
	 */
	decode(value: DataView): number[] {
		const ret: number[] = [];
		for (let i = 0; i < value.byteLength; i++) {
			ret[i] = value.getUint8(i);
		}
		if (this.decoder == null) {
			return ret;
		}
		const iv = this.decoder.iv || [];
		if (ret.length > 16) {
			const offset = ret.length - 16;
			const block = this.decoder.decrypt(ret.slice(offset));
			for (let i = 0; i < 16; i++) {
				ret[i + offset] = block[i] ^ ~~iv[i];
			}
		}
		this.decoder.decrypt(ret);
		for (let i = 0; i < 16; i++) {
			ret[i] ^= ~~iv[i];
		}
		return ret;
	}

	/**
	 * cstimer `checkState()` facelet unpacking — 1:1 port.
	 * 48 facelets at 3 bits each; the six centres are implied by their face index.
	 */
	parseFacelets(value: number[]): string {
		const state: string[] = [];
		for (let i = 0; i < value.length - 2; i += 3) {
			const face = (value[i ^ 1] << 16) | (value[(i + 1) ^ 1] << 8) | value[(i + 2) ^ 1];
			for (let j = 21; j >= 0; j -= 3) {
				state.push('URFDLB'.charAt((face >> j) & 0x7));
				if (j == 12) {
					state.push('URFDLB'.charAt(i / 3));
				}
			}
		}
		return state.join('');
	}

	/**
	 * cstimer `loopRead()` move-characteristic parsing — 1:1 port.
	 * Returns false when the counter has not advanced, i.e. nothing to do this round.
	 */
	parseMoves(value: number[]): boolean {
		this.moveCnt = value[12];
		if (this.moveCnt == this.prevMoveCnt) {
			return false;
		}
		this.prevMoves = [];
		for (let i = 0; i < 6; i++) {
			const m = value[13 + i];
			this.prevMoves.unshift('URFDLB'.charAt(~~(m / 3)) + " 2'".charAt(m % 3));
		}
		return true;
	}

	/** cstimer `loopRead()` time-characteristic parsing — 1:1 port. */
	parseTimeOffsets(value: number[]): void {
		this.timeOffs = [];
		for (let i = 0; i < 9; i++) {
			const off = value[i * 2 + 1] | (value[i * 2 + 2] << 8);
			this.timeOffs.unshift(off);
		}
	}

	/** Is a state read due? cstimer gates the poll on the same counter. */
	get needsStateCheck(): boolean {
		return this.movesFromLastCheck >= GAN_GEN1_STATE_CHECK_INTERVAL;
	}

	/**
	 * Record a state read. cstimer's `checkState()` bookkeeping, minus the BLE call.
	 *
	 * Returns true when this was the initial sync (cstimer `initCubeState`): the move
	 * counter is adopted without replaying anything, so the moves the cube made before we
	 * connected are not handed to the app as if they had just happened.
	 */
	applyStateRead(): boolean {
		this.movesFromLastCheck = 0;
		if (this.prevMoveCnt == -1) {
			this.prevMoveCnt = this.moveCnt;
			return true;
		}
		return false;
	}

	/**
	 * cstimer `updateMoveTimes()` — 1:1 port, emitting our MOVE events instead of calling
	 * back with a facelet string. The tracker in `GAN.handleCubeEvent` applies the moves,
	 * exactly as it does for Gen2/3/4.
	 */
	updateMoveTimes(locTime: number): GanGen1MoveEvent[] {
		const events: GanGen1MoveEvent[] = [];
		let moveDiff = (this.moveCnt - this.prevMoveCnt) & 0xff;
		if (moveDiff > 1) {
			console.warn('[ZKT:GAN-V1] bluetooth event was lost, moveDiff =', moveDiff);
		}
		this.prevMoveCnt = this.moveCnt;
		this.movesFromLastCheck += moveDiff;
		if (moveDiff > this.prevMoves.length) {
			// More moves happened than the cube can report. The rest are unrecoverable, so
			// force a state read to re-anchor rather than guess at them.
			this.movesFromLastCheck = GAN_GEN1_STATE_CHECK_INTERVAL;
			moveDiff = this.prevMoves.length;
		}
		let calcTs = this.deviceTime + this.deviceTimeOffset;
		for (let i = moveDiff - 1; i >= 0; i--) {
			calcTs += this.timeOffs[i];
		}
		if (!this.deviceTime || Math.abs(locTime - calcTs) > 2000) {
			this.deviceTime += locTime - calcTs;
		}
		for (let i = moveDiff - 1; i >= 0; i--) {
			this.deviceTime += this.timeOffs[i];
			events.push({
				type: 'MOVE',
				serial: (this.moveCnt - i) & 0xff,
				timestamp: locTime,
				// Only the newest move of a batch carries a local timestamp, matching the
				// Gen2 driver: the older ones were not observed when they happened.
				localTimestamp: i == 0 ? locTime : null,
				cubeTimestamp: this.deviceTime,
				move: this.prevMoves[i].trim(),
			});
		}
		this.deviceTimeOffset = locTime - this.deviceTime;
		return events;
	}
}
