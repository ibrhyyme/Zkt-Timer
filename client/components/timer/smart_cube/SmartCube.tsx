import React, { useContext, useEffect, useRef, useState } from 'react';
import './SmartCube.scss';
import Emblem from '../../common/emblem/Emblem';
import Battery from './battery/Battery';
import Connect from './bluetooth/connect';
import { setTimerParams } from '../helpers/params';
import { Bluetooth, DotsThree } from 'phosphor-react';
import { preflightChecks } from './preflight';
import { openModal } from '../../../actions/general';
import ManageSmartCubes from './manage_smart_cubes/ManageSmartCubes';
import Cube from 'cubejs';
import block from '../../../styles/bem';
import { TimerContext } from '../Timer';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useDispatch } from 'react-redux';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';
import { endTimer, startTimer, startInspection } from '../helpers/events';
import BluetoothErrorMessage from '../common/BluetoothErrorMessage';

const b = block('smart-cube');

export default function SmartCube() {
	const dispatch = useDispatch();

	const context = useContext(TimerContext);

	const canvasRef = useRef(null);
	const cube = useRef(null);
	const turnIndex = useRef(0);
	const turnInterval = useRef(null);
	const cubejs = useRef(new Cube());
	const connect = useRef(new Connect());

	// Turn queue that an interval picks up every 50ms or so
	const turns = useRef([]);

	const [scrambleCompletedAt, setScrambleCompletedAt] = useState(null);
	const [inspectionTime, setInspectionTime] = useState(0);

	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const inspectionEnabled = useSettings('inspection');
	const mobileMode = useGeneral('mobile_mode');

	let smartCubeSize = useSettings('smart_cube_size'); // From settings
	if (mobileMode) {
		// Mobil modda sabit boyut kullan (CSS scale yerine native canvas boyutu)
		smartCubeSize = 300;
	}

	const {
		scramble,
		smartTurns,
		smartDeviceId,
		smartCubeConnecting,
		smartCubeBatteryLevel,
		smartCurrentState,
		smartSolvedState,
		smartCubeConnected,
		timeStartedAt,
		smartGyroQuaternion,
		smartGyroSupported,
	} = context;

	useEffect(() => {
		return () => {
			connect.current.disconnect();
		};
	}, []);

	useEffect(() => {
		initVisualCube();

		return () => {
			if (turnInterval.current) {
				clearInterval(turnInterval.current);
				turnInterval.current = null;
			}
		};
	}, [smartCubeSize]); // Re-init when size changes

	useEffect(() => {
		if (smartTurns.length) {
			const turn = smartTurns[smartTurns.length - 1].turn;
			cubejs.current.move(turn);

			addTurn(turn);
		}

		const isSolved = cubejs.current.asString() === smartSolvedState;

		if (!useSpaceWithSmartCube && isSolved && smartTurns.length) {
			resetMoves();
		}
	}, [smartTurns, smartSolvedState]);

	// Jiroskop verisini küpe uygula
	useEffect(() => {
		if (cube.current && smartGyroQuaternion) {
			cube.current.setGyroQuaternion(smartGyroQuaternion);
		}
	}, [smartGyroQuaternion]);

	function initVisualCube() {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const RubiksCube = require('./visual').default;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { materials } = require('./visual');

		if (turnInterval.current) {
			clearInterval(turnInterval.current);
			turnInterval.current = null;
			turnIndex.current = 0;
		}

		if (canvasRef.current) {
			canvasRef.current.width = smartCubeSize;
			canvasRef.current.height = smartCubeSize;

			cube.current = new RubiksCube(
				canvasRef.current,
				materials.classic,
				80,
				`${smartCubeSize}px`,
				`${smartCubeSize}px`,
				smartCurrentState
			);
		}

		setTimeout(() => {
			processQueue();
		}, 500);
	}

	function cubeIsSolved() {
		return cubejs.current.asString() === smartSolvedState;
	}

	function checkForStartAfterTurn() {
		if (useSpaceWithSmartCube || smartCubeConnecting) {
			return;
		}

		if (scrambleCompletedAt) {
			// First move after scramble is complete - start timer
			startTimer();

			let it = (new Date().getTime() - scrambleCompletedAt.getTime()) / 1000;
			it = Math.floor(it * 100) / 100;

			setScrambleCompletedAt(null);
			setInspectionTime(it);
			setTimerParams({
				smartCanStart: false,
			});
		} else if (preflightChecks(smartTurns, scramble)) {
			// Scramble is complete
			setScrambleCompletedAt(new Date());
			setTimerParams({
				smartCanStart: true,
			});
			resetMoves();

			// If inspection is enabled, start WCA inspection countdown
			if (inspectionEnabled) {
				startInspection(context);
			}
		}
	}

	const processingTurns = useRef(false);

	function addTurn(...t) {
		checkForStartAfterTurn();
		turns.current = [...turns.current, ...t];
		processQueue();
	}

	function resetMoves(markSolved: boolean = false) {
		if (timeStartedAt) {
			endTimer(context, null, {
				inspection_time: inspectionTime,
				smart_device_id: smartDeviceId,
				is_smart_cube: true,
				smart_turn_count: smartTurns.length,
				smart_turns: JSON.stringify(smartTurns),
			});
		}

		setTimerParams({
			smartSolvedState: markSolved ? cubejs.current.asString() : smartSolvedState,
			smartTurns: [],
			smartPickUpTime: 0,
			lastSmartMoveTime: 0,
		});

		setTimeout(() => {
			if (markSolved) {
				initVisualCube();
			}
		}, 50);
	}

	// Replaced interval with direct async queue processing
	const processQueue = async () => {
		if (processingTurns.current) return;

		processingTurns.current = true;

		while (turns.current.length > turnIndex.current) {
			await execTurn();
		}

		// Cleanup if needed
		if (turns.current.length && turns.current.length === turnIndex.current) {
			turns.current = [];
			turnIndex.current = 0;
		}

		processingTurns.current = false;
	};

	async function execTurn() {
		const turnRaw = turns.current[turnIndex.current];

		const prime = !(turnRaw.indexOf("'") > -1);
		const turn = turnRaw.replace(/'|\s/g, '');

		if (!cube.current) {
			turnIndex.current += 1;
			return;
		}

		switch (turn) {
			case 'R': await cube.current.R(prime); break;
			case 'L': await cube.current.L(!prime); break;
			case 'D': await cube.current.D(!prime); break;
			case 'F': await cube.current.F(prime); break;
			case 'U': await cube.current.U(!prime); break;
			case 'B': await cube.current.B(!prime); break;
			case 'x': await cube.current.x(prime); break;
			case 'y': await cube.current.y(prime); break;
			case 'z': await cube.current.z(prime); break;
			default: break;
		}

		turnIndex.current += 1;
	}

	async function connectBluetooth() {
		try {
			let bluetoothAvailable = !!navigator.bluetooth && (await navigator.bluetooth.getAvailability());
			if (bluetoothAvailable) {
				connect.current.connect();
			} else {
				dispatch(openModal(<BluetoothErrorMessage />));
			}
		} catch (e) {
			toastError('Web Bluetooth API error' + (e ? `: ${e}` : ''));
			// chrome://flags/#enable-experimental-web-platform-features
		}
	}

	function disconnectBluetooth() {
		connect.current.disconnect();
		setTimerParams({
			smartCanStart: false,
			smartCubeConnected: false,
			smartCubeConnecting: false,
			smartTurns: [],
			smartDeviceId: '',
		});
	}

	function toggleManageSmartCubes() {
		dispatch(
			openModal(<ManageSmartCubes />, {
				title: 'Akıllı küpleri yönet',
			})
		);
	}

	// Jiroskop sıfırlama fonksiyonu
	function resetGyro() {
		if (cube.current) {
			cube.current.resetGyroBasis();
		}
		// Redux state'ini de sıfırla ki bir sonraki veri geldiğinde yeni basis oluşsun
		setTimerParams({
			smartGyroQuaternion: null,
		});
	}

	let actionButton = null;
	const dropdown = (
		<Dropdown
			dropdownButtonProps={{
				transparent: true,
			}}
			icon={<DotsThree />}
			options={[
				{
					text: 'Çözülmüş olarak işaretle',
					hidden: !smartCubeConnected,
					disabled: !!timeStartedAt,
					onClick: () => resetMoves(true),
				},
				{
					text: 'Jiroskop sıfırla',
					hidden: !smartCubeConnected || !smartGyroSupported,
					disabled: !!timeStartedAt,
					onClick: resetGyro,
				},
				{
					text: 'Bağlantıyı kes',
					hidden: !smartCubeConnected,
					disabled: !!timeStartedAt,
					onClick: disconnectBluetooth,
				},
				{ text: 'Akıllı küpleri yönet', disabled: !!timeStartedAt, onClick: toggleManageSmartCubes },
			]}
		/>
	);
	let battery = <Battery level={smartCubeBatteryLevel} />;

	let emblem;
	if (smartCubeConnecting) {
		emblem = <Emblem small orange icon={<Bluetooth />} />;
		actionButton = <Button text="Bağlanıyor..." disabled />;
		battery = null;
	} else if (smartCubeConnected) {
		emblem = <Emblem small green icon={<Bluetooth />} />;
	} else {
		emblem = <Emblem small red icon={<Bluetooth />} />;
		actionButton = <Button text="Bağlan" onClick={connectBluetooth} />;
		battery = null;
	}

	return (
		<div className={b()}>
			<div className={b('wrapper')}>
				<div className={b('cube')}>
					<canvas width="200px" height="200px" ref={canvasRef} />
				</div>
				<div className={b('info')}>
					{battery}
					{emblem}
					{dropdown}
				</div>
			</div>
			{actionButton}
		</div>
	);
}
