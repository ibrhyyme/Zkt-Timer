import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';

const b = block('competitions');

const WCA_EVENTS = [
	{code: '333', shortName: '3x3'},
	{code: '222', shortName: '2x2'},
	{code: '444', shortName: '4x4'},
	{code: '555', shortName: '5x5'},
	{code: '666', shortName: '6x6'},
	{code: '777', shortName: '7x7'},
	{code: '333bf', shortName: '3BLD'},
	{code: '333fm', shortName: 'FMC'},
	{code: '333oh', shortName: 'OH'},
	{code: 'minx', shortName: 'Mega'},
	{code: 'pyram', shortName: 'Pyra'},
	{code: 'clock', shortName: 'Clock'},
	{code: 'skewb', shortName: 'Skewb'},
	{code: 'sq1', shortName: 'SQ1'},
	{code: '444bf', shortName: '4BLD'},
	{code: '555bf', shortName: '5BLD'},
	{code: '333mbf', shortName: 'MBLD'},
];

interface Props {
	selectedEvent: string | null;
	onSelect: (eventCode: string | null) => void;
}

export default function CompetitionEventFilter({selectedEvent, onSelect}: Props) {
	const {t} = useTranslation();

	return (
		<div className={b('event-filter')}>
			{WCA_EVENTS.map((event) => (
				<button
					key={event.code}
					className={b('event-chip', {active: selectedEvent === event.code})}
					onClick={() => onSelect(selectedEvent === event.code ? null : event.code)}
				>
					{event.shortName}
				</button>
			))}
		</div>
	);
}

export {WCA_EVENTS};
