import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import './NewCubeType.scss';
import block from '../../../../styles/bem';
import {useInput} from '../../../../util/hooks/useInput';
import {ScrambleType} from '../../../../util/cubes/cube_scrambles';
import {IModalProps} from '../../../common/modal/Modal';
import Input from '../../../common/inputs/input/Input';
import Button from '../../../common/button/Button';
import ScramblePicker from '../../../common/scramble_picker/ScramblePicker';
import {gql} from '@apollo/client/core';
import {gqlMutate} from '../../../api';
import {refreshSettings} from '../../../../db/settings/update';
import ModalHeader from '../../../common/modal/modal_header/ModalHeader';

const b = block('new-cube-type');

export default function NewCubeType(props: IModalProps) {
	const {t} = useTranslation();
	const [name, setName] = useInput('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [scrambleType, setScrambleType] = useState('none');

	function onChangeScrambleType(st: ScrambleType) {
		setScrambleType(st.id);
	}

	async function createCubeType() {
		setLoading(true);
		setError('');

		const query = gql`
			mutation Mutate($input: CustomCubeTypeInput) {
				createCustomCubeType(input: $input) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {
				input: {
					name,
					scramble: scrambleType,
				},
			});

			await refreshSettings();
			props.onComplete();
		} catch (e) {
			setLoading(false);
			setError(e.message);
		}
	}

	const disabled = !name.trim() || !scrambleType;

	return (
		<div className={b()}>
			<ModalHeader title={t('timer_settings.cube_type_new_title')} />
			<Input legend={t('timer_settings.cube_type_name')} value={name} onChange={setName} />
			<ScramblePicker value={scrambleType} onChange={onChangeScrambleType} />
			<Button
				large
				primary
				glow
				loading={loading}
				error={error}
				text={t('timer_settings.cube_type_create')}
				disabled={disabled}
				onClick={createCubeType}
			/>
		</div>
	);
}
