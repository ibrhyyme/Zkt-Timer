import React from 'react';
import { gql } from '@apollo/client/core';
import { gqlMutate } from '../../components/api';
import { getSolveDb } from './init';
import { emitEvent } from '../../util/event_handler';
import { clearSolveStatCache, clearSolveStatCacheForSession } from './stats/solves/caching';
import { getStore } from '../../components/store';
import { openModal } from '../../actions/general';
import ConfirmModal from '../../components/common/confirm_modal/ConfirmModal';
import { checkForPB } from './stats/solves/pb';
import { saveLokiDb, updateOfflineHash } from '../../components/layout/offline';
import { getSetting } from '../settings/query';
import { Solve } from '../../../server/schemas/Solve.schema';
import { checkForWorst } from './stats/solves/worst';
import { sanitizeSolve } from '../../../shared/solve';
import { checkForCurrentAverageUpdate } from './stats/solves/cache/average_cache';
import { fetchLastSolve, buildBucketFilter } from './query';
import { setTimerParam } from '../../components/timer/helpers/params';
import { addToQueue } from '../../util/offline-queue';
import { toastInfo } from '../../util/toast';
import { canReadSync, canWriteSync } from '../../lib/sync-gate';
import { syncAnonSolveCount } from '../../util/anon-mode';
import { addSolveTombstones } from '../../util/solve-tombstones';
import { recordDeletedSolves } from '../../components/daily-goal/helpers/deleted-solves';
import { stripLokiJsMetadata } from '../lokijs';

let offlineToastShown = false;
let queuedToastShown = false;
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		offlineToastShown = false;
		queuedToastShown = false;
	});
}

function showOfflineToastOnce() {
	if (!offlineToastShown) {
		toastInfo('Çözüm offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
		offlineToastShown = true;
	}
}

/**
 * A failed save is not proof of a lost connection. A server error, a rejected payload or a
 * request that times out all land in the same catch, and reporting every one of them as
 * "offline" sent users looking at their wifi while the real fault sat on the server and was
 * never logged anywhere. The solve is queued either way; only the wording and the console
 * record differ.
 */
function reportSaveFailure(error: unknown) {
	const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
	if (offline) {
		showOfflineToastOnce();
		return;
	}
	console.error('[solve] save failed while online — queued for retry:', error);
	if (!queuedToastShown) {
		toastInfo('Çözüm kaydedilemedi, kuyruğa alındı. Otomatik olarak tekrar denenecek.');
		queuedToastShown = true;
	}
}

export async function createSolveDb(solveInput: Solve) {
	const solveDb = getSolveDb();

	const solve = sanitizeSolve(solveInput) as Solve;
	solveDb.insert({
		...solve,
	});

	postProcessDbUpdate(solve, true);

	if (canWriteSync()) {
		const query = gql`
			mutation Mutate($input: SolveInput) {
				createSolve(input: $input) {
					id
					is_smart_cube
					solve_method_steps {
						id
						step_name
						total_time
						recognition_time
						turn_count
						turns
						tps
						oll_case_key
						pll_case_key
						skipped
						parent_name
						method_name
						step_index
						created_at
					}
				}
			}
		`;

		try {
			const result = await gqlMutate(query, { input: solve });
			const created = (result as any)?.data?.createSolve;
			if (created) {
				const db = getSolveDb();
				const existing = db.findOne({ id: solve.id });
				if (existing) {
					// Server downgrade ettiyse (örn. smart_turns parse hatasi) client'i sync et
					if (typeof created.is_smart_cube === 'boolean' && created.is_smart_cube !== existing.is_smart_cube) {
						existing.is_smart_cube = created.is_smart_cube;
					}
					// method_steps her zaman güncelle — bos array de gecerli sonuc (stale veriyi temizler)
					existing.solve_method_steps = created.solve_method_steps || [];
					db.update(existing);
					emitEvent('solveDbUpdatedEvent', existing);
				}
			}
		} catch (e) {
			// Offline queue'ya ekle
			await addToQueue('createSolve', { input: solve });
			reportSaveFailure(e);
		}
	}
}

export async function deleteSolveDb(solve: Solve, confirmed: boolean = false) {
	const store = getStore();

	const confirmDelete = getSetting('confirm_delete_solve');
	if (confirmDelete && !confirmed) {
		store.dispatch(
			openModal(
				<ConfirmModal
					buttonText="Çözümü sil"
					hideInput
					triggerAction={() => deleteSolveDb(solve, true)}
				/>,
				{
					title: 'Çözümü sil',
					description: 'Bu çözümü silmek istediğinizden emin misiniz?',
					closeButtonText: 'Bitti',
					compact: true,
					width: 420,
				}
			)
		);
		return;
	}

	const solveDb = getSolveDb();

	// The stored document, not the caller's object. Only a solve that is really in the
	// collection can be removed (a double tap on the same row finds nothing the second
	// time), and removing through a caller's detached copy could take a different row with
	// it: LokiJS locates the document by the `$loki` the copy happens to carry.
	const stored = solveDb.findOne({ id: solve.id });
	if (!stored) {
		return;
	}

	// Taken before the removal, which strips LokiJS' own fields off the document. It is
	// what the deleted-solve tally is told about.
	const snapshot = stripLokiJsMetadata(stored) as Solve;

	solveDb.remove(stored);
	// Record the intent before the network call: another device still holding this solve
	// locally would otherwise re-upload it through its backfill pass, and the tombstone
	// also covers the case where the request never lands.
	addSolveTombstones([solve.id]);
	// Before postProcessDbUpdate, whose solveDbUpdatedEvent makes the goal progress
	// recount: the tally has to be in place by then.
	recordDeletedSolves([snapshot]);
	postProcessDbUpdate(solve, false);

	refreshBucketLastSolve(solve);

	void sendSolveDeleteToServer(solve.id);
}

/**
 * Point the timer's "last time" at whatever is now the newest solve of the bucket the
 * change touched (session + cube_type + subset), never at the session-global last solve:
 * that would leak a solve from another cube type into this bucket's view.
 */
function refreshBucketLastSolve(solve: Solve) {
	const newLastSolve = fetchLastSolve(
		buildBucketFilter({
			session_id: solve.session_id,
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset,
		})
	);

	setTimerParam('finalTime', newLastSolve ? newLastSolve.time * 1000 : 0);
}

/** The delete the undo window was waiting on, now going out for real. */
async function sendSolveDeleteToServer(id: string) {
	if (!canWriteSync()) {
		return;
	}

	const query = gql`
		mutation Mutate($id: String) {
			deleteSolve(id: $id) {
				id
			}
		}
	`;

	try {
		await gqlMutate(query, { id });
	} catch (e) {
		// Offline queue'ya ekle
		await addToQueue('deleteSolve', { id });
		reportSaveFailure(e);
	}
}

export async function updateSolveDb(solve: Solve, input: Partial<Solve> = {}, updateLocalDb = true) {
	updateSolveTime(solve);
	const solveDb = getSolveDb();

	if (updateLocalDb) {
		solveDb.update({
			...solve,
			...input,
		});

		postProcessDbUpdate(solve, false);
	}

	if (canWriteSync()) {
		const query = gql`
			mutation Mutate($id: String, $input: SolveInput) {
				updateSolve(id: $id, input: $input) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {
				id: solve.id,
				input: {
					...input,
					time: solve.time,
				},
			});
		} catch (e) {
			// Offline queue'ya ekle
			await addToQueue('updateSolve', { id: solve.id, input: { ...input, time: solve.time } });
			reportSaveFailure(e);
		}
	}
}

/**
 * Write the solve collection back to disk after a change.
 *
 * Pro users also bump the server-side offline hash; everyone else just saves
 * locally. Anonymous visitors additionally refresh their solve counter, which is
 * what tells a later signed-in boot that there is data here worth transferring.
 */
function persistSolveChange() {
	if (canReadSync()) {
		updateOfflineHash();
	} else {
		saveLokiDb();
	}

	syncAnonSolveCount();
}

/**
 * `restored` marks an undone deletion. Such a solve re-enters the averages exactly as a
 * new one does (`isNew` is what tells the current-average cache to drop every entry), but
 * it is not a new result: `checkForPB`/`checkForWorst` only fire their events when isNew
 * is set, so this clears the same caches without announcing a record the user already had.
 */
function postProcessDbUpdate(solve: Solve, isNew: boolean, restored = false) {
	clearSolveStatCache({
		solve: {
			id: solve.id,
		} as any,
	});

	// ORDER MATTERS! avg_current cache must be cleared before PB/worst checks
	// so getCurrentAverage() returns fresh data during comparison.
	checkForCurrentAverageUpdate(solve, isNew);
	checkForPB(solve, isNew && !restored);
	checkForWorst(solve, isNew && !restored);

	persistSolveChange();

	emitEvent('solveDbUpdatedEvent', solve);
}

export function updateSolveTime(solve: Solve) {
	if (solve.dnf) {
		solve.time = -1;
	} else if (solve.plus_two) {
		solve.time = solve.raw_time + 2;
	} else {
		solve.time = solve.raw_time;
	}
}

export async function deleteAllSolvesInSessionDb(sessionId: string, confirmed: boolean = false) {
	const store = getStore();
	const confirmDelete = getSetting('confirm_delete_season');

	if (confirmDelete && !confirmed) {
		store.dispatch(
			openModal(
				<ConfirmModal
					buttonText="Tümünü Sil"
					hideInput
					triggerAction={() => deleteAllSolvesInSessionDb(sessionId, true)}
				/>,
				{
					title: 'Sezonu Temizle',
					description: 'Bu sezondaki TÜM çözümleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
					closeButtonText: 'Bitti',
					compact: true,
					width: 420,
				}
			)
		);
		return;
	}

	// A single delete still waiting out its undo window has to be settled first: the
	// session-wide delete about to go out does not know about it, and an undo afterwards
	// would put a solve back into a session the server has already emptied.

	const solveDb = getSolveDb();
	const solvesToRemove = solveDb.find({ session_id: sessionId });

	solveDb.removeWhere({ session_id: sessionId });
	addSolveTombstones(solvesToRemove.map((s) => s.id));
	recordDeletedSolves(solvesToRemove);

	clearSolveStatCacheForSession(sessionId);
	emitEvent('solveDbUpdatedEvent', null);

	if (canWriteSync()) {
		const query = gql`
			mutation Mutate($sessionId: String!) {
				deleteAllSolvesInSession(sessionId: $sessionId)
			}
		`;

		try {
			await gqlMutate(query, { sessionId });
		} catch (e) {
			// Log
		}
	}

	persistSolveChange();
}

export async function deleteMultipleSolvesDb(solves: Solve[], confirmed: boolean = false) {
	const store = getStore();

	const confirmDelete = getSetting('confirm_delete_solve');
	if (confirmDelete && !confirmed) {
		store.dispatch(
			openModal(
				<ConfirmModal
					buttonText="Seçilenleri Sil"
					hideInput
					triggerAction={() => deleteMultipleSolvesDb(solves, true)}
				/>,
				{
					title: 'Çözümleri Sil',
					description: `Seçilen ${solves.length} çözümü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
					closeButtonText: 'Bitti',
					compact: true,
					width: 420,
				}
			)
		);
		return;
	}

	// Settle any single delete still inside its undo window before a bulk one runs: the
	// two would otherwise race over the same server state.

	const solveDb = getSolveDb();
	const ids = solves.map(s => s.id);
	// The stored copies, not the caller's: only what is really removed gets tallied
	const removed = solveDb.find({ id: { $in: ids } });

	// Remove from local DB
	solveDb.removeWhere(s => ids.includes(s.id));
	addSolveTombstones(ids);
	recordDeletedSolves(removed);

	if (solves.length > 0) {
		// Group deleted solves by bucket (session + cube_type + subset) and refresh
		// EVERY affected bucket's PB/avg/worst/stat cache. Passing only solves[0] left
		// other buckets stale when deleting across multiple cube types/subsets at once.
		const buckets = new Map<string, Solve>();
		for (const s of solves) {
			const key = `${s.session_id}::${s.cube_type}::${s.scramble_subset ?? ''}`;
			if (!buckets.has(key)) buckets.set(key, s);
		}
		for (const representative of buckets.values()) {
			postProcessDbUpdate(representative, false);
		}

		refreshBucketLastSolve(solves[0]);
	}

	if (solves.length > 0 && canWriteSync()) {
		const query = gql`
			mutation Mutate($ids: [String!]!) {
				deleteSolves(ids: $ids)
			}
		`;

		try {
			await gqlMutate(query, {
				ids: solves.map(s => s.id),
			});
		} catch (e: any) {
			// Argument Validation Error = Yazılımsal hata (muhtemelen Return Type uyuşmazlığı)
			// Bunu queue'ya eklememeliyiz, yoksa sonsuza kadar dener.
			if (e.message && e.message.includes('Argument Validation Error')) {
				console.error('deleteSolves validation error:', e);
				// Kullanıcıya sessizce hata verme, ama queue'ya da ekleme
				return;
			}

			// Offline queue'ya ekle
			await addToQueue('deleteSolves', { ids: solves.map(s => s.id) });
			reportSaveFailure(e);
		}
	}
}
