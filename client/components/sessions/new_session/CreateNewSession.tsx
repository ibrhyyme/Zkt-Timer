import React, {useState} from 'react';
import { useTranslation } from 'react-i18next';
import './CreateNewSession.scss';
import Input from '../../common/inputs/input/Input';
import {setCubeType, setCurrentSession} from '../../../db/settings/update';
import CubePicker from '../../common/cube_picker/CubePicker';
import {createSessionDb} from '../../../db/sessions/update';
import {IModalProps} from '../../common/modal/Modal';
import {toastError} from '../../../util/toast';
import {useInput} from '../../../util/hooks/useInput';
import Button from '../../common/button/Button';
import {CubeType} from '../../../util/cubes/cube_types';
import block from '../../../styles/bem';

const b = block('create-new-session');

export default function CreateNewSession(props: IModalProps) {
	const {onComplete} = props;
	const { t } = useTranslation();

	const [loading, setLoading] = useState(false);
	const [sessionCubeType, setSessionCubeType] = useState('333');
	const [name, setName] = useInput('');

	function onCubeTypeChange(ct: CubeType) {
		setSessionCubeType(ct.id);
	}

	async function createSession() {
		if (loading) {
			return;
		}

		setLoading(true);

		try {
			const session = await createSessionDb({name});
			setCurrentSession(session.id);
			setCubeType(sessionCubeType);

			onComplete(session);
		} catch (e) {
			setLoading(false);
			toastError(t('sessions.create_session_error'));
		}
	}

	const disabled = !name.trim() || loading || !sessionCubeType;

	return (
		<div className={b()}>
			<Input
				placeholder={t('sessions.new_session_placeholder')}
				maxLength={200}
				legend={t('sessions.session_name')}
				value={name}
				onChange={setName}
			/>
			<CubePicker
				dropdownProps={{
					legend: t('sessions.cube_type'),
					info: t('sessions.cube_type_info'),
					openLeft: true,
					openUp: true,
					dropdownMaxHeight: 260,
				}}
				onChange={onCubeTypeChange}
				value={sessionCubeType}
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
