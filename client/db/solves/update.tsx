import React from 'react';
import { gql } from '@apollo/client/core';
import { gqlMutate } from '../../components/api';
import { getSolveDb } from './init';
import { emitEvent } from '../../util/event_handler';
import { clearSolveStatCache } from './stats/solves/caching';
import { toastError } from '../../util/toast';
import { getStore } from '../../components/store';
import { openModal } from '../../actions/general';
import ConfirmModal from '../../components/common/confirm_modal/ConfirmModal';
import { checkForPB } from './stats/solves/pb';
import { updateOfflineHash } from '../../components/layout/offline';
import { getSetting } from '../settings/query';
import { Solve } from '../../../server/schemas/Solve.schema';
import { checkForWorst } from './stats/solves/worst';
import { sanitizeSolve } from '../../../shared/solve';
import { checkForCurrentAverageUpdate } from './stats/solves/cache/average_cache';
import { fetchLastSolve } from './query';
import { setTimerParam } from '../../components/timer/helpers/params';
import { addToQueue } from '../../util/offline-queue';
import { toastInfo } from '../../util/toast';

export async function createSolveDb(solveInput: Solve) {
	const solveDb = getSolveDb();

	const solve = sanitizeSolve(solveInput);
	solveDb.insert({
		...solve,
	});

	postProcessDbUpdate(solve, true);

	if (!solve.demo_mode) {
		const query = gql`
			mutation Mutate($input: SolveInput) {
				createSolve(input: $input) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {
				input: solve,
			});
		} catch (e) {
			// Offline queue'ya ekle
			await addToQueue('createSolve', { input: solve });
			toastInfo('Çözüm offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
		}
	} else {
		await createDemoSolve(solve);
	}
}

async function createDemoSolve(solve: Solve) {
	const query = gql`
		mutation Mutate($input: DemoSolveInput) {
			createDemoSolve(input: $input) {
				id
			}
		}
	`;

	const browserSessionId = getStore().getState()?.general?.browser_session_id;

	try {
		await gqlMutate(query, {
			input: {
				raw_time: solve.raw_time,
				cube_type: solve.cube_type,
				scramble: solve.scramble,
				started_at: solve.started_at,
				ended_at: solve.ended_at,
				demo_session_id: browserSessionId,
			},
		});
	} catch (e) {
		toastError('Could not save solve. Please check your connection.');
	}
}

export async function deleteSolveDb(solve: Solve, confirmed: boolean = false) {
	const store = getStore();

	const confirmDelete = getSetting('confirm_delete_solve');
	if (confirmDelete && !confirmed) {
		store.dispatch(
			openModal(
				<ConfirmModal
					description="Bu çözümü silmek istediğinizden emin misiniz?"
					buttonText="Çözümü sil"
					hideInput
					title="Çözümü sil"
					triggerAction={() => deleteSolveDb(solve, true)}
				/>
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

	if (!solve.demo_mode) {
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
			toastInfo('Silme işlemi offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
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

	if (!solve.demo_mode) {
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
			toastInfo('Güncelleme offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
		}
	}
}

function postProcessDbUpdate(solve: Solve, isNew: boolean) {
	clearSolveStatCache({
		solve: {
			id: solve.id,
		} as any,
	});

	// ORDER MATTERS!
	checkForPB(solve, isNew);
	checkForWorst(solve, isNew);
	checkForCurrentAverageUpdate(solve, isNew);

	if (!solve.demo_mode) {
		updateOfflineHash();
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
					description="Bu sezondaki TÜM çözümleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
					buttonText="Tümünü Sil"
					hideInput
					title="Sezonu Temizle"
					triggerAction={() => deleteAllSolvesInSessionDb(sessionId, true)}
				/>
			)
		);
		return;
	}

	const solveDb = getSolveDb();
	const solvesToRemove = solveDb.find({ session_id: sessionId });

	solveDb.removeWhere({ session_id: sessionId });

	// İstatistikleri temizle
	solvesToRemove.forEach(solve => clearSolveStatCache({ solve: solve as any }));
	emitEvent('solveDbUpdatedEvent', null);
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
}

export async function deleteMultipleSolvesDb(solves: Solve[], confirmed: boolean = false) {
	const store = getStore();

	const confirmDelete = getSetting('confirm_delete_solve');
	if (confirmDelete && !confirmed) {
		store.dispatch(
			openModal(
				<ConfirmModal
					description={`Seçilen ${solves.length} çözümü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
					buttonText="Seçilenleri Sil"
					hideInput
					title="Çözümleri Sil"
					triggerAction={() => deleteMultipleSolvesDb(solves, true)}
				/>
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

	const solvesToDeleteFromServer = solves.filter(s => !s.demo_mode);

	if (solvesToDeleteFromServer.length > 0) {
		const query = gql`
			mutation Mutate($ids: [String!]!) {
				deleteSolves(ids: $ids)
			}
		`;

		try {
			await gqlMutate(query, {
				ids: solvesToDeleteFromServer.map(s => s.id),
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
			await addToQueue('deleteSolves', { ids: solvesToDeleteFromServer.map(s => s.id) });
			toastInfo('Silme işlemleri offline kaydedildi. İnternet bağlandığında senkronize edilecek.');
		}
	}
}
