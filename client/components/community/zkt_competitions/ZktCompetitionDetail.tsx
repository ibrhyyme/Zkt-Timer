import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory, useRouteMatch} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, formatDateRange} from './shared';
import {useSelector} from 'react-redux';
import ZktInfoTab from './tabs/ZktInfoTab';
import ZktCompetitorsTab from './tabs/ZktCompetitorsTab';
import ZktEventsTab from './tabs/ZktEventsTab';
import ZktLiveTab from './tabs/ZktLiveTab';
import ZktRegistrationForm from './tabs/ZktRegistrationForm';
import {Users, ListBullets, Globe, Broadcast, UserPlus} from 'phosphor-react';

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
				}
			}
			registrations {
				id
				user_id
				status
				user {
					id
					username
					profile {
						pfp_image {
							id
							url
						}
					}
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
		}
	}
`;

type TabId = 'info' | 'competitors' | 'events' | 'live' | 'register';

export default function ZktCompetitionDetail() {
	const {competitionId} = useParams<{competitionId: string}>();
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const liveMatch = useRouteMatch<{eventId?: string; roundNumber?: string}>(
		'/community/zkt-competitions/:competitionId/live/:eventId?/:roundNumber?'
	);
	const isLiveRoute = !!liveMatch;

	const me = useSelector((state: any) => state.account.me);
	const [detail, setDetail] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<TabId>(isLiveRoute ? 'live' : 'info');

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

	const TABS: Array<{id: TabId; label: string; icon: any; show?: boolean; count?: number}> = [
		{id: 'info', label: t('tab_info'), icon: Globe, show: true},
		{id: 'competitors', label: t('tab_competitors'), icon: Users, show: true, count: approvedCount},
		{id: 'events', label: t('tab_events'), icon: ListBullets, show: true, count: detail.events.length},
		{id: 'live', label: t('tab_live'), icon: Broadcast, show: detail.status !== 'DRAFT'},
		{id: 'register', label: t('tab_register'), icon: UserPlus, show: canRegister},
	];

	function handleTab(id: TabId) {
		setTab(id);
		if (id === 'live') {
			history.push(`/community/zkt-competitions/${competitionId}/live`);
		} else {
			history.push(`/community/zkt-competitions/${competitionId}`);
		}
	}

	return (
		<div className={b('detail-page')}>
			<div className={b('detail-header')}>
				<button className={b('back-btn')} onClick={() => history.push('/community/competitions')}>
					{t('back')}
				</button>
				<h1 className={b('detail-title')}>{detail.name}</h1>
				<div className={b('detail-meta')}>
					{formatDateRange(detail.date_start, detail.date_end, locale)} - {detail.location}
				</div>
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
							<Icon weight="bold" />
							<span>{tb.label}{tb.count !== undefined ? ` (${tb.count})` : ''}</span>
						</button>
					);
				})}
			</div>

			<div className={b('tab-content')}>
				{tab === 'info' && <ZktInfoTab detail={detail} />}
				{tab === 'competitors' && <ZktCompetitorsTab detail={detail} />}
				{tab === 'events' && <ZktEventsTab detail={detail} />}
				{tab === 'live' && <ZktLiveTab detail={detail} />}
				{tab === 'register' && <ZktRegistrationForm detail={detail} onDone={fetch} />}
			</div>
		</div>
	);
}
