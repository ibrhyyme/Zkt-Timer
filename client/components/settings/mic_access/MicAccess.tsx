import React, {useEffect, useState} from 'react';
import Button from '../../common/button/Button';

export default function MicAccess() {
	const [status, setStatus] = useState(null);

	// not-determined, granted, denied, restricted or unknown.

	useEffect(() => {
		updateStatus();
	}, []);

	function updateStatus() {
		if (typeof navigator === 'undefined' || !navigator?.permissions) {
			return;
		}

		navigator.permissions.query({name: 'microphone' as any}).then((permissionStatus) => {
			setStatus(permissionStatus.state);
		});
	}

	function clickAllow() {
		if (typeof navigator === 'undefined') {
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
	if (status === 'granted') {
		disabled = true;
		info = 'İzin verildi';
	} else if (status === 'denied' || status === 'denied') {
		disabled = true;
		error = 'İzin reddedildi. OS ayarlarınızdan mikrofon erişimine izin verin';
	} else if (status === 'not-determined') {
		disabled = false;
	}

	return <Button onClick={clickAllow} primary text="Mikrofon Erişimi Ver" disabled={disabled} info={info} error={error} />;
}
