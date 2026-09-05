import SmartCube from './smart_cube';
import GiikerUtil from './giiker_util';
import { setTimerParams } from '../../helpers/params';

export default class Giiker extends SmartCube {
	device;
	adapter;
	connected = false;
	batteryInterval = null;
	giiker = null;

	constructor(device, adapter) {
		super();

		this.device = device;
		this.adapter = adapter;
	}

	static SERVICE_UUID = '0000aadb-0000-1000-8000-00805f9b34fb';
	static opServices = [Giiker.SERVICE_UUID];

	init = async () => {
		const giiker = new GiikerUtil(this.device, this.adapter);
		await giiker.connect();
		// Batch dispatch, not alertTurnCube: the move and the state it produced have to reach
		// the app in one update. The single-move path publishes them separately, which lets a
		// listener see the new state before the move that caused it — the same ordering bug
		// the GAN and QiYi drivers already avoid this way.
		giiker.on('move', ({move, facelets}) => {
			if (!this.connected) {
				return;
			}
			if (move) {
				this.alertTurnCubeBatch([{turn: move, completedAt: Date.now()}], facelets);
			} else {
				// A packet the move decoder could not read still carries a usable state, and
				// pushing an empty turn into the stream would corrupt the tracker.
				this.alertCubeState(facelets);
			}
		});

		giiker.on('connected', (server) => {
			this.connected = true;
			setTimerParams({ smartCubeConnectStep: 'paired' });
			const ate = giiker.stateString;
			setTimerParams({ smartCubeConnectStep: 'reading_service' });
			this.alertConnected(server);
			this.alertCubeState(ate);
			this.updateBattery();
		});

		giiker.on('disconnected', () => {
			if (this.batteryInterval) {
				clearInterval(this.batteryInterval);
				this.batteryInterval = null;
			}

			this.alertDisconnected();
		});

		this.batteryInterval = setInterval(() => {
			this.updateBattery();
		}, 10000);

		this.giiker = giiker;
	};

	updateBattery = async () => {
		const level = await this.giiker.getBatteryLevel();
		this.alertBatteryLevel(level);
	};
}
