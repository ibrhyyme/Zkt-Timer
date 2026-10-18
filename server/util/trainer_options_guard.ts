/**
 * Algorithm trainer settings (Setting.trainer_options) are a `{v, ts, options}` blob written by
 * every device of the account, where `ts` is the time of the change on that device. The client
 * only uploads a copy it believes is newer (client/util/trainer/trainer_options_sync.ts), but two
 * devices can still race: one decides to upload an offline change, the other writes a newer one
 * before that upload lands. The server keeps the newer copy, so an older one can never replace it.
 */

/** Change time of a stored blob; 0 for null, unreadable or legacy (ts less) blobs. */
export function trainerOptionsTs(raw: unknown): number {
	if (typeof raw !== 'string' || raw.length === 0) return 0;
	try {
		const ts = JSON.parse(raw)?.ts;
		return typeof ts === 'number' && Number.isFinite(ts) ? ts : 0;
	} catch {
		return 0;
	}
}

/** True when `incoming` is older than what the server already has, so the write is skipped. */
export function isOlderTrainerOptions(incoming: unknown, stored: unknown): boolean {
	return trainerOptionsTs(incoming) < trainerOptionsTs(stored);
}
