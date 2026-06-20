import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory, useRouteMatch} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, formatDateRange, getEventName} from './shared';
import {useSelector} from 'react-redux';
import ZktInfoTab from './tabs/ZktInfoTab';
import ZktCompetitorsTab from './tabs/ZktCompetitorsTab';
import ZktEventsTab from './tabs/ZktEventsTab';
import ZktLiveTab from './tabs/ZktLiveTab';
import ZktPodiumsTab from './tabs/ZktPodiumsTab';
import ZktRegistrationForm from './tabs/ZktRegistrationForm';
import ZktScheduleTab from './tabs/ZktScheduleTab';
import {useZktCompRefetch} from './useZktCompRefetch';
import {Users, ListBullets, Globe, Broadcast, UserPlus, ChartBar, FileText, CalendarBlank, MapPin, ShieldCheck} from 'phosphor-react';
import MarkdownContent from './MarkdownContent';
import {openInMaps} from '../../../util/external-link';

const DETAIL_QUERY = gql`
	query ZktCompetitionPublic($id: String!) {
		zktCompetition(id: $id) {
			id
			name
			description
			date_start
			date_end
			location
			location_address
			short_name
			latitude
			longitude
			registration_opens_at
			registration_closes_at
			registration_edit_deadline
			on_spot_registration
			cancellation_policy
			guests_enabled
			force_comment
			extra_requirements
			contact
			main_event_id
			competitor_limit
			status
			visibility
			created_by_id
			created_by {
				id
				username
			}
			events {
				id
				competition_id
				event_id
				event_order
				rounds {
					id
					round_number
					format
					time_limit_cs
					cutoff_cs
					advancement_type
					advancement_level
					status
					groups {
						id
						group_number
						start_time
						end_time
					}
					assignments {
						id
						user_id
						person_id
						role
						group {
							group_number
						}
					}
				}
			}
			registrations {
				id
				user_id
				person_id
				status
				registration_number
				user {
					id
					username
					first_name
					last_name
					join_country
					profile {
						pfp_image {
							id
							url
						}
					}
				}
				person {
					id
					first_name
					last_name
					country_code
					wca_id
					external_id
				}
				events {
					id
					comp_event_id
				}
			}
			delegates {
				id
				user_id
				user {
					id
					username
				}
			}
			organizers {
				id
				user_id
				user {
					id
					username
				}
			}
			tabs {
				id
				title
				content
				tab_order
			}
			schedule_items {
				id
				title
				start_time
				end_time
			}
		}
	}
`;

type TabId = 'groups' | 'live' | 'events' | 'rankings' | 'info' | 'register' | string;

export default function ZktCompetitionDetail() {
	const {competitionId} = useParams<{competitionId: string}>();
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const liveMatch = useRouteMatch<{eventId?: string; roundNumber?: string}>(
		'/zkt-competitions/:competitionId/live/:eventId?/:roundNumber?'
	);
	const isLiveRoute = !!liveMatch;

	const me = useSelector((state: any) => state.account.me);
	const [detail, setDetail] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<TabId>(isLiveRoute ? 'live' : 'groups');

	const fetch = useCallback(async () => {
		try {
			const res = await gqlMutate(DETAIL_QUERY, {id: competitionId});
			setDetail(res?.data?.zktCompetition);
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [competitionId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	// Live refetch socket room is keyed by the real UUID (detail.id); the route
	// param may be a slug, which the server never broadcasts to. Falls back to
	// the param until detail loads.
	useZktCompRefetch(detail?.id ?? competitionId, fetch);

	useEffect(() => {
		if (isLiveRoute) setTab('live');
	}, [isLiveRoute]);

	if (loading) return <Loading />;
	if (!detail) return <div className={b('empty')}>{t('not_found')}</div>;

	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;
	const myRegistration = detail.registrations.find((r: any) => r.user_id === me?.id);
	const canRegister =
		detail.status === 'REGISTRATION_OPEN' &&
		detail.visibility === 'PUBLIC' &&
		me &&
		(!myRegistration || myRegistration.status === 'WITHDRAWN');

	const approvedCount = detail.registrations.filter((r: any) => r.status === 'APPROVED').length;

	// "Happening now" — rounds currently OPEN/ACTIVE (Competitor-groups style
	// live highlight, driven purely by round status; socket refetch keeps it hot).
	const liveRounds: Array<{eventId: string; roundNumber: number}> = [];
	for (const ev of detail.events) {
		for (const r of ev.rounds) {
			if (r.status === 'OPEN' || r.status === 'ACTIVE') {
				liveRounds.push({eventId: ev.event_id, roundNumber: r.round_number});
			}
		}
	}

	// Tab order matches the WCA competitions page so users feel at home
	// switching between WCA + ZKT competitions. "Rankings" replaces the
	// stand-alone "Podiums" tab — final-round top 3 is the natural top of
	// the rankings table.
	const TABS: Array<{id: TabId; label: string; icon: any; show?: boolean; count?: number}> = [
		{id: 'groups', label: t('tab_competitors'), icon: Users, show: true, count: approvedCount},
		{id: 'live', label: t('tab_live'), icon: Broadcast, show: detail.status !== 'DRAFT'},
		{id: 'events', label: t('tab_events'), icon: ListBullets, show: true, count: detail.events.length},
		{id: 'rankings', label: t('tab_rankings'), icon: ChartBar, show: detail.status !== 'DRAFT'},
		{
			id: 'schedule',
			label: t('tab_schedule'),
			icon: CalendarBlank,
			show:
				(detail.schedule_items || []).length > 0 ||
				detail.events.some((ev: any) => (ev.rounds || []).some((r: any) => (r.groups || []).some((g: any) => g.start_time))),
		},
		{id: 'info', label: t('tab_info'), icon: Globe, show: true},
		...(detail.tabs || []).map((tb: any) => ({
			id: `custom_${tb.id}`,
			label: tb.title,
			icon: FileText,
			show: true,
		})),
		{id: 'register', label: t('tab_register'), icon: UserPlus, show: canRegister},
	];

	function handleTab(id: TabId) {
		setTab(id);
		if (id === 'live') {
			history.push(`/zkt-competitions/${competitionId}/live`);
		} else {
			history.push(`/zkt-competitions/${competitionId}`);
		}
	}

	return (
		<div className={b('detail-page')}>
			<div className={b('detail-header')}>
				<button className={b('back-btn')} onClick={() => history.push('/competitions')}>
					{t('back')}
				</button>
				<h1 className={b('detail-title')}>{detail.name}</h1>
				<div className={b('detail-meta')}>
					<span className={b('meta-item')}>
						<CalendarBlank size={15} weight="bold" />
						{formatDateRange(detail.date_start, detail.date_end, locale)}
					</span>
					<button
						type="button"
						className={b('meta-item', {link: true})}
						onClick={() =>
							openInMaps(
								detail.latitude && detail.longitude
									? `${detail.latitude},${detail.longitude}`
									: [detail.location, detail.location_address].filter(Boolean).join(' ')
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
								{t('delegates')}: {detail.delegates.map((d: any) => d.user.username).join(', ')}
							</span>
						)}
						{detail.organizers?.length > 0 && (
							<span className={b('detail-people-item')}>
								<Users size={14} weight="bold" />
								{t('organizers')}: {detail.organizers.map((o: any) => o.user.username).join(', ')}
							</span>
						)}
					</div>
				)}
				<div className={b('detail-status-row')}>
					<span className={b('status', {[detail.status.toLowerCase()]: true})}>
						{t(`status_${detail.status.toLowerCase()}`)}
					</span>
					{myRegistration && (
						<span className={b('my-status', {[myRegistration.status.toLowerCase()]: true})}>
							{t('my_status')}: {t(`registration_${myRegistration.status.toLowerCase()}`)}
						</span>
					)}
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
				{tab === 'register' && <ZktRegistrationForm detail={detail} onDone={fetch} />}
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
