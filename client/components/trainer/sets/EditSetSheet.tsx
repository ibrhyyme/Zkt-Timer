/**
 * EditSetSheet: "New set" and "Edit" (name, description, sharing), trainer-sets 7.2, 7.4.
 *
 * Opened through openModal, so it lives outside the trainer provider: everything it needs comes
 * in as props, and `onSubmit` does the request (it throws to show an error here).
 *
 * The text rules are the server's own (shared/trainer/alg_sets.ts clean + check), so the counter
 * and the server limit never disagree. Private is preselected for a new set (2.8-g). Making a
 * saved set private asks once: the people who saved it lose it (3.3).
 */
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {
	ALG_SET_LIMITS,
	ALG_SET_VISIBILITIES,
	algSetTextLength,
	checkAlgSetDescription,
	checkAlgSetName,
	cleanAlgSetDescription,
	cleanAlgSetName,
	type AlgSetTextError,
	type AlgSetVisibility,
} from '../../../../shared/trainer/alg_sets';
import {VisibilityIcon} from './parts';

const b = block('alg-sets');

export interface EditSetValues {
	name: string;
	description: string | null;
	visibility: AlgSetVisibility;
}

interface Props {
	mode: 'create' | 'edit';
	initial?: Partial<EditSetValues>;
	/** People who saved the set (edit): asked about before it turns private. */
	saveCount?: number;
	/** Hidden by moderation: the sharing level is locked (3.6). */
	hidden?: boolean;
	onSubmit: (values: EditSetValues) => Promise<void>;
	onClose?: () => void;
}

const TEXT_ERROR_KEY: Record<AlgSetTextError, string> = {
	NAME_EMPTY: 'alg_set_errors.name_empty',
	NAME_TOO_LONG: 'alg_set_errors.name_too_long',
	DESCRIPTION_TOO_LONG: 'alg_set_errors.description_too_long',
	DESCRIPTION_TOO_MANY_LINES: 'alg_set_errors.description_too_many_lines',
};

export default function EditSetSheet({mode, initial, saveCount = 0, hidden = false, onSubmit, onClose}: Props) {
	const {t} = useTranslation();
	const initialVisibility: AlgSetVisibility = initial?.visibility || 'private';
	const [name, setName] = useState(initial?.name || '');
	const [description, setDescription] = useState(initial?.description || '');
	const [visibility, setVisibility] = useState<AlgSetVisibility>(initialVisibility);
	const [confirmPrivate, setConfirmPrivate] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const nameLength = algSetTextLength(cleanAlgSetName(name));
	const descriptionLength = algSetTextLength(cleanAlgSetDescription(description));

	async function submit(e?: React.FormEvent) {
		if (e) e.preventDefault();
		if (busy) return;

		const cleanName = cleanAlgSetName(name);
		const cleanDescription = cleanAlgSetDescription(description);
		const textError = checkAlgSetName(cleanName) || checkAlgSetDescription(cleanDescription);
		if (textError) {
			setError(t(TEXT_ERROR_KEY[textError]));
			return;
		}

		const losesSavers = mode === 'edit' && initialVisibility !== 'private' && visibility === 'private' && saveCount > 0;
		if (losesSavers && !confirmPrivate) {
			setConfirmPrivate(true);
			return;
		}

		setBusy(true);
		setError('');
		try {
			await onSubmit({name: cleanName, description: cleanDescription || null, visibility});
			if (onClose) onClose();
		} catch (err) {
			setError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
			setBusy(false);
		}
	}

	return (
		<form className={b('sheet')} onSubmit={submit}>
			<label className={b('field')}>
				<span className={b('field-label')}>
					{t('trainer.sets.name_label')}
					<span className={b('field-count', {over: nameLength > ALG_SET_LIMITS.NAME_MAX_LENGTH})}>
						{nameLength}/{ALG_SET_LIMITS.NAME_MAX_LENGTH}
					</span>
				</span>
				<input
					className={b('input')}
					type="text"
					value={name}
					placeholder={t('trainer.sets.name_placeholder')}
					maxLength={ALG_SET_LIMITS.NAME_MAX_LENGTH * 2}
					autoFocus={mode === 'create'}
					onChange={(e) => {
						setName(e.target.value);
						setError('');
					}}
				/>
			</label>

			<label className={b('field')}>
				<span className={b('field-label')}>
					{t('trainer.sets.description_label')}
					<span className={b('field-count', {over: descriptionLength > ALG_SET_LIMITS.DESCRIPTION_MAX_LENGTH})}>
						{descriptionLength}/{ALG_SET_LIMITS.DESCRIPTION_MAX_LENGTH}
					</span>
				</span>
				<textarea
					className={b('input', {area: true})}
					value={description}
					rows={3}
					maxLength={ALG_SET_LIMITS.DESCRIPTION_MAX_LENGTH * 2}
					onChange={(e) => {
						setDescription(e.target.value);
						setError('');
					}}
				/>
			</label>

			<fieldset className={b('field', {group: true})} disabled={hidden}>
				<legend className={b('field-label')}>{t('trainer.sets.visibility_label')}</legend>
				{ALG_SET_VISIBILITIES.map((level) => (
					<label key={level} className={b('choice', {active: visibility === level})}>
						<input
							type="radio"
							name="alg-set-visibility"
							value={level}
							checked={visibility === level}
							onChange={() => {
								setVisibility(level);
								setConfirmPrivate(false);
							}}
						/>
						<span className={b('choice-icon')}>
							<VisibilityIcon visibility={level} size={18} />
						</span>
						<span className={b('choice-text')}>
							<span className={b('choice-title')}>{t(`trainer.sets.visibility.${level}`)}</span>
							<span className={b('choice-desc')}>{t(`trainer.sets.visibility.${level}_desc`)}</span>
						</span>
					</label>
				))}
				{hidden ? <p className={b('note')}>{t('alg_set_errors.hidden_locked')}</p> : null}
			</fieldset>

			{confirmPrivate ? (
				<p className={b('note', {warning: true})} role="alert">
					{t('trainer.sets.make_private_confirm', {count: saveCount})}
				</p>
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
					disabled={busy}
					text={
						confirmPrivate
							? t('trainer.sets.make_private')
							: mode === 'create'
								? t('trainer.sets.create')
								: t('trainer.sets.save_changes')
					}
				/>
			</div>
		</form>
	);
}
