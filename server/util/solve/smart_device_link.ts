import type {PrismaClient} from '@prisma/client';
import {logger} from '../../services/logger';

/**
 * Which smart device row a solve may point at.
 *
 * `solve.smart_device_id` is a foreign key to `smart_device.id`, a uuid the server hands out
 * when the app registers a cube (addNewSmartDevice). The app does not always know that id.
 * When a cube connects without a connection, or for a signed-out visitor, the lookup cannot
 * run and the app records the cube's BLE identifier instead, the value the device row keeps
 * in `smart_device.device_id` (client/util/smart_cube/connection_manager.ts handleConnected).
 *
 * Written as is, that value broke the foreign key. formatError reported it as INTERNAL, the
 * offline queue could not tell that from a passing fault and retried the solve for ever, and
 * on the bulk path the one row took every solve in its chunk down with it, on every launch.
 * Nothing checked the owner either, so a solve could be hung on another account's device and
 * its card then showed that device's name.
 *
 * The rule, on every path that writes the column (createSolve, bulkCreateSolves, updateSolve):
 * - the id of one of the caller's own devices is kept;
 * - the BLE identifier of one of the caller's own devices becomes that device's row id;
 * - anything else (an unknown value, another account's row, an empty string) becomes null.
 * A solve is never refused over this field: the link is a label, the solve is the data.
 *
 * Kept out of the resolvers so the planned physical cube link (cube_id, the "My Cubes" design,
 * section 3.3) can join this same pass instead of growing a second one next to it.
 */

export interface SmartDeviceLinkRow {
	id?: string | null;
	smart_device_id?: string | null;
}

/** One of the caller's device rows, as much of it as the decision needs. */
export interface OwnedSmartDevice {
	id: string;
	device_id: string | null;
	created_at: Date | string | null;
}

export interface SmartDeviceLinkReport {
	/** Solves whose BLE identifier was swapped for the caller's device row id. */
	relinked: (string | null)[];
	/** Solves whose value matched none of the caller's devices and was cleared. */
	cleared: (string | null)[];
}

/** The distinct values worth looking up: present, and not empty. */
export function requestedSmartDeviceIds(rows: SmartDeviceLinkRow[]): string[] {
	const values = new Set<string>();
	for (const row of rows) {
		const value = row?.smart_device_id;
		if (typeof value === 'string' && value) {
			values.add(value);
		}
	}
	return [...values];
}

function createdAtMs(device: OwnedSmartDevice): number {
	const ms = device.created_at ? new Date(device.created_at).getTime() : NaN;
	return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

function oldestFirst(a: OwnedSmartDevice, b: OwnedSmartDevice): number {
	return createdAtMs(a) - createdAtMs(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * What each requested value is stored as. Pure; `owned` must hold the caller's rows only,
 * which is what makes a value that names another account's device come out as null.
 */
export function resolveSmartDeviceIds(requested: string[], owned: OwnedSmartDevice[]): Map<string, string | null> {
	const ownIds = new Set(owned.map((device) => device.id));

	// Two rows can carry the same BLE identifier (two connects whose lookups crossed). The
	// app's own lookup takes the first row the server lists, in practice the oldest, so the
	// same row wins here and every solve of that cube lands on one row.
	const byBleId = new Map<string, string>();
	for (const device of [...owned].sort(oldestFirst)) {
		if (device.device_id && !byBleId.has(device.device_id)) {
			byBleId.set(device.device_id, device.id);
		}
	}

	const resolved = new Map<string, string | null>();
	for (const value of requested) {
		resolved.set(value, ownIds.has(value) ? value : byBleId.get(value) ?? null);
	}
	return resolved;
}

/**
 * Writes the resolved values onto the rows, in place. A row without the field (undefined) or
 * with null is left alone: on an update those mean "unchanged" and "unlink", both valid.
 */
export function applySmartDeviceIds(
	rows: SmartDeviceLinkRow[],
	resolved: Map<string, string | null>
): SmartDeviceLinkReport {
	const report: SmartDeviceLinkReport = {relinked: [], cleared: []};

	for (const row of rows) {
		const value = row?.smart_device_id;
		if (value === undefined || value === null) continue;

		const next = (typeof value === 'string' && value && resolved.get(value)) || null;
		if (next === value) continue;

		row.smart_device_id = next;
		(next ? report.relinked : report.cleared).push(row.id ?? null);
	}

	return report;
}

/** At most this many solve ids go into one log line. */
const LOGGED_SOLVE_IDS = 20;

/**
 * The whole pass: one query for the caller's devices matching any requested value, by row id
 * or by BLE identifier, then the rows are corrected in place. Asks nothing of the database when
 * no row carries a value. `source` names the mutation in the log line.
 */
export async function sanitizeSmartDeviceLinks(
	prisma: Pick<PrismaClient, 'smartDevice'>,
	userId: string,
	rows: SmartDeviceLinkRow[],
	source: string
): Promise<SmartDeviceLinkReport> {
	const requested = requestedSmartDeviceIds(rows);

	const owned: OwnedSmartDevice[] = requested.length
		? await prisma.smartDevice.findMany({
				where: {
					user_id: userId,
					OR: [{id: {in: requested}}, {device_id: {in: requested}}],
				},
				select: {id: true, device_id: true, created_at: true},
		  })
		: [];

	const report = applySmartDeviceIds(rows, resolveSmartDeviceIds(requested, owned));

	if (report.relinked.length || report.cleared.length) {
		// Not a fault: a cube connected offline is expected to send its BLE identifier. The line
		// is what shows how often it happens and which accounts it reaches.
		logger.warn('Solve smart device link repaired', {
			userId,
			source,
			relinkedCount: report.relinked.length,
			clearedCount: report.cleared.length,
			solveIds: [...report.relinked, ...report.cleared].slice(0, LOGGED_SOLVE_IDS),
		});
	}

	return report;
}
