import React from 'react';
import {useTranslation} from 'react-i18next';
import {X} from 'phosphor-react';
import {WCA_EVENT_IDS} from '../../../../shared/wca_geo';
import {b, EventIcon, getEventShortName} from './shared';

interface Props {
	selected: string[];
	onToggle: (eventCode: string) => void;
	onClear: () => void;
}

/**
 * Multi-select event chip bar for the competition list. A competition matches
 * when it holds AT LEAST ONE selected event (union), which is the useful default
 * for discovery ("show me comps that have FMC").
 */
export default function CompEventFilter({selected, onToggle, onClear}: Props) {
	const {t} = useTranslation();
	const active = selected.length > 0;

	return (
		<div className={b('event-filter')}>
			<div className={b('event-filter-head')}>
				<span className={b('event-filter-label')}>{t('my_schedule.filter_by_event')}</span>
				{active && (
					<button className={b('event-filter-clear')} onClick={onClear}>
						<X size={12} weight="bold" />
						{t('my_schedule.filter_clear')}
					</button>
				)}
			</div>
			<div className={b('event-filter-chips')}>
				{WCA_EVENT_IDS.map((code) => (
					<button
						key={code}
						className={b('event-chip', {active: selected.includes(code)})}
						onClick={() => onToggle(code)}
						title={getEventShortName(code)}
						aria-pressed={selected.includes(code)}
					>
						<EventIcon eventId={code} size={16} />
					</button>
				))}
			</div>
		</div>
	);
}
