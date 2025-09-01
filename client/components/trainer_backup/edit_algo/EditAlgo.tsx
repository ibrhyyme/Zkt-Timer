import React, {useState} from 'react';
import './EditAlgo.scss';
import block from '../../../styles/bem';
import {TrainerAlgorithmExtended} from '../../../db/trainer/init';
import {IModalProps} from '../../common/modal/Modal';
import {AlgorithmOverride} from '../../../@types/generated/graphql';
import {useInput} from '../../../util/hooks/useInput';
import {deleteTrainerAlgoOverrides, updateTrainerAlgoOverrides} from '../../../db/trainer/operations';
import Button from '../../common/button/Button';
import Radio from '../../common/inputs/radio/Radio';
import TextArea from '../../common/inputs/textarea/TextArea';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';
import Input from '../../common/inputs/input/Input';
import AlgoVisual from '../algo_visual/AlgoVisual';
import {toastError, toastSuccess} from '../../../util/toast';

const b = block('edit-algo');

interface Props extends IModalProps {
	algoExt: TrainerAlgorithmExtended;
}

export default function EditAlgo(props: Props) {
	const {onComplete, algoExt} = props;

	const [overrides, setOverrides] = useState(algoExt?.overrides || null);
	const [saving, setSaving] = useState(false);
	const [resetting, setResetting] = useState(false);

	const [name, setName] = useInput(overrides?.name || algoExt.name || '');
	const [rotate, setRotate] = useInput(String(overrides?.rotate || algoExt.rotate || 0));
	const [solution, setSolution] = useInput(overrides?.solution || algoExt.solution || '');
	const [scrambles, setScrambles] = useInput(overrides?.scrambles || algoExt.scrambles || '');

	function getOverrides(): AlgorithmOverride {
		return {
			name,
			solution,
			rotate: parseInt(rotate) || 0,
			scrambles,
		};
	}

	async function saveAlgo() {
		setSaving(true);
		try {
			await updateTrainerAlgoOverrides(algoExt, getOverrides());
			toastSuccess('Eğitmen algoritması güncellendi');
			onComplete();
		} catch (e) {
			toastError(e);
			setSaving(false);
		}
	}

	async function resetToDefaults() {
		setResetting(true);
		try {
			await deleteTrainerAlgoOverrides(algoExt);
			toastSuccess('Eğitmen algoritma değerleri başarıyla varsayılana sıfırlandı');
			setOverrides(null);
			setName(algoExt.name);
			setRotate(String(algoExt.rotate || 0));
			setSolution(algoExt.solution);
			setScrambles(algoExt.scrambles);
		} catch (e) {
			toastError(e);
		} finally {
			setResetting(false);
		}
	}

	return (
		<div className={b()}>
			<ModalHeader
				title="Edit Trainer Algorithm"
				description="Below, you can override any of the default values for this trainer algorithm. Removing the value will reset it to its default value."
			/>
			<div className={b('header')}>
				<AlgoVisual rotate={parseInt(rotate)} colors={algoExt.colors} cubeType={algoExt.cube_type} />
			</div>
			<Input legend="İsim" value={name} placeholder={algoExt.name} onChange={setName} />
			<Input legend="Çözüm" value={solution} placeholder={algoExt.solution} onChange={setSolution} />
			<TextArea
				optional
				autoSize
				legend="Karıştırmalar"
				value={scrambles}
				placeholder={algoExt.scrambles}
				onChange={setScrambles}
			/>
			<Radio
				legend="Döndürme"
				onChange={setRotate}
				value={rotate}
				name="rotate"
				options={[
					{label: '0°', value: 0, id: '0'},
					{label: '90°', value: 90, id: '90'},
					{label: '180°', value: 180, id: '180'},
					{label: '270°', value: 270, id: '270'},
				]}
			/>
			<div className={b('actions')}>
				<Button text="Kaydet" loading={saving} onClick={saveAlgo} />
				<Button
					hidden={!overrides}
					text="Varsayılanlara Sıfırla"
					flat
					danger
					loading={resetting}
					onClick={resetToDefaults}
				/>
			</div>
		</div>
	);
}
