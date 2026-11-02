import React from 'react';
import {useTranslation} from 'react-i18next';
import '../wca_pb_card/WcaPbCard.scss';
import block from '../../../styles/bem';
import {Trophy, Medal, Crown} from 'phosphor-react';
import {EventIcon} from '../../community/my_schedule/shared';

// Reuses the WCA PB card's stylesheet and block: on the same profile these two
// lists are read side by side, so a different card shape would suggest the
// numbers mean different things. They don't — one is a WCA result, the other a
// ZKT result.
const b = block('profile-wca-pb-card');

export interface ZktRankPosition {
	rank: number;
	total: number;
}

export interface ZktPb {
	event_id: string;
	single?: string;
	average?: string;
	single_rank?: ZktRankPosition | null;
	average_rank?: ZktRankPosition | null;
}

interface Props {
	pb: ZktPb;
}

/**
 * One event's best ZKT competition result. Times arrive already formatted from
 * the federation (it owns the FMC/MBLD formatting rules for its own results),
 * so this card never re-formats them. The rank is the member's position in the
 * ZKT all-time rankings, published by the federation itself; ZKT competitions
 * are all in Türkiye, so it sits where the WCA card shows its country rank, and
 * there is no world rank. Absent when the member switched ranking off.
 */
export default function ZktPbCard({pb}: Props) {
	const {t} = useTranslation();

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	function getRankIcon(position?: ZktRankPosition | null) {
		const rank = position?.rank;
		if (!rank) return null;

		if (rank === 1) return <Crown weight="fill" className={b('rank-icon', {gold: true})} />;
		if (rank <= 3) return <Medal weight="fill" className={b('rank-icon', {silver: true})} />;
		if (rank <= 10) return <Trophy weight="fill" className={b('rank-icon', {bronze: true})} />;
		return null;
	}

	function renderRecord(value?: string, position?: ZktRankPosition | null) {
		if (!value) {
			return <span className={b('no-record')}>—</span>;
		}
		return (
			<>
				<div className={b('time-container')}>
					<span className={b('time-value')}>{value}</span>
					{getRankIcon(position)}
				</div>
				{position && (
					<div className={b('ranks')}>
						<span className={b('rank')} title={`${position.rank} / ${position.total}`}>
							#{position.rank} {t('profile.zkt_rank_short')}
						</span>
					</div>
				)}
			</>
		);
	}

	if (!pb.single && !pb.average) {
		return null;
	}

	return (
		<div className={b()}>
			<div className={b('visual')}>
				<EventIcon eventId={pb.event_id} size={52} />
				<span
					className={b('event-label')}
					style={{
						display: 'block',
						marginTop: '6px',
						fontSize: '0.72rem',
						fontWeight: 600,
						opacity: 0.65,
						textAlign: 'center',
					}}
				>
					{getEventName(pb.event_id)}
				</span>
			</div>

			<div className={b('record-section')}>
				<div className={b('record-type')}>{t('profile.average')}</div>
				{renderRecord(pb.average, pb.average_rank)}
			</div>

			<div className={b('record-section')}>
				<div className={b('record-type')}>{t('profile.single')}</div>
				{renderRecord(pb.single, pb.single_rank)}
			</div>
		</div>
	);
}
