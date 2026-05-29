// QiYi Timer React component — GanTimer.tsx pattern (singleton conn + scope-level state)
// Referans state mapping: cstimer BluetoothTimer.CONST

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

	// Solve sirasinda kullanici Escape basinca cihazdan gelen sonraki RUNNING/STOPPED
	// event'lerini ignore etmek icin flag. HANDS_ON, IDLE, STOPPED'de reset edilir.
	const cancelledRef = useRef(false);
	// Cihazin son bildirimini lokal olarak takip et — Redux yerine bunu kullaniyoruz
	// cunku KeyWatcher.escapePressed Escape basildiginda resetTimerParams cagiriyor
	// (solving=false yapar), bizim listener Redux'u okusa false gorur → flag set olmaz.
	const lastDeviceStateRef = useRef<QiyiTimerState | null>(null);
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				// Cihaz aktif solve dongusunde ise (RUNNING/INSPECTION/GET_SET/HANDS_ON)
				// Escape ile iptal say
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
				// Yeni dongu basliyor, iptal flag'ini temizle
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
				// Escape ile iptal edildiyse cihazdan gelen RUNNING event'lerini ignore et
				if (cancelledRef.current) return;
				setTimerParams({canStart: false, spaceTimerStarted: 0});
				startTimer();
				break;
			case QiyiTimerState.STOPPED:
				// Escape ile iptal edildiyse solve kaydetme, bir sonraki dongu icin flag reset
				if (cancelledRef.current) {
					cancelledRef.current = false;
					break;
				}
				if (event.recordedTime) {
					// cstimer record-time event'inde QiYi hem solveTime hem inspectTime gonderir
					// (qiyitimer.js:143-150, dpId=1 dpType=1). cstimer kendi local inspection
					// counter'ini kullaniyor, hardware inspectTime'i sadece bilgi icin tutuyor —
					// aynisini yapiyoruz. Ileride DNF/+2 mantigina baglanabilir.
					endTimer(contextRef.current, event.recordedTime.asTimestamp);
				}
				break;
			case QiyiTimerState.IDLE: {
				// Cihazdaki "reset/restart" tusu basildiginda gelir.
				// Cihaz 2. tik restart event'i gondermez (state degismiyor) — bu yuzden
				// 2-tik mantigi fiziksel olarak imkansiz. 1-tikla birlesik davranis:
				//   - qiyi_auto_inspection ACIK: sure sifir + (inspection ayari acikssa) inspection baslat
				//   - qiyi_auto_inspection KAPALI: sadece sure sifir, inspection elle baslatilir
				// Default ACIK; ayar TimerSettings'te toggle.
				cancelledRef.current = false;  // yeni dongu

				// getTimerStore ile Redux'tan ANLIK state oku (contextRef stale olabilir)
				const finalTime = getTimerStore('finalTime') ?? 0;
				const inInspection = getTimerStore('inInspection');
				const solving = getTimerStore('solving');

				if (solving) {
					// V2 firmware solve sirasinda IDLE event gondermiyor — defensive
				} else if (finalTime > 0 || inInspection) {
					// Onceki solve veya inspection ekranda → sifirla
					cancelInspection();
					setTimerParams({
						spaceTimerStarted: 0,
						canStart: false,
						finalTime: 0,
						timeStartedAt: null,
						dnfTime: false,
						addTwoToSolve: false,
					});
					// qiyi_auto_inspection + inspection setting ACIK ise inspection baslat
					if (qiyiAutoInspectionRef.current && inspectionEnabledRef.current) {
						startInspection(contextRef.current);
					}
				} else if (qiyiAutoInspectionRef.current && inspectionEnabledRef.current) {
					// Baseline idle + iki ayar da acik → inspection baslat
					startInspection(contextRef.current);
				}
				break;
			}
			case QiyiTimerState.INSPECTION:
				// Cihaz "eli timer'a koy → inspection baslat" davranisi kup incelemeyi
				// engelliyor (resmi ex.rubik'te de aynisi var, kullanici sacma buldu).
				// Zkt-Timer tarafindan ignore et — sadece bizim 2-tik mantigi inspection baslatir.
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

	// Connected iken metin yok — yesil renk + Bluetooth icon yeterli.
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
