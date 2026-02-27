import React from 'react';
import {useTranslation} from 'react-i18next';
import './WcaPbCard.scss';
import Scramble from '../../modules/scramble/ScrambleVisual';
import {getCubeTypeInfoById} from '../../../util/cubes/util';
import block from '../../../styles/bem';
import {Trophy, Medal, Crown} from 'phosphor-react';

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

	const cubeType = getCubeTypeInfoById(record.wca_event);

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	function getScrambleForVisual(eventCode: string): string {
		// WCA eventlerini desteklenen scramble türlerine map'le
		const eventToScramble: Record<string, string> = {
			'333': '333',
			'222': '222', 
			'444': '444',
			'555': '555',
			'666': '666',
			'777': '777',
			'333bf': '333bl', // Blind için 333bl scramble kullan
			'333oh': '333',   // One handed için normal 3x3 visual
			'333fm': '333',   // Fewest moves için normal 3x3 visual
			'333ft': '333',   // With feet için normal 3x3 visual
		};

		return eventToScramble[eventCode] || eventCode;
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

	if (!cubeType) {
		return null;
	}

	// Eğer hiç record yoksa gösterme
	if (!record.average_record && !record.single_record) {
		return null;
	}

	return (
		<div className={b()}>
			{/* Sol: Event İsmi */}
			<div className={b('visual')}>
				<div className={b('event-name')}>
					{getEventName(record.wca_event)}
				</div>
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
						{record.average_country_rank && (
							<span className={b('rank')}>#{record.average_country_rank} Türkiye</span>
						)}
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
						{record.single_country_rank && (
							<span className={b('rank')}>#{record.single_country_rank} Türkiye</span>
						)}
					</>
				) : (
					<span className={b('no-record')}>—</span>
				)}
			</div>
		</div>
	);
}
