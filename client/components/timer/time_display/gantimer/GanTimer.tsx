import React, {useContext, useEffect, useRef, useState} from 'react';
import {ITimerContext, TimerContext} from '../../Timer';
import {Bluetooth} from 'phosphor-react';
import Emblem from '../../../common/emblem/Emblem';
import {startTimer, endTimer, startInspection, cancelInspection} from '../../helpers/events';
import {setTimerParams} from '../../helpers/params';
import {useSettings} from '../../../../util/hooks/useSettings';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../../actions/general';
import BluetoothErrorMessage from '../../common/BluetoothErrorMessage';
import BleScanningModal from '../../smart_cube/ble_scanning_modal/BleScanningModal';
import {isNative} from '../../../../util/platform';
import {useTranslation} from 'react-i18next';

import {SubscriptionLike} from 'rxjs';
import {GanTimerConnection, GanTimerEvent, GanTimerState, connectGanTimer} from 'gan-web-bluetooth';

// Since this component is singleton and should never have multiple instances,
// also will never be used in different contexts, we won't pollute context
// with connection status and event subscription. Just use module-scoped variables.
let conn: GanTimerConnection | null = null;
let subs: SubscriptionLike | null = null;

export default function GanTimer() {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const inspectionEnabled = useSettings('inspection');
	const [connected, setConnected] = useState(false);
	const [scanning, setScanning] = useState(false);

	const context = useContext(TimerContext);
	const contextRef = useRef<ITimerContext>(context);
	useEffect(() => {
		contextRef.current = context;
	}, [context]);

	// Subscribe/unsubscribe to GAN Smart Timer events when component being mounted/unmounted
	useEffect(() => {
		subs = conn?.events$.subscribe(handleTimerEvent);
		setConnected(!!conn);
		return () => subs?.unsubscribe();
	}, []);

	function handleTimerEvent(event: GanTimerEvent) {
		switch (event.state) {
			case GanTimerState.HANDS_ON:
				setTimerParams({canStart: false, spaceTimerStarted: 1});
				break;
			case GanTimerState.HANDS_OFF:
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				break;
			case GanTimerState.GET_SET:
				setTimerParams({canStart: true, spaceTimerStarted: 0});
				break;
			case GanTimerState.RUNNING:
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				startTimer();
				break;
			case GanTimerState.STOPPED:
				endTimer(contextRef.current, event.recordedTime.asTimestamp);
				break;
			case GanTimerState.IDLE:
				if (!inspectionEnabled || contextRef.current.inInspection || contextRef.current.finalTime > 0) {
					cancelInspection();
					setTimerParams({spaceTimerStarted: 0, canStart: false, finalTime: -1});
				} else {
					startInspection();
				}
				break;
			case GanTimerState.DISCONNECT:
				setConnected(false);
				break;
		}
	}

	function cancelGanScan() {
		dispatch(closeModal());
		setScanning(false);
	}

	async function handleConnectButton() {
		if (conn) {
			conn.disconnect();
			conn = null;
			setConnected(false);
		} else {
			console.log('[BLE] GanTimer handleConnectButton, isNative:', isNative());
			let bluetoothAvailable = isNative() || (!!navigator.bluetooth && (await navigator.bluetooth.getAvailability()));
			console.log('[BLE] GanTimer bluetoothAvailable:', bluetoothAvailable);
			if (bluetoothAvailable) {
				if (isNative()) {
					setScanning(true);
					dispatch(openModal(
						<BleScanningModal
							mode="gantimer"
							onCancel={cancelGanScan}
						/>,
						{
							title: t('smart_cube.ble_scan_title'),
							hideCloseButton: true,
							disableBackdropClick: true,
							width: 400,
						}
					));
				}
				try {
					conn = await connectGanTimer();
					if (isNative()) {
						dispatch(closeModal());
					}
					conn.events$.subscribe((evt) => evt.state == GanTimerState.DISCONNECT && (conn = null));
					subs = conn.events$.subscribe(handleTimerEvent);
					setConnected(true);
				} catch (e) {
					console.error('[BLE] GanTimer connection error:', e);
					if (isNative()) {
						dispatch(closeModal());
					}
				} finally {
					setScanning(false);
				}
			} else {
				dispatch(openModal(<BluetoothErrorMessage />));
			}
		}
	}

	let emblemText = connected ? t('smart_cube.connecting').replace('...', '') : t('smart_cube.connect');
	if (scanning) {
		emblemText = t('smart_cube.scanning_short');
	}

	return (
		<div onClick={scanning ? undefined : handleConnectButton} style={{userSelect: 'none', cursor: scanning ? 'default' : 'pointer'}}>
			<Emblem
				icon={<Bluetooth />}
				text={emblemText}
				small
				red={!connected && !scanning}
				green={connected}
				orange={scanning}
			/>
		</div>
	);
}
