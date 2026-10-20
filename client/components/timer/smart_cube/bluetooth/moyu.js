// MoYu MHC (Hi-Cube) BLE protocol port — cstimer moyucube.js (148 lines) 100% port
// Reference: e:/Projects/Zkt-Timer/Reference/cstimer-master/src/js/hardware/moyucube.js
//
// State tracking: cubejs (used throughout the project) instead of cstimer's mathlib.CubieCube
// Protocol logic (parseTurn, faceStatus, ts calculation, axis mapping) 1:1 with cstimer.
//
// Extended from smartcube-web-bluetooth src/smartcube/protocols/moyu-mhc.ts (Pau Oliva, MIT):
// the cube's own sticker state, battery and a state reset over MoYu API v1 (moyu_v1_client.js),
// the gyroscope on 0x1004, and the turn direction read as a signed byte.

import SmartCube from './smart_cube';
import Cube from 'cubejs';
import { setTimerParams } from '../../helpers/params';
import { MoyuV1Client, moyuStickersToFacelets, MOYU_V1_SOLVED_STICKERS } from './moyu_v1_client';

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
		// MoYu API v1 request channel; null when the cube does not expose it.
		this.v1 = null;
	}

	subscribeGyro = (callback) => this._addGyroListener(callback);

	init = async () => {
		console.log('[moyu] init started');

		await this.adapter.connect(this.device, () => {
			console.log('[moyu] disconnect');
			this.v1?.dispose();
			this.alertDisconnected();
		});

		setTimerParams({ smartCubeConnectStep: 'paired' });

		this.v1 = new MoyuV1Client((frame) =>
			this.adapter.writeCharacteristic(this.device, SERVICE_UUID, CHRCT_UUID_WRITE, frame.buffer)
		);

		// Start READ, TURN, GYRO notifications
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
		if (!this._gyroSeen) this.alertGyroSupported(false);

		// The cube's own state, so a cube that was turned while disconnected is not taken for
		// solved. cstimer assumed solved here, and the first solve after connecting was then
		// tracked from a wrong position.
		await this.readStateFromCube();

		// The real level, not the 100 % placeholder this used to report.
		await this.updateBattery();
	};

	async readStateFromCube() {
		try {
			const { stickers, angles } = await this.v1.getCubeState();
			const facelet = moyuStickersToFacelets(stickers);
			const cube = Cube.fromString(facelet);
			this.prevCube = cube;
			this.curFacelet = facelet;
			// Align the turn counters with the face angles the cube reports.
			for (let i = 0; i < 6; i++) this.faceStatus[i] = (angles[i] ?? 0) % 9;
		} catch (e) {
			// No v1 channel, or an unreadable reply: keep cstimer's assumption.
			console.warn('[moyu] could not read the cube state, assuming solved:', e?.message);
			this.prevCube = Cube.fromString(SOLVED_FACELET);
			this.curFacelet = SOLVED_FACELET;
		}
		this.alertCubeState(this.curFacelet);
	}

	// Polled by the connection manager while a page shows the cube.
	updateBattery = async () => {
		try {
			const level = await this.v1.getBatteryPercent();
			this.alertBatteryLevel(Math.min(100, Math.max(0, Math.round(level))));
		} catch (e) {
			// Optional command; a cube without it simply reports no level.
		}
	};

	// Tell the cube its current position is solved (MoYu API v1 "set cube state").
	resetCubeState = async () => {
		try {
			await this.v1.setCubeState(MOYU_V1_SOLVED_STICKERS, [0, 0, 0, 0, 0, 0]);
		} catch (e) {
			console.error('[moyu] cube state reset failed:', e?.message);
			return false;
		}
		this.faceStatus = [0, 0, 0, 0, 0, 0];
		this.prevCube = Cube.fromString(SOLVED_FACELET);
		this.curFacelet = SOLVED_FACELET;
		this.alertCubeState(SOLVED_FACELET);
		return true;
	};

	onReadEvent(value) {
		this.v1?.onReadNotification(value);
	}

	// Orientation: four little-endian float32 (w, x, y, z) from byte 4, normalised and
	// mapped onto GAN's frame (y negated), as smartcube-web-bluetooth does.
	onGyroEvent(value) {
		if (!value || value.byteLength < 20) return;
		const w = value.getFloat32(4, true);
		const x = value.getFloat32(8, true);
		const y = -value.getFloat32(12, true);
		const z = value.getFloat32(16, true);
		const n = Math.hypot(w, x, y, z) || 1;
		this._emitGyro({ timestamp: Date.now(), quaternion: { x: x / n, y: y / n, z: z / n, w: w / n } });
	}

	onTurnEvent(value) {
		this.parseTurn(value);
	}

	// cstimer parseTurn() — 1:1 port, except the direction byte (see below)
	parseTurn(data) {
		const locTime = Date.now();
		if (data.byteLength < 1) {
			return;
		}
		const n_moves = data.getUint8(0);
		if (data.byteLength < 1 + n_moves * 6) {
			return;
		}
		const batch = [];
		for (let i = 0; i < n_moves; i++) {
			const offset = 1 + i * 6;
			let ts = (data.getUint8(offset + 1) << 24)
				| (data.getUint8(offset + 0) << 16)
				| (data.getUint8(offset + 3) << 8)
				| data.getUint8(offset + 2);
			ts = Math.round(ts / 65536 * 1000);
			const face = data.getUint8(offset + 4);
			if (face >= 6) continue;
			// Signed: a counter-clockwise step arrives as a negative byte. cstimer read it
			// unsigned, which turned -36 into +6 steps and reported the turn the wrong way
			// round (smartcube-web-bluetooth reads it signed).
			const dir = Math.round(data.getInt8(offset + 5) / 36);
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

			// State update via cubejs (cstimer's CubeMult+moveCube[m] logic)
			this.prevCube.move(cubejsMove);
			this.curFacelet = this.prevCube.asString();

			// prevMoves tracking (same as cstimer — last 8 moves)
			this.prevMoves.unshift(moveStr);
			if (this.prevMoves.length > 8) {
				this.prevMoves = this.prevMoves.slice(0, 8);
			}

			batch.push({ turn: cubejsMove, completedAt: locTime, cubeTimestamp: ts, localTimestamp: locTime });
		}
		// Moves and the state they produce travel in one dispatch, as every other driver does.
		if (batch.length > 0) {
			this.alertTurnCubeBatch(batch, this.curFacelet);
		}
	}

	disconnect = async () => {
		this.v1?.dispose();
	};
}
