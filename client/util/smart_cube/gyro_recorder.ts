import { detectCubeRotations, GyroSample } from '../../../shared/smart_cube/gyro_rotations';
import { encodeGyroSamples } from '../../../shared/smart_cube/gyro_codec';
import { ParsedTurn, serializeSmartTurnsCompact } from '../../../shared/smart_cube/parse_turns';

/**
 * Gyroscope history for the solve in progress, turned into `smart_rotations` and `smart_gyro`
 * when it ends (gyroFieldsForSave).
 *
 * Kept outside Redux on purpose: a GAN i4 sends about 11 readings a second, and a dispatch
 * per reading would re-render everything subscribed to the timer.
 *
 * Two clocks meet here. Readings are stamped with Date.now() on arrival; a saved solve's
 * turns are on the timeline the engine fitted from the cube's own timestamps, which can sit
 * a fixed distance off the JS clock. So the arrival time of every turn is logged too, and
 * at save the gap between arrival and fitted time, taken over the solve's own turns, moves
 * the rotations onto the turns' timeline.
 *
 * Subscribing also keeps the manager processing gyro packets while the timer is on screen,
 * whether or not the 3D view is drawing them. The manager is handed in rather than imported:
 * the save side runs from helpers/events.ts, which must not pull the Bluetooth drivers in.
 */

/** The part of the connection manager this needs (connection_manager.ts). */
export interface GyroRecorderSource {
	subscribeGyro(listener: (event: any) => void): () => void;
	subscribeMoves(listener: (batch: { moves: { turn: string }[] }) => void): () => void;
}

/** Ceiling on what is held: about 38 minutes at 11 Hz, far past any solve worth reading. */
const MAX_SAMPLES = 25000;
const MAX_TURNS = 2000;
/**
 * Readings before the first turn. Detection is relative to its first reading, so it must not
 * start in the middle of the rotation a solver often makes right before turning; 1.5 s back
 * it starts from the holding during inspection. The replay also opens on these readings.
 */
const LEAD_IN_MS = 1500;
/** Readings after the last turn, so the replay's last frame has a reading on each side. */
const TAIL_MS = 300;

interface LoggedTurn {
	t: number;
	turn: string;
}

let samples: GyroSample[] = [];
let turnLog: LoggedTurn[] = [];
let holders = 0;
let unsubscribers: (() => void)[] = [];

export function attachGyroRecorder(manager: GyroRecorderSource): () => void {
	holders++;
	if (unsubscribers.length === 0) {
		unsubscribers = [
			manager.subscribeGyro((event: any) => {
				if (event?.type !== 'GYRO' || !event.quaternion) return;
				const { x, y, z, w } = event.quaternion;
				samples.push({ t: Date.now(), x, y, z, w });
				if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
			}),
			manager.subscribeMoves((batch) => {
				const t = Date.now();
				for (const m of batch.moves) turnLog.push({ t, turn: m.turn });
				if (turnLog.length > MAX_TURNS) turnLog.splice(0, turnLog.length - MAX_TURNS);
			}),
		];
	}
	return () => {
		holders--;
		if (holders > 0) return;
		unsubscribers.forEach((u) => u());
		unsubscribers = [];
		samples = [];
		turnLog = [];
	};
}

/**
 * Arrival clock minus the turns' clock, from the solve's turns matched against the end of
 * the arrival log. 0 when they cannot be matched (nothing logged, a different sequence).
 */
function clockOffset(turns: ParsedTurn[]): number {
	const diffs: number[] = [];
	for (let i = 1; i <= Math.min(turns.length, turnLog.length); i++) {
		const solveTurn = turns[turns.length - i];
		const logged = turnLog[turnLog.length - i];
		if (solveTurn.turn !== logged.turn) break;
		diffs.push(logged.t - solveTurn.completedAt);
	}
	if (diffs.length === 0) return 0;
	diffs.sort((a, b) => a - b);
	return diffs[diffs.length >> 1];
}

export interface GyroSaveFields {
	smart_rotations: string | null;
	smart_gyro: string | null;
}

/**
 * The gyro fields for a solve whose turns are serialized from `baseMs`; both null when the
 * cube sent no gyro data. Both are on the turns' timeline and time base.
 *
 * - `smart_rotations`: the rotations detected, from the first turn on. The holding before the
 *   first turn is worked out from the cross (cross_rotation.ts), and a rotation stamped
 *   earlier would be applied on top of it.
 * - `smart_gyro`: the readings themselves (gyro_codec.ts), for the realistic replay. Sent with
 *   the solve but never stored on the device (createSolveDb).
 */
export function gyroFieldsForSave(turns: ParsedTurn[], baseMs: number): GyroSaveFields {
	const none = { smart_rotations: null, smart_gyro: null };
	if (turns.length === 0) return none;
	const offset = clockOffset(turns);
	const first = turns[0].completedAt;
	const last = turns[turns.length - 1].completedAt;
	const window = samples
		.map((s) => ({ ...s, t: s.t - offset }))
		.filter((s) => s.t >= first - LEAD_IN_MS && s.t <= last + TAIL_MS);
	const detected = window.filter((s) => s.t <= last);
	if (detected.length < 2) return none;
	// The turns let the detector confirm fast slices the stream alone misses.
	const rotations = detectCubeRotations(detected, turns).filter((r) => r.completedAt >= first);
	return {
		smart_rotations: serializeSmartTurnsCompact(rotations, baseMs),
		smart_gyro: encodeGyroSamples(window.map((s) => ({ ...s, t: s.t - baseMs }))),
	};
}
