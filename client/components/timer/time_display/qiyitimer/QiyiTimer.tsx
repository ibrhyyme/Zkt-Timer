// QiYi Timer React component — GanTimer.tsx pattern (singleton conn + scope-level state)
// Referans state mapping: cstimer BluetoothTimer.CONST

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
import {
	QiyiTimerConnection,
	QiyiTimerEvent,
	QiyiTimerState,
	connectQiyiTimer,
	abortQiyiTimerScan,
} from './qiyiTimerConnection';

// Singleton connection (GanTimer.tsx ile ayni pattern)
let conn: QiyiTimerConnection | null = null;
let subs: SubscriptionLike | null = null;

export default function QiyiTimer() {
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

	useEffect(() => {
		subs = conn?.events$.subscribe(handleTimerEvent);
		setConnected(!!conn);
		return () => subs?.unsubscribe();
	}, []);

	function handleTimerEvent(event: QiyiTimerEvent) {
		switch (event.state) {
			case QiyiTimerState.HANDS_ON:
				setTimerParams({canStart: false, spaceTimerStarted: 1});
				break;
			case QiyiTimerState.HANDS_OFF:
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				break;
			case QiyiTimerState.GET_SET:
				setTimerParams({canStart: true, spaceTimerStarted: 0});
				break;
			case QiyiTimerState.RUNNING:
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				startTimer();
				break;
			case QiyiTimerState.STOPPED:
				if (event.recordedTime) {
					endTimer(contextRef.current, event.recordedTime.asTimestamp);
				}
				break;
			case QiyiTimerState.IDLE:
				if (!inspectionEnabled || contextRef.current.inInspection || (contextRef.current.finalTime ?? 0) > 0) {
					cancelInspection();
					setTimerParams({spaceTimerStarted: 0, canStart: false, finalTime: -1});
				} else {
					startInspection(contextRef.current);
				}
				break;
			case QiyiTimerState.INSPECTION:
				if (inspectionEnabled && !contextRef.current.inInspection) {
					startInspection(contextRef.current);
				}
				break;
			case QiyiTimerState.DISCONNECT:
				setConnected(false);
				conn = null;
				break;
		}
	}

	function cancelQiyiScan() {
		abortQiyiTimerScan();
		dispatch(closeModal());
		setScanning(false);
	}

	async function handleConnectButton() {
		if (conn) {
			conn.disconnect();
			conn = null;
			setConnected(false);
		} else {
			console.log('[BLE] QiyiTimer handleConnectButton, isNative:', isNative());
			let bluetoothAvailable = isNative() || (!!navigator.bluetooth && (await navigator.bluetooth.getAvailability()));
			console.log('[BLE] QiyiTimer bluetoothAvailable:', bluetoothAvailable);
			if (bluetoothAvailable) {
				if (isNative()) {
					setScanning(true);
					dispatch(openModal(
						<BleScanningModal
							mode="gantimer"
							onCancel={cancelQiyiScan}
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
					conn = await connectQiyiTimer();
					if (isNative()) {
						dispatch(closeModal());
					}
					conn.events$.subscribe((evt) => evt.state === QiyiTimerState.DISCONNECT && (conn = null));
					subs = conn.events$.subscribe(handleTimerEvent);
					setConnected(true);
				} catch (e) {
					console.error('[BLE] QiyiTimer connection error:', e);
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
		<div
			className={'cd-timer__connect-trigger' + (scanning ? ' cd-timer__connect-trigger--disabled' : '')}
			onClick={scanning ? undefined : handleConnectButton}
			role="button"
		>
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
