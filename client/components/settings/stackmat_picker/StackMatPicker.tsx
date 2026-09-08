import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Microphone, Warning } from 'phosphor-react';
import { setSetting } from '../../../db/settings/update';
import { getSetting } from '../../../db/settings/query';
import { useSettings } from '../../../util/hooks/useSettings';
import Button from '../../common/button/Button';
import { IModalProps } from '../../common/modal/Modal';
import { isNative } from '../../../util/platform';
import block from '../../../styles/bem';
import './StackMatPicker.scss';

const b = block('stackmat-picker');

// Modal title/description for the audio-jack device picker.
//
// StackMat and QYtoys used to be two timer types with two sets of strings. They
// are one input now: the same 1200 Hz protocol on the same audio jack, saved to
// the same device id. The copy names both brands so a QYtoys owner still
// recognises their device.
export function getAudioPickerModalProps(t: (key: string) => string) {
	return {
		title: t('stackmat.select_input'),
		description: t('stackmat.description'),
	};
}

interface StackMatPickerProps extends IModalProps {
}

export default function StackMatPicker(props: StackMatPickerProps) {
	const { t } = useTranslation();
	const { onComplete } = props;

	const stackMatId = useSettings('stackmat_id');
	const [selectedStackMatId, setSelectedStackMatId] = useState(stackMatId);
	const [options, setOptions] = useState<MediaDeviceInfo[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [permissionGranted, setPermissionGranted] = useState(false);
	const [loading, setLoading] = useState(true);

	const unsupported =
		isNative() ||
		typeof navigator === 'undefined' ||
		!navigator ||
		!navigator.mediaDevices ||
		!navigator.mediaDevices.enumerateDevices;

	function loadDevices() {
		if (unsupported) {
			setLoading(false);
			return;
		}

		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				const audioInputs = devices.filter((d) => d.kind === 'audioinput');
				setOptions(audioInputs);
				// Device labels are only populated once microphone permission is granted.
				setPermissionGranted(audioInputs.some((d) => !!d.label));
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setLoading(false);
			});
	}

	function requestPermission() {
		if (unsupported) {
			setLoading(false);
			return;
		}

		setError(null);
		setLoading(true);
		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				stream.getTracks().forEach((track) => track.stop());
				setPermissionGranted(true);
				loadDevices();
			})
			.catch((err) => {
				setError(err.message);
				setPermissionGranted(false);
				setLoading(false);
			});
	}

	// Auto-request permission on open so labels populate immediately — no blank device rows.
	useEffect(() => {
		requestPermission();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function saveSelectedAudio() {
		// stackmat_id'yi ONCE set et: timer_type degisince StackMat component id hazirken mount olup init etsin.
		setSetting('stackmat_id', selectedStackMatId);
		setSetting('timer_type', 'stackmat');
		onComplete();
	}

	const selectLabel = t('stackmat.select_stackmat');

	function deviceLabel(device: MediaDeviceInfo, index: number) {
		return device.label || `${selectLabel} ${index + 1}`;
	}

	const hasSelection = !!selectedStackMatId && options.some((op) => op.deviceId === selectedStackMatId);

	let bodyContent: React.ReactNode;

	if (unsupported) {
		bodyContent = (
			<div className={b('state')}>
				<Warning size={28} weight="fill" />
				<p className={b('state-text')}>{t('stackmat.not_supported_mobile')}</p>
			</div>
		);
	} else if (loading) {
		bodyContent = (
			<div className={b('state')}>
				<Microphone size={28} weight="fill" />
				<p className={b('state-text')}>{selectLabel}…</p>
			</div>
		);
	} else if (!permissionGranted) {
		bodyContent = (
			<div className={b('state')}>
				<Microphone size={28} weight="fill" />
				<p className={b('state-text')}>{t('stackmat.permission_denied')}</p>
				{error && <p className={b('state-error')}>{error}</p>}
				<Button large primary text={t('stackmat.grant_mic_access')} onClick={requestPermission} />
			</div>
		);
	} else if (options.length === 0) {
		bodyContent = (
			<div className={b('state')}>
				<Warning size={28} weight="fill" />
				<p className={b('state-text')}>{t('stackmat.no_devices')}</p>
				<Button large text={t('stackmat.request_permission')} onClick={requestPermission} />
			</div>
		);
	} else {
		bodyContent = (
			<>
				<div className={b('list')}>
					{options.map((op, index) => {
						const selected = op.deviceId === selectedStackMatId;
						return (
							<button
								key={op.deviceId || index}
								type="button"
								className={b('device', { selected })}
								onClick={() => {
									setError(null);
									setSelectedStackMatId(op.deviceId);
								}}
							>
								<Microphone className={b('device-icon')} size={20} weight={selected ? 'fill' : 'regular'} />
								<span className={b('device-label')}>{deviceLabel(op, index)}</span>
								{selected && <Check className={b('device-check')} size={18} weight="bold" />}
							</button>
						);
					})}
				</div>
				<div className={b('actions')}>
					<Button large glow primary text={t('stackmat.save')} disabled={!hasSelection} onClick={saveSelectedAudio} />
				</div>
			</>
		);
	}

	return <div className={b()}>{bodyContent}</div>;
}
