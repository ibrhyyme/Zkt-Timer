import React, {useEffect, useState} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {b, formatCs, ZKT_WCA_EVENTS} from './shared';

const RANKINGS_QUERY = gql`
	query ZktAllTimeRankings($eventId: String!, $recordType: String!, $limit: Float) {
		zktAllTimeRankings(eventId: $eventId, recordType: $recordType, limit: $limit) {
			ranking
			value
			event_id
			record_type
			result_id
			round_id
			user {
				id
				username
				profile {
					pfp_image {
						url
					}
				}
			}
			competition {
				id
				name
				date_start
			}
		}
	}
`;

export default function ZktRankingsPage() {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [eventId, setEventId] = useState<string>('333');
	const [recordType, setRecordType] = useState<'single' | 'average'>('single');
	const [rows, setRows] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		(async () => {
			try {
				const res: any = await gqlMutate(RANKINGS_QUERY, {
					eventId,
					recordType,
					limit: 100,
				});
				if (!cancelled) setRows(res?.data?.zktAllTimeRankings || []);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [eventId, recordType]);

	return (
		<div className={b('rankings-page')}>
			<h1>{t('all_time_rankings')}</h1>

			<div className={b('rankings-controls')} style={{display: 'flex', gap: '1rem', margin: '1rem 0', flexWrap: 'wrap'}}>
				<label>
					<span style={{display: 'block', fontSize: 12, opacity: 0.7}}>
						{t('rankings_event')}
					</span>
					<select
						className={b('select')}
						value={eventId}
						onChange={(e) => setEventId(e.target.value)}
					>
						{ZKT_WCA_EVENTS.map((ev) => (
							<option key={ev.id} value={ev.id}>
								{ev.name}
							</option>
						))}
					</select>
				</label>

				<div role="tablist" style={{display: 'flex', gap: '0.5rem', alignItems: 'flex-end'}}>
					<button
						type="button"
						role="tab"
						aria-selected={recordType === 'single'}
						className={b('filter-pill', {active: recordType === 'single'})}
						onClick={() => setRecordType('single')}
					>
						{t('rankings_type_single')}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={recordType === 'average'}
						className={b('filter-pill', {active: recordType === 'average'})}
						onClick={() => setRecordType('average')}
					>
						{t('rankings_type_average')}
					</button>
				</div>
			</div>

			{loading ? (
				<div className={b('empty')}>{t('loading')}</div>
			) : rows.length === 0 ? (
				<div className={b('empty')}>{t('no_podiums_yet')}</div>
			) : (
				<div className={b('rankings-list')}>
					{rows.map((row) => (
						<div key={`${row.user?.id}-${row.result_id}`} className={b('ranking-row')}>
							<span className={b('ranking-pos')}>#{row.ranking}</span>
							{row.user?.profile?.pfp_image?.url && (
								<img
									className={b('user-avatar')}
									src={row.user.profile.pfp_image.url}
									alt=""
								/>
							)}
							<span className={b('ranking-name')}>{row.user?.username}</span>
							<span className={b('ranking-value')}>{formatCs(row.value)}</span>
							{row.competition && (
								<Link
									className={b('ranking-comp-link')}
									to={`/community/zkt-competitions/${row.competition.id}`}
								>
									{row.competition.name}
								</Link>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
