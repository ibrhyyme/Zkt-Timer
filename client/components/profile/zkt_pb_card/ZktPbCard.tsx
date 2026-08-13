import React from 'react';
import {useTranslation} from 'react-i18next';
import '../wca_pb_card/WcaPbCard.scss';
import block from '../../../styles/bem';
import {EventIcon} from '../../community/my_schedule/shared';

// Reuses the WCA PB card's stylesheet and block: on the same profile these two
// lists are read side by side, so a different card shape would suggest the
// numbers mean different things. They don't — one is a WCA result, the other a
// ZKT result.
const b = block('profile-wca-pb-card');

export interface ZktPb {
	event_id: string;
	single?: string;
	average?: string;
}

interface Props {
	pb: ZktPb;
}

/**
 * One event's best ZKT competition result. Times arrive already formatted from
 * the federation (it owns the FMC/MBLD formatting rules for its own results),
 * so this card never re-formats them. There are no world/country ranks: ZKT
 * rankings are a separate page, and inventing a rank here would be a claim the
 * federation never made.
 */
export default function ZktPbCard({pb}: Props) {
	const {t} = useTranslation();

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
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
				<div className={b('record-type')}>Average</div>
				{pb.average ? (
					<div className={b('time-container')}>
						<span className={b('time-value')}>{pb.average}</span>
					</div>
				) : (
					<span className={b('no-record')}>—</span>
				)}
			</div>

			<div className={b('record-section')}>
				<div className={b('record-type')}>Single</div>
				{pb.single ? (
					<div className={b('time-container')}>
						<span className={b('time-value')}>{pb.single}</span>
					</div>
				) : (
					<span className={b('no-record')}>—</span>
				)}
			</div>
		</div>
	);
}
