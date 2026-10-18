/**
 * CommunitySets: the "Community Sets" page of Algorithm Sets (trainer-sets 7.3, 4.6, 7.8).
 *
 * Search, New / Popular, and a puzzle dropdown, all written to the address (?q, ?sort, ?puzzle)
 * so back and a shared link give the same list. 24 sets per request, the next page when the
 * end of the list comes into view; sets already listed are skipped (popular order can shift
 * between pages). Open to signed out visitors (2.4); needs a connection.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {CaretDown, CircleNotch, MagnifyingGlass, WifiSlash, X} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {useOnlineStatus} from '../../../util/hooks/useOnlineStatus';
import {COMMUNITY_PATH, buildSetPath} from '../../../util/trainer/url/trainer_url';
import {fetchCommunityAlgSets} from '../../../lib/alg_sets/api';
import {ALG_SET_COMMUNITY, ALG_SET_COMMUNITY_SORTS} from '../../../../shared/trainer/alg_sets';
import AlgSetCard from './AlgSetCard';
import {
	COMMUNITY_PUZZLES,
	buildCommunitySearch,
	mergeById,
	parseCommunitySearch,
	type CommunityFilters,
} from './set_ui';
import type {AlgSetSummaryData} from '../../../lib/alg_sets/types';
import './AlgSets.scss';

const b = block('alg-sets');
const SEARCH_DEBOUNCE_MS = 350;

type Status = 'loading' | 'ready' | 'error';

export default function CommunitySets() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const online = useOnlineStatus();

	const filters = parseCommunitySearch(location.search);
	const filterKey = `${filters.q.trim()}|${filters.sort}|${filters.puzzle || ''}`;

	const [query, setQuery] = useState(filters.q);
	const [items, setItems] = useState<AlgSetSummaryData[]>([]);
	const [page, setPage] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [status, setStatus] = useState<Status>('loading');
	const [loadingMore, setLoadingMore] = useState(false);
	const requestRef = useRef(0);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const setFilters = useCallback(
		(next: Partial<CommunityFilters>) => {
			const current = parseCommunitySearch(history.location.search);
			const merged = {...current, ...next};
			history.replace(COMMUNITY_PATH + buildCommunitySearch(merged));
		},
		[history]
	);

	// Typing waits a moment before it becomes the address (and a request).
	useEffect(() => {
		if (query.trim() === filters.q.trim()) return;
		const timer = setTimeout(() => setFilters({q: query}), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query, filters.q, setFilters]);

	// Back / forward changed the address: the box follows.
	// (A trailing space the user is still typing is kept.)
	useEffect(() => {
		setQuery((prev) => (prev.trim() === filters.q.trim() ? prev : filters.q));
	}, [filters.q]);

	const load = useCallback(
		(pageIndex: number) => {
			const id = ++requestRef.current;
			const f = parseCommunitySearch(history.location.search);
			const q = f.q.trim();
			if (pageIndex === 0) setStatus('loading');
			else setLoadingMore(true);

			fetchCommunityAlgSets({
				q: q.length >= ALG_SET_COMMUNITY.QUERY_MIN_LENGTH ? q : null,
				sort: f.sort,
				puzzle: f.puzzle,
				page: pageIndex,
				page_size: ALG_SET_COMMUNITY.DEFAULT_PAGE_SIZE,
			})
				.then((res) => {
					if (id !== requestRef.current) return;
					setItems((prev) => (pageIndex === 0 ? res.items : mergeById(prev, res.items)));
					setPage(pageIndex);
					setHasMore(res.has_more);
					setStatus('ready');
				})
				.catch(() => {
					if (id !== requestRef.current) return;
					if (pageIndex === 0) {
						setItems([]);
						setStatus('error');
					}
					setHasMore(false);
				})
				.finally(() => {
					if (id === requestRef.current) setLoadingMore(false);
				});
		},
		[history]
	);

	useEffect(() => {
		if (!online) return;
		load(0);
	}, [filterKey, online, load]);

	// The next page when the end of the list scrolls into view.
	useEffect(() => {
		const node = sentinelRef.current;
		if (!node || !hasMore || status !== 'ready' || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && !loadingMore) load(page + 1);
			},
			{rootMargin: '300px'}
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [hasMore, status, loadingMore, page, load]);

	const open = (set: AlgSetSummaryData) => history.push(buildSetPath(set.code));
	const filtered = !!filters.q.trim() || !!filters.puzzle;

	return (
		<div className={b('page')}>
			<div className={b('filters')}>
				<label className={b('search')}>
					<MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
					<input
						type="search"
						value={query}
						maxLength={ALG_SET_COMMUNITY.QUERY_MAX_LENGTH}
						placeholder={t('trainer.sets.search_placeholder')}
						aria-label={t('trainer.sets.search_placeholder')}
						onChange={(e) => setQuery(e.target.value)}
					/>
					{query ? (
						<button
							type="button"
							className={b('search-clear')}
							onClick={() => {
								setQuery('');
								setFilters({q: ''});
							}}
							aria-label={t('trainer.sets.clear_search')}
						>
							<X size={16} weight="bold" />
						</button>
					) : null}
				</label>

				<div className={b('chips')} role="radiogroup" aria-label={t('trainer.sets.sort_label')}>
					{ALG_SET_COMMUNITY_SORTS.map((sort) => (
						<button
							key={sort}
							type="button"
							role="radio"
							aria-checked={filters.sort === sort}
							className={b('chip', {active: filters.sort === sort})}
							onClick={() => setFilters({sort})}
						>
							{t(`trainer.sets.sort_${sort}`)}
						</button>
					))}
				</div>

				{/* Puzzle filter: one dropdown instead of a chip per puzzle (owner, 2026-10-13). */}
				<label className={b('puzzle-select')}>
					<select
						value={filters.puzzle || ''}
						aria-label={t('trainer.sets.puzzle_label')}
						onChange={(e) => {
							const picked = COMMUNITY_PUZZLES.find((p) => p.key === e.target.value);
							setFilters({puzzle: picked ? picked.key : null});
						}}
					>
						<option value="">{t('trainer.sets.puzzle_all')}</option>
						{COMMUNITY_PUZZLES.map((p) => (
							<option key={p.key} value={p.key}>
								{p.label}
							</option>
						))}
					</select>
					<CaretDown className={b('puzzle-caret')} size={14} weight="bold" aria-hidden="true" />
				</label>
			</div>

			{!online ? (
				<p className={b('banner')} role="status">
					<WifiSlash size={16} weight="bold" aria-hidden="true" />
					{t('trainer.sets.offline_needed')}
				</p>
			) : status === 'loading' ? (
				<p className={b('status')}>
					<CircleNotch className="spin" size={18} aria-hidden="true" /> {t('trainer.sets.loading_list')}
				</p>
			) : status === 'error' ? (
				<div className={b('empty')}>
					<p>{t('trainer.sets.load_error')}</p>
					<Button gray text={t('trainer.sets.retry')} onClick={() => load(0)} />
				</div>
			) : items.length === 0 ? (
				<div className={b('empty')}>
					<p>{filtered ? t('trainer.sets.empty_search') : t('trainer.sets.empty_community')}</p>
				</div>
			) : (
				<>
					<div className={b('grid', {community: true})}>
						{items.map((set) => (
							<AlgSetCard key={set.id} set={set} variant="community" onOpen={open} />
						))}
					</div>
					<div ref={sentinelRef} className={b('sentinel')}>
						{loadingMore ? <CircleNotch className="spin" size={20} aria-hidden="true" /> : null}
					</div>
				</>
			)}
		</div>
	);
}
