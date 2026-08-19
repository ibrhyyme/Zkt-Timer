import React, {useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {CalendarPlus} from 'phosphor-react';
import block from '../../../styles/bem';
import {openModal} from '../../../actions/general';
import {toastError, toastSuccess, toastWarning} from '../../../util/toast';
import {
	addCompetitionToNativeCalendar,
	fetchCompetitionCalendarMeta,
	isNativeCalendarAvailable,
	probeNativeCalendar,
} from '../../../util/native-calendar';
import AddToCalendarModal from './AddToCalendarModal';
import './AddToCalendar.scss';

const b = block('add-to-calendar');

interface Props {
	/** WCA competition id, or `zkt-<slug>` for a Zeka Kupu Turkiye competition. */
	competitionId: string;
}

/**
 * "Add to calendar" pill for the competition page header.
 *
 * On a phone that ships the native plugin this opens the system event sheet, so
 * the competition lands in the phone's own calendar next to birthdays and public
 * holidays. Everywhere else (the browser, and app binaries built before the
 * plugin existed) it falls back to the Google/.ics sheet.
 *
 * One rule governs every branch: anything that fails BEFORE the system sheet is
 * on screen opens the web sheet, and anything that happens AFTER it is on screen
 * is either a toast or deliberate silence.
 */
export default function AddToCalendarButton(props: Props) {
	const {competitionId} = props;
	const {t, i18n} = useTranslation();
	const dispatch = useDispatch();
	const [pending, setPending] = useState(false);

	// The system sheet can outlive a navigation away from this page.
	const mounted = useRef(true);
	useEffect(() => {
		return () => {
			mounted.current = false;
		};
	}, []);

	function openWebSheet() {
		dispatch(
			openModal(<AddToCalendarModal competitionId={competitionId} />, {
				compact: true,
				width: 420,
				closeButtonText: t('add_to_calendar.done'),
			})
		);
	}

	async function addNatively() {
		setPending(true);
		try {
			// Old binary without the plugin: the web sheet is the same experience
			// it has today, so fall back before touching the network.
			if (!(await probeNativeCalendar())) {
				openWebSheet();
				return;
			}

			const meta = await fetchCompetitionCalendarMeta(competitionId, i18n.language || 'tr');
			if (!meta) {
				openWebSheet();
				return;
			}

			const result = await addCompetitionToNativeCalendar(
				meta,
				t('add_to_calendar.cancelled_prefix')
			);

			switch (result) {
				case 'saved':
					toastSuccess(t('add_to_calendar.native_saved'));
					break;
				case 'opened':
					// Android handed off. The calendar screen is in front of the
					// user, so a toast would be noise on top of it.
					break;
				case 'cancelled':
					// Backing out is a decision, not a failure.
					break;
				case 'denied':
					// The .ics and Google routes need no calendar permission, so
					// offer them instead of dead-ending.
					toastWarning(t('add_to_calendar.native_denied'));
					openWebSheet();
					break;
				case 'error':
					toastError(t('add_to_calendar.native_error'));
					openWebSheet();
					break;
				default:
					openWebSheet();
			}
		} finally {
			if (mounted.current) {
				setPending(false);
			}
		}
	}

	function handleClick() {
		if (pending) return;

		if (isNativeCalendarAvailable()) {
			void addNatively();
			return;
		}

		openWebSheet();
	}

	return (
		<button
			type="button"
			className={b('trigger', {pending})}
			onClick={handleClick}
			disabled={pending}
		>
			<CalendarPlus size={15} weight="bold" />
			{t('add_to_calendar.button')}
		</button>
	);
}
