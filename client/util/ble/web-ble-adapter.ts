import { BleAdapter, BleDevice, BleRequestDeviceOptions } from './ble-adapter';

interface WebBleDeviceState {
	device: BluetoothDevice;
	server: BluetoothRemoteGATTServer | null;
	characteristics: Map<string, BluetoothRemoteGATTCharacteristic>;
}

export class WebBleAdapter implements BleAdapter {
	private devices = new Map<string, WebBleDeviceState>();
	private nextId = 0;

	async requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice> {
		const filters: BluetoothLEScanFilter[] = [];

		for (const name of options.nameFilters) {
			filters.push({ namePrefix: name });
		}
		for (const service of options.serviceFilters) {
			filters.push({ services: [service] });
		}

		const device = await navigator.bluetooth.requestDevice({
			filters,
			optionalServices: options.optionalServices,
		});

		const id = `web_${this.nextId++}`;
		this.devices.set(id, {
			device,
			server: null,
			characteristics: new Map(),
		});

		return { deviceId: id, name: device.name || '' };
	}

	async connect(device: BleDevice, onDisconnect?: () => void): Promise<void> {
		const state = this.getState(device.deviceId);
		state.server = await state.device.gatt!.connect();

		if (onDisconnect) {
			state.device.addEventListener('gattserverdisconnected', () => {
				onDisconnect();
			});
		}
	}

	async disconnect(device: BleDevice): Promise<void> {
		const state = this.devices.get(device.deviceId);
		if (state?.server?.connected) {
			state.server.disconnect();
		}
	}

	async getServices(device: BleDevice): Promise<string[]> {
		const state = this.getState(device.deviceId);
		if (!state.server) throw new Error('Not connected');
		const services = await state.server.getPrimaryServices();
		return services.map((s) => s.uuid);
	}

	async readCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<DataView> {
		const char = await this.getCharacteristic(device.deviceId, serviceUuid, characteristicUuid);
		return char.readValue();
	}

	async writeCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string, data: ArrayBuffer): Promise<void> {
		const char = await this.getCharacteristic(device.deviceId, serviceUuid, characteristicUuid);
		await char.writeValue(data);
	}

	async startNotifications(
		device: BleDevice,
		serviceUuid: string,
		characteristicUuid: string,
		callback: (value: DataView) => void
	): Promise<void> {
		const char = await this.getCharacteristic(device.deviceId, serviceUuid, characteristicUuid);
		await char.startNotifications();
		char.addEventListener('characteristicvaluechanged', (event: Event) => {
			const target = event.target as BluetoothRemoteGATTCharacteristic;
			if (target.value) {
				callback(target.value);
			}
		});
	}

	async stopNotifications(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<void> {
		const key = `${serviceUuid}:${characteristicUuid}`;
		const state = this.devices.get(device.deviceId);
		const char = state?.characteristics.get(key);
		if (char) {
			await char.stopNotifications();
		}
	}

	async watchAdvertisements(device: BleDevice): Promise<Map<number, DataView> | null> {
		const state = this.getState(device.deviceId);
		const webDevice = state.device;

		if (typeof webDevice.watchAdvertisements !== 'function') {
			return null;
		}

		return new Promise((resolve) => {
			const abortController = new AbortController();

			const onAdvEvent = (evt: any) => {
				webDevice.removeEventListener('advertisementreceived', onAdvEvent);
				abortController.abort();
				resolve(evt.manufacturerData || null);
			};

			const onAbort = () => {
				webDevice.removeEventListener('advertisementreceived', onAdvEvent);
				abortController.abort();
				resolve(null);
			};

			webDevice.addEventListener('advertisementreceived', onAdvEvent);
			webDevice.watchAdvertisements({ signal: abortController.signal }).catch(onAbort);
			setTimeout(onAbort, 10000);
		});
	}

	private getState(deviceId: string): WebBleDeviceState {
		const state = this.devices.get(deviceId);
		if (!state) throw new Error(`Device not found: ${deviceId}`);
		return state;
	}

	private async getCharacteristic(
		deviceId: string,
		serviceUuid: string,
		characteristicUuid: string
	): Promise<BluetoothRemoteGATTCharacteristic> {
		const key = `${serviceUuid}:${characteristicUuid}`;
		const state = this.getState(deviceId);

		let char = state.characteristics.get(key);
		if (!char) {
			if (!state.server) throw new Error('Not connected');
			const service = await state.server.getPrimaryService(serviceUuid);
			char = await service.getCharacteristic(characteristicUuid);
			state.characteristics.set(key, char);
		}
		return char;
	}
}
