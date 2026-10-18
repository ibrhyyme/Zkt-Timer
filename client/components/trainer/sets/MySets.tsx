/**
 * MySets: the "My Sets" page of Algorithm Sets (trainer-sets 7.2, 7.8, 9.3).
 *
 * "New set" on top, then two sections: My sets (last updated first) and Saved (other people's
 * sets, the owner always shown, 2.8-i). A saved set that is no longer shared becomes a plain line
 * with "Remove from my list"; a saved set whose owner deleted it is said once, then dropped.
 *
 * One `myAlgSets` request when the page opens; offline the device's last list shows under a line
 * that says so, and every action that needs the server is off.
 *
 * Signed in only (the shell shows AccountRequired otherwise).
 */
import React, {useEffect} from 'react';
import {useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {CircleNotch, PencilSimple, Play, Plus, ShareNetwork, Trash, WifiSlash, X} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {useTrainerContext} from '../TrainerContext';
import {useOnlineStatus} from '../../../util/hooks/useOnlineStatus';
import {buildAlgorithmsPath, buildSetPath} from '../../../util/trainer/url/trainer_url';
import {dismissRemovedSet, refreshMySets, useMySets} from '../../../lib/alg_sets/store';
import {ALG_SET_LIMITS} from '../../../../shared/trainer/alg_sets';
import {toastError} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import AlgSetCard from './AlgSetCard';
import {useSetActions} from './set_actions';
import {useShareAlgSet} from './ShareButton';
import type {SheetAction} from './parts';
import type {AlgSetSummaryData} from '../../../lib/alg_sets/types';
import './AlgSets.scss';

const b = block('alg-sets');

export default function MySets() {
	const {t} = useTranslation();
	const history = useHistory();
	const {state} = useTrainerContext();
	const online = useOnlineStatus();
	const list = useMySets();
	const actions = useSetActions();
	const share = useShareAlgSet();

	useEffect(() => {
		refreshMySets();
	}, []);

	const mode = state.mode === 'smart' ? 'smart' : null;
	const canWrite = online && !list.offline;
	const offlineNote = t('trainer.sets.offline_needed');
	const own = list.data?.own || [];
	const saved = list.data?.saved || [];
	const atLimit = own.length >= ALG_SET_LIMITS.MAX_SETS_PER_USER;

	const open = (set: AlgSetSummaryData) => history.push(buildSetPath(set.code));
	const study = (set: AlgSetSummaryData) => history.push(buildAlgorithmsPath('train', {set: set.code, mode}));

	const createSet = () => {
		actions.openCreate((created) => history.push(buildSetPath(created.code, true)));
	};

	const ownMenu = (set: AlgSetSummaryData) => {
		const items: SheetAction[] = [
			{
				key: 'study',
				label: t('trainer.sets.study'),
				icon: <Play size={18} weight="bold" />,
				disabled: set.item_count === 0,
				onSelect: () => study(set),
			},
			{
				key: 'share',
				label: t('trainer.sets.share'),
				icon: <ShareNetwork size={18} weight="bold" />,
				// A private set opens its page, where sharing is offered first.
				onSelect: () => (set.visibility === 'private' ? open(set) : share(set)),
			},
			{
				key: 'edit',
				label: t('trainer.sets.edit'),
				icon: <PencilSimple size={18} weight="bold" />,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () => actions.openEdit(set, null),
			},
			{
				key: 'delete',
				label: t('trainer.sets.delete'),
				icon: <Trash size={18} weight="bold" />,
				danger: true,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () => actions.confirmDelete(set),
			},
		];
		actions.openMenu(set.name, items);
	};

	const savedMenu = (set: AlgSetSummaryData) => {
		actions.openMenu(set.name, [
			{
				key: 'study',
				label: t('trainer.sets.study'),
				icon: <Play size={18} weight="bold" />,
				disabled: set.item_count === 0,
				onSelect: () => study(set),
			},
			{
				key: 'unsave',
				label: t('trainer.sets.remove_from_list'),
				icon: <X size={18} weight="bold" />,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () => unsave(set.id),
			},
		]);
	};

	const unsave = (setId: string) => {
		actions.unsave(setId).catch((err) => toastError(getGqlErrorMessage(err, t, 'trainer.sets.load_error')));
	};

	const firstLoad = !list.data && (list.status === 'idle' || list.status === 'loading');

	return (
		<div className={b('page')}>
			<div className={b('toolbar')}>
				<Button
					primary
					large
					icon={<Plus weight="bold" />}
					iconFirst
					text={t('trainer.sets.new')}
					disabled={!canWrite || atLimit}
					onClick={createSet}
				/>
				{!canWrite ? <span className={b('toolbar-note')}>{offlineNote}</span> : null}
				{canWrite && atLimit ? <span className={b('toolbar-note')}>{t('alg_set_errors.limit_sets')}</span> : null}
			</div>

			{list.offline || (!online && list.data) ? (
				<p className={b('banner')} role="status">
					<WifiSlash size={16} weight="bold" aria-hidden="true" />
					{t('trainer.sets.offline_list')}
				</p>
			) : null}

			{list.removed.map((entry) => (
				<div key={entry.set_id} className={b('notice-row')}>
					<span>{t('trainer.sets.removed_by_owner')}</span>
					<button
						type="button"
						className={b('text-button')}
						onClick={() => dismissRemovedSet(entry.set_id)}
					>
						{t('trainer.sets.dismiss')}
					</button>
				</div>
			))}

			{firstLoad ? (
				<p className={b('status')}>
					<CircleNotch className="spin" size={18} aria-hidden="true" /> {t('trainer.sets.loading_list')}
				</p>
			) : null}

			{list.status === 'error' && !list.data ? (
				<div className={b('empty')}>
					<p>{online ? t('trainer.sets.load_error') : t('trainer.sets.offline_needed')}</p>
					<Button gray text={t('trainer.sets.retry')} onClick={() => refreshMySets()} />
				</div>
			) : null}

			{list.data ? (
				<>
					<section className={b('section')}>
						<h2 className={b('section-title')}>{t('trainer.sets.my_sets')}</h2>
						{own.length === 0 ? (
							<div className={b('empty')}>
								<p>{t('trainer.sets.empty_mine')}</p>
								<Button
									gray
									icon={<Plus weight="bold" />}
									iconFirst
									text={t('trainer.sets.new')}
									disabled={!canWrite}
									onClick={createSet}
								/>
							</div>
						) : (
							<div className={b('grid')}>
								{own.map((set) => (
									<AlgSetCard key={set.id} set={set} variant="mine" onOpen={open} onMenu={ownMenu} />
								))}
							</div>
						)}
					</section>

					{saved.length > 0 ? (
						<section className={b('section')}>
							<h2 className={b('section-title')}>{t('trainer.sets.saved_sets')}</h2>
							<div className={b('grid')}>
								{saved.map((entry) =>
									entry.set ? (
										<AlgSetCard
											key={entry.set_id}
											set={entry.set}
											variant="saved"
											onOpen={open}
											onMenu={savedMenu}
										/>
									) : (
										<div key={entry.set_id} className={b('notice-row', {card: true})}>
											<span>{t('trainer.sets.unavailable')}</span>
											<button
												type="button"
												className={b('text-button')}
												disabled={!canWrite}
												title={!canWrite ? offlineNote : undefined}
												onClick={() => unsave(entry.set_id)}
											>
												{t('trainer.sets.remove_from_list')}
											</button>
										</div>
									)
								)}
							</div>
						</section>
					) : null}
				</>
			) : null}
		</div>
	);
}
