import React, {useEffect, useState, useCallback} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useParams, useHistory} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs} from './shared';

const USER_ASSIGNMENTS_QUERY = gql`
	query ZktUserAssignmentsPublic($competitionId: String!, $userId: String!) {
		zktUserAssignments(competitionId: $competitionId, userId: $userId) {
			id
			round_id
			group_id
			user_id
			role
			station_number
			round {
				round_number
				format
				comp_event {
					event_id
				}
			}
			group {
				group_number
			}
		}
	}
`;

const COMPETITOR_RESULTS_QUERY = gql`
	query ZktCompetitorResultsPublic($competitionId: String!, $userId: String!) {
		zktCompetitorResults(competitionId: $competitionId, userId: $userId) {
			id
			round_id
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
			best
			average
			ranking
			proceeds
			single_record_tag
			average_record_tag
			round {
				round_number
				format
				comp_event {
					event_id
				}
			}
		}
	}
`;

const ROLE_LABELS: Record<string, string> = {
	COMPETITOR: 'role_competitor',
	JUDGE: 'role_judge',
	SCRAMBLER: 'role_scrambler',
	RUNNER: 'role_runner',
	ORGANIZER: 'role_organizer',
	STAFF: 'role_staff',
};

const ROLE_COLORS: Record<string, string> = {
	COMPETITOR: '#2dbd61',
	JUDGE: '#42a5f5',
	SCRAMBLER: '#9b59b6',
	RUNNER: '#ee6a26',
};

export default function ZktCompetitorDetail() {
	const {competitionId, userId} = useParams<{competitionId: string; userId: string}>();
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();

	const [assignments, setAssignments] = useState<any[]>([]);
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const fetch = useCallback(async () => {
		try {
			const [assignRes, resultRes] = await Promise.all([
				gqlMutate(USER_ASSIGNMENTS_QUERY, {competitionId, userId}),
				gqlMutate(COMPETITOR_RESULTS_QUERY, {competitionId, userId}),
			]);
			setAssignments(assignRes?.data?.zktUserAssignments || []);
			setResults(resultRes?.data?.zktCompetitorResults || []);
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [competitionId, userId]);

	useEffect(() => {
		fetch();
	}, [fetch]);

	if (loading) return <Loading />;

	// Group assignments by event
	const eventMap = new Map<string, any[]>();
	for (const a of assignments) {
		const eventId = a.round?.comp_event?.event_id || 'unknown';
		if (!eventMap.has(eventId)) eventMap.set(eventId, []);
		eventMap.get(eventId)!.push(a);
	}

	// Group results by event
	const resultEventMap = new Map<string, any[]>();
	for (const r of results) {
		const eventId = r.round?.comp_event?.event_id || 'unknown';
		if (!resultEventMap.has(eventId)) resultEventMap.set(eventId, []);
		resultEventMap.get(eventId)!.push(r);
	}

	return (
		<div className={b('detail-page')}>
			<div className={b('detail-header')}>
				<button
					className={b('back-btn')}
					onClick={() => history.push(`/community/zkt-competitions/${competitionId}`)}
				>
					{t('back')}
				</button>
				<h1 className={b('detail-title')}>{t('competitor_detail')}</h1>
			</div>

			{/* Assignments section */}
			<div style={{marginBottom: '2rem'}}>
				<h3 className={b('section-title')}>{t('my_assignments')}</h3>

				{assignments.length === 0 ? (
					<div className={b('empty')}>{t('no_assignments')}</div>
				) : (
					<div className={b('events-list')}>
						{Array.from(eventMap.entries()).map(([eventId, eventAssignments]) => (
							<div key={eventId} className={b('event-card')}>
								<div className={b('event-card-header')}>
									<span className={`cubing-icon event-${eventId}`} style={{fontSize: 24}} />
									<div>
										<div className={b('event-card-title')}>{getEventName(eventId)}</div>
									</div>
								</div>
								<div className={b('event-card-rounds')}>
									{eventAssignments.map((a: any) => (
										<div key={a.id} className={b('round-info-row')}>
											<span className={b('round-info-label')}>
												{t('round_n', {n: a.round?.round_number})}
											</span>
											{a.group && (
												<span className={b('round-info-fmt')}>
													{t('group_n', {n: a.group.group_number})}
												</span>
											)}
											<span
												style={{
													padding: '0.15rem 0.5rem',
													borderRadius: 4,
													fontSize: 11,
													fontWeight: 700,
													background: `${ROLE_COLORS[a.role] || '#666'}22`,
													color: ROLE_COLORS[a.role] || 'rgb(var(--text-color))',
												}}
											>
												{t(ROLE_LABELS[a.role] || a.role)}
											</span>
											{a.station_number && (
												<span className={b('round-info-meta')}>#{a.station_number}</span>
											)}
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Results section */}
			<div>
				<h3 className={b('section-title')}>{t('results')}</h3>

				{results.length === 0 ? (
					<div className={b('empty')}>{t('no_results_yet')}</div>
				) : (
					<div className={b('events-list')}>
						{Array.from(resultEventMap.entries()).map(([eventId, eventResults]) => (
							<div key={eventId} className={b('event-card')}>
								<div className={b('event-card-header')}>
									<span className={`cubing-icon event-${eventId}`} style={{fontSize: 24}} />
									<div>
										<div className={b('event-card-title')}>{getEventName(eventId)}</div>
									</div>
								</div>
								<div className={b('event-card-rounds')}>
									{eventResults.map((r: any) => (
										<div key={r.id} className={b('round-info-row')}>
											<span className={b('round-info-label')}>
												{t('round_n', {n: r.round?.round_number})}
											</span>
											<span className={b('round-info-fmt')}>{r.round?.format}</span>
											{r.ranking && (
												<span
													style={{
														padding: '0.15rem 0.5rem',
														borderRadius: 4,
														fontSize: 12,
														fontWeight: 700,
														background: 'rgba(var(--primary-color), 0.2)',
														color: 'rgb(var(--primary-color))',
													}}
												>
													#{r.ranking}
												</span>
											)}
											<span style={{fontFamily: 'monospace', fontWeight: 700}}>
												{formatCs(r.best)}
											</span>
											{r.average && r.average > 0 && (
												<span
													style={{fontFamily: 'monospace', color: 'rgba(var(--text-color), 0.75)'}}
												>
													avg: {formatCs(r.average)}
												</span>
											)}
											{r.single_record_tag && (
												<span className={b('record-tag')}>{r.single_record_tag}</span>
											)}
											{r.average_record_tag && (
												<span className={b('record-tag')}>{r.average_record_tag}</span>
											)}
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
