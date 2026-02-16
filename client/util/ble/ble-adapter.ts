export interface BleDevice {
	deviceId: string;
	name: string;
}

export interface BleRequestDeviceOptions {
	nameFilters: string[];
	serviceFilters: string[];
	optionalServices: string[];
}

export interface BleAdapter {
	requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice>;
	connect(device: BleDevice, onDisconnect?: () => void): Promise<void>;
	disconnect(device: BleDevice): Promise<void>;
	getServices(device: BleDevice): Promise<string[]>;
	readCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<DataView>;
	writeCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string, data: ArrayBuffer): Promise<void>;
	startNotifications(
		device: BleDevice,
		serviceUuid: string,
		characteristicUuid: string,
		callback: (value: DataView) => void
	): Promise<void>;
	stopNotifications(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<void>;
	watchAdvertisements?(device: BleDevice): Promise<Map<number, DataView> | null>;
}
