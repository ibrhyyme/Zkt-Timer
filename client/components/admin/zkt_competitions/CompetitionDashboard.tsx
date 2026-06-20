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
import {Trash, ArrowLeft, CalendarBlank, MapPin, Eye, PencilSimple} from 'phosphor-react';
import {b, formatDateRange} from './shared';
import DashboardOverview from './tabs/DashboardOverview';
import DashboardRegistrations from './tabs/DashboardRegistrations';
import DashboardRounds from './tabs/DashboardRounds';
import DashboardResults from './tabs/DashboardResults';
import DashboardDelegates from './tabs/DashboardDelegates';
import DashboardOrganizers from './tabs/DashboardOrganizers';
import ZktCompTabsManager from './tabs/ZktCompTabsManager';
import DashboardAssignments from './tabs/DashboardAssignments';
import DashboardSchedule from './tabs/DashboardSchedule';
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
			slug
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
					group_count
					status
					groups {
						id
						group_number
						start_time
						end_time
					}
					assignments {
						id
						role
						user_id
						person_id
						station_number
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
				notes
				registration_number
				created_at
				user {
					id
					username
					first_name
					last_name
					join_country
					verified
					is_pro
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
			organizers {
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

type TabId = 'overview' | 'registrations' | 'rounds' | 'assignments' | 'results' | 'schedule' | 'delegates' | 'organizers' | 'tabs_manager';

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
							history.push('/organizer');
						} catch (e: any) {
							toastError(e?.message || t('error'));
						}
					}}
				/>
			)
		);
	}

	// `silent` skips the full-page <Loading/> so a background refetch (after an
	// assignment/result/registration change) does NOT unmount the active tab and
	// reset its in-tab state (e.g. the selected event/round on the Görevler tab).
	const fetch = useCallback(
		async (silent = false) => {
			if (!silent) setLoading(true);
			try {
				const result = await gqlMutate(DETAIL_QUERY, {id: competitionId});
				setDetail(result?.data?.zktCompetitionForAdmin);
			} catch {
				toastError('Yarisma yuklenemedi');
			} finally {
				if (!silent) setLoading(false);
			}
		},
		[competitionId]
	);

	useEffect(() => {
		fetch();
	}, [fetch]);

	// Socket-driven refresh must be silent too — otherwise a remote change flashes
	// the whole dashboard and drops the current tab's selection.
	useZktCompRefetch(competitionId, () => fetch(true));

	if (loading) return <Loading />;
	if (!detail) return <div className={b('empty')}>{t('not_found')}</div>;

	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	const TABS: Array<{id: TabId; label: string}> = [
		{id: 'overview', label: t('tab_overview')},
		{id: 'registrations', label: t('tab_registrations')},
		{id: 'rounds', label: t('tab_rounds')},
		{id: 'assignments', label: t('tab_assignments')},
		{id: 'results', label: t('tab_results')},
		{id: 'schedule', label: t('tab_schedule')},
		{id: 'delegates', label: t('tab_delegates')},
		{id: 'organizers', label: t('tab_organizers')},
		{id: 'tabs_manager', label: t('tab_manage')},
	];

	return (
		<div className={b('dashboard')}>
			<div className={b('sticky-header')}>
				<div className={b('sticky-header-top')}>
					<button
						type="button"
						className={b('icon-btn', {ghost: true})}
						onClick={() => history.push('/organizer')}
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
							className={b('header-edit-btn')}
							onClick={() => history.push(`/organizer/${detail.slug || detail.id}/edit`)}
							title={t('edit_competition')}
						>
							<PencilSimple weight="bold" /> {t('edit_competition')}
						</button>
						<button
							type="button"
							className={b('icon-btn', {ghost: true})}
							onClick={() => window.open(`/zkt-competitions/${detail.slug || detail.id}`, '_blank')}
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
				{tab === 'overview' && <DashboardOverview detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'registrations' && <DashboardRegistrations detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'rounds' && <DashboardRounds detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'assignments' && <DashboardAssignments detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'schedule' && <DashboardSchedule detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'results' && <DashboardResults detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'delegates' && <DashboardDelegates detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'organizers' && <DashboardOrganizers detail={detail} onUpdated={() => fetch(true)} />}
				{tab === 'tabs_manager' && <ZktCompTabsManager detail={detail} onUpdated={() => fetch(true)} />}
			</div>
		</div>
	);
}
