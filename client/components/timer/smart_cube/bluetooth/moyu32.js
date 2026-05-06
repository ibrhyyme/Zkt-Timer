// MoYu WeiLong AI 2024 (WCU_MY3) BLE protokol port'u
// Referans: e:/Projects/Zkt-Timer/Referans/cstimer-master/src/js/hardware/moyu32cube.js (392 satir)
// %100 port: encryption (GAN Gen2/3 sema), MAC discovery, message parsing, time correction
//
// State takibi: cstimer mathlib.CubieCube yerine cubejs (proje genelinde kullanilan)
// AES + LZString proje icindeki ./ae128 + ./lz_string (cstimer ile API uyumlu)

import SmartCube from './smart_cube';
import LZString from './lz_string';
import aes128 from './ae128';
import Cube from 'cubejs';

const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const SERVICE_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb0';
const CHRT_UUID_READ = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const CHRT_UUID_WRITE = '0783b03e-7735-b5a0-1760-a305d2795cb2';

// cstimer KEYS — LZString compressed key/iv pairs
const KEYS = [
	'NoJgjANGYJwQrADgjEUAMBmKAWCP4JNIRswt81Yp5DztE1EB2AXSA',
	'NoRg7ANAzArNAc1IigFgqgTB9MCcE8cAbBCJpKgeaSAAxTSPxgC6QA',
];

// CICs 0x(01..=FF)00 — cstimer dan ayni
const MOYU32_CIC_LIST = Array(255).fill(undefined).map((_, i) => (i + 1) << 8);

const MAC_CACHE_KEY = 'moyu32_cube_mac';

function valuedArray(n, val) {
	const arr = [];
	for (let i = 0; i < n; i++) {
		arr.push(typeof val === 'function' ? val(i) : val);
	}
	return arr;
}

export default class MoYu32 extends SmartCube {
	device;
	adapter;

	static SERVICE_UUID = SERVICE_UUID;
	static opServices = [SERVICE_UUID];
	static cics = MOYU32_CIC_LIST;

	constructor(device, adapter) {
		super();
		this.device = device;
		this.adapter = adapter;

		// cstimer module-state equivalents
		this.deviceName = device.name?.trim() || '';
		this.deviceMac = null;
		this.decoder = null;

		this.prevMoves = [];
		this.timeOffs = [];
		this.prevCube = Cube.fromString(SOLVED_FACELET);
		this.curCube = Cube.fromString(SOLVED_FACELET);
		this.latestFacelet = SOLVED_FACELET;
		this.deviceTime = 0;
		this.deviceTimeOffset = 0;
		this.moveCnt = -1;
		this.prevMoveCnt = -1;
		this.batteryLevel = 0;
	}

	// cstimer getKeyAndIv() — bire bir port
	getKeyAndIv(value) {
		const key = JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[0]));
		const iv = JSON.parse(LZString.decompressFromEncodedURIComponent(KEYS[1]));
		for (let i = 0; i < 6; i++) {
			key[i] = (key[i] + value[5 - i]) % 255;
			iv[i] = (iv[i] + value[5 - i]) % 255;
		}
		return [key, iv];
	}

	// cstimer initDecoder() — bire bir port
	initDecoder(mac) {
		const value = [];
		for (let i = 0; i < 6; i++) {
			value.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
		}
		const keyiv = this.getKeyAndIv(value);
		this.decoder = aes128(keyiv[0]);
		this.decoder.iv = keyiv[1];
	}

	// cstimer decode() — bire bir port
	decode(value) {
		const ret = [];
		for (let i = 0; i < value.byteLength; i++) {
			ret[i] = value.getUint8(i);
		}
		if (this.decoder == null) {
			return ret;
		}
		const iv = this.decoder.iv || [];
		if (ret.length > 16) {
			const offset = ret.length - 16;
			const block = this.decoder.decrypt(ret.slice(offset));
			for (let i = 0; i < 16; i++) {
				ret[i + offset] = block[i] ^ (~~iv[i]);
			}
		}
		this.decoder.decrypt(ret);
		for (let i = 0; i < 16; i++) {
			ret[i] ^= (~~iv[i]);
		}
		return ret;
	}

	// cstimer encode() — bire bir port
	encode(ret) {
		if (this.decoder == null) {
			return ret;
		}
		const iv = this.decoder.iv || [];
		for (let i = 0; i < 16; i++) {
			ret[i] ^= ~~iv[i];
		}
		this.decoder.encrypt(ret);
		if (ret.length > 16) {
			const offset = ret.length - 16;
			const block = ret.slice(offset);
			for (let i = 0; i < 16; i++) {
				block[i] ^= ~~iv[i];
			}
			this.decoder.encrypt(block);
			for (let i = 0; i < 16; i++) {
				ret[i + offset] = block[i];
			}
		}
		return ret;
	}

	async sendRequest(req) {
		const encodedReq = this.encode(req.slice());
		console.log('[Moyu32] sendRequest', req, encodedReq);
		return this.adapter.writeCharacteristic(
			this.device,
			SERVICE_UUID,
			CHRT_UUID_WRITE,
			new Uint8Array(encodedReq).buffer
		);
	}

	sendSimpleRequest(opcode) {
		const req = valuedArray(20, 0);
		req[0] = opcode;
		return this.sendRequest(req);
	}

	requestCubeInfo() { return this.sendSimpleRequest(161); }
	requestCubeStatus() { return this.sendSimpleRequest(163); }
	requestCubePower() { return this.sendSimpleRequest(164); }

	// MAC adresini bul: 1) manufacturer data (auto), 2) device name pattern, 3) prompt
	async resolveMac() {
		// 1) Manufacturer data'dan otomatik MAC
		if (this.adapter.watchAdvertisements) {
			try {
				const mfData = await this.adapter.watchAdvertisements(this.device);
				if (mfData) {
					let dataView = null;
					if (mfData instanceof DataView) {
						dataView = new DataView(mfData.buffer.slice(2));
					} else {
						for (const id of MOYU32_CIC_LIST) {
							if (mfData.has(id)) {
								console.log('[Moyu32] CIC bulundu: 0x' + id.toString(16).padStart(4, '0'));
								dataView = mfData.get(id);
								break;
							}
						}
					}
					if (dataView && dataView.byteLength >= 6) {
						const mac = [];
						for (let i = 0; i < 6; i++) {
							mac.push((dataView.getUint8(dataView.byteLength - i - 1) + 0x100).toString(16).slice(1));
						}
						const macStr = mac.join(':').toUpperCase();
						console.log('[Moyu32] MAC otomatik bulundu:', macStr);
						return macStr;
					}
				}
			} catch (e) {
				console.warn('[Moyu32] watchAdvertisements hatasi:', e);
			}
		}

		// 2) Device name pattern — WCU_MY32_XXXX
		let defaultMac = null;
		const m = /^WCU_MY32_[0-9A-F]{4}$/.exec(this.deviceName);
		if (m) {
			defaultMac = 'CF:30:16:00:' + this.deviceName.slice(9, 11) + ':' + this.deviceName.slice(11, 13);
			console.log('[Moyu32] Default MAC device name pattern:', defaultMac);
		}

		// 3) Cache veya prompt
		const cached = localStorage.getItem(MAC_CACHE_KEY);
		if (cached) {
			return cached;
		}

		const promptMsg = 'MoYu WeiLong AI: Otomatik MAC adresi bulunamadi.\nLutfen kupun MAC adresini girin (ornek: CF:30:16:00:AB:CD):';
		const userInput = typeof window !== 'undefined' ? window.prompt(promptMsg, defaultMac || '') : null;
		if (userInput) {
			const cleaned = userInput.trim().toUpperCase();
			localStorage.setItem(MAC_CACHE_KEY, cleaned);
			return cleaned;
		}
		return null;
	}

	async init() {
		console.log('[Moyu32] init basladi, device:', this.deviceName);

		await this.adapter.connect(this.device, () => {
			console.log('[Moyu32] disconnect');
			this.alertDisconnected();
		});

		// Notification baslat
		await this.adapter.startNotifications(
			this.device,
			SERVICE_UUID,
			CHRT_UUID_READ,
			(value) => this.onStateChanged(value)
		);

		// MAC al
		this.deviceMac = await this.resolveMac();
		if (!this.deviceMac) {
			throw new Error('[Moyu32] MAC adresi alinamadi, baglanti mumkun degil');
		}
		console.log('[Moyu32] MAC kullaniliyor:', this.deviceMac);
		this.initDecoder(this.deviceMac);

		// Connected callback (dummy server)
		const dummyServer = {
			device: {
				name: this.device.name,
				id: this.device.deviceId,
			},
		};
		await this.alertConnected(dummyServer);

		// cstimer ile ayni initial request sirasi: info -> status -> power
		await this.requestCubeInfo();
		await this.requestCubeStatus();
		await this.requestCubePower();
	}

	onStateChanged(value) {
		if (this.decoder == null) {
			return;
		}
		this.parseData(value);
	}

	initCubeState() {
		console.log('[Moyu32] initialising cube state, facelet:', this.latestFacelet);
		this.alertCubeState(this.latestFacelet);
		this.prevCube = Cube.fromString(this.latestFacelet);
		this.prevMoveCnt = this.moveCnt;
	}

	// cstimer parseData() — bire bir port
	parseData(value) {
		const locTime = Date.now();
		let decoded = this.decode(value);

		// cstimer'in bit-string conversion'i
		const bits = [];
		for (let i = 0; i < decoded.length; i++) {
			bits.push((decoded[i] + 256).toString(2).slice(1));
		}
		const bitStr = bits.join('');

		const msgType = parseInt(bitStr.slice(0, 8), 2);

		if (msgType === 161) { // info
			console.log('[Moyu32] hardware info event', bitStr);
			let devName = '';
			for (let i = 0; i < 8; i++) {
				devName += String.fromCharCode(parseInt(bitStr.slice(8 + i * 8, 16 + i * 8), 2));
			}
			const hardwareVersion = parseInt(bitStr.slice(88, 96), 2) + '.' + parseInt(bitStr.slice(96, 104), 2);
			const softwareVersion = parseInt(bitStr.slice(72, 80), 2) + '.' + parseInt(bitStr.slice(80, 88), 2);
			console.log('[Moyu32] HW Version:', hardwareVersion, '| SW Version:', softwareVersion, '| Device:', devName);
		} else if (msgType === 163) { // state (facelets)
			if (this.prevMoveCnt === -1) { // sadece initial state
				this.moveCnt = parseInt(bitStr.slice(152, 160), 2);
				this.latestFacelet = this.parseFacelet(bitStr.slice(8, 152));
				this.initCubeState();
			}
		} else if (msgType === 164) { // battery
			this.batteryLevel = parseInt(bitStr.slice(8, 16), 2);
			console.log('[Moyu32] battery:', this.batteryLevel);
			this.alertBatteryLevel(this.batteryLevel);
		} else if (msgType === 165) { // move
			this.moveCnt = parseInt(bitStr.slice(88, 96), 2);
			if (this.moveCnt === this.prevMoveCnt || this.prevMoveCnt === -1) {
				return;
			}
			this.timeOffs = [];
			this.prevMoves = [];
			let invalidMove = false;
			for (let i = 0; i < 5; i++) {
				const m = parseInt(bitStr.slice(96 + i * 5, 101 + i * 5), 2);
				this.timeOffs[i] = parseInt(bitStr.slice(8 + i * 16, 24 + i * 16), 2);
				this.prevMoves[i] = 'FBUDLR'.charAt(m >> 1) + " '".charAt(m & 1);
				if (m >= 12) {
					this.prevMoves[i] = 'U ';
					invalidMove = true;
				}
			}
			if (!invalidMove) {
				this.updateMoveTimes(locTime);
			}
		}
		// msgType 171 = gyro (cstimer'da da disabled)
	}

	// cstimer updateMoveTimes() — bire bir port + bizim Redux pipeline'a uyarlama
	updateMoveTimes(locTime) {
		let moveDiff = (this.moveCnt - this.prevMoveCnt) & 0xff;
		if (moveDiff > 1) {
			console.log('[Moyu32] BLE event lost, moveDiff =', moveDiff);
		}
		this.prevMoveCnt = this.moveCnt;
		if (moveDiff > this.prevMoves.length) {
			moveDiff = this.prevMoves.length;
		}
		let calcTs = this.deviceTime + this.deviceTimeOffset;
		for (let i = moveDiff - 1; i >= 0; i--) {
			calcTs += this.timeOffs[i];
		}
		if (!this.deviceTime || Math.abs(locTime - calcTs) > 2000) {
			console.log('[Moyu32] time adjust', locTime - calcTs, '@', locTime);
			this.deviceTime += locTime - calcTs;
		}

		// Batch hamleleri topla
		const batch = [];
		for (let i = moveDiff - 1; i >= 0; i--) {
			const moveRaw = this.prevMoves[i]; // ornek: "R " veya "R'"
			const cubejsMove = moveRaw.replace(' ', ''); // " '" -> "'" / ""
			this.prevCube.move(cubejsMove);
			this.deviceTime += this.timeOffs[i];

			batch.push({
				turn: cubejsMove,
				cubeTimestamp: this.deviceTime,
				localTimestamp: i === 0 ? locTime : null,
				completedAt: this.deviceTime,
			});
			console.log('[Moyu32] move', moveRaw, 'tsOff:', this.timeOffs[i]);
		}
		this.deviceTimeOffset = locTime - this.deviceTime;

		// Cube state ve hamleleri Redux'a push et
		if (batch.length > 0) {
			this.alertTurnCubeBatch(batch);
			this.alertCubeState(this.prevCube.asString());
		}
	}

	// cstimer parseFacelet() — bire bir port
	// Input: 144-bit string (24 bit / face, 6 face) — face order FBUDLR
	parseFacelet(faceletBits) {
		const state = [];
		const faces = [2, 5, 0, 3, 4, 1]; // URFDLB sirasinda parse, FBUDLR'den
		for (let i = 0; i < 6; i++) {
			const face = faceletBits.slice(faces[i] * 24, 24 + faces[i] * 24);
			for (let j = 0; j < 8; j++) {
				state.push('FBUDLR'.charAt(parseInt(face.slice(j * 3, 3 + j * 3), 2)));
				if (j === 3) {
					state.push('FBUDLR'.charAt(faces[i]));
				}
			}
		}
		return state.join('');
	}
}
