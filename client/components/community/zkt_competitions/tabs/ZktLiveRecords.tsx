import React, {useEffect, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs, competitorDisplayName, competitorFlag} from '../shared';

const RECORDS_QUERY = gql`
	query ZktRecordsForLive {
		zktRecords {
			id
			event_id
			record_type
			value
			user {
				id
				username
				first_name
				last_name
				join_country
			}
		}
	}
`;

interface RecordItem {
	event_id: string;
	record_type: string;
	value: number;
	user?: {id: string; username: string};
}

export default function ZktLiveRecords() {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [records, setRecords] = useState<RecordItem[]>([]);

	useEffect(() => {
		(async () => {
			try {
				const res = await gqlMutate(RECORDS_QUERY, {});
				setRecords(res?.data?.zktRecords || []);
			} catch {
				// ignore
			}
		})();
	}, []);

	if (records.length === 0) return null;

	return (
		<div style={{marginBottom: '2rem'}}>
			<h3 className={b('section-title')}>{t('records_title')}</h3>
			<div style={{display: 'flex', flexDirection: 'column', gap: '0.35rem'}}>
				{records.map((r) => (
					<div
						key={r.event_id + r.record_type}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.6rem',
							padding: '0.5rem 0.75rem',
							background: 'rgb(var(--module-color))',
							borderRadius: 6,
							fontSize: 13,
							color: 'rgb(var(--text-color))',
						}}
					>
						<span className={`cubing-icon event-${r.event_id}`} style={{fontSize: 18}} />
						<span style={{fontWeight: 600}}>{getEventName(r.event_id)}</span>
						<span className={b('record-tag')}>NR</span>
						<span style={{textTransform: 'capitalize', color: 'rgb(var(--text-color))'}}>
							{r.record_type}
						</span>
						<span style={{fontFamily: 'monospace', fontWeight: 700, marginLeft: 'auto'}}>
							{formatCs(r.value)}
						</span>
						<span style={{color: 'rgb(var(--text-color))'}}>
							{competitorFlag(r.user) ? competitorFlag(r.user) + ' ' : ''}
							{competitorDisplayName(r.user) || '-'}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
