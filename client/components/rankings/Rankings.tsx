import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useLocation} from 'react-router-dom';
import {MagnifyingGlass, Trophy, Medal, Crown} from 'phosphor-react';
import {gqlQuery, gqlQueryTyped} from '../api';
import {RankingsDocument} from '../../@types/generated/graphql';
import gql from 'graphql-tag';
import {useMe} from '../../util/hooks/useMe';
import {resourceUri, getStorageURL} from '../../util/storage';
import {LINKED_SERVICES} from '../../../shared/integration';
import {countryFlag} from '../community/my_schedule/shared';
import PageTitle from '../common/page_title/PageTitle';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import block from '../../styles/bem';
import './Rankings.scss';

const b = block('rankings');

type RankingMode = 'kinch' | 'sor_single' | 'sor_average';

interface RankedUser {
	rank: number;
	user_id: string;
	username: string;
	is_pro: boolean;
	wca_id: string;
	country_iso2: string;
	score: number;
	wca_competition_count?: number;
	wca_medal_gold?: number;
	wca_medal_silver?: number;
	wca_medal_bronze?: number;
	pfp_image_url?: string;
}

const MODES: {key: RankingMode; label: string}[] = [
	{key: 'kinch', label: 'ranks.kinch'},
	{key: 'sor_single', label: 'ranks.sor_single'},
	{key: 'sor_average', label: 'ranks.sor_average'},
];

export default function Rankings() {
	const {t} = useTranslation();
	const me = useMe();
	const history = useHistory();
	const location = useLocation();

	const params = new URLSearchParams(location.search);
	const initialMode = (params.get('mode') as RankingMode) || 'kinch';
	const initialPage = parseInt(params.get('page') || '0', 10);

	const [mode, setMode] = useState<RankingMode>(initialMode);
	const [page, setPage] = useState(initialPage);
	const [search, setSearch] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const [rows, setRows] = useState<RankedUser[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [hasWca, setHasWca] = useState<boolean | null>(null);

	// WCA bagli mi kontrol et
	useEffect(() => {
		if (!me) {
			setHasWca(false);
			return;
		}
		(async () => {
			try {
				const res = await gqlQuery(
					gql`query CheckWca($type: IntegrationType!) { integration(integrationType: $type) { wca_id } }`,
					{type: 'wca'}
				);
				setHasWca(!!res.data?.integration?.wca_id);
			} catch {
				setHasWca(false);
			}
		})();
	}, [me]);

	useEffect(() => {
		const timer = setTimeout(() => setSearchDebounced(search), 300);
		return () => clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		const p = new URLSearchParams();
		p.set('mode', mode);
		if (page > 0) p.set('page', String(page));
		history.replace({search: p.toString()});
	}, [mode, page]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		(async () => {
			try {
				const res = await gqlQueryTyped(RankingsDocument, {
					mode,
					page: searchDebounced ? 0 : page,
					search: searchDebounced || null,
				});
				if (cancelled) return;
				const data = res.data?.rankings;
				if (data) {
					setRows(data.rows as RankedUser[]);
					setTotalCount(data.total_count);
				}
			} catch (err) {
				console.error('[Rankings] Fetch error:', err);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => { cancelled = true; };
	}, [mode, page, searchDebounced]);

	const totalPages = Math.ceil(totalCount / 50);
	const isKinch = mode === 'kinch';

	function formatScore(score: number): string {
		if (isKinch) return score.toFixed(2);
		return score.toLocaleString('en-US');
	}

	function handleWcaLink() {
		const service = LINKED_SERVICES.wca;
		const wcaParams = new URLSearchParams({
			client_id: service.clientId,
			response_type: service.responseType,
			scope: service.scope.join(' '),
			redirect_uri: window.location.origin + (!me ? '/oauth/wca/login' : '/oauth/wca'),
			state: '/ranks',
		});
		window.location.href = `${service.authEndpoint}?${wcaParams.toString()}`;
	}

	function getUserInitial(username: string): string {
		return (username || '?').charAt(0).toUpperCase();
	}

	function renderCard(row: RankedUser) {
		const totalMedals = (row.wca_medal_gold || 0) + (row.wca_medal_silver || 0) + (row.wca_medal_bronze || 0);

		return (
			<div
				key={row.user_id}
				className={b('card', {
					gold: row.rank === 1,
					silver: row.rank === 2,
					bronze: row.rank === 3,
				})}
				onClick={() => history.push(`/user/${row.username}`)}
			>
				{/* Rank */}
				<div className={b('card-rank')}>
					<span className={b('rank-num', {
						gold: row.rank === 1,
						silver: row.rank === 2,
						bronze: row.rank === 3,
					})}>
						{row.rank}
					</span>
				</div>

				{/* Avatar */}
				<div className={b('card-avatar', {pro: row.is_pro})}>
					{row.pfp_image_url ? (
						<img
							src={getStorageURL(row.pfp_image_url)}
							alt={row.username}
							className={b('avatar-img')}
						/>
					) : (
						<div className={b('avatar-fallback')}>
							{getUserInitial(row.username)}
						</div>
					)}
				</div>

				{/* Info */}
				<div className={b('card-info')}>
					<div className={b('card-name-row')}>
						<span className={b('flag')}>{countryFlag(row.country_iso2)}</span>
						<span className={b('username')}>{row.username}</span>
						{row.is_pro && <span className={b('pro-badge')}>PRO</span>}
					</div>
					<span className={b('wca-id')}>{row.wca_id}</span>
					{/* Stats row */}
					<div className={b('card-stats')}>
						{row.wca_competition_count > 0 && (
							<span className={b('stat')}>
								<Trophy size={12} weight="fill" />
								{row.wca_competition_count}
							</span>
						)}
						{row.wca_medal_gold > 0 && (
							<span className={b('stat', {gold: true})}>
								<Crown size={12} weight="fill" />
								{row.wca_medal_gold}
							</span>
						)}
						{row.wca_medal_silver > 0 && (
							<span className={b('stat', {silver: true})}>
								<Medal size={12} weight="fill" />
								{row.wca_medal_silver}
							</span>
						)}
						{row.wca_medal_bronze > 0 && (
							<span className={b('stat', {bronze: true})}>
								<Medal size={12} weight="fill" />
								{row.wca_medal_bronze}
							</span>
						)}
					</div>
				</div>

				{/* Score */}
				<div className={b('card-score')}>
					<span className={b('score-value')}>{formatScore(row.score)}</span>
					<span className={b('score-label')}>
						{isKinch ? t('ranks.score') : t('ranks.sum')}
					</span>
				</div>
			</div>
		);
	}

	return (
		<FeatureGuard feature="leaderboards_enabled" pageNameKey="nav.ranks">
		<div className={b()}>
			<PageTitle pageName={t('ranks.title')} />

			<div className={b('inner')}>
				{/* WCA Banner — sadece WCA bagli degilse goster */}
				{me && hasWca === false && (
					<div className={b('wca-banner')}>
						<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-banner-logo')} />
						<div className={b('wca-banner-body')}>
							<h3 className={b('wca-banner-title')}>{t('ranks.link_wca_title')}</h3>
							<p className={b('wca-banner-desc')}>{t('ranks.link_wca_desc')}</p>
							<button className={b('wca-banner-btn')} onClick={handleWcaLink}>
								{t('ranks.link_wca_button')}
							</button>
						</div>
					</div>
				)}
				{!me && (
					<div className={b('wca-banner')}>
						<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-banner-logo')} />
						<div className={b('wca-banner-body')}>
							<h3 className={b('wca-banner-title')}>{t('ranks.login_title')}</h3>
							<p className={b('wca-banner-desc')}>{t('ranks.login_desc')}</p>
							<button className={b('wca-banner-btn')} onClick={handleWcaLink}>
								{t('ranks.login_button')}
							</button>
						</div>
					</div>
				)}

				{/* Tabs */}
				<div className={b('tabs')}>
					{MODES.map((m) => (
						<button
							key={m.key}
							className={b('tab', {active: mode === m.key})}
							onClick={() => { setMode(m.key); setPage(0); }}
						>
							{t(m.label)}
						</button>
					))}
				</div>

				{/* Search */}
				<div className={b('search-box')}>
					<MagnifyingGlass size={18} weight="bold" />
					<input
						type="text"
						className={b('search-input')}
						placeholder={t('ranks.search_placeholder')}
						value={search}
						onChange={(e) => { setSearch(e.target.value); setPage(0); }}
					/>
				</div>

				{/* Content */}
				<div className={b('content')}>
					{loading ? (
						<div className={b('state')}>
							<div className={b('spinner')} />
						</div>
					) : rows.length === 0 ? (
						<div className={b('state')}>
							<p className={b('empty-text')}>{t('ranks.no_results')}</p>
						</div>
					) : (
						<>
							<div className={b('card-list')}>
								{rows.map(renderCard)}
							</div>

							{!searchDebounced && totalPages > 1 && (
								<div className={b('pagination')}>
									<button
										className={b('page-btn')}
										disabled={page === 0}
										onClick={() => setPage(Math.max(0, page - 1))}
									>
										&#9664;
									</button>
									{Array.from({length: Math.min(5, totalPages)}, (_, i) => {
										const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
										const pageNum = startPage + i;
										if (pageNum >= totalPages) return null;
										return (
											<button
												key={pageNum}
												className={b('page-btn', {active: pageNum === page})}
												onClick={() => setPage(pageNum)}
											>
												{pageNum + 1}
											</button>
										);
									})}
									<button
										className={b('page-btn')}
										disabled={page >= totalPages - 1}
										onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
									>
										&#9654;
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
		</FeatureGuard>
	);
}
