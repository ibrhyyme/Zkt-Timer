import React, {useEffect, useState, useCallback} from 'react';
import './AdminZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../actions/general';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import {toastSuccess, toastError} from '../../../util/toast';
import Loading from '../../common/loading/Loading';
import {Trash, ArrowLeft, CalendarBlank, MapPin, Eye} from 'phosphor-react';
import {b, formatDateRange} from './shared';
import DashboardOverview from './tabs/DashboardOverview';
import DashboardRegistrations from './tabs/DashboardRegistrations';
import DashboardRounds from './tabs/DashboardRounds';
import DashboardResults from './tabs/DashboardResults';
import DashboardDelegates from './tabs/DashboardDelegates';
import DashboardAssignments from './tabs/DashboardAssignments';
import {useZktCompRefetch} from '../../community/zkt_competitions/useZktCompRefetch';

const DELETE_MUTATION = gql`
	mutation DeleteZktCompFromDashboard($id: String!) {
		deleteZktCompetition(id: $id)
	}
`;

const DETAIL_QUERY = gql`
	query ZktCompDetail($id: String!) {
		zktCompetitionForAdmin(id: $id) {
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
			created_at
			updated_at
			events {
				id
				competition_id
				event_id
				event_order
				rounds {
					id
					comp_event_id
					round_number
					format
					time_limit_cs
					cutoff_cs
					cutoff_attempts
					advancement_type
					advancement_level
					status
					groups {
						id
						group_number
					}
				}
			}
			registrations {
				id
				user_id
				status
				notes
				created_at
				user {
					id
					username
					verified
					is_pro
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
					verified
					is_pro
					profile {
						pfp_image {
							id
							url
						}
					}
				}
			}
		}
	}
`;

type TabId = 'overview' | 'registrations' | 'rounds' | 'assignments' | 'results' | 'delegates';

export default function CompetitionDashboard() {
	const {competitionId} = useParams<{competitionId: string}>();
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const dispatch = useDispatch();
	const [detail, setDetail] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<TabId>('overview');

	function handleDelete() {
		dispatch(
			openModal(
				<ConfirmModal
					buttonText={t('delete_confirm_button')}
					hideInput
					triggerAction={async () => {
						try {
							await gqlMutate(DELETE_MUTATION, {id: competitionId});
							toastSuccess(t('deleted'));
							history.push('/admin/competitions');
						} catch (e: any) {
							toastError(e?.message || t('error'));
						}
					}}
				/>
			)
		);
	}

	const fetch = useCallback(async () => {
		setLoading(true);
		try {
			const result = await gqlMutate(DETAIL_QUERY, {id: competitionId});
			setDetail(result?.data?.zktCompetitionForAdmin);
		} catch {
			toastError('Yarisma yuklenemedi');
		} finally {
			setLoading(false);
		}
	}, [competitionId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	useZktCompRefetch(competitionId, fetch);

	if (loading) return <Loading />;
	if (!detail) return <div className={b('empty')}>{t('not_found')}</div>;

	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	const TABS: Array<{id: TabId; label: string}> = [
		{id: 'overview', label: t('tab_overview')},
		{id: 'registrations', label: t('tab_registrations')},
		{id: 'rounds', label: t('tab_rounds')},
		{id: 'assignments', label: t('tab_assignments')},
		{id: 'results', label: t('tab_results')},
		{id: 'delegates', label: t('tab_delegates')},
	];

	return (
		<div className={b('dashboard')}>
			<div className={b('sticky-header')}>
				<div className={b('sticky-header-top')}>
					<button
						type="button"
						className={b('icon-btn', {ghost: true})}
						onClick={() => history.push('/admin/competitions')}
						title={t('back')}
						aria-label={t('back')}
					>
						<ArrowLeft weight="bold" />
					</button>

					<div className={b('sticky-header-title-block')}>
						<div className={b('sticky-header-overline')}>{t('admin_overline')}</div>
						<h1 className={b('sticky-header-title')}>{detail.name}</h1>
						<div className={b('sticky-header-meta')}>
							<span><CalendarBlank weight="bold" /> {formatDateRange(detail.date_start, detail.date_end, locale)}</span>
							<span><MapPin weight="bold" /> {detail.location}</span>
							<span className={b('status', {[detail.status.toLowerCase()]: true})}>
								{t(`status_${detail.status.toLowerCase()}`)}
							</span>
							<span className={b('visibility', {[detail.visibility.toLowerCase()]: true})}>
								{t(`visibility_${detail.visibility.toLowerCase()}`)}
							</span>
						</div>
					</div>

					<div className={b('sticky-header-actions')}>
						<button
							type="button"
							className={b('icon-btn', {ghost: true})}
							onClick={() => window.open(`/community/zkt-competitions/${detail.id}`, '_blank')}
							title={t('public_view')}
							aria-label={t('public_view')}
						>
							<Eye weight="bold" />
						</button>
						<button
							type="button"
							className={b('icon-btn', {danger: true})}
							onClick={handleDelete}
							title={t('delete_competition')}
							aria-label={t('delete_competition')}
						>
							<Trash weight="bold" />
						</button>
					</div>
				</div>

				<div className={b('tabs', {sticky: true})}>
					{TABS.map((tb) => (
						<button
							key={tb.id}
							className={b('tab', {active: tab === tb.id})}
							onClick={() => setTab(tb.id)}
						>
							{tb.label}
						</button>
					))}
				</div>
			</div>

			<div className={b('tab-content')}>
				{tab === 'overview' && <DashboardOverview detail={detail} onUpdated={fetch} />}
				{tab === 'registrations' && <DashboardRegistrations detail={detail} onUpdated={fetch} />}
				{tab === 'rounds' && <DashboardRounds detail={detail} onUpdated={fetch} />}
				{tab === 'assignments' && <DashboardAssignments detail={detail} onUpdated={fetch} />}
				{tab === 'results' && <DashboardResults detail={detail} onUpdated={fetch} />}
				{tab === 'delegates' && <DashboardDelegates detail={detail} onUpdated={fetch} />}
			</div>
		</div>
	);
}
