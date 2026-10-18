/**
 * AlgSetPage: one set's page, /trainer/sets/:code (trainer-sets 7.4, 7.7, 7.8, 6.6, 9.3).
 *
 * Who sees which button:
 *   owner: Study, Add algorithms, Share (a private set first offers to open sharing), Edit,
 *          Reset link, Reorder, Delete; per row "Change algorithm" and "Remove from set".
 *   others: Study, Save / Remove from my sets, Report; Share only on a public set (a link set is
 *          the owner's to pass on, 7.4).
 *   signed out: read only; Study and Save lead to the login page and back.
 *
 * Loading: the device copy paints at once, the server copy follows (9.3). Rows whose algorithm
 * changed since the device copy carry "Algorithm changed" once. Offline without a copy, or a set
 * that cannot be opened, says so; the server answers the same NOT_FOUND for gone, private and
 * hidden sets, so the page cannot tell them apart either.
 *
 * Statistics stay the device's (6.6): each row shows the learned flag and the best time of its
 * algorithm text, the same key the normal trainer uses (trainerAlgText).
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import {Link, useHistory, useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
	ArrowDown,
	ArrowsDownUp,
	ArrowUp,
	BookmarkSimple,
	CircleNotch,
	DotsThreeVertical,
	EyeSlash,
	Flag,
	LinkSimple,
	PencilSimple,
	Play,
	Plus,
	Swap,
	Trash,
	WifiSlash,
	X,
} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {openModal} from '../../../actions/general';
import {useTrainerContext} from '../TrainerContext';
import StudyModeSwitch from '../hub/StudyModeSwitch';
import CasePattern from '../common/CasePattern';
import {facesFor, usePatternFaces} from './picker/PickerCards';
import {useMe} from '../../../util/hooks/useMe';
import {useSsr} from '../../../util/hooks/useSsr';
import {useOnlineStatus} from '../../../util/hooks/useOnlineStatus';
import {useTrainerDb} from '../../../util/hooks/useTrainerDb';
import {hapticImpact} from '../../../util/native-plugins';
import {toastError} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {algToId} from '../../../util/trainer/algorithm_engine';
import {startSetStudyPayload, trainerAlgText} from '../../../util/trainer/set_queue';
import {MY_SETS_PATH, COMMUNITY_PATH, buildSetPath, parseSetPath} from '../../../util/trainer/url/trainer_url';
import {getBestTime, getLearnedStatus} from '../hooks/useAlgorithmData';
import {
	removeAlgSetItems,
	reorderAlgSetItems,
	reportAlgSet,
	saveAlgSet,
	unsaveAlgSet,
	updateAlgSetItem,
} from '../../../lib/alg_sets/api';
import {loadAlgSet, peekCachedAlgSet, rememberAlgSet, forgetAlgSet, toStudySet} from '../../../lib/alg_sets/loader';
import {addSavedSet, removeSavedSet, upsertOwnSet} from '../../../lib/alg_sets/store';
import {algSetSsrKey, type AlgSetSsrPreview} from './ssr';
import {CategoryBadges, OwnerChip, VisibilityTag, type SheetAction} from './parts';
import {groupItemsByCategory, loginRedirectPath, moveId, moveIdTo, progressCounts} from './set_ui';
import {useSetActions} from './set_actions';
import {useShareAlgSet} from './ShareButton';
import ReportSheet from './ReportSheet';
import VariantSheet from './VariantSheet';
import RowDetailSheet from './RowDetailSheet';
import type {AlgSetData, AlgSetItemData} from '../../../lib/alg_sets/types';
import './AlgSets.scss';

const b = block('alg-sets');

type Status = 'loading' | 'ready' | 'not_found' | 'offline' | 'error';

interface ViewState {
	code: string;
	set: AlgSetData | null;
	status: Status;
	fromCache: boolean;
	changed: Set<string>;
}

export function formatBestTime(ms: number | null): string {
	if (!ms) return '';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

function statsKey(item: AlgSetItemData): string {
	return algToId(trainerAlgText(item.algorithm));
}

export default function AlgSetPage() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const reduxDispatch = useDispatch();
	const {dispatch} = useTrainerContext();
	const me = useMe();
	const online = useOnlineStatus();
	useTrainerDb(); // flags and best times are live
	const faces = usePatternFaces();
	const actions = useSetActions();
	const share = useShareAlgSet();

	const code = parseSetPath(location.pathname)?.code || '';
	const [preview] = useSsr<AlgSetSsrPreview | null>(algSetSsrKey(code));

	const [view, setView] = useState<ViewState>(() => {
		const cached = peekCachedAlgSet(code);
		return {code, set: cached, status: cached ? 'ready' : 'loading', fromCache: !!cached, changed: new Set()};
	});
	const [reported, setReported] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [sorting, setSorting] = useState<string[] | null>(null);
	const [dragId, setDragId] = useState<string | null>(null);
	/** The page itself moved to a new code (reset link, or the server knew the set under a new one). */
	const ownCodeChange = useRef<string | null>(null);

	const meId = me?.id || null;

	useEffect(() => {
		if (!code) return;
		if (ownCodeChange.current === code) {
			ownCodeChange.current = null;
			return;
		}
		let alive = true;
		const cached = peekCachedAlgSet(code);
		setView({code, set: cached, status: cached ? 'ready' : 'loading', fromCache: !!cached, changed: new Set()});
		setSorting(null);
		setReported(false);

		loadAlgSet(code).then(({loaded, notFound}) => {
			if (!alive) return;
			if (loaded) {
				if (loaded.set.code && loaded.set.code !== code) {
					ownCodeChange.current = loaded.set.code;
					history.replace(buildSetPath(loaded.set.code));
				}
				setView({
					code: loaded.set.code || code,
					set: loaded.set,
					status: 'ready',
					fromCache: loaded.fromCache,
					changed: loaded.changed,
				});
				return;
			}
			if (cached && !notFound) return; // keep showing the device copy
			setView((prev) => ({
				...prev,
				set: null,
				status: notFound ? 'not_found' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
			}));
		});
		return () => {
			alive = false;
		};
		// A login or logout changes is_owner / is_saved: load again.
	}, [code, meId, history]);

	const set = view.set;
	const isOwner = !!set?.is_owner;
	const canWrite = online;
	const offlineNote = t('trainer.sets.offline_needed');
	const here = location.pathname + location.search;
	// Rows the picker just added get a short highlight (trainer-sets 5.5); the ids ride on the history entry.
	const justAdded = useMemo(() => {
		const ids = (location.state as {addedIds?: unknown} | undefined)?.addedIds;
		return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
	}, [location.state]);

	const items = useMemo(() => (set ? set.items.slice().sort((a, b2) => a.position - b2.position) : []), [set]);
	const groups = useMemo(() => groupItemsByCategory(items), [items]);
	const progress = progressCounts(items.map(statsKey), getLearnedStatus);

	function applySet(next: AlgSetData) {
		setView((prev) => ({...prev, set: next, status: 'ready', fromCache: false}));
		rememberAlgSet(next);
		if (next.is_owner) upsertOwnSet(next);
	}

	function fail(err: unknown) {
		toastError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
	}

	// ── Actions ─────────────────────────────────────────────────────────

	function study() {
		if (!set) return;
		if (!me) {
			history.push(loginRedirectPath(here));
			return;
		}
		dispatch({type: 'START_SET_STUDY', payload: startSetStudyPayload(toStudySet(set), getBestTime)});
	}

	async function toggleSave() {
		if (!set) return;
		if (!me) {
			history.push(loginRedirectPath(here));
			return;
		}
		setBusy('save');
		try {
			if (set.is_saved) {
				await unsaveAlgSet(set.id);
				const next = {...set, is_saved: false, save_count: Math.max(0, set.save_count - 1)};
				setView((prev) => ({...prev, set: next}));
				removeSavedSet(set.id);
				forgetAlgSet(set.id);
			} else {
				await saveAlgSet(set.id);
				const next = {...set, is_saved: true, save_count: set.save_count + 1};
				setView((prev) => ({...prev, set: next}));
				addSavedSet(next);
				rememberAlgSet(next);
			}
			hapticImpact('light');
		} catch (err) {
			fail(err);
		} finally {
			setBusy(null);
		}
	}

	function report() {
		if (!set) return;
		reduxDispatch(
			openModal(
				<ReportSheet
					onSend={async (reason, note) => {
						await reportAlgSet(set.id, reason, note);
					}}
					onReported={() => setReported(true)}
				/>,
				{title: t('trainer.sets.report'), width: 460}
			)
		);
	}

	function edit() {
		if (!set) return;
		actions.openEdit(set, set.items, (next) => setView((prev) => ({...prev, set: {...next, items: set.items}})));
	}

	function shareOwn() {
		if (!set) return;
		if (set.visibility === 'private') {
			actions.openMenu(
				t('trainer.sets.share'),
				[
					{
						key: 'open',
						label: t('trainer.sets.open_sharing'),
						icon: <LinkSimple size={18} weight="bold" />,
						disabled: !canWrite,
						note: offlineNote,
						onSelect: edit,
					},
				],
				t('trainer.sets.share_private_hint')
			);
			return;
		}
		share(set);
	}

	function ownerMenu() {
		if (!set) return;
		const list: SheetAction[] = [
			{
				key: 'edit',
				label: t('trainer.sets.edit'),
				icon: <PencilSimple size={18} weight="bold" />,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: edit,
			},
			{
				key: 'reorder',
				label: t('trainer.sets.reorder'),
				icon: <ArrowsDownUp size={18} weight="bold" />,
				disabled: !canWrite || items.length < 2,
				note: !canWrite ? offlineNote : undefined,
				onSelect: () => setSorting(items.map((item) => item.id)),
			},
		];
		if (set.visibility !== 'private') {
			list.push({
				key: 'reset',
				label: t('trainer.sets.reset_link'),
				icon: <LinkSimple size={18} weight="bold" />,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () =>
					actions.confirmResetLink(set, (next) => {
						ownCodeChange.current = next.code;
						setView((prev) => ({...prev, code: next.code, set: next}));
						history.replace(buildSetPath(next.code));
					}),
			});
		}
		list.push({
			key: 'delete',
			label: t('trainer.sets.delete'),
			icon: <Trash size={18} weight="bold" />,
			danger: true,
			disabled: !canWrite,
			note: offlineNote,
			onSelect: () => actions.confirmDelete(set, () => history.push(MY_SETS_PATH)),
		});
		actions.openMenu(set.name, list);
	}

	function rowMenu(item: AlgSetItemData) {
		if (!set) return;
		actions.openMenu(item.case_name, [
			{
				key: 'variant',
				label: t('trainer.sets.change_algorithm'),
				icon: <Swap size={18} weight="bold" />,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () => changeAlgorithm(item),
			},
			{
				key: 'remove',
				label: t('trainer.sets.remove_from_set'),
				icon: <X size={18} weight="bold" />,
				danger: true,
				disabled: !canWrite,
				note: offlineNote,
				onSelect: () => removeItem(item),
			},
		]);
	}

	function changeAlgorithm(item: AlgSetItemData) {
		if (!set) return;
		const setId = set.id;
		reduxDispatch(
			openModal(
				<VariantSheet
					category={item.category}
					caseName={item.case_name}
					current={item.algorithm}
					signedIn={!!me}
					onPick={async (algorithm) => {
						const updated = await updateAlgSetItem(item.id, algorithm);
						setView((prev) => {
							if (!prev.set || prev.set.id !== setId) return prev;
							const next = {
								...prev.set,
								items: prev.set.items.map((row) =>
									row.id === item.id ? {...row, algorithm: updated.algorithm || algorithm} : row
								),
							};
							rememberAlgSet(next);
							return {...prev, set: next};
						});
					}}
				/>,
				{title: `${item.case_name} · ${t('trainer.sets.variant_title')}`, width: 460}
			)
		);
	}

	async function removeItem(item: AlgSetItemData) {
		if (!set) return;
		setBusy(`row:${item.id}`);
		try {
			applySet(await removeAlgSetItems(set.id, [item.id]));
		} catch (err) {
			fail(err);
		} finally {
			setBusy(null);
		}
	}

	async function finishSorting() {
		if (!set || !sorting) return;
		const before = items.map((item) => item.id);
		if (before.join() === sorting.join()) {
			setSorting(null);
			return;
		}
		setBusy('reorder');
		try {
			applySet(await reorderAlgSetItems(set.id, sorting));
			setSorting(null);
		} catch (err) {
			fail(err);
		} finally {
			setBusy(null);
		}
	}

	function openRow(item: AlgSetItemData) {
		reduxDispatch(
			openModal(<RowDetailSheet item={item} faces={faces} />, {title: item.case_name, width: 460, compact: true})
		);
	}

	// ── Render ──────────────────────────────────────────────────────────

	if (!set) {
		if (view.status === 'loading') {
			return (
				<div className={b('page', {set: true})}>
					<div className={b('set-head')}>
						{preview ? (
							<>
								<h1 className={b('set-name')}>{preview.name}</h1>
								<p className={b('set-meta')}>
									{preview.owner} · {t('trainer.sets.count', {count: preview.count})}
								</p>
							</>
						) : null}
						<p className={b('status')}>
							<CircleNotch className="spin" size={18} aria-hidden="true" /> {t('trainer.sets.loading')}
						</p>
					</div>
				</div>
			);
		}
		const message =
			view.status === 'not_found'
				? t('alg_set_errors.not_found')
				: view.status === 'offline'
					? t('trainer.sets.offline_needed')
					: t('trainer.sets.load_error');
		return (
			<div className={b('page', {set: true})}>
				<div className={b('empty')}>
					{view.status === 'offline' ? <WifiSlash size={28} aria-hidden="true" /> : null}
					<p>{message}</p>
					<Button gray text={t('trainer.sets.go_community')} to={COMMUNITY_PATH} />
				</div>
			</div>
		);
	}

	const showShare = isOwner || set.visibility === 'public';
	const sortingItems = sorting
		? sorting.map((id) => items.find((item) => item.id === id)).filter((item): item is AlgSetItemData => !!item)
		: null;

	const renderRow = (item: AlgSetItemData, index: number) => {
		const key = statsKey(item);
		const learned = me ? getLearnedStatus(key) : 0;
		const best = me ? getBestTime(key) : null;
		const changed = view.changed.has(item.id);
		const rowBusy = busy === `row:${item.id}`;
		return (
			<li
				key={item.id}
				className={b('row', {sorting: !!sorting, dragging: dragId === item.id, added: justAdded.has(item.id)})}
				draggable={!!sorting}
				onDragStart={sorting ? () => setDragId(item.id) : undefined}
				onDragOver={sorting ? (e) => e.preventDefault() : undefined}
				onDrop={
					sorting
						? (e) => {
								e.preventDefault();
								if (dragId) setSorting((ids) => (ids ? moveIdTo(ids, dragId, item.id) : ids));
								setDragId(null);
							}
						: undefined
				}
				onDragEnd={sorting ? () => setDragId(null) : undefined}
			>
				<button type="button" className={b('row-main')} onClick={() => !sorting && openRow(item)} disabled={!!sorting}>
					<span className={b('row-pattern')}>
						<CasePattern category={item.category} algorithm={trainerAlgText(item.algorithm)} {...facesFor(item.category, faces)} fit />
					</span>
					<span className={b('row-body')}>
						<span className={b('row-head')}>
							<span className={b('row-name')}>{item.case_name}</span>
							{sorting ? <span className={b('badge')}>{item.category}</span> : null}
							{changed ? <span className={b('changed-tag')}>{t('trainer.sets.alg_changed')}</span> : null}
						</span>
						<code className={b('row-alg')}>{item.algorithm}</code>
					</span>
					{!sorting && me ? (
						<span className={b('row-stats')}>
							{best ? (
								<span className={b('row-best')}>
									<span className={b('row-best-label')}>{t('trainer.card_best')}</span>
									{formatBestTime(best)}
								</span>
							) : null}
							{learned > 0 ? (
								<BookmarkSimple
									className={b('row-flag', {learned: learned === 2, learning: learned === 1})}
									size={18}
									weight="fill"
									aria-label={learned === 2 ? t('trainer.sets.flag_learned') : t('trainer.sets.flag_learning')}
								/>
							) : null}
						</span>
					) : null}
				</button>
				{sorting ? (
					<span className={b('row-move')}>
						<button
							type="button"
							className={b('icon-button')}
							disabled={index === 0}
							onClick={() => setSorting((ids) => (ids ? moveId(ids, item.id, -1) : ids))}
							aria-label={t('trainer.sets.move_up')}
						>
							<ArrowUp size={18} weight="bold" />
						</button>
						<button
							type="button"
							className={b('icon-button')}
							disabled={index === (sortingItems?.length || 0) - 1}
							onClick={() => setSorting((ids) => (ids ? moveId(ids, item.id, 1) : ids))}
							aria-label={t('trainer.sets.move_down')}
						>
							<ArrowDown size={18} weight="bold" />
						</button>
					</span>
				) : isOwner ? (
					<button
						type="button"
						className={b('icon-button')}
						onClick={() => rowMenu(item)}
						disabled={rowBusy}
						aria-label={t('trainer.sets.more_actions')}
						title={t('trainer.sets.more_actions')}
					>
						{rowBusy ? <CircleNotch className="spin" size={18} /> : <DotsThreeVertical size={20} weight="bold" />}
					</button>
				) : null}
			</li>
		);
	};

	return (
		<div className={b('page', {set: true})}>
			<div className={b('set-layout')}>
				<aside className={b('set-head')}>
					{set.hidden && isOwner ? (
						<p className={b('banner', {warning: true})} role="status">
							<EyeSlash size={16} weight="bold" aria-hidden="true" />
							{t('trainer.sets.hidden_banner')}
						</p>
					) : null}
					{view.fromCache && !online ? (
						<p className={b('banner')} role="status">
							<WifiSlash size={16} weight="bold" aria-hidden="true" />
							{t('trainer.sets.offline_copy')}
						</p>
					) : null}

					<div className={b('set-title-row')}>
						<h1 className={b('set-name')}>{set.name}</h1>
						<button
							type="button"
							className={b('icon-button')}
							onClick={isOwner ? ownerMenu : () => actions.openMenu(set.name, otherMenu())}
							aria-label={t('trainer.sets.more_actions')}
							title={t('trainer.sets.more_actions')}
							hidden={!isOwner && !me}
						>
							<DotsThreeVertical size={22} weight="bold" />
						</button>
					</div>

					<OwnerChip owner={set.owner} />
					{set.description ? <p className={b('set-description')}>{set.description}</p> : null}

					<p className={b('set-meta')}>
						<span>{t('trainer.sets.count', {count: set.item_count || items.length})}</span>
						{set.visibility !== 'private' ? (
							<span>{t('trainer.sets.saves_count', {count: set.save_count})}</span>
						) : null}
						<VisibilityTag visibility={set.visibility} />
					</p>
					{me && items.length > 0 ? (
						<p className={b('set-meta')}>{t('trainer.sets.progress', progress)}</p>
					) : null}
					<CategoryBadges categories={groups.map((g) => g.category)} max={8} />

					<div className={b('set-actions')}>
						<StudyModeSwitch block />
						<Button
							primary
							large
							fullWidth
							icon={<Play weight="fill" />}
							iconFirst
							text={t('trainer.sets.study')}
							disabled={items.length === 0 || !!sorting}
							onClick={study}
						/>
						<div className={b('set-actions-row')}>
							{isOwner ? (
								<Button
									gray
									fullWidth
									icon={<Plus weight="bold" />}
									iconFirst
									text={t('trainer.sets.add_algorithms')}
									disabled={!canWrite || !!sorting}
									title={!canWrite ? offlineNote : undefined}
									onClick={() => history.push(buildSetPath(set.code, true))}
								/>
							) : (
								<Button
									gray
									fullWidth
									icon={<BookmarkSimple weight={set.is_saved ? 'fill' : 'bold'} />}
									iconFirst
									text={set.is_saved ? t('trainer.sets.unsave') : t('trainer.sets.save')}
									loading={busy === 'save'}
									disabled={busy === 'save' || (!!me && !canWrite)}
									title={me && !canWrite ? offlineNote : undefined}
									onClick={toggleSave}
								/>
							)}
							{showShare ? (
								<Button
									gray
									fullWidth
									icon={<LinkSimple weight="bold" />}
									iconFirst
									text={t('trainer.sets.share')}
									onClick={isOwner ? shareOwn : () => share(set)}
								/>
							) : null}
						</div>
					</div>
				</aside>

				<section className={b('set-rows')}>
					{sorting ? (
						<div className={b('sort-bar')}>
							<span>{t('trainer.sets.reorder_hint')}</span>
							<span className={b('sort-bar-actions')}>
								<Button gray text={t('trainer.sets.cancel')} onClick={() => setSorting(null)} disabled={busy === 'reorder'} />
								<Button
									primary
									text={t('trainer.sets.done')}
									loading={busy === 'reorder'}
									disabled={busy === 'reorder'}
									onClick={finishSorting}
								/>
							</span>
						</div>
					) : null}

					{items.length === 0 ? (
						<div className={b('empty')}>
							<p>{t('trainer.sets.empty_set')}</p>
							{isOwner ? (
								<Button
									primary
									icon={<Plus weight="bold" />}
									iconFirst
									text={t('trainer.sets.add_algorithms')}
									disabled={!canWrite}
									onClick={() => history.push(buildSetPath(set.code, true))}
								/>
							) : null}
						</div>
					) : sortingItems ? (
						<ol className={b('rows')}>{sortingItems.map(renderRow)}</ol>
					) : (
						groups.map((group) => (
							<div key={group.category} className={b('group')}>
								<h2 className={b('group-title')}>
									{group.category}
									<span className={b('group-count')}>{group.items.length}</span>
								</h2>
								<ul className={b('rows')}>{group.items.map(renderRow)}</ul>
							</div>
						))
					)}

					{!me ? (
						<p className={b('signin-note')}>
							<Link to={loginRedirectPath(here)}>{t('trainer.sets.signin_hint')}</Link>
						</p>
					) : null}
				</section>
			</div>
		</div>
	);

	function otherMenu(): SheetAction[] {
		return [
			{
				key: 'report',
				label: reported ? t('trainer.sets.reported') : t('trainer.sets.report'),
				icon: <Flag size={18} weight="bold" />,
				disabled: reported || !canWrite,
				note: reported ? undefined : offlineNote,
				onSelect: report,
			},
		];
	}
}
