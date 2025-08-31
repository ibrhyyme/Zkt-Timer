import React, {useState} from 'react';
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
import ModalHeader from '../../common/modal/modal_header/ModalHeader';
import block from '../../../styles/bem';
import FormSection from '../../common/form/FormSection';

const b = block('create-new-session');

export default function CreateNewSession(props: IModalProps) {
	const {onComplete} = props;

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
			toastError('Sunucu Hatası: Oturum oluşturulamadı');
		}
	}

	const disabled = !name.trim() || loading || !sessionCubeType;

	return (
		<div className={b()}>
			<ModalHeader
				title="Yeni oturum oluştur"
				description="Zkt-Timer'da oturumlar birden fazla küp türüne sahip olabilir. Oturumları istediğiniz gibi bölebilirsiniz: küp türüne göre, güne göre, vb."
			/>
			<div className="w-full">
				<Input
					placeholder="Yeni Oturum"
					maxLength={200}
					legend="Oturum Adı"
					value={name}
					onChange={setName}
				/>
			</div>
			<CubePicker
				dropdownProps={{
					legend: 'Cube Türü',
					info: 'Korkma:) Bu daha sonra değiştirilebilir',
					openLeft: true,
				}}
				onChange={onCubeTypeChange}
				value={sessionCubeType}
			/>
			<div className="mt-3">
				<Button
					glow
					primary
					large
					text="Sezon Oluştur"
					onClick={createSession}
					disabled={disabled}
					loading={loading}
				/>
			</div>
		</div>
	);
}
