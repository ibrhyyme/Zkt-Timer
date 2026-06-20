import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {IModalProps} from '../../../common/modal/Modal';
import {b, getEventName} from '../shared';
import {PencilSimple} from 'phosphor-react';

// Ghost (account-less) competitor: name + country + events are editable.
const UPDATE_PERSON = gql`
	mutation EditZktPerson($input: UpdateZktPersonInput!) {
		updateZktPerson(input: $input) {
			id
			first_name
			last_name
		}
	}
`;

// Account competitor: only the events are editable (the name belongs to the account).
const UPDATE_REG_EVENTS = gql`
	mutation AdminUpdateZktRegEvents($registrationId: String!, $eventIds: [String!]!) {
		adminUpdateZktRegistrationEvents(registrationId: $registrationId, eventIds: $eventIds) {
			id
		}
	}
`;

interface Props extends IModalProps {
	competitionId: string;
	compEvents: Array<{id: string; event_id: string}>;
	registration: any; // the reg row (carries user OR person + events)
}

export default function EditCompetitorModal(props: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const reg = props.registration;
	const isGhost = !!reg.person && !reg.user_id;

	const [firstName, setFirstName] = useState(reg.person?.first_name || reg.user?.first_name || '');
	const [lastName, setLastName] = useState(reg.person?.last_name || reg.user?.last_name || '');
	const [country, setCountry] = useState(
		reg.person?.country_code || reg.user?.join_country || 'TR'
	);
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
		() => new Set((reg.events || []).map((e: any) => e.comp_event_id))
	);
	const [submitting, setSubmitting] = useState(false);

	function toggleEvent(compEventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(compEventId)) next.delete(compEventId);
		else next.add(compEventId);
		setSelectedEvents(next);
	}

	async function handleSave() {
		if (selectedEvents.size === 0) {
			toastError(t('select_at_least_one_event'));
			return;
		}
		if (isGhost && (!firstName.trim() || !lastName.trim())) {
			toastError(t('import_name_required'));
			return;
		}
		setSubmitting(true);
		try {
			if (isGhost) {
				await gqlMutate(UPDATE_PERSON, {
					input: {
						personId: reg.person.id,
						firstName: firstName.trim(),
						lastName: lastName.trim(),
						country: country.trim() || undefined,
						eventIds: Array.from(selectedEvents),
					},
				});
			} else {
				await gqlMutate(UPDATE_REG_EVENTS, {
					registrationId: reg.id,
					eventIds: Array.from(selectedEvents),
				});
			}
			toastSuccess(t('updated'));
			if (props.onComplete) props.onComplete();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	const accountName =
		[reg.user?.first_name, reg.user?.last_name].filter(Boolean).join(' ') ||
		reg.user?.username ||
		'';

	return (
		<div className={b('add-competitor-modal')}>
			<div className={b('modal-header')}>
				<div className={b('modal-icon')}>
					<PencilSimple weight="fill" />
				</div>
				<h2 className={b('modal-title')}>{t('edit_competitor')}</h2>
			</div>

			<div className={b('form')}>
				{isGhost ? (
					<div className={b('import-grid-2')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_first')}</label>
							<input
								className={b('input')}
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								autoFocus
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_last')}</label>
							<input
								className={b('input')}
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
							/>
						</div>
					</div>
				) : (
					<div className={b('selected-user')}>
						<span className={b('user-name')}>{accountName}</span>
					</div>
				)}

				{isGhost && (
					<div className={b('field')}>
						<label className={b('label')}>{t('csv_col_country')}</label>
						<input
							className={b('input')}
							value={country}
							onChange={(e) => setCountry(e.target.value)}
							placeholder="TR"
							maxLength={2}
						/>
					</div>
				)}

				<div className={b('field')}>
					<label className={b('label')}>{t('select_events')}</label>
					<div className={b('event-grid')}>
						{props.compEvents.map((ev) => (
							<button
								key={ev.id}
								type="button"
								className={b('event-option', {selected: selectedEvents.has(ev.id)})}
								onClick={() => toggleEvent(ev.id)}
							>
								<span className={`cubing-icon event-${ev.event_id}`} />
								<span>{getEventName(ev.event_id)}</span>
							</button>
						))}
					</div>
				</div>
			</div>

			<button
				type="button"
				className={b('cta')}
				onClick={handleSave}
				disabled={submitting || selectedEvents.size === 0}
			>
				{submitting ? t('saving') : t('save')}
			</button>
		</div>
	);
}
