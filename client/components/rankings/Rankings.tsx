import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {MagnifyingGlass, Trophy} from 'phosphor-react';
import PageTitle from '../common/page_title/PageTitle';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import OfflineGuard from '../common/offline_guard/OfflineGuard';
import Button from '../common/button/Button';
import LoadingIcon from '../common/LoadingIcon';
import block from '../../styles/bem';
import {gqlQueryTyped} from '../api';
import {
	BattleLeaderboardDocument,
	BattleLeaderboardRowFragmentFragment,
	MyBattleRatingDocument,
	MyBattleRatingQuery,
} from '../../@types/generated/graphql';
import {useMe} from '../../util/hooks/useMe';
import {BATTLE_PUZZLE, LEADERBOARD_PAGE_SIZE} from '../../../shared/battle/config';
import {useBattleLaunch} from '../battle/useBattleLaunch';
import {ONLINE_BATTLE_PATH} from '../battle/battle_landing_modes';
import {avatarSrc} from '../battle/online/OpponentBar';
import {
	SEARCH_DEBOUNCE_MS,
	SEARCH_MAX_LENGTH,
	appendLeaderboardRows,
	hasMoreRows,
	normalizeSearch,
	pickRankingsView,
	winRatePercent,
} from './rankings_view';
import './Rankings.scss';

const b = block('rankings');

type LeaderboardRow = BattleLeaderboardRowFragmentFragment;
type MyRating = NonNullable<MyBattleRatingQuery['myBattleRating']>;

/**
 * /ranks: the Online Battle leaderboard (ranking-battle 5.6). The order comes from the
 * cautious rating (rating - 2 x uncertainty, server side), the number shown is the rating
 * itself, so a provisional "?" player can sit below someone with a lower number.
 *
 * Until Online Battle is open to this viewer (site flag off, not an admin) the page keeps the
 * empty state R1 put here; it is out of the menu and the index until launch (B5).
 */
export default function Rankings() {
	const {t} = useTranslation();
	const view = pickRankingsView(useBattleLaunch());

	return (
		<FeatureGuard feature="leaderboards_enabled" pageNameKey="nav.ranks">
			<div className={b()}>
				<PageTitle pageName={t('ranks.title')} />

				<div className={b('inner')}>
					{/* The page's own heading on a desktop; a phone shows the title in its top bar. */}
					<header className={b('head')}>
						<h1 className={b('title')}>{t('ranks.title')}</h1>
						{/* The subtitle explains the list order, so it goes with the list. */}
						{view === 'board' && <p className={b('subtitle')}>{t('ranks.subtitle')}</p>}
					</header>
					{view === 'board' ? (
						<OfflineGuard>
							<RankingsBoard />
						</OfflineGuard>
					) : (
						<ComingSoon />
					)}
				</div>
			</div>
		</FeatureGuard>
	);
}

function ComingSoon() {
	const {t} = useTranslation();

	return (
		<div className={b('coming-soon')}>
			<Trophy className={b('coming-soon-icon')} size={40} weight="duotone" />
			<p className={b('coming-soon-body')}>{t('ranks.coming_soon_body')}</p>
			<Button primary text={t('ranks.coming_soon_cta')} to="/battle" />
		</div>
	);
}

/** The signed-in player's own rating; asked once per visit, never on the server. */
function useMyRating(signedIn: boolean): {rating: MyRating | null; loaded: boolean} {
	const [state, setState] = useState<{rating: MyRating | null; loaded: boolean}>({rating: null, loaded: false});

	useEffect(() => {
		if (!signedIn) {
			setState({rating: null, loaded: true});
			return;
		}
		let alive = true;
		gqlQueryTyped(MyBattleRatingDocument, {puzzle: BATTLE_PUZZLE}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (alive) setState({rating: res?.data?.myBattleRating || null, loaded: true});
			})
			.catch(() => {
				if (alive) setState({rating: null, loaded: true});
			});
		return () => {
			alive = false;
		};
	}, [signedIn]);

	return state;
}

type BoardStatus = 'loading' | 'ready' | 'error';

function RankingsBoard() {
	const {t} = useTranslation();
	const me = useMe();
	const myRating = useMyRating(!!me);

	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [rows, setRows] = useState<LeaderboardRow[]>([]);
	const [pagesLoaded, setPagesLoaded] = useState(0);
	const [total, setTotal] = useState(0);
	const [pageSize, setPageSize] = useState(LEADERBOARD_PAGE_SIZE);
	const [status, setStatus] = useState<BoardStatus>('loading');
	const [loadingMore, setLoadingMore] = useState(false);
	const [hintFor, setHintFor] = useState<string | null>(null);
	// Only the newest request may write; a slow page for an old search term is dropped.
	const requestRef = useRef(0);

	useEffect(() => {
		const id = setTimeout(() => setSearch(normalizeSearch(searchInput)), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [searchInput]);

	const loadPage = useCallback(async (page: number, term: string) => {
		const request = ++requestRef.current;
		if (page === 0) setStatus('loading');
		else setLoadingMore(true);

		try {
			const res = await gqlQueryTyped(
				BattleLeaderboardDocument,
				{puzzle: BATTLE_PUZZLE, page, search: term || null},
				{fetchPolicy: 'no-cache'}
			);
			if (request !== requestRef.current) return;
			const data = res?.data?.battleLeaderboard;
			const next = (data?.rows || []).filter(Boolean) as LeaderboardRow[];
			setRows((prev) => (page === 0 ? next : appendLeaderboardRows(prev, next)));
			setPagesLoaded(page + 1);
			setTotal(data?.total_count || 0);
			setPageSize(data?.page_size || LEADERBOARD_PAGE_SIZE);
			setStatus('ready');
		} catch (e) {
			if (request !== requestRef.current) return;
			// A failed "more" keeps the rows already shown; only a failed first page is an error.
			if (page === 0) setStatus('error');
		} finally {
			if (request === requestRef.current) setLoadingMore(false);
		}
	}, []);

	useEffect(() => {
		setHintFor(null);
		loadPage(0, search);
	}, [search, loadPage]);

	function toggleHint(key: string) {
		setHintFor((cur) => (cur === key ? null : key));
	}

	const canLoadMore = status === 'ready' && hasMoreRows(pagesLoaded, pageSize, total);

	let list: React.ReactNode;
	if (status === 'loading') {
		list = (
			<div className={b('state')}>
				<LoadingIcon />
			</div>
		);
	} else if (status === 'error') {
		list = (
			<div className={b('state')}>
				<p className={b('state-text')}>{t('ranks.load_error')}</p>
				<Button text={t('ranks.retry')} onClick={() => loadPage(0, search)} />
			</div>
		);
	} else if (!rows.length) {
		list = (
			<div className={b('state')}>
				<p className={b('state-text')}>{search ? t('ranks.no_results') : t('ranks.empty')}</p>
			</div>
		);
	} else {
		list = (
			<ol className={b('list')}>
				{rows.map((row) => (
					<LeaderboardItem
						key={row.user_id}
						row={row}
						isMe={!!me && row.user_id === me.id}
						hintOpen={hintFor === row.user_id}
						onToggleHint={() => toggleHint(row.user_id)}
					/>
				))}
			</ol>
		);
	}

	return (
		<div className={b('board')}>
			<MyCard
				signedIn={!!me}
				rating={myRating.rating}
				loaded={myRating.loaded}
				hintOpen={hintFor === 'me'}
				onToggleHint={() => toggleHint('me')}
			/>

			<div className={b('toolbar')}>
				<label className={b('search')}>
					<MagnifyingGlass className={b('search-icon')} weight="bold" aria-hidden="true" />
					<input
						type="search"
						className={b('search-input')}
						value={searchInput}
						maxLength={SEARCH_MAX_LENGTH}
						placeholder={t('ranks.search_placeholder')}
						aria-label={t('ranks.search_placeholder')}
						onChange={(e) => setSearchInput(e.target.value)}
					/>
				</label>
				<span className={b('puzzle')}>3x3</span>
			</div>

			{status === 'ready' && rows.length > 0 && (
				<div className={b('cols')} aria-hidden="true">
					<span>#</span>
					<span>{t('ranks.col_player')}</span>
					<span className={b('cols-end')} lang="en">
						{t('ranks.col_rating')}
					</span>
					<span className={b('cols-end')}>{t('ranks.col_games')}</span>
					<span className={b('cols-end')}>{t('ranks.col_win')}</span>
				</div>
			)}

			{list}

			{canLoadMore && (
				<div className={b('more')}>
					<Button text={t('ranks.load_more')} loading={loadingMore} onClick={() => loadPage(pagesLoaded, search)} />
				</div>
			)}
		</div>
	);
}

interface MyCardProps {
	signedIn: boolean;
	rating: MyRating | null;
	loaded: boolean;
	hintOpen: boolean;
	onToggleHint: () => void;
}

/** Own standing on top, or the way into the first match (3.0-g: one match puts you on the list). */
function MyCard({signedIn, rating, loaded, hintOpen, onToggleHint}: MyCardProps) {
	const {t} = useTranslation();

	if (signedIn && !loaded) return null;

	if (!rating || !rating.games) {
		return (
			<div className={b('me', {cta: true})}>
				<p className={b('me-cta')}>{t('ranks.first_match_cta')}</p>
				<Button primary text={t('ranks.play_online')} to={ONLINE_BATTLE_PATH} />
			</div>
		);
	}

	const rate = winRatePercent(rating.wins, rating.games);
	const stats: [string, string][] = [
		[t('ranks.col_rank'), rating.rank != null ? `#${rating.rank}` : '-'],
		[t('ranks.col_games'), String(rating.games || 0)],
		[t('ranks.col_win'), rate != null ? t('ranks.win_rate', {value: rate}) : '-'],
	];

	// Own standing: the rating large in mono, rank, games and win rate as labelled figures.
	return (
		<div className={b('me')}>
			<div className={b('me-main')}>
				<span className={b('label')}>{t('ranks.you')}</span>
				<span className={b('me-rating')}>
					<RatingValue rating={rating.rating} provisional={!!rating.provisional} onToggleHint={onToggleHint} hintOpen={hintOpen} />
				</span>
			</div>
			<dl className={b('me-stats')}>
				{stats.map(([label, value]) => (
					<div key={label} className={b('me-stat')}>
						<dt className={b('label')}>{label}</dt>
						<dd className={b('me-stat-value')}>{value}</dd>
					</div>
				))}
			</dl>
			{hintOpen && <p className={b('hint', {me: true})}>{t('ranks.provisional_hint')}</p>}
		</div>
	);
}

interface RatingValueProps {
	rating: number | null | undefined;
	provisional: boolean;
	hintOpen: boolean;
	onToggleHint: () => void;
}

function RatingValue({rating, provisional, hintOpen, onToggleHint}: RatingValueProps) {
	const {t} = useTranslation();

	return (
		<span className={b('rating')}>
			{rating ?? ''}
			{provisional && (
				<button
					type="button"
					className={b('provisional')}
					aria-label={t('ranks.provisional')}
					title={t('ranks.provisional')}
					aria-expanded={hintOpen}
					onClick={onToggleHint}
				>
					?
				</button>
			)}
		</span>
	);
}

interface LeaderboardItemProps {
	row: LeaderboardRow;
	isMe: boolean;
	hintOpen: boolean;
	onToggleHint: () => void;
}

function LeaderboardItem({row, isMe, hintOpen, onToggleHint}: LeaderboardItemProps) {
	const {t} = useTranslation();
	const src = avatarSrc(row.pfp_image_url);
	const name = row.username || '';
	const rate = winRatePercent(row.wins, row.games);

	return (
		<li className={b('row', {me: isMe})}>
			<span className={b('rank')}>{row.rank}</span>
			<Link className={b('player')} to={`/user/${encodeURIComponent(name)}`}>
				<span className={b('avatar')} aria-hidden="true">
					{src ? <img src={src} alt="" loading="lazy" /> : name.charAt(0).toUpperCase()}
				</span>
				<span className={b('name')}>{name}</span>
			</Link>
			<RatingValue rating={row.rating} provisional={!!row.provisional} hintOpen={hintOpen} onToggleHint={onToggleHint} />
			{/* Two columns on a desktop (games, win rate); one line under the name on a phone. */}
			<span className={b('meta')}>
				<span className={b('games')}>
					<span className={b('games-full')}>{t('ranks.games', {count: row.games || 0})}</span>
					<span className={b('games-num')}>{row.games || 0}</span>
				</span>
				<span className={b('win')}>{rate != null ? t('ranks.win_rate', {value: rate}) : '-'}</span>
			</span>
			{hintOpen && <p className={b('hint', {row: true})}>{t('ranks.provisional_hint')}</p>}
		</li>
	);
}
