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
import { fetchLastSolve } from './query';
import { setTimerParam } from '../../components/timer/helpers/params';
import { addToQueue } from '../../util/offline-queue';
import { toastInfo } from '../../util/toast';
import { canSync } from '../../lib/sync-gate';

let offlineToastShown = false;
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => { offlineToastShown = false; });
}

function showOfflineToastOnce() {
	if (!offlineToastShown) {
		toastInfo('Çözüm offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
		offlineToastShown = true;
	}
}

export async function createSolveDb(solveInput: Solve) {
	const solveDb = getSolveDb();

	const solve = sanitizeSolve(solveInput) as Solve;
	solveDb.insert({
		...solve,
	});

	postProcessDbUpdate(solve, true);

	if (canSync()) {
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
			showOfflineToastOnce();
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

	solveDb.remove(solve);
	postProcessDbUpdate(solve, false);

	// Silme sonrası timer'daki son süreyi güncelle
	const newLastSolve = fetchLastSolve({ session_id: solve.session_id });
	if (newLastSolve) {
		setTimerParam('finalTime', newLastSolve.time * 1000);
	} else {
		// Hiç çözüm kalmadı, timer'ı sıfırla
		setTimerParam('finalTime', 0);
	}

	if (canSync()) {
		const query = gql`
			mutation Mutate($id: String) {
				deleteSolve(id: $id) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {
				id: solve.id,
			});
		} catch (e) {
			// Offline queue'ya ekle
			await addToQueue('deleteSolve', { id: solve.id });
			showOfflineToastOnce();
		}
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

	if (canSync()) {
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
			showOfflineToastOnce();
		}
	}
}

function postProcessDbUpdate(solve: Solve, isNew: boolean) {
	clearSolveStatCache({
		solve: {
			id: solve.id,
		} as any,
	});

	// ORDER MATTERS! avg_current cache must be cleared before PB/worst checks
	// so getCurrentAverage() returns fresh data during comparison.
	checkForCurrentAverageUpdate(solve, isNew);
	checkForPB(solve, isNew);
	checkForWorst(solve, isNew);

	if (canSync()) {
		updateOfflineHash();
	} else {
		saveLokiDb();
	}

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

	const solveDb = getSolveDb();
	const solvesToRemove = solveDb.find({ session_id: sessionId });

	solveDb.removeWhere({ session_id: sessionId });

	clearSolveStatCacheForSession(sessionId);
	emitEvent('solveDbUpdatedEvent', null);

	if (canSync()) {
		updateOfflineHash();

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
	} else {
		saveLokiDb();
	}
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

	const solveDb = getSolveDb();
	const ids = solves.map(s => s.id);

	// Remove from local DB
	solveDb.removeWhere(s => ids.includes(s.id));

	if (solves.length > 0) {
		postProcessDbUpdate(solves[0], false);

		const session_id = solves[0].session_id;
		const newLastSolve = fetchLastSolve({ session_id });
		if (newLastSolve) {
			setTimerParam('finalTime', newLastSolve.time * 1000);
		} else {
			setTimerParam('finalTime', 0);
		}
	}

	if (solves.length > 0 && canSync()) {
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
			showOfflineToastOnce();
		}
	}
}
