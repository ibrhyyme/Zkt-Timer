// QiYi Timer React component — GanTimer.tsx pattern (singleton conn + scope-level state)
// Reference state mapping: cstimer BluetoothTimer.CONST

import React, {useContext, useEffect, useRef, useState} from 'react';
import {ITimerContext, TimerContext} from '../../Timer';
import {Bluetooth} from 'phosphor-react';
import Emblem from '../../../common/emblem/Emblem';
import {startTimer, endTimer, startInspection, cancelInspection} from '../../helpers/events';
import {setTimerParams} from '../../helpers/params';
import {useSettings} from '../../../../util/hooks/useSettings';
import {getTimerStore} from '../../../../util/store/getTimer';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../../actions/general';
import BluetoothErrorMessage from '../../common/BluetoothErrorMessage';
import BleScanningModal from '../../smart_cube/ble_scanning_modal/BleScanningModal';
import {showBleConnectInfo} from '../../common/showBleConnectInfo';
import {isNative} from '../../../../util/platform';
import {toastError} from '../../../../util/toast';
import {useTranslation} from 'react-i18next';

import {SubscriptionLike} from 'rxjs';
import {
	QiyiTimerConnection,
	QiyiTimerEvent,
	QiyiTimerState,
	connectQiyiTimer,
	abortQiyiTimerScan,
} from './qiyiTimerConnection';

// Singleton connection (same pattern as GanTimer.tsx)
let conn: QiyiTimerConnection | null = null;
let subs: SubscriptionLike | null = null;

export default function QiyiTimer() {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const inspectionEnabled = useSettings('inspection');
	const inspectionEnabledRef = useRef(inspectionEnabled);
	useEffect(() => {
		inspectionEnabledRef.current = inspectionEnabled;
	}, [inspectionEnabled]);

	const qiyiAutoInspection = useSettings('qiyi_auto_inspection');
	const qiyiAutoInspectionRef = useRef(qiyiAutoInspection);
	useEffect(() => {
		qiyiAutoInspectionRef.current = qiyiAutoInspection;
	}, [qiyiAutoInspection]);

	const [connected, setConnected] = useState(false);
	const [scanning, setScanning] = useState(false);

	const context = useContext(TimerContext);
	const contextRef = useRef<ITimerContext>(context);
	useEffect(() => {
		contextRef.current = context;
	}, [context]);

	// Flag to ignore subsequent RUNNING/STOPPED events from device when user presses Escape during solve.
	// Reset on HANDS_ON, IDLE, STOPPED.
	const cancelledRef = useRef(false);
	// Track device's last state locally — we use this instead of Redux
	// because KeyWatcher.escapePressed calls resetTimerParams on Escape
	// (sets solving=false), our listener reads Redux and sees false → flag won't set.
	const lastDeviceStateRef = useRef<QiyiTimerState | null>(null);
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				// If device is in active solve loop (RUNNING/INSPECTION/GET_SET/HANDS_ON)
				// treat Escape as cancellation
				const s = lastDeviceStateRef.current;
				if (s === QiyiTimerState.RUNNING || s === QiyiTimerState.INSPECTION ||
					s === QiyiTimerState.GET_SET || s === QiyiTimerState.HANDS_ON) {
					cancelledRef.current = true;
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	useEffect(() => {
		subs = conn?.events$.subscribe(handleTimerEvent);
		setConnected(!!conn);
		return () => subs?.unsubscribe();
	}, []);

	function handleTimerEvent(event: QiyiTimerEvent) {
		lastDeviceStateRef.current = event.state;
		switch (event.state) {
			case QiyiTimerState.HANDS_ON:
				// New loop starting, clear cancel flag
				cancelledRef.current = false;
				setTimerParams({canStart: false, spaceTimerStarted: 1});
				break;
			case QiyiTimerState.HANDS_OFF:
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				break;
			case QiyiTimerState.GET_SET:
				setTimerParams({canStart: true, spaceTimerStarted: 0});
				break;
			case QiyiTimerState.RUNNING:
				// If cancelled via Escape, ignore RUNNING events from device
				if (cancelledRef.current) return;
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				startTimer();
				break;
			case QiyiTimerState.STOPPED:
				// If cancelled via Escape, don't save solve, reset flag for next loop
				if (cancelledRef.current) {
					cancelledRef.current = false;
					break;
				}
				if (event.recordedTime) {
					// In cstimer record-time event, QiYi sends both solveTime and inspectTime
					// (qiyitimer.js:143-150, dpId=1 dpType=1). cstimer uses its own local inspection
					// counter, keeps hardware inspectTime for reference only —
					// we do the same. Could be wired to DNF/+2 logic in future.
					endTimer(contextRef.current, event.recordedTime.asTimestamp);
				}
				break;
			case QiyiTimerState.IDLE: {
				// Arrives when device's "reset/restart" button is pressed.
				// Device doesn't send 2nd tick restart event (state unchanged) — so
				// 2-tick logic is physically impossible. 1-tick combined behavior:
				//   - qiyi_auto_inspection ON: time to zero + (if inspection on) start inspection
				//   - qiyi_auto_inspection OFF: just time to zero, inspection started manually
				// Default ON; setting toggled in TimerSettings.
				cancelledRef.current = false;  // yeni dongu

				// Read LIVE state from Redux via getTimerStore (contextRef may be stale)
				const finalTime = getTimerStore('finalTime') ?? 0;
				const inInspection = getTimerStore('inInspection');
				const solving = getTimerStore('solving');

				if (solving) {
					// V2 firmware doesn't send IDLE event during solve — defensive
				} else if (finalTime > 0 || inInspection) {
					// Previous solve or inspection on screen → clear
					cancelInspection();
					setTimerParams({
						spaceTimerStarted: 0,
						canStart: false,
						finalTime: 0,
						timeStartedAt: null,
						dnfTime: false,
						addTwoToSolve: false,
					});
					// If qiyi_auto_inspection + inspection setting ON, start inspection
					if (qiyiAutoInspectionRef.current && inspectionEnabledRef.current) {
						startInspection(contextRef.current);
					}
				} else if (qiyiAutoInspectionRef.current && inspectionEnabledRef.current) {
					// Baseline idle + both settings ON → start inspection
					startInspection(contextRef.current);
				}
				break;
			}
			case QiyiTimerState.INSPECTION:
				// Device's "put hand on timer → start inspection" behavior blocks cube inspection
				// (same on official ex.rubik's, user found it stupid).
				// Ignore in Zkt-Timer — only our 2-tick logic starts inspection.
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
			// Web-only pre-connection info screen (browser/Chrome-flag guidance + app links).
			if (!(await showBleConnectInfo())) return;
			let bluetoothAvailable = isNative() || (!!navigator.bluetooth && (await navigator.bluetooth.getAvailability()));
			if (bluetoothAvailable) {
				if (isNative()) {
					setScanning(true);
					dispatch(openModal(
						<BleScanningModal
							mode="gantimer"
							onCancel={cancelQiyiScan}
						/>,
						{
							position: 'bottom',
							hideCloseButton: true,
							disableBackdropClick: true,
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
				} catch (e: any) {
					console.error('[BLE] QiyiTimer connection error:', e);
					if (isNative()) {
						dispatch(closeModal());
					}
					// Wrong MAC / no handshake — tell the user instead of silently failing.
					if (e?.message === 'QIYI_TIMER_WRONG_MAC') {
						toastError(t('smart_cube.wrong_mac_desc'));
					}
				} finally {
					setScanning(false);
				}
			} else {
				dispatch(openModal(<BluetoothErrorMessage />));
			}
		}
	}

	// When connected no text — green color + Bluetooth icon sufficient.
	let emblemText: string | undefined = t('smart_cube.connect');
	if (scanning) {
		emblemText = t('smart_cube.scanning_short');
	} else if (connected) {
		emblemText = undefined;
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
