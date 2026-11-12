import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import ChoiceGroup from '../../../common/choice_group/ChoiceGroup';
import {EventIcon, localEventName} from '../shared';
import {JudgeRound} from '../../../../../shared/zkt_judge';

const b = block('judge');

interface Props {
	rounds: JudgeRound[] | null;
	roundId: string | null;
	onChange: (roundId: string | null) => void;
}

/**
 * The event, then its round, for "Hakem ol" and the organisers' panel: one icon
 * per event in a single row, the chosen event's rounds as small chips right
 * under it. Picking an event picks its running round (or its only round); the
 * group comes after, in the screen that uses this.
 */
export default function JudgeRoundChooser({rounds, roundId, onChange}: Props) {
	const {t} = useTranslation();
	const events = useMemo(() => [...new Set((rounds || []).map((r) => r.eventId))], [rounds]);
	const [eventId, setEventId] = useState<string | null>(null);
	// The event follows the round once one is picked.
	const currentEvent = (rounds || []).find((r) => r.id === roundId)?.eventId ?? eventId;
	const eventRounds = (rounds || []).filter((r) => r.eventId === currentEvent);

	function pickEvent(id: string) {
		setEventId(id);
		const own = (rounds || []).filter((r) => r.eventId === id);
		const running = own.filter((r) => r.status === 'ACTIVE');
		onChange(running.length === 1 ? running[0].id : own.length === 1 ? own[0].id : null);
	}

	return (
		<>
			<span className={b('label')}>
				{t('my_schedule.col_event')}
				{currentEvent && <span className={b('label-value')}> · {localEventName(t, currentEvent)}</span>}
			</span>
			<ChoiceGroup<string>
				className={b('events')}
				label={t('my_schedule.col_event')}
				value={currentEvent}
				onChange={pickEvent}
				options={events.map((id) => ({
					value: id,
					title: localEventName(t, id),
					label: <EventIcon eventId={id} size={20} />,
				}))}
			/>
			{eventRounds.length > 0 && (
				<ChoiceGroup<string>
					className={b('rounds')}
					label={t('my_schedule.col_round')}
					value={roundId}
					onChange={onChange}
					options={eventRounds.map((r) => ({
						value: r.id,
						label: t('zkt_comp.judge_round_n', {n: r.roundNumber}),
					}))}
				/>
			)}
		</>
	);
}
