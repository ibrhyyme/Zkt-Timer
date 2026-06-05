import React, {useEffect, useState} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import Loading from '../../common/loading/Loading';
import {
	b,
	getEventName,
	formatCs,
	formatDateRange,
	ZKT_WCA_EVENTS,
	competitorDisplayName,
	competitorFlag,
} from './shared';

const RECORDS_QUERY = gql`
	query ZktRecordsList {
		zktRecords {
			id
			event_id
			record_type
			value
			user_id
			result_id
			competition_id
			set_at
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
			competition {
				id
				name
			}
		}
	}
`;

export default function ZktRecordsPage() {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [records, setRecords] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const res = await gqlMutate(RECORDS_QUERY, {});
				setRecords(res?.data?.zktRecords || []);
			} catch {
				// ignore
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	// Group by event_id; keep single + average per event.
	const byEvent = new Map<string, {single?: any; average?: any}>();
	for (const r of records) {
		const entry = byEvent.get(r.event_id) || {};
		if (r.record_type === 'single') entry.single = r;
		else if (r.record_type === 'average') entry.average = r;
		byEvent.set(r.event_id, entry);
	}

	if (loading) return <Loading />;

	function holderCell(rec: any) {
		return (
			<div className={b('record-holder')}>
				{rec.user?.profile?.pfp_image?.url && (
					<img className={b('tiny-avatar')} src={rec.user.profile.pfp_image.url} alt="" />
				)}
				{competitorFlag(rec.user) && (
					<span className={b('flag')}>{competitorFlag(rec.user)}</span>
				)}
				<span>{competitorDisplayName(rec.user) || '-'}</span>
			</div>
		);
	}

	function recordRow(eventId: string, type: 'single' | 'average', rec: any) {
		if (!rec) return null;
		return (
			<tr key={`${eventId}-${type}`}>
				<td>
					<div className={b('record-event')}>
						<span className={`cubing-icon event-${eventId}`} />
						<span>{getEventName(eventId)}</span>
					</div>
				</td>
				<td className={b('record-type-col')}>
					{type === 'single' ? t('single_best') : t('average_best')}
				</td>
				<td>{holderCell(rec)}</td>
				<td className={b('record-value')}>
					{formatCs(rec.value)}
					<span className={b('record-tag', {nr: true})}>NR</span>
				</td>
				<td className={b('record-date')}>
					{rec.set_at ? formatDateRange(rec.set_at, rec.set_at) : '-'}
				</td>
				<td>
					{rec.competition && (
						<Link
							className={b('record-comp-link')}
							to={`/community/zkt-competitions/${rec.competition.id}`}
						>
							{rec.competition.name}
						</Link>
					)}
				</td>
			</tr>
		);
	}

	return (
		<div className={b('records-page')}>
			<div className={b('page-header')}>
				<h1 className={b('page-title')}>{t('records_title')}</h1>
				<p className={b('page-subtitle')}>{t('records_subtitle')}</p>
			</div>

			{byEvent.size === 0 ? (
				<div className={b('empty')}>{t('no_records')}</div>
			) : (
				<div className={b('records-table-wrapper')}>
					<table className={b('records-table')}>
						<thead>
							<tr>
								<th>{t('event')}</th>
								<th>{t('record_type_col')}</th>
								<th>{t('holder')}</th>
								<th>{t('result')}</th>
								<th className={b('col-date')}>{t('date')}</th>
								<th>{t('competition')}</th>
							</tr>
						</thead>
						<tbody>
							{ZKT_WCA_EVENTS.map((ev) => {
								const entry = byEvent.get(ev.id);
								if (!entry) return null;
								return (
									<React.Fragment key={ev.id}>
										{recordRow(ev.id, 'single', entry.single)}
										{recordRow(ev.id, 'average', entry.average)}
									</React.Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
