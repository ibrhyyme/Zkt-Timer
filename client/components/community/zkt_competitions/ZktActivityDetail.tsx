import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, formatName, formatTimeRange} from './shared';
import {CaretLeft, CaretRight} from 'phosphor-react';

const GROUP_ASSIGNMENTS_QUERY = gql`
	query ZktGroupAssignmentsPublic($groupId: String!) {
		zktGroupAssignments(groupId: $groupId) {
			id
			round_id
			group_id
			user_id
			role
			station_number
			seed_result
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
			group {
				id
				group_number
				start_time
				end_time
			}
			round {
				id
				round_number
				format
				comp_event {
					id
					event_id
				}
			}
		}
	}
`;

const ROLE_ORDER = ['COMPETITOR', 'SCRAMBLER', 'RUNNER', 'JUDGE', 'ORGANIZER', 'STAFF'];

const ROLE_HEADER_COLORS: Record<string, string> = {
	COMPETITOR: '#2dbd61',
	JUDGE: '#42a5f5',
	SCRAMBLER: '#9b59b6',
	RUNNER: '#ee6a26',
	ORGANIZER: '#246bfd',
	STAFF: '#95a5a6',
};

interface Assignment {
	id: string;
	user_id: string;
	role: string;
	station_number?: number;
	seed_result?: number;
	user?: {id: string; username: string; profile?: {pfp_image?: {url: string}}};
	group?: {id: string; group_number: number; start_time?: string | null; end_time?: string | null};
	round?: {
		id: string;
		round_number: number;
		format: string;
		comp_event?: {id: string; event_id: string};
	};
}

export default function ZktActivityDetail() {
	const {competitionId, groupId} = useParams<{competitionId: string; groupId: string}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [assignments, setAssignments] = useState<Assignment[]>([]);
	const [loading, setLoading] = useState(true);

	const fetch = useCallback(async () => {
		try {
			const res = await gqlMutate(GROUP_ASSIGNMENTS_QUERY, {groupId});
			setAssignments(res?.data?.zktGroupAssignments || []);
		} catch {
			setAssignments([]);
		} finally {
			setLoading(false);
		}
	}, [groupId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	if (loading) return <Loading />;

	const byRole: Record<string, Assignment[]> = {};
	for (const a of assignments) {
		if (!byRole[a.role]) byRole[a.role] = [];
		byRole[a.role].push(a);
	}

	const totalCount = assignments.length;
	const roleSummary = ROLE_ORDER.filter((r) => byRole[r]?.length)
		.map((r) => `${t(`role_${r.toLowerCase()}`)} ${byRole[r].length}`)
		.join(' · ');

	const first = assignments[0];
	const eventId = first?.round?.comp_event?.event_id;
	const roundNumber = first?.round?.round_number;
	const groupNumber = first?.group?.group_number;
	const format = first?.round?.format;
	const startTime = first?.group?.start_time;
	const endTime = first?.group?.end_time;
	const timeRange = startTime ? formatTimeRange(startTime, endTime) : '';

	return (
		<div className={b('detail-page')}>
			<div className={b('detail-header')}>
				<button
					className={b('back-btn')}
					onClick={() => history.push(`/community/zkt-competitions/${competitionId}`)}
				>
					{t('back')}
				</button>
			</div>

			{/* Activity header — etkinlik + round + grup ana bilgisi */}
			{first && (
				<div className={b('activity-header')}>
					{eventId && (
						<span className={`cubing-icon event-${eventId}`} style={{fontSize: 28}} />
					)}
					<div className={b('activity-header-text')}>
						<h1 className={b('activity-title')}>
							{eventId ? getEventName(eventId) : t('activity')}
							{roundNumber && (
								<span className={b('activity-round')}> · R{roundNumber}</span>
							)}
							{groupNumber !== undefined && (
								<span className={b('activity-group')}> · {t('col_group')} {groupNumber}</span>
							)}
						</h1>
						{(format || timeRange) && (
							<div className={b('activity-meta')}>
								{format && <span>{t('format')}: <strong>{formatName(format)}</strong></span>}
								{timeRange && <span style={{marginLeft: format ? '1rem' : 0}}>🕐 {timeRange}</span>}
							</div>
						)}
					</div>
				</div>
			)}

			<div style={{marginBottom: '0.75rem', color: 'rgba(var(--text-color), 0.65)', fontSize: 13}}>
				{totalCount} {t('people')} / {roleSummary}
			</div>

			{ROLE_ORDER.filter((role) => byRole[role]?.length).map((role) => (
				<div key={role} style={{marginBottom: '1.5rem'}}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							padding: '0.5rem 0.85rem',
							borderRadius: 8,
							background: `${ROLE_HEADER_COLORS[role]}22`,
							borderLeft: `4px solid ${ROLE_HEADER_COLORS[role]}`,
							marginBottom: '0.5rem',
							fontSize: 14,
							fontWeight: 700,
							color: 'rgb(var(--text-color))',
						}}
					>
						<span style={{color: ROLE_HEADER_COLORS[role]}}>
							{t(`role_${role.toLowerCase()}`)}
						</span>
						<span style={{marginLeft: 'auto', fontSize: 12, fontWeight: 500, opacity: 0.7}}>
							{byRole[role].length}
						</span>
					</div>

					<div className={b('competitor-list')}>
						{byRole[role].map((a) => (
							<div
								key={a.id}
								className={b('competitor-row')}
								style={{cursor: 'pointer'}}
								onClick={() =>
									history.push(`/community/zkt-competitions/${competitionId}/competitors/${a.user_id}`)
								}
							>
								{a.user?.profile?.pfp_image?.url && (
									<img
										className={b('user-avatar')}
										src={a.user.profile.pfp_image.url}
										alt=""
									/>
								)}
								<span className={b('user-name')}>{a.user?.username || a.user_id}</span>
								{a.station_number && (
									<span style={{fontSize: 12, color: 'rgba(var(--text-color), 0.5)'}}>
										#{a.station_number}
									</span>
								)}
								{a.seed_result && a.seed_result > 0 && (
									<span
										style={{
											marginLeft: 'auto',
											fontFamily: 'monospace',
											fontSize: 13,
											color: 'rgba(var(--text-color), 0.7)',
										}}
									>
										{formatCs(a.seed_result)}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			))}

			{assignments.length === 0 && (
				<div className={b('empty')}>{t('no_assignments')}</div>
			)}
		</div>
	);
}
