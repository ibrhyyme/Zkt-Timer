import { isNative } from '../platform';
import { BleAdapter } from './ble-adapter';

let _adapter: BleAdapter | null = null;

export async function getBleAdapter(): Promise<BleAdapter> {
	if (_adapter) return _adapter;

	if (isNative()) {
		const { CapacitorBleAdapter } = await import('./capacitor-ble-adapter');
		_adapter = new CapacitorBleAdapter();
	} else {
		const { WebBleAdapter } = await import('./web-ble-adapter');
		_adapter = new WebBleAdapter();
	}
	return _adapter;
}

export type { BleAdapter, BleDevice } from './ble-adapter';
