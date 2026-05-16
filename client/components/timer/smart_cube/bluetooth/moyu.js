// MoYu MHC (Hi-Cube) BLE protokol port'u — cstimer moyucube.js (148 satır) %100 port
// Referans: e:/Projects/Zkt-Timer/Referans/cstimer-master/src/js/hardware/moyucube.js
//
// State takibi: cstimer'in mathlib.CubieCube'u yerine cubejs (proje genelinde kullanilan)
// Protokol mantigi (parseTurn, faceStatus, ts hesabi, axis mapping) cstimer ile bire bir.

import SmartCube from './smart_cube';
import Cube from 'cubejs';
import { setTimerParams } from '../../helpers/params';

const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const SERVICE_UUID = '00001000' + UUID_SUFFIX;
const CHRCT_UUID_WRITE = '00001001' + UUID_SUFFIX;
const CHRCT_UUID_READ = '00001002' + UUID_SUFFIX;
const CHRCT_UUID_TURN = '00001003' + UUID_SUFFIX;
const CHRCT_UUID_GYRO = '00001004' + UUID_SUFFIX;

export default class MoYu extends SmartCube {
	device;
	adapter;

	static SERVICE_UUID = SERVICE_UUID;
	static opServices = [SERVICE_UUID];

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;

		// cstimer faceStatus, curFacelet, prevCubie, curCubie, prevMoves equivalents
		this.faceStatus = [0, 0, 0, 0, 0, 0];
		this.curFacelet = SOLVED_FACELET;
		this.prevCube = Cube.fromString(SOLVED_FACELET);
		this.prevMoves = [];
	}

	init = async () => {
		console.log('[moyu] init basladi');

		await this.adapter.connect(this.device, () => {
			console.log('[moyu] disconnect');
			this.alertDisconnected();
		});

		setTimerParams({ smartCubeConnectStep: 'paired' });

		// READ, TURN, GYRO notifications baslat
		await this.adapter.startNotifications(
			this.device,
			SERVICE_UUID,
			CHRCT_UUID_READ,
			(value) => this.onReadEvent(value)
		);
		await this.adapter.startNotifications(
			this.device,
			SERVICE_UUID,
			CHRCT_UUID_TURN,
			(value) => this.onTurnEvent(value)
		);
		await this.adapter.startNotifications(
			this.device,
			SERVICE_UUID,
			CHRCT_UUID_GYRO,
			(value) => this.onGyroEvent(value)
		);

		setTimerParams({ smartCubeConnectStep: 'reading_service' });

		const dummyServer = {
			device: {
				name: this.device.name,
				id: this.device.deviceId,
			},
		};
		await this.alertConnected(dummyServer);

		// Initial state callback
		this.alertCubeState(this.curFacelet);

		// Battery interval
		this.alertBatteryLevel(100);
	};

	onReadEvent(value) {
		console.log('[moyu] read event', value);
	}

	onGyroEvent(value) {
		console.log('[moyu] gyro event', value);
	}

	onTurnEvent(value) {
		console.log('[moyu] turn event byteLength:', value.byteLength);
		this.parseTurn(value);
	}

	// cstimer parseTurn() — bire bir port
	parseTurn(data) {
		const locTime = Date.now();
		if (data.byteLength < 1) {
			return;
		}
		const n_moves = data.getUint8(0);
		if (data.byteLength < 1 + n_moves * 6) {
			return;
		}
		for (let i = 0; i < n_moves; i++) {
			const offset = 1 + i * 6;
			let ts = (data.getUint8(offset + 1) << 24)
				| (data.getUint8(offset + 0) << 16)
				| (data.getUint8(offset + 3) << 8)
				| data.getUint8(offset + 2);
			ts = Math.round(ts / 65536 * 1000);
			const face = data.getUint8(offset + 4);
			const dir = Math.round(data.getUint8(offset + 5) / 36);
			const prevRot = this.faceStatus[face];
			const curRot = this.faceStatus[face] + dir;
			this.faceStatus[face] = (curRot + 9) % 9;
			const axis = [3, 4, 5, 1, 2, 0][face];
			let pow = 0;
			if (prevRot >= 5 && curRot <= 4) {
				pow = 2;
			} else if (prevRot <= 4 && curRot >= 5) {
				pow = 0;
			} else {
				continue;
			}
			const moveStr = 'URFDLB'.charAt(axis) + " 2'".charAt(pow);
			const cubejsMove = moveStr.replace(' ', ''); // " 2'" -> "" / "2" / "'"
			console.log('[moyu] move', moveStr);

			// State update via cubejs (cstimer'in CubeMult+moveCube[m] mantigi)
			this.prevCube.move(cubejsMove);
			this.curFacelet = this.prevCube.asString();

			// prevMoves tracking (cstimer ile ayni — son 8 hamle)
			this.prevMoves.unshift(moveStr);
			if (this.prevMoves.length > 8) {
				this.prevMoves = this.prevMoves.slice(0, 8);
			}

			// Bizim Redux pipeline'a uygun callback'ler
			this.alertTurnCube(cubejsMove);
			this.alertCubeState(this.curFacelet);
		}
	}
}
