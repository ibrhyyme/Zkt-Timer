import React, {useEffect, useState, useCallback, useMemo} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, formatName, formatTimeRange, competitorDisplayName, competitorFlag, PublicCompetitor, ZKT_ROLE_COLORS} from './shared';
import {CaretLeft, CaretRight} from 'phosphor-react';

// One group's assignments (the "görevler" activity detail) served by the
// federation public API: competitors are opaque-keyed, roles/stations/seed
// times come pre-resolved. A second lightweight query pulls the flat group list
// for prev/next paging across the whole competition.
const GROUP_ASSIGNMENTS_QUERY = gql`
	query ZktPublicGroupAssignments($competitionId: String!, $groupId: String!) {
		zktPublicGroupAssignments(competitionId: $competitionId, groupId: $groupId) {
			groupId
			groupNumber
			startTime
			endTime
			round {
				roundId
				roundNumber
				format
				status
				eventId
				eventName
			}
			assignments {
				competitor {
					id
					name
					wcaId
					externalId
					country
					avatarUrl
					isGhost
				}
				role
				stationNumber
				seedResult
			}
		}
	}
`;

const COMP_GROUPS_QUERY = gql`
	query ZktPublicCompGroupsNav($id: String!) {
		zktPublicCompetition(id: $id) {
			id
			events {
				eventId
				rounds {
					roundNumber
					groups {
						groupId
						groupNumber
					}
				}
			}
		}
	}
`;

const ROLE_ORDER = ['COMPETITOR', 'SCRAMBLER', 'RUNNER', 'JUDGE', 'ORGANIZER', 'STAFF'];

const ROLE_HEADER_COLORS = ZKT_ROLE_COLORS;

interface Assignment {
	competitor: PublicCompetitor;
	role: string;
	stationNumber?: number | null;
	seedResult?: number | null;
}

interface NavGroup {
	groupId: string;
	eventId: string;
	eventOrder: number;
	roundNumber: number;
	groupNumber: number;
}

export default function ZktActivityDetail() {
	const {competitionId, groupId} = useParams<{competitionId: string; groupId: string}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [groupData, setGroupData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [navGroups, setNavGroups] = useState<NavGroup[]>([]);

	const fetch = useCallback(async () => {
		try {
			const res = await gqlMutate(GROUP_ASSIGNMENTS_QUERY, {competitionId, groupId});
			setGroupData(res?.data?.zktPublicGroupAssignments || null);
		} catch {
			setGroupData(null);
		} finally {
			setLoading(false);
		}
	}, [competitionId, groupId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	// Build the flat ordered group list once for prev/next navigation. Events are
	// already event-order sorted by the federation, so the array index is the
	// event order.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await gqlMutate(COMP_GROUPS_QUERY, {id: competitionId});
				if (cancelled) return;
				const events = res?.data?.zktPublicCompetition?.events || [];
				const flat: NavGroup[] = [];
				events.forEach((ev: any, evIdx: number) => {
					for (const rd of ev.rounds || []) {
						for (const g of rd.groups || []) {
							flat.push({
								groupId: g.groupId,
								eventId: ev.eventId,
								eventOrder: evIdx,
								roundNumber: rd.roundNumber,
								groupNumber: g.groupNumber,
							});
						}
					}
				});
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
		() => navGroups.findIndex((g) => g.groupId === groupId),
		[navGroups, groupId]
	);

	const goTo = useCallback(
		(index: number) => {
			if (index < 0 || index >= navGroups.length) return;
			history.push(`/zkt-competitions/${competitionId}/activities/${navGroups[index].groupId}`);
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

	const assignments: Assignment[] = groupData?.assignments || [];

	const byRole: Record<string, Assignment[]> = {};
	for (const a of assignments) {
		if (!byRole[a.role]) byRole[a.role] = [];
		byRole[a.role].push(a);
	}

	const totalCount = assignments.length;
	const roleSummary = ROLE_ORDER.filter((r) => byRole[r]?.length)
		.map((r) => `${t(`role_${r.toLowerCase()}`)} ${byRole[r].length}`)
		.join(' · ');

	const round = groupData?.round;
	const eventId = round?.eventId;
	const roundNumber = round?.roundNumber;
	const groupNumber = groupData?.groupNumber;
	const format = round?.format;
	const timeRange = groupData?.startTime ? formatTimeRange(groupData.startTime, groupData.endTime) : '';

	const hasNav = navGroups.length > 1 && currentIndex >= 0;

	return (
		<div className={b('detail-page')}>
			<div className={b('activity-topbar')}>
				<button
					className={b('back-btn')}
					onClick={() => history.push(`/zkt-competitions/${competitionId}`)}
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
			{round && (
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
							{(round.status === 'OPEN' || round.status === 'ACTIVE') && (
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
								key={`${a.competitor.id}-${a.role}`}
								className={b('competitor-row', {clickable: true})}
								onClick={() =>
									history.push(`/zkt-competitions/${competitionId}/competitors/${a.competitor.id}`)
								}
							>
								{a.competitor.avatarUrl && (
									<img
										className={b('user-avatar')}
										src={a.competitor.avatarUrl}
										alt=""
									/>
								)}
								<span className={b('user-name')}>
									{competitorFlag(a.competitor) && (
										<span className={b('flag')}>{competitorFlag(a.competitor)}</span>
									)}
									{competitorDisplayName(a.competitor) || a.competitor.id}
								</span>
								{a.stationNumber && (
									<span className={b('activity-station')}>#{a.stationNumber}</span>
								)}
								{a.seedResult && a.seedResult > 0 && (
									<span className={b('activity-seed')}>{formatCs(a.seedResult)}</span>
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
