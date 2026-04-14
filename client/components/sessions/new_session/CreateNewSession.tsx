import React, {useState} from 'react';
import { useTranslation } from 'react-i18next';
import './CreateNewSession.scss';
import Input from '../../common/inputs/input/Input';
import {setCurrentSession} from '../../../db/settings/update';
import {createSessionDb} from '../../../db/sessions/update';
import {IModalProps} from '../../common/modal/Modal';
import {toastError} from '../../../util/toast';
import {useInput} from '../../../util/hooks/useInput';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';

const b = block('create-new-session');

export default function CreateNewSession(props: IModalProps) {
	const {onComplete} = props;
	const { t } = useTranslation();

	const [loading, setLoading] = useState(false);
	const [name, setName] = useInput('');

	async function createSession() {
		if (loading) {
			return;
		}

		setLoading(true);

		try {
			const session = await createSessionDb({name});
			setCurrentSession(session.id);

			onComplete(session);
		} catch (e) {
			setLoading(false);
			toastError(t('sessions.create_session_error'));
		}
	}

	const disabled = !name.trim() || loading;

	return (
		<div className={b()}>
			<Input
				placeholder={t('sessions.new_session_placeholder')}
				maxLength={200}
				legend={t('sessions.session_name')}
				value={name}
				onChange={setName}
			/>
			<div className={b('actions')}>
				<Button
					glow
					primary
					large
					fullWidth
					text={t('sessions.create_session')}
					onClick={createSession}
					disabled={disabled}
					loading={loading}
				/>
			</div>
		</div>
	);
}
