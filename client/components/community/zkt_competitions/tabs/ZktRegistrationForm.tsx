import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName} from '../shared';
import {useSelector} from 'react-redux';

const REGISTER = gql`
	mutation ZktRegister($input: ZktRegistrationInput!) {
		registerForZktCompetition(input: $input) {
			id
			status
		}
	}
`;

const WITHDRAW = gql`
	mutation ZktWithdraw($competitionId: String!) {
		withdrawZktRegistration(competitionId: $competitionId) {
			id
			status
		}
	}
`;

export default function ZktRegistrationForm({detail, onDone}: {detail: any; onDone: () => void}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const me = useSelector((state: any) => state.account.me);
	const myReg = detail.registrations.find((r: any) => r.user_id === me?.id);

	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(() => {
		if (myReg) return new Set(myReg.events.map((e: any) => e.comp_event_id));
		return new Set();
	});
	const [notes, setNotes] = useState(myReg?.notes || '');
	const [submitting, setSubmitting] = useState(false);

	function toggleEvent(compEventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(compEventId)) next.delete(compEventId);
		else next.add(compEventId);
		setSelectedEvents(next);
	}

	async function handleRegister() {
		if (selectedEvents.size === 0) {
			toastError(t('select_at_least_one_event'));
			return;
		}
		setSubmitting(true);
		try {
			await gqlMutate(REGISTER, {
				input: {
					competitionId: detail.id,
					eventIds: Array.from(selectedEvents),
					notes: notes.trim() || null,
				},
			});
			toastSuccess(t('registration_sent'));
			onDone();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	async function handleWithdraw() {
		setSubmitting(true);
		try {
			await gqlMutate(WITHDRAW, {competitionId: detail.id});
			toastSuccess(t('withdrawn'));
			onDone();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className={b('register-tab')}>
			<h2 className={b('section-title')}>{t('register_title')}</h2>

			{myReg && myReg.status !== 'WITHDRAWN' && (
				<div className={b('info-banner')}>
					<strong>{t(`registration_${myReg.status.toLowerCase()}`)}</strong>
					{myReg.status === 'APPROVED' && (
						<button className={b('withdraw-btn')} onClick={handleWithdraw} disabled={submitting}>
							{t('withdraw')}
						</button>
					)}
				</div>
			)}

			<div className={b('field')}>
				<label className={b('label')}>{t('select_events')}</label>
				<div className={b('event-grid')}>
					{detail.events.map((ev: any) => (
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

			<div className={b('field')}>
				<label className={b('label')}>{t('notes_optional')}</label>
				<textarea
					className={b('textarea')}
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					rows={3}
				/>
			</div>

			<button
				className={b('cta')}
				onClick={handleRegister}
				disabled={submitting || selectedEvents.size === 0}
			>
				{submitting ? t('submitting') : myReg ? t('update_registration') : t('register')}
			</button>
		</div>
	);
}
