import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import Button from '../../common/button/Button';
import {isNative} from '../../../util/platform';

export default function MicAccess() {
	const {t} = useTranslation();
	const [status, setStatus] = useState(null);

	// not-determined, granted, denied, restricted or unknown.

	useEffect(() => {
		updateStatus();
	}, []);

	function updateStatus() {
		if (isNative() || typeof navigator === 'undefined' || !navigator?.permissions) {
			return;
		}

		navigator.permissions.query({name: 'microphone' as any}).then((permissionStatus) => {
			setStatus(permissionStatus.state);
		});
	}

	function clickAllow() {
		if (isNative() || typeof navigator === 'undefined') {
			return;
		}

		navigator.mediaDevices
			.getUserMedia({audio: true})
			.then(() => {
				updateStatus();
			})
			.catch(() => {
				updateStatus();
			});
	}

	let disabled = false;
	let error = '';
	let info = '';
	if (isNative()) {
		disabled = true;
		error = t('stackmat.not_supported_mobile');
	} else if (status === 'granted') {
		disabled = true;
		info = t('stackmat.permission_granted');
	} else if (status === 'denied' || status === 'denied') {
		disabled = true;
		error = t('stackmat.permission_denied');
	} else if (status === 'not-determined') {
		disabled = false;
	}

	return <Button onClick={clickAllow} primary text={t('stackmat.grant_mic_access')} disabled={disabled} info={info} error={error} />;
}
