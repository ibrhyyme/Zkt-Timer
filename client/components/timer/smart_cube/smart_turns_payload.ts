import { ParsedTurn, serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';

/**
 * The `smart_turns` value a smart cube solve is saved with, for both ways a smart solve
 * ends: the normal stop and "abandon, save as DNF" (feedback E-2, which used to send the
 * full JSON objects for everyone).
 *
 * - Pro only. Move reconstruction is a Pro feature; a free user's solve carries no turns
 *   (the server clears them anyway, Solve.resolver.ts, but they should not be sent).
 * - Compact `turn@ms` format with the first move as 0. The moves' `completedAt` are
 *   absolute local stamps, and the BLE clock can drift from the JS clock, so the offset
 *   is taken from the first move rather than from the timer start.
 */
export function smartTurnsForSave(moves: ParsedTurn[], isPro: boolean): string | null {
	if (!isPro) return null;

	const baseMs = moves.length > 0 ? moves[0].completedAt : 0;
	return serializeSmartTurnsCompact(
		moves.map((m) => ({
			turn: m.turn,
			completedAt: m.completedAt - baseMs,
		})),
		0
	);
}
