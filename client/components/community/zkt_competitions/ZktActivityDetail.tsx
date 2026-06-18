import React, {useEffect, useState, useCallback, useMemo} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, formatName, formatTimeRange, competitorDisplayName, competitorFlag, ZKT_ROLE_COLORS} from './shared';
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
				status
				comp_event {
					id
					event_id
				}
			}
		}
	}
`;

// All groups across the competition, ordered, for prev/next navigation — the
// WCA ActivityDetail lets you page through every group/round with arrows.
const COMP_GROUPS_QUERY = gql`
	query ZktCompGroupsForNav($id: String!) {
		zktCompetition(id: $id) {
			id
			events {
				id
				event_id
				event_order
				rounds {
					id
					round_number
					groups {
						id
						group_number
					}
				}
			}
		}
	}
`;

const ROLE_ORDER = ['COMPETITOR', 'SCRAMBLER', 'RUNNER', 'JUDGE', 'ORGANIZER', 'STAFF'];

const ROLE_HEADER_COLORS = ZKT_ROLE_COLORS;

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
		status?: string;
		comp_event?: {id: string; event_id: string};
	};
}

interface NavGroup {
	id: string;
	eventId: string;
	eventOrder: number;
	roundNumber: number;
	groupNumber: number;
}

export default function ZktActivityDetail() {
	const {competitionId, groupId} = useParams<{competitionId: string; groupId: string}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [assignments, setAssignments] = useState<Assignment[]>([]);
	const [loading, setLoading] = useState(true);
	const [navGroups, setNavGroups] = useState<NavGroup[]>([]);

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

	// Build the flat ordered group list once for prev/next navigation.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await gqlMutate(COMP_GROUPS_QUERY, {id: competitionId});
				if (cancelled) return;
				const events = res?.data?.zktCompetition?.events || [];
				const flat: NavGroup[] = [];
				for (const ev of events) {
					for (const rd of ev.rounds || []) {
						for (const g of rd.groups || []) {
							flat.push({
								id: g.id,
								eventId: ev.event_id,
								eventOrder: ev.event_order ?? 0,
								roundNumber: rd.round_number,
								groupNumber: g.group_number,
							});
						}
					}
				}
				flat.sort(
					(a, b) =>
						a.eventOrder - b.eventOrder ||
						a.roundNumber - b.roundNumber ||
						a.groupNumber - b.groupNumber
				);
				setNavGroups(flat);
			} catch {
				if (!cancelled) setNavGroups([]);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [competitionId]);

	const currentIndex = useMemo(
		() => navGroups.findIndex((g) => g.id === groupId),
		[navGroups, groupId]
	);

	const goTo = useCallback(
		(index: number) => {
			if (index < 0 || index >= navGroups.length) return;
			history.push(`/community/zkt-competitions/${competitionId}/activities/${navGroups[index].id}`);
		},
		[navGroups, competitionId, history]
	);

	// Keyboard arrow navigation (WCA ActivityDetail parity).
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (target && /input|textarea|select/i.test(target.tagName)) return;
			if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
			else if (e.key === 'ArrowRight') goTo(currentIndex + 1);
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [goTo, currentIndex]);

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

	const hasNav = navGroups.length > 1 && currentIndex >= 0;

	return (
		<div className={b('detail-page')}>
			<div className={b('activity-topbar')}>
				<button
					className={b('back-btn')}
					onClick={() => history.push(`/community/zkt-competitions/${competitionId}`)}
				>
					{t('back')}
				</button>

				{hasNav && (
					<div className={b('activity-nav')}>
						<button
							type="button"
							className={b('activity-nav-btn')}
							disabled={currentIndex <= 0}
							onClick={() => goTo(currentIndex - 1)}
							aria-label={t('previous')}
						>
							<CaretLeft weight="bold" />
						</button>
						<span className={b('activity-nav-pos')}>
							{currentIndex + 1} / {navGroups.length}
						</span>
						<button
							type="button"
							className={b('activity-nav-btn')}
							disabled={currentIndex >= navGroups.length - 1}
							onClick={() => goTo(currentIndex + 1)}
							aria-label={t('next')}
						>
							<CaretRight weight="bold" />
						</button>
					</div>
				)}
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
							{(first.round?.status === 'OPEN' || first.round?.status === 'ACTIVE') && (
								<span className={b('live-now-chip', {static: true})}>{t('live_now')}</span>
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

			<div className={b('activity-breakdown')}>
				{totalCount} {t('people')} / {roleSummary}
			</div>

			{ROLE_ORDER.filter((role) => byRole[role]?.length).map((role) => (
				<div key={role} className={b('activity-role-section')}>
					<div
						className={b('activity-role-header')}
						style={{
							background: `${ROLE_HEADER_COLORS[role]}22`,
							borderLeft: `4px solid ${ROLE_HEADER_COLORS[role]}`,
						}}
					>
						<span style={{color: ROLE_HEADER_COLORS[role]}}>
							{t(`role_${role.toLowerCase()}`)}
						</span>
						<span className={b('activity-role-count')}>{byRole[role].length}</span>
					</div>

					<div className={b('competitor-list')}>
						{byRole[role].map((a) => (
							<div
								key={a.id}
								className={b('competitor-row', {clickable: true})}
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
								<span className={b('user-name')}>
									{competitorFlag(a.user) && (
										<span className={b('flag')}>{competitorFlag(a.user)}</span>
									)}
									{competitorDisplayName(a.user) || a.user_id}
								</span>
								{a.station_number && (
									<span className={b('activity-station')}>#{a.station_number}</span>
								)}
								{a.seed_result && a.seed_result > 0 && (
									<span className={b('activity-seed')}>{formatCs(a.seed_result)}</span>
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
