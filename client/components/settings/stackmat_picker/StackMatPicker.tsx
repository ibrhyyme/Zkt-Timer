import React, { useEffect, useState } from 'react';
import { CaretDown } from 'phosphor-react';
import { setSetting } from '../../../db/settings/update';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { useSettings } from '../../../util/hooks/useSettings';
import Button from '../../common/button/Button';
import { IModalProps } from '../../common/modal/Modal';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';

export default function StackMatPicker(props: IModalProps) {
	const { onComplete } = props;

	const stackMatId = useSettings('stackmat_id');
	const [selectedStackMatId, setSelectedStackMatId] = useState(stackMatId);
	const [options, setOptions] = useState<MediaDeviceInfo[]>([]);
	const [error, setError] = useState();

	function loadDevices() {
		if (
			typeof navigator === 'undefined' ||
			!navigator ||
			!navigator.mediaDevices ||
			!navigator.mediaDevices.enumerateDevices
		) {
			return;
		}

		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				const options = [];
				const storedIds = new Set();

				for (const device of devices) {
					if (device.kind !== 'audioinput') {
						continue;
					}

					if (storedIds.has(device.deviceId)) {
						// continue;
					}
					storedIds.add(device.deviceId);
					options.push(device);
				}

				setOptions(options);
			})
			.catch((err) => {
				setError(err.message);
			});
	}

	useEffect(() => {
		loadDevices();
	}, []);

	function requestPermission() {
		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				stream.getTracks().forEach((track) => track.stop());
				loadDevices();
			})
			.catch((err) => {
				setError(err.message);
			});
	}

	function getStackMatFromId(id: string): MediaDeviceInfo {
		let stackMat = null;
		for (const option of options) {
			if (option.deviceId === id) {
				stackMat = option;
				break;
			}
		}

		return stackMat;
	}

	function saveSelectedAudio() {
		setSetting('timer_type', 'stackmat');
		setSetting('stackmat_id', selectedStackMatId);
		onComplete();
	}

	function selectAudio(selectedId: string) {
		setError(null);
		setSelectedStackMatId(selectedId);
	}

	let name = 'StackMat Seç';
	let disabled = !selectedStackMatId;

	if (selectedStackMatId) {
		const stackMat = getStackMatFromId(selectedStackMatId);

		if (stackMat) {
			name = stackMat.label;
		} else {
			name = 'Hiçbiri';
			disabled = true;
		}
	}

	return (
		<div>
			<ModalHeader
				title="StackMat Girişi Seç"
				description={`StackMat bilgisayarınıza ses girişi ile bağlanır. Aşağıdaki açılır menüye tıklayın, StackMat'ınızı seçin. Giriş adının "StackMat" değil "USB Audio Device" gibi bir şey olabileceğini unutmayın.`}
			/>
			<div className="mb-2">
				<Dropdown
					dropdownButtonProps={{
						large: true,
					}}
					openLeft
					text={name}
					icon={<CaretDown />}
					error={error}
					options={options.map((op) => ({
						onClick: () => selectAudio(op.deviceId),
						text: op.label.replace(/\(.+\)/g, '').trim(),
						on: op.deviceId === selectedStackMatId,
					}))}
				/>
			</div>
			<div className="flex gap-2">
				<Button large glow text="Kaydet" primary disabled={disabled} onClick={saveSelectedAudio} error={error} />
				<Button large text="İzin İste" onClick={requestPermission} />
			</div>
		</div>
	);
}
