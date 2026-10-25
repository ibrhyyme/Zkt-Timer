import React, {useState} from 'react';
import { useTranslation } from 'react-i18next';
import './CreateNewSession.scss';
import Input from '../../common/inputs/input/Input';
import {setCurrentSession} from '../../../db/settings/update';
import {createSessionDb} from '../../../db/sessions/update';
import {setTimerSession} from '../../../db/sessions/active';
import {IModalProps} from '../../common/modal/Modal';
import {toastError} from '../../../util/toast';
import {useInput} from '../../../util/hooks/useInput';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';

const b = block('create-new-session');

interface Props extends IModalProps {
	/**
	 * What the new session becomes. From the Sessions page it is the main session; from
	 * the timer's picker only the timer's session for now (db/sessions/active.ts), since
	 * the main session is changed on the Sessions page alone.
	 */
	target?: 'main' | 'timer';
}

export default function CreateNewSession(props: Props) {
	const {onComplete, target = 'main'} = props;
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
			if (target === 'timer') {
				setTimerSession(session.id);
			} else {
				setCurrentSession(session.id);
			}

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
