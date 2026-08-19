import React from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {CalendarPlus} from 'phosphor-react';
import block from '../../../styles/bem';
import {openModal} from '../../../actions/general';
import AddToCalendarModal from './AddToCalendarModal';
import './AddToCalendar.scss';

const b = block('add-to-calendar');

interface Props {
	/** WCA competition id, or `zkt-<slug>` for a Zeka Kupu Turkiye competition. */
	competitionId: string;
}

/** "Add to calendar" pill for the competition page header. */
export default function AddToCalendarButton(props: Props) {
	const {competitionId} = props;
	const {t} = useTranslation();
	const dispatch = useDispatch();

	function handleClick() {
		dispatch(
			openModal(<AddToCalendarModal competitionId={competitionId} />, {
				compact: true,
				width: 420,
				closeButtonText: t('add_to_calendar.done'),
			})
		);
	}

	return (
		<button type="button" className={b('trigger')} onClick={handleClick}>
			<CalendarPlus size={15} weight="bold" />
			{t('add_to_calendar.button')}
		</button>
	);
}
