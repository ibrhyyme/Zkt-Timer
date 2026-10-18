/**
 * ReportSheet: "Report" on someone else's set (trainer-sets 3.6, 7.7). Four reasons, a note for
 * "Other". Opened through openModal (outside the trainer provider), so the request comes in as
 * a prop. A set the user already reported counts as reported.
 */
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {errorI18nKey} from '../../../lib/alg_sets/api';
import {
	ALG_SET_MODERATION,
	ALG_SET_REPORT_REASONS,
	algSetTextLength,
	type AlgSetReportReason,
} from '../../../../shared/trainer/alg_sets';

const b = block('alg-sets');

interface Props {
	onSend: (reason: AlgSetReportReason, note: string | null) => Promise<void>;
	/** Called once the report is in (or was already in). */
	onReported: () => void;
	onClose?: () => void;
}

export default function ReportSheet({onSend, onReported, onClose}: Props) {
	const {t} = useTranslation();
	const [reason, setReason] = useState<AlgSetReportReason | null>(null);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [done, setDone] = useState(false);

	const noteLength = algSetTextLength(note.trim());
	const noteTooLong = noteLength > ALG_SET_MODERATION.REPORT_NOTE_MAX_LENGTH;

	async function send(e: React.FormEvent) {
		e.preventDefault();
		if (!reason || busy || noteTooLong) return;
		setBusy(true);
		setError('');
		try {
			await onSend(reason, reason === 'other' && note.trim() ? note.trim() : null);
			setDone(true);
			onReported();
		} catch (err) {
			if (errorI18nKey(err) === 'alg_set_errors.already_reported') {
				setDone(true);
				onReported();
				return;
			}
			setError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
		} finally {
			setBusy(false);
		}
	}

	if (done) {
		return (
			<div className={b('sheet')}>
				<p className={b('sheet-message')}>{t('trainer.sets.report_thanks')}</p>
				<div className={b('sheet-actions')}>
					<Button primary large fullWidth text={t('trainer.sets.done')} onClick={() => onClose && onClose()} />
				</div>
			</div>
		);
	}

	return (
		<form className={b('sheet')} onSubmit={send}>
			<fieldset className={b('field', {group: true})}>
				<legend className={b('field-label')}>{t('trainer.sets.report_reason_label')}</legend>
				{ALG_SET_REPORT_REASONS.map((value) => (
					<label key={value} className={b('choice', {active: reason === value, compact: true})}>
						<input
							type="radio"
							name="alg-set-report-reason"
							value={value}
							checked={reason === value}
							onChange={() => {
								setReason(value);
								setError('');
							}}
						/>
						<span className={b('choice-title')}>{t(`trainer.sets.report_reasons.${value}`)}</span>
					</label>
				))}
			</fieldset>

			{reason === 'other' ? (
				<label className={b('field')}>
					<span className={b('field-label')}>
						{t('trainer.sets.report_note_label')}
						<span className={b('field-count', {over: noteTooLong})}>
							{noteLength}/{ALG_SET_MODERATION.REPORT_NOTE_MAX_LENGTH}
						</span>
					</span>
					<textarea
						className={b('input', {area: true})}
						rows={3}
						value={note}
						maxLength={ALG_SET_MODERATION.REPORT_NOTE_MAX_LENGTH * 2}
						onChange={(e) => setNote(e.target.value)}
					/>
				</label>
			) : null}

			{error ? (
				<p className={b('note', {error: true})} role="alert">
					{error}
				</p>
			) : null}

			<div className={b('sheet-actions')}>
				<Button
					primary
					large
					fullWidth
					type="submit"
					loading={busy}
					disabled={!reason || busy || noteTooLong}
					text={t('trainer.sets.report_send')}
				/>
			</div>
		</form>
	);
}
