import SmartCube from './smart_cube';
import { setTimerParams } from '../../helpers/params';

// GoCube / Rubik's Connected UART protocol.
//
// Extended from smartcube-web-bluetooth src/smartcube/protocols/gocube.ts (Pau Oliva, MIT):
// the frame checksum, the truncated move frame, the classic GoCube's orientation stream, and
// the state reset command.

/** Opposite faces in URFDLB order (U-D, R-L, F-B). */
const OPPOSITE_AXIS = [3, 4, 5, 0, 1, 2];

/**
 * The byte sum of everything before the checksum equals the checksum (the byte before CRLF).
 * Only full frames carry it; a short move frame may not.
 */
export function goCubeChecksumValid(value) {
	if (value.byteLength < 7) return false;
	let sum = 0;
	for (let i = 0; i <= value.byteLength - 4; i++) sum += value.getUint8(i);
	return (sum & 0xff) === value.getUint8(value.byteLength - 3);
}

/**
 * Orientation payload: ASCII "x#y#z#w", normalised and mapped onto GAN's frame
 * (x, -z, -y, w) the way smartcube-web-bluetooth does.
 */
export function parseGoCubeOrientation(text) {
	const parts = text.split('#');
	if (parts.length !== 4) return null;
	const [rx, ry, rz, rw] = parts.map((p) => Number.parseInt(p.trim(), 10));
	if (![rx, ry, rz, rw].every((n) => Number.isFinite(n))) return null;
	const len = Math.hypot(rx, ry, rz, rw);
	if (len === 0) return null;
	return { x: rx / len, y: -rz / len, z: -ry / len, w: rw / len };
}

/** Classic GoCube streams orientation; Rubik's Connected and GoCube X do not. */
function supportsGyro(name) {
	return (name || '').startsWith('GoCube') && !(name || '').startsWith('GoCubeX');
}

export default class Particula extends SmartCube {
	device;
	adapter;
	batteryInterval;

	WRITE_BATTERY = 50;
	WRITE_STATE = 51;
	WRITE_RESET = 53;
	/** Switches the orientation stream on (classic GoCube only). */
	WRITE_ENABLE_ORIENTATION = 0x38;

	static UUID_SUFFIX = '-b5a3-f393-e0a9-e50e24dcca9e';
	static SERVICE_UUID = '6e400001' + Particula.UUID_SUFFIX;
	static opServices = [Particula.SERVICE_UUID];

	CHRCT_UUID_WRITE = '6e400002' + Particula.UUID_SUFFIX;
	CHRCT_UUID_READ = '6e400003' + Particula.UUID_SUFFIX;

	axisPerm = [5, 2, 0, 3, 1, 4];
	facePerm = [0, 1, 2, 5, 8, 7, 6, 3];
	faceOffset = [0, 0, 6, 2, 0, 0];

	batteryIntervalStarted = false;
	getStateTimeout = null;

	curBatteryLevel = -1;
	batteryResolveList = [];
	/** Last full move (axis, direction bit), for the truncated move frame. */
	lastMoveMeta = null;
	orientationEnabled = false;

	constructor(device, adapter) {
		super();

		this.device = device;
		this.adapter = adapter;
		// Only a cube that can stream orientation offers it; the connection manager reads the
		// presence of subscribeGyro as "may have a gyroscope".
		if (supportsGyro(device?.name)) {
			this.subscribeGyro = (callback) => this._addGyroListener(callback);
		}
	}

	// Switched on with the first gyro listener; there is no documented "off".
	_onGyroSubscribersChanged = (count) => {
		if (count === 0 || this.orientationEnabled || !supportsGyro(this.device?.name)) return;
		this.orientationEnabled = true;
		this.adapter
			.writeCharacteristic(this.device, Particula.SERVICE_UUID, this.CHRCT_UUID_WRITE, new Uint8Array([this.WRITE_ENABLE_ORIENTATION]).buffer)
			.catch(() => { this.orientationEnabled = false; });
	};

	// Tell the cube its current position is solved.
	resetCubeState = async () => {
		try {
			await this.adapter.writeCharacteristic(this.device, Particula.SERVICE_UUID, this.CHRCT_UUID_WRITE, new Uint8Array([this.WRITE_RESET]).buffer);
		} catch (e) {
			console.error('[gocube] cube state reset failed:', e?.message);
			return false;
		}
		this.lastMoveMeta = null;
		this.alertCubeState('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
		return true;
	};

	init = async () => {
		await this.adapter.connect(this.device, () => {
			if (this.batteryInterval) {
				clearInterval(this.batteryInterval);
				this.batteryInterval = null;
			}

			this.alertDisconnected();
		});

		setTimerParams({ smartCubeConnectStep: 'paired' });

		await this.adapter.startNotifications(
			this.device,
			Particula.SERVICE_UUID,
			this.CHRCT_UUID_READ,
			(value) => this.parseData(value)
		);

		setTimerParams({ smartCubeConnectStep: 'reading_service' });

		await this.adapter.writeCharacteristic(
			this.device,
			Particula.SERVICE_UUID,
			this.CHRCT_UUID_WRITE,
			new Uint8Array([this.WRITE_STATE]).buffer
		);

		const dummyServer = {
			device: {
				name: this.device.name,
				id: this.device.deviceId,
			},
		};
		await this.alertConnected(dummyServer);
		if (!this._gyroSeen) this.alertGyroSupported(false);
		// A page may have subscribed before the link was up; switch the stream on now.
		this._onGyroSubscribersChanged(this._gyroListeners.length);

		this.batteryInterval = setInterval(async () => {
			this.batteryIntervalStarted = true;
			const battery = await this.getBatteryLevel();
			this.alertBatteryLevel(battery);
		}, 10000);
	};

	parseData = (value) => {
		if (value.byteLength < 4) return;

		if (
			value.getUint8(0) != 0x2a ||
			value.getUint8(value.byteLength - 2) != 0x0d ||
			value.getUint8(value.byteLength - 1) != 0x0a
		) {
			return;
		}

		// Full frames carry a checksum; a corrupt one used to be parsed as moves.
		if (value.byteLength >= 7 && !goCubeChecksumValid(value)) return;

		const msgType = value.getUint8(2);
		const msgLen = value.byteLength - 6;

		if (msgType === 1) {
			// Turn
			if (value.byteLength < 8) {
				// The firmware sometimes sends a move frame too short to hold a move: it stands
				// for the opposite face turned the opposite way to the last full move. That
				// reading is smartcube-web-bluetooth's; its captures hold no such frame, so it is
				// taken on the library's word. Read as a normal frame it decoded a single stray
				// byte into an unrelated turn.
				if (this.lastMoveMeta) {
					const axis = OPPOSITE_AXIS[this.lastMoveMeta.axis];
					const dirBit = 1 - this.lastMoveMeta.dirBit;
					this.lastMoveMeta = { axis, dirBit };
					this.alertTurnCube('URFDLB'.charAt(axis) + " 2'".charAt([0, 2][dirBit]));
				}
			} else {
				for (let i = 0; i < msgLen; i += 2) {
					const axis = this.axisPerm[value.getUint8(3 + i) >> 1];
					const dirBit = value.getUint8(3 + i) & 1;
					this.lastMoveMeta = { axis, dirBit };
					const move = 'URFDLB'.charAt(axis) + " 2'".charAt([0, 2][dirBit]);
					this.alertTurnCube(move);
				}
			}

			if (this.getStateTimeout) {
				clearTimeout(this.getStateTimeout);
				this.getStateTimeout = null;
			}

			this.getStateTimeout = setTimeout(() => {
				this.updateState();
			}, 750);
		} else if (msgType === 2) {
			// Cube state
			const faces = this.getCubeState(value);
			this.alertCubeState(faces);

			if (!this.batteryIntervalStarted) {
				this.getBatteryLevel().then((level) => {
					this.alertBatteryLevel(level);
				});
			}
		} else if (msgType === 3) {
			// Orientation: ASCII "x#y#z#w" between byte 3 and the checksum.
			if (!supportsGyro(this.device?.name) || value.byteLength < 8) return;
			let text = '';
			for (let i = 3; i < value.byteLength - 3; i++) text += String.fromCharCode(value.getUint8(i));
			const quaternion = parseGoCubeOrientation(text);
			if (quaternion) this._emitGyro({ timestamp: Date.now(), quaternion });
		} else if (msgType === 5) {
			// Battery level
			this.curBatteryLevel = value.getUint8(3);
			while (this.batteryResolveList.length !== 0) {
				this.batteryResolveList.shift()(this.curBatteryLevel);
			}
		}
	};

	getCubeState = (value) => {
		const facelet = [];
		for (let a = 0; a < 6; a++) {
			const axis = this.axisPerm[a] * 9;
			const aoff = this.faceOffset[a];
			facelet[axis + 4] = 'BFUDRL'.charAt(value.getUint8(3 + a * 9));
			for (let i = 0; i < 8; i++) {
				facelet[axis + this.facePerm[(i + aoff) % 8]] = 'BFUDRL'.charAt(value.getUint8(3 + a * 9 + i + 1));
			}
		}

		return facelet.join('');
	};

	toHexVal = (value) => {
		const valhex = [];
		for (let i = 0; i < value.byteLength; i++) {
			valhex.push((value.getUint8(i) >> 4) & 0xf);
			valhex.push(value.getUint8(i) & 0xf);
		}
		return valhex;
	};

	updateState = () => {
		this.adapter.writeCharacteristic(
			this.device,
			Particula.SERVICE_UUID,
			this.CHRCT_UUID_WRITE,
			new Uint8Array([this.WRITE_STATE]).buffer
		);
	};

	getBatteryLevel = async () => {
		this.adapter.writeCharacteristic(
			this.device,
			Particula.SERVICE_UUID,
			this.CHRCT_UUID_WRITE,
			new Uint8Array([this.WRITE_BATTERY]).buffer
		);
		return new Promise((resolve) => {
			this.batteryResolveList.push(resolve);
		});
	};
}
