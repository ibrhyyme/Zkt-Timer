import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlQuery} from '../../api';
import Emblem from '../../common/emblem/Emblem';
import {Trophy, Medal, Crown} from 'phosphor-react';
import {formatResult} from '../../community/my_schedule/shared';
import './WcaRecords.scss';

interface WcaRecord {
	id: string;
	wca_event: string;
	single_record?: number;
	average_record?: number;
	single_world_rank?: number;
	average_world_rank?: number;
	single_country_rank?: number;
	average_country_rank?: number;
	published: boolean;
}

interface WcaRecordsProps {
	userId: string;
}

export default function WcaRecords({userId}: WcaRecordsProps) {
	const {t} = useTranslation();
	const [records, setRecords] = useState<WcaRecord[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadWcaRecords();
	}, [userId]);

	async function loadWcaRecords() {
		if (!userId) return;

		setLoading(true);
		try {
			const query = gql`
				query WcaRecords($userId: String) {
					wcaRecords(userId: $userId) {
						id
						wca_event
						single_record
						average_record
						single_world_rank
						average_world_rank
						single_country_rank
						average_country_rank
						published
					}
				}
			`;

			const res = await gqlQuery(query, { userId });
			setRecords((res.data as any).wcaRecords || []);
		} catch (error) {
			console.error('Failed to load WCA records:', error);
		} finally {
			setLoading(false);
		}
	}

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	function getRankIcon(rank?: number) {
		if (!rank) return null;
		
		if (rank === 1) return <Crown weight="fill" color="#FFD700" />;
		if (rank <= 3) return <Medal weight="fill" color="#C0C0C0" />;
		if (rank <= 10) return <Trophy weight="fill" color="#CD7F32" />;
		return null;
	}

	if (loading) {
		return <div className="wca-records loading">{t('profile.wca_records_loading')}</div>;
	}

	if (!records.length) {
		return null; // Don't show anything if no published records
	}

	const recordCards = records.map(record => {
		const hasSingle = record.single_record;
		const hasAverage = record.average_record;
		
		if (!hasSingle && !hasAverage) return null;

		return (
			<div key={record.id} className="wca-record-card">
				<div className="event-name">
					<Emblem text={getEventName(record.wca_event)} />
				</div>
				
				<div className="records-row">
					{hasSingle && (
						<div className="record-item">
							<div className="record-type">{t('profile.single')}</div>
							<div className="record-time">
								{formatResult(record.single_record!, record.wca_event, false)}
								{getRankIcon(record.single_country_rank)}
							</div>
							{record.single_country_rank && (
								<div className="record-rank">
									#{record.single_country_rank} {t('profile.wca_country_short')}
								</div>
							)}
						</div>
					)}
					
					{hasAverage && (
						<div className="record-item">
							<div className="record-type">{t('profile.average')}</div>
							<div className="record-time">
								{formatResult(record.average_record!, record.wca_event, true)}
								{getRankIcon(record.average_country_rank)}
							</div>
							{record.average_country_rank && (
								<div className="record-rank">
									#{record.average_country_rank} {t('profile.wca_country_short')}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}).filter(Boolean);

	if (!recordCards.length) {
		return null;
	}

	return (
		<div className="wca-records">
			<h2>{t('profile.wca_official_records')}</h2>
			<div className="wca-records-grid">
				{recordCards}
			</div>
		</div>
	);
}
