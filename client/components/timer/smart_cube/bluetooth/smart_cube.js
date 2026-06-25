import { setTimerParams } from '../../helpers/params';
import { getStore } from '../../../store';
import { turnSmartCube, turnSmartCubeBatch } from '../../../../actions/timer';
import { toastError } from '../../../../util/toast';
import { gql } from '@apollo/client';
import { gqlMutate } from '../../../api';
import { closeModal } from '../../../../actions/general';
import { logSmartDeviceEvent } from '../../../../util/smart_device_telemetry';

export default class SmartCube {
	// Telemetry: subclasses set `deviceType` (and, for GAN, `generationLabel`/`hardwareName`/`serial`).
	deviceType = 'unknown';
	// Reason stamped just before an intentional disconnect; alertDisconnected reads then clears it.
	_pendingDisconnectReason = null;

	alertScanning = () => {
		setTimerParams({
			smartCubeScanning: true,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
		});
	};

	alertScanError = (errorMessage) => {
		setTimerParams({
			smartCubeScanning: false,
			smartCubeScanError: errorMessage,
			smartCubeConnectStep: null,
		});
	};

	alertConnecting = () => {
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: true,
			smartCubeScanError: null,
			smartScanDevices: [],
		});
	};

	// Stamp why the NEXT disconnect happens (manual, timer-type change, wrong MAC, ...).
	// Absent reason => alertDisconnected treats it as an unexpected GATT/firmware drop.
	setDisconnectReason = (reason) => {
		this._pendingDisconnectReason = reason;
	};

	// Connection telemetry context. Fields are GAN-specific where present, null elsewhere.
	getTelemetryMeta = () => ({
		device_type: this.deviceType || 'unknown',
		device_name: this.device?.name || null,
		hardware_name: this.hardwareName || null,
		generation: this.generationLabel || null,
		last_serial: typeof this.serial === 'number' ? this.serial : null,
	});

	alertDisconnected = () => {
		const reason = this._pendingDisconnectReason || 'gatt_self';
		this._pendingDisconnectReason = null;
		logSmartDeviceEvent({ event: 'disconnect', reason, ...this.getTelemetryMeta() });

		toastError('Smart cube connection lost');

		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeConnected: false,
			smartCubeScanError: null,
			smartCurrentState: null,
			smartCubeConnectStep: null,
		});
	};

	smartCubeInDb = async (server) => {
		const query = gql`
			query Query {
				smartDevices {
					id
					device_id
				}
			}
		`;

		const res = await gqlMutate(query);

		for (const dev of res.data.smartDevices) {
			if (dev.device_id === server.device.id) {
				return dev;
			}
		}

		return false;
	};

	addSmartCubeToDb = async (originalName, deviceId) => {
		const query = gql`
			mutation Mutate($originalName: String, $deviceId: String) {
				addNewSmartDevice(originalName: $originalName, deviceId: $deviceId) {
					id
					name
					internal_name
					device_id
					created_at
				}
			}
		`;

		const res = await gqlMutate(query, {
			originalName,
			deviceId,
		});

		return res.data.addNewSmartDevice;
	};

	alertConnected = async (server) => {
		let dev;
		try {
			const exists = await this.smartCubeInDb(server);
			if (!exists) {
				dev = await this.addSmartCubeToDb(server.device.name, server.device.id);
			} else {
				dev = exists;
			}
		} catch (error) {
			console.error('Smart Cube DB Error (continuing offline):', error);
			// Fallback device object if DB fails
			dev = {
				id: server.device.id, // Use MAC/ID as makeshift DB ID
				name: server.device.name,
				device_id: server.device.id
			};
		}

		const store = getStore();

		// Close scanning modal if open
		if (store.getState().general.modals.length > 0) {
			store.dispatch(closeModal());
		}

		// SolveCheck modal removed — connect directly
		// Broken cube state handled automatically in SmartCube.tsx (initial sync)
		this.confirmConnected(dev);
	};

	confirmConnected = (dev) => {
		logSmartDeviceEvent({ event: 'connect', ...this.getTelemetryMeta() });

		setTimerParams({
			smartCubeConnecting: false,
			smartCubeConnected: true,
			smartDeviceId: dev.id,
			smartCubeConnectStep: 'done',
		});
	};

	alertBatteryLevel = (level) => {
		setTimerParams({
			smartCubeBatteryLevel: level,
		});
	};

	alertTurnCube = (move) => {
		const store = getStore();
		// if (store.getState().timer.smartCubeConnecting) {
		// 	return;
		// }

		const cleanMove = move.replace(/\s/g, '');
		store.dispatch(turnSmartCube(cleanMove, new Date()));
	};

	alertTurnCubeBatch = (moves) => {
		const store = getStore();
		if (!moves || moves.length === 0) return;

		// Format moves for Redux - IMPORTANT: property name is "turn" not "move"
		const formattedMoves = moves.map(m => ({
			turn: (m.move || m.turn || '').replace(/\s/g, ''),
			completedAt: m.timestamp || m.completedAt || Date.now(),
			cubeTimestamp: m.cubeTimestamp ?? null,
			localTimestamp: m.localTimestamp ?? null,
		}));

		store.dispatch(turnSmartCubeBatch(formattedMoves));
	};

	alertCubeState = (state) => {
		const store = getStore();

		// DEDUP: Skip Redux update if same state received again
		// Cube sends FACELETS periodically (~1s) — avoid unnecessary render if state unchanged
		const currentState = store.getState().timer.smartCurrentState;
		if (state === currentState) {
			return;
		}

		const seq = (store.getState().timer.smartStateSeq || 0) + 1;
		const smartSolvedState = store.getState().timer.smartSolvedState;
		const isPhysicallySolved = state === smartSolvedState;

		setTimerParams({
			smartCurrentState: state,
			smartStateSeq: seq,
			smartPhysicallySolved: isPhysicallySolved,
		});
	};

	alertGyroData = (quaternion, velocity) => {
		setTimerParams({
			smartGyroQuaternion: quaternion,
			smartGyroVelocity: velocity || null,
		});
	};

	alertGyroSupported = (supported) => {
		setTimerParams({
			smartGyroSupported: supported,
		});
	};

	resetGyro = () => {
		setTimerParams({
			smartGyroQuaternion: null,
		});
	};
}
