import { setTimerParams } from '../../helpers/params';
import { getStore } from '../../../store';
import { turnSmartCube, turnSmartCubeBatch } from '../../../../actions/timer';
import { toastError } from '../../../../util/toast';
import { gql } from '@apollo/client';
import { gqlMutate } from '../../../api';
import { openModal, closeModal } from '../../../../actions/general';
import React from 'react';
import SolveCheck from '../solve_check/SolveCheck';

export default class SmartCube {
	alertScanning = () => {
		setTimerParams({
			smartCubeScanning: true,
			smartCubeScanError: null,
		});
	};

	alertScanError = (errorMessage) => {
		setTimerParams({
			smartCubeScanning: false,
			smartCubeScanError: errorMessage,
		});
	};

	alertConnecting = () => {
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: true,
			smartCubeScanError: null,
		});
	};

	alertDisconnected = () => {
		toastError('Akıllı küp bağlantısı kesildi');

		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeConnected: false,
			smartCubeScanError: null,
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

		// Scanning modal açıksa kapat
		if (store.getState().general.modals.length > 0) {
			store.dispatch(closeModal());
		}

		store.dispatch(
			openModal(<SolveCheck />, {
				title: 'Küpün çözüldüğünü doğrulayın.',
				description: 'Lütfen devam etmeden önce küpünüzün çözüldüğünü doğrulayın.',
				hideCloseButton: true,
				onComplete: () => this.confirmConnected(dev),
			})
		);
	};

	confirmConnected = (dev) => {
		setTimerParams({
			smartCubeConnecting: false,
			smartCubeConnected: true,
			smartDeviceId: dev.id,
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

		store.dispatch(turnSmartCube(move.replace(/\s/g, ''), new Date()));
	};

	alertTurnCubeBatch = (moves) => {
		const store = getStore();
		if (!moves || moves.length === 0) return;

		// Format moves for Redux - IMPORTANT: property name is "turn" not "move"
		const formattedMoves = moves.map(m => ({
			turn: (m.move || m.turn || '').replace(/\s/g, ''),
			completedAt: m.timestamp || m.completedAt || Date.now()
		}));

		store.dispatch(turnSmartCubeBatch(formattedMoves));
	};

	alertCubeState = (state) => {
		const store = getStore();
		if (store.getState().timer.smartCubeConnecting) {
			return;
		}

		setTimerParams({
			smartCurrentState: state,
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
