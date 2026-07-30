import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory, useRouteMatch, useLocation} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, formatDateRange, getEventName} from './shared';
import ZktInfoTab from './tabs/ZktInfoTab';
import ZktCompetitorsTab from './tabs/ZktCompetitorsTab';
import ZktEventsTab from './tabs/ZktEventsTab';
import ZktLiveTab from './tabs/ZktLiveTab';
import ZktPodiumsTab from './tabs/ZktPodiumsTab';
import ZktScheduleTab from './tabs/ZktScheduleTab';
import {Users, ListBullets, Globe, Broadcast, ChartBar, FileText, CalendarBlank, MapPin, ShieldCheck} from 'phosphor-react';
import MarkdownContent from './MarkdownContent';
import {openInMaps} from '../../../util/external-link';
import {toastError} from '../../../util/toast';

// Read-only view of a competition owned by the Zeka Kupu Turkiye federation.
// Data comes from the federation public API (proxied + Redis-cached by
// ZktPublic.resolver), so competitors are opaque-keyed and every result already
// carries ranking + record tags + advancement. Registration / follow / "my
// results" live on the federation site, not here (view-only consumer).
const DETAIL_QUERY = gql`
	query ZktPublicCompetition($id: String!) {
		zktPublicCompetition(id: $id) {
			id
			slug
			name
			description
			startDate
			endDate
			location
			locationAddress
			latitude
			longitude
			country
			status
			championshipType
			mainEventId
			contact
			registrationCount
			days {
				position
				label
				date
			}
			competitors {
				id
				name
				wcaId
				externalId
				country
				avatarUrl
				isGhost
				registrationNumber
				registeredEventIds
				dayIndex
				dayLabel
			}
			delegates {
				name
			}
			organizers {
				name
			}
			tabs {
				id
				title
				content
				order
			}
			events {
				eventId
				eventName
				rounds {
					roundId
					roundNumber
					format
					status
					advancementType
					advancementLevel
					cutoffCs
					cutoffAttempts
					timeLimitCs
					dayIndex
					dayLabel
					isFinal
					groups {
						groupId
						groupNumber
						startTime
						endTime
						dayIndex
						dayLabel
					}
				}
			}
			schedule {
				id
				title
				startTime
				endTime
			}
			podiums {
				eventId
				eventName
				dayLabel
				entries {
					competitor {
						id
						name
						wcaId
						externalId
						country
						avatarUrl
						isGhost
					}
					ranking
					best
					average
					recordTags {
						single
						average
					}
					attempts
				}
			}
		}
	}
`;

// Module-level SWR cache: revisits + tab switches render instantly from cache
// while a background refetch keeps it fresh (mirrors WCA CompetitionLoader).
const detailCache = new Map<string, {data: any; ts: number}>();
const FRESH_TTL = 60 * 60 * 1000; // 1h

export async function prefetchZktCompetitionDetail(id: string): Promise<void> {
	if (!id) return;
	const cached = detailCache.get(id);
	if (cached && Date.now() - cached.ts < FRESH_TTL) return;
	try {
		const res = await gqlMutate(DETAIL_QUERY, {id});
		const data = res?.data?.zktPublicCompetition;
		if (data) detailCache.set(id, {data, ts: Date.now()});
	} catch {
		// best-effort prefetch
	}
}

type TabId = 'groups' | 'live' | 'events' | 'rankings' | 'info' | 'schedule' | string;

export default function ZktCompetitionDetail() {
	const {competitionId} = useParams<{competitionId: string}>();
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const location = useLocation();
	const liveMatch = useRouteMatch<{eventId?: string; roundNumber?: string}>(
		'/zkt-competitions/:competitionId/live/:eventId?/:roundNumber?'
	);
	const isLiveRoute = !!liveMatch;

	const [detail, setDetail] = useState<any>(() => detailCache.get(competitionId)?.data ?? null);
	const [loading, setLoading] = useState(() => !detailCache.get(competitionId));
	// The reason the page is empty, kept on screen rather than in a toast that
	// disappears: "not found" and "the federation is down" look identical to the
	// organizer otherwise, and only one of them is their problem.
	const [loadError, setLoadError] = useState<string | null>(null);
	const [tab, setTab] = useState<TabId>(
		isLiveRoute ? 'live' : ((new URLSearchParams(location.search).get('tab') as TabId) || 'groups')
	);

	const fetch = useCallback(async () => {
		const cached = detailCache.get(competitionId);
		if (cached) {
			setDetail(cached.data);
			setLoading(false);
		}
		try {
			const res = await gqlMutate(DETAIL_QUERY, {id: competitionId});
			const data = res?.data?.zktPublicCompetition;
			if (data) detailCache.set(competitionId, {data, ts: Date.now()});
			setDetail(data);
			setLoadError(null);
		} catch (e: any) {
			// The server already phrases this in Turkish and names the address it
			// could not reach; show it verbatim instead of a generic failure.
			const message =
				e?.graphQLErrors?.[0]?.message ||
				e?.networkError?.result?.errors?.[0]?.message ||
				e?.message ||
				String(e);
			setLoadError(message);
			if (!detailCache.get(competitionId)) toastError(t('error'));
		} finally {
			setLoading(false);
		}
	}, [competitionId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	// Live refresh: the federation socket push is a later phase; while a
	// competition is ONGOING, poll the detail every 60s so "happening now" chips
	// and podiums stay current without a manual reload. Round-level live results
	// poll faster inside the Live tab.
	useEffect(() => {
		if (detail?.status !== 'ONGOING') return;
		const id = window.setInterval(fetch, 60000);
		return () => window.clearInterval(id);
	}, [detail?.status, fetch]);

	useEffect(() => {
		if (isLiveRoute) {
			setTab('live');
			return;
		}
		const urlTab = new URLSearchParams(location.search).get('tab') as TabId | null;
		setTab(urlTab || 'groups');
	}, [isLiveRoute, location.search]);

	if (loading) return <Loading />;
	if (!detail) {
		return (
			<div className={b('load-error')}>
				<strong>{loadError ? t('load_failed') : t('not_found')}</strong>
				{loadError && <code className={b('load-error-detail')}>{loadError}</code>}
				{loadError && <span className={b('load-error-hint')}>{t('load_failed_hint')}</span>}
			</div>
		);
	}
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	// "Happening now" — rounds currently OPEN/ACTIVE (Competitor-groups style
	// live highlight, driven purely by round status).
	const liveRounds: Array<{eventId: string; roundNumber: number}> = [];
	for (const ev of detail.events) {
		for (const r of ev.rounds) {
			if (r.status === 'OPEN' || r.status === 'ACTIVE') {
				liveRounds.push({eventId: ev.eventId, roundNumber: r.roundNumber});
			}
		}
	}

	const hasSchedule =
		(detail.schedule || []).length > 0 ||
		detail.events.some((ev: any) => (ev.rounds || []).some((r: any) => (r.groups || []).some((g: any) => g.startTime)));

	// Tab order matches the WCA competitions page so users feel at home switching
	// between WCA + ZKT competitions.
	const TABS: Array<{id: TabId; label: string; icon: any; show?: boolean; count?: number}> = [
		{id: 'groups', label: t('tab_competitors'), icon: Users, show: true, count: detail.competitors.length},
		{id: 'live', label: t('tab_live'), icon: Broadcast, show: detail.status !== 'DRAFT'},
		{id: 'events', label: t('tab_events'), icon: ListBullets, show: true, count: detail.events.length},
		{id: 'rankings', label: t('tab_rankings'), icon: ChartBar, show: detail.status !== 'DRAFT'},
		{id: 'schedule', label: t('tab_schedule'), icon: CalendarBlank, show: hasSchedule},
		{id: 'info', label: t('tab_info'), icon: Globe, show: true},
		...(detail.tabs || []).map((tb: any) => ({
			id: `custom_${tb.id}`,
			label: tb.title,
			icon: FileText,
			show: true,
		})),
	];

	function handleTab(id: TabId) {
		setTab(id);
		if (id === 'live') {
			history.push(`/zkt-competitions/${competitionId}/live`);
		} else {
			history.push(`/zkt-competitions/${competitionId}?tab=${id}`);
		}
	}

	return (
		<div className={b('detail-page')}>
			{/* Data on screen but the refresh failed: what is shown is the last good
			    copy, which on competition day is the difference between a stale
			    schedule and a live one. Say so instead of pretending it is current. */}
			{loadError && (
				<div className={b('load-error', {inline: true})}>
					<strong>{t('refresh_failed')}</strong>
					<code className={b('load-error-detail')}>{loadError}</code>
				</div>
			)}
			<div className={b('detail-header')}>
				<button className={b('back-btn')} onClick={() => history.push('/competitions')}>
					{t('back')}
				</button>
				<h1 className={b('detail-title')}>{detail.name}</h1>
				<div className={b('detail-meta')}>
					<span className={b('meta-item')}>
						<CalendarBlank size={15} weight="bold" />
						{formatDateRange(detail.startDate, detail.endDate, locale)}
					</span>
					<button
						type="button"
						className={b('meta-item', {link: true})}
						onClick={() =>
							openInMaps(
								detail.latitude && detail.longitude
									? `${detail.latitude},${detail.longitude}`
									: [detail.location, detail.locationAddress].filter(Boolean).join(' ')
							)
						}
					>
						<MapPin size={15} weight="bold" />
						{detail.location}
					</button>
				</div>
				{(detail.delegates?.length > 0 || detail.organizers?.length > 0) && (
					<div className={b('detail-people')}>
						{detail.delegates?.length > 0 && (
							<span className={b('detail-people-item')}>
								<ShieldCheck size={14} weight="bold" />
								{t('delegates')}: {detail.delegates.map((d: any) => d.name).join(', ')}
							</span>
						)}
						{detail.organizers?.length > 0 && (
							<span className={b('detail-people-item')}>
								<Users size={14} weight="bold" />
								{t('organizers')}: {detail.organizers.map((o: any) => o.name).join(', ')}
							</span>
						)}
					</div>
				)}
				<div className={b('detail-status-row')}>
					<span className={b('status', {[detail.status.toLowerCase()]: true})}>
						{t(`status_${detail.status.toLowerCase()}`)}
					</span>
				</div>

				{liveRounds.length > 0 && (
					<div className={b('live-now')}>
						<span className={b('live-now-label')}>{t('live_now')}</span>
						{liveRounds.map((lr) => (
							<button
								key={`${lr.eventId}-${lr.roundNumber}`}
								type="button"
								className={b('live-now-chip')}
								onClick={() =>
									history.push(
										`/zkt-competitions/${competitionId}/live/${lr.eventId}/${lr.roundNumber}`
									)
								}
							>
								<span className={`cubing-icon event-${lr.eventId}`} />
								{getEventName(lr.eventId)} — {t('round_n', {n: lr.roundNumber})}
							</button>
						))}
					</div>
				)}
			</div>

			<div className={b('tabs')}>
				{TABS.filter((tb) => tb.show !== false).map((tb) => {
					const Icon = tb.icon;
					return (
						<button
							key={tb.id}
							className={b('tab', {active: tab === tb.id})}
							onClick={() => handleTab(tb.id)}
						>
							<Icon size={16} />
							{tb.label}
							{tb.count !== undefined && (
								<span className={b('tab-count')}>{tb.count}</span>
							)}
						</button>
					);
				})}
			</div>

			<div className={b('tab-content')}>
				{tab === 'groups' && <ZktCompetitorsTab detail={detail} />}
				{tab === 'live' && <ZktLiveTab detail={detail} />}
				{tab === 'events' && <ZktEventsTab detail={detail} />}
				{tab === 'rankings' && <ZktPodiumsTab detail={detail} />}
				{tab === 'schedule' && <ZktScheduleTab detail={detail} />}
				{tab === 'info' && <ZktInfoTab detail={detail} />}
				{typeof tab === 'string' &&
					tab.startsWith('custom_') &&
					(() => {
						const tabId = tab.replace('custom_', '');
						const customTab = (detail.tabs || []).find((tb: any) => tb.id === tabId);
						return customTab ? (
							<div className={b('custom-tab-content')}>
								<MarkdownContent content={customTab.content} />
							</div>
						) : null;
					})()}
			</div>
		</div>
	);
}
