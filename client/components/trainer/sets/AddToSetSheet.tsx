/**
 * AddToSetSheet: "Add to set" from the normal trainer (trainer-sets 10 T12, Q6).
 *
 * Opened through openModal from the algorithm detail window (one case) and from the selection
 * screen (the checked cards), so it lives outside the trainer provider and gets the cases as
 * props. Lists the user's own sets (saved sets belong to somebody else and cannot take rows)
 * plus "New set": a new set is created first, then the cases go in.
 *
 * Each case goes in with the algorithm the user runs for it here; a text the server does not
 * know falls back to the library algorithm once (add_items.ts, design 5.5). Writing needs the
 * network: offline every row is disabled with one line saying so (9.3).
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {CircleNotch, Plus} from 'phosphor-react';
import block from '../../../styles/bem';
import {openModal} from '../../../actions/general';
import Button from '../../common/button/Button';
import {useMe} from '../../../util/hooks/useMe';
import {useOnlineStatus} from '../../../util/hooks/useOnlineStatus';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {toastError, toastInfo, toastSuccess} from '../../../util/toast';
import {ALG_SET_LIMITS} from '../../../../shared/trainer/alg_sets';
import {fetchDefaultAlgs} from '../hooks/useAlgorithmData';
import {rememberAlgSet} from '../../../lib/alg_sets/loader';
import {refreshMySets, upsertOwnSet, useMySets} from '../../../lib/alg_sets/store';
import {addItemsWithFallback, libraryAlgLookup} from './add_items';
import {useSetActions} from './set_actions';
import {VisibilityIcon} from './parts';
import type {AddItemInput} from './picker/picker_model';
import type {AlgSetData, AlgSetSummaryData} from '../../../lib/alg_sets/types';
import './AlgSets.scss';
import './AddToSetSheet.scss';

const b = block('alg-sets');

// Structural, not i18next's TFunction (see util/gql-error.ts).
type Translate = (key: string, options?: Record<string, unknown>) => any;

interface Props {
	items: AddItemInput[];
	onClose?: () => void;
}

/** Adds the cases to a set, keeps My Sets and the device copy in step, and says what happened. */
async function addToSet(set: {id: string; name: string; item_count: number}, items: AddItemInput[], t: Translate) {
	const library = await fetchDefaultAlgs().catch(() => null);
	const {set: next, fallbackCount} = await addItemsWithFallback(set.id, items, libraryAlgLookup(library));
	const full: AlgSetData = {...next, is_owner: true};
	upsertOwnSet(full);
	rememberAlgSet(full);

	const after = full.items.length || full.item_count;
	const added = Math.max(0, after - set.item_count);
	if (fallbackCount > 0) toastInfo(t('trainer.sets.variant_fallback', {count: fallbackCount}));
	if (added === 0) toastInfo(t('trainer.sets.add_to.already', {count: items.length, name: full.name || set.name}));
	else toastSuccess(t('trainer.sets.add_to.added', {count: added, name: full.name || set.name}));
}

/** Opens the sheet over whatever is open (the detail window stays underneath). */
export function openAddToSet(dispatch: (action: any) => void, t: Translate, items: AddItemInput[]) {
	if (!items.length) return;
	dispatch(openModal(<AddToSetSheet items={items} />, {title: t('trainer.sets.add_to.title'), width: 460, compact: true}));
}

export default function AddToSetSheet({items, onClose}: Props) {
	const {t} = useTranslation();
	const me = useMe();
	const online = useOnlineStatus();
	const list = useMySets();
	const {openCreate} = useSetActions();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	// One myAlgSets when the list is not there yet for this user (My Sets keeps it current after).
	const userId = me?.id || null;
	useEffect(() => {
		if (!userId) return;
		if (list.userId !== userId || list.status === 'idle' || list.status === 'error') refreshMySets();
		// Only on open: later changes come from the store itself.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId]);

	const pick = useCallback(
		async (set: AlgSetSummaryData) => {
			if (busyId || !online) return;
			setBusyId(set.id);
			setError('');
			try {
				await addToSet(set, items, t);
				// Closed meanwhile (backdrop): closing again would take the detail window under it.
				if (mounted.current && onClose) onClose();
			} catch (err) {
				if (!mounted.current) return;
				setError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
				setBusyId(null);
			}
		},
		[busyId, online, items, t, onClose]
	);

	const createNew = useCallback(() => {
		if (busyId || !online) return;
		// Close this sheet first: closeModal always takes the top modal, and the new set sheet goes on top.
		if (onClose) onClose();
		openCreate((created) => {
			addToSet({id: created.id, name: created.name, item_count: 0}, items, t).catch((err) =>
				toastError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'))
			);
		});
	}, [busyId, online, onClose, openCreate, items, t]);

	const own = list.userId === userId && list.data ? list.data.own : [];
	const firstLoad = !list.data && (list.status === 'loading' || list.status === 'idle');
	const disabled = !online || !!busyId;

	return (
		<div className={b('sheet')}>
			{items.length > 1 ? <p className={b('sheet-message')}>{t('trainer.sets.selected_count', {count: items.length})}</p> : null}
			{!online && list.data ? <p className={b('note')}>{t('trainer.sets.offline_needed')}</p> : null}

			<div className={b('action-sheet', {scroll: true})}>
				<button type="button" className={b('action')} disabled={disabled} onClick={createNew}>
					<span className={b('action-icon')}>
						<Plus size={18} weight="bold" aria-hidden="true" />
					</span>
					<span className={b('action-text')}>
						<span>{t('trainer.sets.new')}</span>
					</span>
				</button>

				{own.map((set) => {
					const full = set.item_count >= ALG_SET_LIMITS.MAX_ITEMS_PER_SET;
					const busy = busyId === set.id;
					return (
						<button
							key={set.id}
							type="button"
							className={b('action')}
							disabled={disabled || full}
							aria-busy={busy || undefined}
							onClick={() => pick(set)}
						>
							<span className={b('action-icon')}>
								{busy ? (
									<CircleNotch className="spin" size={18} aria-hidden="true" />
								) : (
									<VisibilityIcon visibility={set.visibility} size={18} />
								)}
							</span>
							<span className={b('action-text')}>
								<span>{set.name}</span>
								<span className={b('action-note')}>
									{full ? t('trainer.sets.limit_items') : t('trainer.sets.count', {count: set.item_count})}
								</span>
							</span>
						</button>
					);
				})}
			</div>

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

			{list.data && list.userId === userId && own.length === 0 ? <p className={b('note')}>{t('trainer.sets.add_to.empty', {count: items.length})}</p> : null}

			{error ? (
				<p className={b('note', {error: true})} role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
