import React from 'react';
import {useTranslation} from 'react-i18next';
import './WcaPbCard.scss';
import block from '../../../styles/bem';
import {Trophy, Medal, Crown} from 'phosphor-react';
import {EventIcon} from '../../community/my_schedule/shared';

const b = block('profile-wca-pb-card');

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

interface Props {
	record: WcaRecord;
}

export default function WcaPbCard(props: Props) {
	const {t} = useTranslation();
	const {record} = props;

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	function formatTime(centiseconds: number): string {
		if (!centiseconds) return '—';

		const minutes = Math.floor(centiseconds / 6000);
		const seconds = Math.floor((centiseconds % 6000) / 100);
		const cs = centiseconds % 100;

		if (minutes > 0) {
			return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
		} else {
			return `${seconds}.${cs.toString().padStart(2, '0')}`;
		}
	}

	function getRankIcon(rank?: number) {
		if (!rank) return null;

		if (rank === 1) return <Crown weight="fill" className={b('rank-icon', {gold: true})} />;
		if (rank <= 3) return <Medal weight="fill" className={b('rank-icon', {silver: true})} />;
		if (rank <= 10) return <Trophy weight="fill" className={b('rank-icon', {bronze: true})} />;
		return null;
	}

	if (!record.average_record && !record.single_record) {
		return null;
	}

	return (
		<div className={b()}>
			{/* Sol: WCA Event İkonu */}
			<div className={b('visual')}>
				<EventIcon eventId={record.wca_event} size={52} />
				<span className={b('event-label')} style={{display: 'block', marginTop: '6px', fontSize: '0.72rem', fontWeight: 600, opacity: 0.65, textAlign: 'center'}}>
					{getEventName(record.wca_event)}
				</span>
			</div>

			{/* Orta: Average */}
			<div className={b('record-section')}>
				<div className={b('record-type')}>Average</div>
				{record.average_record ? (
					<>
						<div className={b('time-container')}>
							<span className={b('time-value')}>{formatTime(record.average_record)}</span>
							{getRankIcon(record.average_country_rank)}
						</div>
						<div className={b('ranks')}>
							{record.average_world_rank && (
								<span className={b('rank', { world: true })}>#{record.average_world_rank} {t('profile.wca_world_short')}</span>
							)}
							{record.average_country_rank && (
								<span className={b('rank')}>#{record.average_country_rank} {t('profile.wca_country_short')}</span>
							)}
						</div>
					</>
				) : (
					<span className={b('no-record')}>—</span>
				)}
			</div>

			{/* Sağ: Single */}
			<div className={b('record-section')}>
				<div className={b('record-type')}>Single</div>
				{record.single_record ? (
					<>
						<div className={b('time-container')}>
							<span className={b('time-value')}>{formatTime(record.single_record)}</span>
							{getRankIcon(record.single_country_rank)}
						</div>
						<div className={b('ranks')}>
							{record.single_world_rank && (
								<span className={b('rank', { world: true })}>#{record.single_world_rank} {t('profile.wca_world_short')}</span>
							)}
							{record.single_country_rank && (
								<span className={b('rank')}>#{record.single_country_rank} {t('profile.wca_country_short')}</span>
							)}
						</div>
					</>
				) : (
					<span className={b('no-record')}>—</span>
				)}
			</div>
		</div>
	);
}
