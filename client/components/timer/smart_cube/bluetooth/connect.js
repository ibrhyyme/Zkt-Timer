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
			// GAN family (GAN cube + Monster Go AI + AiCube)
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

		// cstimer routing order: most specific prefix first
		if (name.startsWith('Gi') || name.startsWith('Mi Smart Magic Cube') || name.startsWith('Hi-')) {
			cube = new Giiker(device, this.adapter);
			cubeType = 'Giiker';
		} else if (nameLower.startsWith('gan') || name.startsWith('MG') || name.startsWith('AiCube')) {
			// GAN family: GAN cube, Monster Go AI (MG), AiCube all use GAN protocol (differentiation in key selection inside gan.js)
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
			console.log(`[BLE-CONNECT] cube.init() starting (${cubeType})...`);
			await cube.init();
			console.log(`[BLE-CONNECT] cube.init() COMPLETED (${cubeType})`);
		} else {
			console.warn('[BLE-CONNECT] _initCube: Device not recognized, cube not created:', device.name);
		}
	};

	connect = async (acceptAll = false) => {
		const MAX_RETRIES = 3;
		const excludeDeviceIds = [];
		this._cancelled = false;

		console.log('[BLE-CONNECT] connect() started | isNative:', isNative(), '| acceptAll:', acceptAll);

		try {
			this.adapter = await getBleAdapter();
			console.log('[BLE-CONNECT] adapter obtained:', this.adapter.constructor.name);

			this.alertScanning();

			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				console.log(`[BLE-CONNECT] Scan attempt ${attempt + 1}/${MAX_RETRIES} | excludeIds:`, excludeDeviceIds);

				const device = await this.adapter.requestDevice({
					...this._deviceOptions,
					excludeDeviceIds,
					acceptAll,
					// Native: surface the live device list so the user picks the right cube.
					onScanUpdate: (devices) => setTimerParams({ smartScanDevices: devices }),
				});

				console.log('[BLE-CONNECT] Device found:', device.name, '| deviceId:', device.deviceId);

				setTimerParams({ smartCubeConnectStep: 'found' });

				if (this._cancelled) {
					console.log('[BLE-CONNECT] Cancelled, exiting');
					try { await this.adapter.disconnect(device); } catch (e) { /* ignore */ }
					return;
				}

				this.device = device;
				this.alertConnecting();

				try {
					console.log('[BLE-CONNECT] _initCube started...');
					await this._initCube(device);
					console.log('[BLE-CONNECT] _initCube SUCCESS');
					return; // Success, exit
				} catch (error) {
					console.error(`[BLE-CONNECT] _initCube ERROR (attempt ${attempt + 1}):`, error.message, error);
					try { await this.adapter.disconnect(device); } catch (e) { /* ignore */ }

					// If unsupported device type, exclude it; if GATT error, retry same device
					if (error.message?.includes('unsupported') || error.message?.includes("Can't find target")) {
						excludeDeviceIds.push(device.deviceId);
					}

					if (attempt === MAX_RETRIES - 1) {
						throw error;
					}

					// Wait 2s for GATT recovery
					await new Promise((r) => setTimeout(r, 2000));
					this.alertScanning();
				}
			}
		} catch (error) {
			console.error('[BLE-CONNECT] connect() ERROR:', error.message, error);

			if (error.message === 'BLE_SCAN_ABORTED') {
				console.log('[BLE-CONNECT] User cancelled');
				setTimerParams({
					smartCubeScanning: false,
					smartCubeConnecting: false,
					smartCubeScanError: null,
					smartCubeConnectStep: null,
				});
			} else if (error.message === 'BLE_SCAN_TIMEOUT') {
				console.warn('[BLE-CONNECT] 15s scan timeout — device not found');
				this.alertScanError('timeout');
			} else if (error.message === 'BLE_PERMISSION_DENIED') {
				console.warn('[BLE-CONNECT] BLE permission denied');
				this.alertScanError('permission');
			} else if (error.message === 'BLE_DISABLED') {
				console.warn('[BLE-CONNECT] Bluetooth disabled');
				this.alertScanError('disabled');
			} else {
				console.error('[BLE-CONNECT] Unexpected error:', error);
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
