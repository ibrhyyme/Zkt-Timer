import React, {useEffect, useState} from 'react';
import './ZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import Loading from '../../common/loading/Loading';
import {b, getEventName, formatCs, ZKT_WCA_EVENTS} from './shared';

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
				profile {
					pfp_image {
						id
						url
					}
				}
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

	// Group by event_id for table rendering
	const byEvent = new Map<string, {single?: any; average?: any}>();
	for (const r of records) {
		const entry = byEvent.get(r.event_id) || {};
		if (r.record_type === 'single') entry.single = r;
		else if (r.record_type === 'average') entry.average = r;
		byEvent.set(r.event_id, entry);
	}

	if (loading) return <Loading />;

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
								<th>{t('single_best')}</th>
								<th>{t('holder')}</th>
								<th>{t('average_best')}</th>
								<th>{t('holder')}</th>
							</tr>
						</thead>
						<tbody>
							{ZKT_WCA_EVENTS.map((ev) => {
								const entry = byEvent.get(ev.id);
								if (!entry) return null;
								return (
									<tr key={ev.id}>
										<td>
											<div className={b('record-event')}>
												<span className={`cubing-icon event-${ev.id}`} />
												<span>{getEventName(ev.id)}</span>
											</div>
										</td>
										<td className={b('record-value')}>
											{entry.single ? formatCs(entry.single.value) : '-'}
										</td>
										<td>
											{entry.single ? (
												<div className={b('record-holder')}>
													{entry.single.user?.profile?.pfp_image?.url && (
														<img
															className={b('tiny-avatar')}
															src={entry.single.user.profile.pfp_image.url}
															alt=""
														/>
													)}
													<span>{entry.single.user?.username || '-'}</span>
												</div>
											) : (
												'-'
											)}
										</td>
										<td className={b('record-value')}>
											{entry.average ? formatCs(entry.average.value) : '-'}
										</td>
										<td>
											{entry.average ? (
												<div className={b('record-holder')}>
													{entry.average.user?.profile?.pfp_image?.url && (
														<img
															className={b('tiny-avatar')}
															src={entry.average.user.profile.pfp_image.url}
															alt=""
														/>
													)}
													<span>{entry.average.user?.username || '-'}</span>
												</div>
											) : (
												'-'
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
