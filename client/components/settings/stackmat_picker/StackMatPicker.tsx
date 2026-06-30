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

type AudioTimerTarget = 'stackmat' | 'qiyiwired';

// Modal title/description for the audio-jack device picker, derived from which audio timer
// it was opened for. Single source of truth so every opener (grid, header, settings, room)
// shows the right name — StackMat vs QYtoys — instead of always saying "StackMat".
export function getAudioPickerModalProps(target: AudioTimerTarget, t: (key: string) => string) {
	if (target === 'qiyiwired') {
		return {
			title: t('stackmat.select_input_qytoys'),
			description: t('stackmat.description_qytoys'),
		};
	}
	return {
		title: t('stackmat.select_input'),
		description: t('stackmat.description'),
	};
}

interface StackMatPickerProps extends IModalProps {
	// Which audio timer this picker is configuring. Drives the save target + labels.
	// Verilmezse legacy davranis: mevcut qiyiwired korunur, degilse stackmat'a duser.
	targetTimerType?: AudioTimerTarget;
}

export default function StackMatPicker(props: StackMatPickerProps) {
	const { t } = useTranslation();
	const { onComplete, targetTimerType } = props;

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
		if (targetTimerType) {
			setSetting('timer_type', targetTimerType);
		} else {
			// Legacy: prop'suz acan cagiranlar icin mevcut qiyiwired secimini koru, degilse stackmat'a dus.
			if (getSetting('timer_type') !== 'qiyiwired') {
				setSetting('timer_type', 'stackmat');
			}
		}
		onComplete();
	}

	// Target-aware "select X" label so loading/fallback text matches the chosen timer (StackMat vs QYtoys).
	const selectLabel = targetTimerType === 'qiyiwired' ? t('stackmat.select_qytoys') : t('stackmat.select_stackmat');

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
