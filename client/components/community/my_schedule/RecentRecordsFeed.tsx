import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {WCA_COUNTRIES} from '../../../../shared/wca_geo';
import {b, formatResult, countryFlag} from './shared';
import {RecentRecordEntry, fetchRecentRecords} from './recordWatchApi';

const TAG_BG: Record<string, string> = {
	WR: 'rgba(231, 76, 60, 0.95)',
	CR: 'rgba(243, 156, 18, 0.95)',
	NR: 'rgba(39, 174, 96, 0.95)',
	PR: 'rgba(120, 120, 120, 0.9)',
};

const COUNTRY_NAME: Record<string, string> = WCA_COUNTRIES.reduce(
	(acc, c) => {
		acc[c.iso2] = c.name;
		return acc;
	},
	{} as Record<string, string>,
);

// Short-lived module cache so switching tabs doesn't refetch every time.
let cache: {data: RecentRecordEntry[]; ts: number} | null = null;
const CACHE_TTL = 3 * 60 * 1000;

export default function RecentRecordsFeed() {
	const {t} = useTranslation();
	const history = useHistory();
	const [records, setRecords] = useState<RecentRecordEntry[] | null>(
		cache && Date.now() - cache.ts < CACHE_TTL ? cache.data : null,
	);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (cache && Date.now() - cache.ts < CACHE_TTL) return;
		let mounted = true;
		fetchRecentRecords()
			.then((data) => {
				cache = {data, ts: Date.now()};
				if (mounted) setRecords(data);
			})
			.catch(() => mounted && setError(true));
		return () => {
			mounted = false;
		};
	}, []);

	function openRecord(rec: RecentRecordEntry) {
		if (rec.competitionId && rec.eventId && rec.roundNumber) {
			history.push(`/competitions/${rec.competitionId}/wca-live/${rec.eventId}/${rec.roundNumber}`);
		} else if (rec.competitionId) {
			history.push(`/competitions/${rec.competitionId}`);
		}
	}

	if (error) {
		return <p className={b('empty')}>{t('my_schedule.radar_save_error')}</p>;
	}
	if (records === null) {
		return <p className={b('my-competitions-empty')}>{t('my_schedule.loading')}</p>;
	}
	if (records.length === 0) {
		return <p className={b('empty')}>{t('my_schedule.feed_empty')}</p>;
	}

	return (
		<div className={b('radar-feed')}>
			{records.map((rec) => {
				const typeLabel =
					rec.type === 'average' ? t('my_schedule.feed_average_of') : t('my_schedule.feed_single_of');
				const result = formatResult(rec.attemptResult, rec.eventId, rec.type === 'average');
				const countryName = rec.personCountryIso2
					? COUNTRY_NAME[rec.personCountryIso2] || rec.personCountryIso2
					: '';
				return (
					<button
						key={rec.id}
						className={b('radar-feed-row')}
						onClick={() => openRecord(rec)}
						disabled={!rec.competitionId}
					>
						<span className={b('radar-feed-tag')} style={{background: TAG_BG[rec.tag] || TAG_BG.PR}}>
							{rec.tag}
						</span>
						<span className={b('radar-feed-body')}>
							<span className={b('radar-feed-title')}>
								{rec.eventName} {typeLabel} <strong>{result}</strong>
							</span>
							<span className={b('radar-feed-person')}>
								{rec.personName}
								{countryName && (
									<>
										{' · '}
										{rec.personCountryIso2 ? countryFlag(rec.personCountryIso2) : ''} {countryName}
									</>
								)}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
