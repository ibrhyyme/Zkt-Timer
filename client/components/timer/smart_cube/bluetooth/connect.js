import Particula from './particula';
import SmartCube from './smart_cube';
import GAN from './gan';
import Giiker from './giiker';
import MoYu from './moyu';
import MoYu32 from './moyu32';
import QiYi from './qiyi';
import { getBleAdapter } from '../../../../util/ble';
import { isNative } from '../../../../util/platform';
import { setTimerParams } from '../../helpers/params';

export default class Connect extends SmartCube {
	device = null;
	adapter = null;
	_cancelled = false;

	_deviceOptions = {
		nameFilters: [
			// Giiker / Xiaomi
			'Gi', 'Mi Smart Magic Cube', 'Hi-',
			// GAN ailesi (GAN cube + Monster Go AI + AiCube)
			'GAN', 'Gan', 'gan', 'MG', 'AiCube',
			// Particula (GoCube + Rubik's Connected)
			'GoCube', 'Rubiks',
			// MoYu MHC + MoYu WeiLong AI 2024
			'MHC', 'WCU_MY3',
			// QiYi Smart Cube + Tornado V4 i
			'QY-QYSC', 'XMD-TornadoV4-i',
		],
		serviceFilters: [],
		optionalServices: [
			'0000180a-0000-1000-8000-00805f9b34fb', // device_information
			'0000180f-0000-1000-8000-00805f9b34fb', // battery_service
			'9fa480e0-4967-4542-9390-d343dc5d04ae',
			'00001805-0000-1000-8000-00805f9b34fb',
			'd0611e78-bbb4-4591-a5f8-487910ae4366',
			'6e400001-b5a3-f393-e0a9-e50e24dc4179',
			'f95a48e6-a721-11e9-a2a3-022ae2dbcce4',
			'00001800-0000-1000-8000-00805f9b34fb', // generic_access
			...Particula.opServices,
			// GAN
			'0000fff0-0000-1000-8000-00805f9b34fb',
			'0000fff5-0000-1000-8000-00805f9b34fb',
			'0000fff7-0000-1000-8000-00805f9b34fb',
			'0000fff2-0000-1000-8000-00805f9b34fb',
			'0000fff3-0000-1000-8000-00805f9b34fb',
			'0000180a-0000-1000-8000-00805f9b34fb',
			'00002a23-0000-1000-8000-00805f9b34fb',
			'00002a28-0000-1000-8000-00805f9b34fb',
			'8653000a-43e6-47b7-9cb0-5fc21d4ae340',
			'00000010-0000-fff7-fff6-fff5fff4fff0',
			'00001805-0000-1000-8000-00805f9b34fb',
			// MoYu MHC
			...MoYu.opServices,
			// MoYu WeiLong AI 2024
			...MoYu32.opServices,
			// QiYi Smart Cube + Tornado V4 i
			...QiYi.opServices,
		],
	};

	_initCube = async (device) => {
		let cube;
		let cubeType = 'unknown';
		const name = device.name || '';
		const nameLower = name.toLowerCase();

		// Cstimer routing sirasi: en spesifik prefix once
		if (name.startsWith('Gi') || name.startsWith('Mi Smart Magic Cube') || name.startsWith('Hi-')) {
			cube = new Giiker(device, this.adapter);
			cubeType = 'Giiker';
		} else if (nameLower.startsWith('gan') || name.startsWith('MG') || name.startsWith('AiCube')) {
			// GAN ailesi: GAN cube, Monster Go AI (MG), AiCube hepsi GAN protokolu (key seciminde gan.js icinde ayrim)
			cube = new GAN(device, this.adapter);
			cubeType = 'GAN';
		} else if (name.startsWith('GoCube') || name.startsWith('Rubiks')) {
			cube = new Particula(device, this.adapter);
			cubeType = 'Particula';
		} else if (name.startsWith('MHC')) {
			cube = new MoYu(device, this.adapter);
			cubeType = 'MoYu MHC';
		} else if (name.startsWith('WCU_MY3')) {
			cube = new MoYu32(device, this.adapter);
			cubeType = 'MoYu WeiLong AI';
		} else if (name.startsWith('QY-QYSC') || name.startsWith('XMD-TornadoV4-i')) {
			cube = new QiYi(device, this.adapter);
			cubeType = 'QiYi';
		}

		console.log(`[BLE-CONNECT] _initCube | type: ${cubeType} | name: ${device.name} | id: ${device.deviceId}`);

		if (cube) {
			this.activeCube = cube;
			if (this._onCubeCreated) this._onCubeCreated(cube);
			console.log(`[BLE-CONNECT] cube.init() baslatiliyor (${cubeType})...`);
			await cube.init();
			console.log(`[BLE-CONNECT] cube.init() TAMAMLANDI (${cubeType})`);
		} else {
			console.warn('[BLE-CONNECT] _initCube: Cihaz taninamadi, cube olusturulmadi:', device.name);
		}
	};

	connect = async () => {
		const MAX_RETRIES = 3;
		const excludeDeviceIds = [];
		this._cancelled = false;

		console.log('[BLE-CONNECT] connect() basladi | isNative:', isNative());

		try {
			this.adapter = await getBleAdapter();
			console.log('[BLE-CONNECT] adapter alindi:', this.adapter.constructor.name);

			this.alertScanning();

			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				console.log(`[BLE-CONNECT] Tarama denemesi ${attempt + 1}/${MAX_RETRIES} | excludeIds:`, excludeDeviceIds);

				const device = await this.adapter.requestDevice({
					...this._deviceOptions,
					excludeDeviceIds,
				});

				console.log('[BLE-CONNECT] Cihaz bulundu:', device.name, '| deviceId:', device.deviceId);

				if (this._cancelled) {
					console.log('[BLE-CONNECT] Iptal edildi, cikiliyor');
					try { await this.adapter.disconnect(device); } catch (e) { /* ignore */ }
					return;
				}

				this.device = device;
				this.alertConnecting();

				try {
					console.log('[BLE-CONNECT] _initCube basladi...');
					await this._initCube(device);
					console.log('[BLE-CONNECT] _initCube BASARILI');
					return; // Başarılı, çık
				} catch (error) {
					console.error(`[BLE-CONNECT] _initCube HATA (deneme ${attempt + 1}):`, error.message, error);
					try { await this.adapter.disconnect(device); } catch (e) { /* ignore */ }

					// Desteklenmeyen cihaz tipiyse exclude et, GATT hatasiysa ayni cihazi tekrar dene
					if (error.message?.includes('unsupported') || error.message?.includes("Can't find target")) {
						excludeDeviceIds.push(device.deviceId);
					}

					if (attempt === MAX_RETRIES - 1) {
						throw error;
					}

					// GATT toparlanmasi icin 2s bekle
					await new Promise((r) => setTimeout(r, 2000));
					this.alertScanning();
				}
			}
		} catch (error) {
			console.error('[BLE-CONNECT] connect() HATA:', error.message, error);

			if (error.message === 'BLE_SCAN_ABORTED') {
				console.log('[BLE-CONNECT] Kullanici iptal etti');
				setTimerParams({
					smartCubeScanning: false,
					smartCubeConnecting: false,
					smartCubeScanError: null,
				});
			} else if (error.message === 'BLE_SCAN_TIMEOUT') {
				console.warn('[BLE-CONNECT] 15s tarama timeout — cihaz bulunamadi');
				this.alertScanError('timeout');
			} else if (error.message === 'BLE_PERMISSION_DENIED') {
				console.warn('[BLE-CONNECT] BLE izni reddedildi');
				this.alertScanError('permission');
			} else if (error.message === 'BLE_DISABLED') {
				console.warn('[BLE-CONNECT] Bluetooth kapali');
				this.alertScanError('disabled');
			} else {
				console.error('[BLE-CONNECT] Beklenmeyen hata:', error);
				this.alertDisconnected();
			}
		}
	};

	cancelScan = () => {
		this._cancelled = true;
		if (this.adapter && typeof this.adapter.abortScan === 'function') {
			this.adapter.abortScan();
		}
	};

	disconnect = async () => {
		if (!this.device || !this.adapter) {
			return;
		}
		await this.adapter.disconnect(this.device);
		this.device = null;
	};
}
