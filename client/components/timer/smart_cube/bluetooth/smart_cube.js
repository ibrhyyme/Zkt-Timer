import { setTimerParams } from '../../helpers/params';
import { getSmartCubeDriverSink } from '../../../../util/smart_cube/driver_sink';

/**
 * Base class for every cube protocol driver (and for Connect itself).
 *
 * The alert* methods are the drivers' only way out. They used to write Redux directly,
 * which is why each page had to build its own Connect and re-point them at itself. They
 * now hand everything to a sink, so a driver behaves the same whichever page happens to
 * be on screen, or when none is.
 *
 * The app-level connection manager is reached through util/smart_cube/driver_sink, not
 * imported: the manager imports connect.js, which extends this class, and a direct import
 * back would make a module cycle in which a driver can load before this class exists.
 *
 * A driver may also carry its OWN sink in `_sink`, which is what makes more than one cube
 * at a time possible. With a single module-level sink every driver posted to the same
 * address, so two connected cubes dropped their moves into one mailbox with no sender on
 * the envelope and nothing downstream could tell them apart. Battle needs exactly that
 * distinction: two cubes, two independent timers. Leaving `_sink` null keeps the old
 * behaviour untouched, which is what the timer page, rooms and the trainer all rely on.
 */
export default class SmartCube {
	/** This driver's own sink. Null means "report to the app-wide connection manager". */
	_sink = null;

	/**
	 * Where this driver's callbacks go: its own sink when it has one, the app-wide manager
	 * otherwise. Resolved per call rather than cached, because a Connect may be handed its
	 * sink after the instance already exists.
	 */
	_target = () => {
		const target = this._sink || getSmartCubeDriverSink();
		if (!target) {
			throw new Error('[smart-cube] driver callback with no connection manager registered');
		}
		return target;
	};

	alertScanning = () => {
		this._target().handleScanning();
	};

	alertScanError = (errorMessage) => {
		this._target().handleScanError(errorMessage);
	};

	alertConnecting = () => {
		this._target().handleConnecting();
	};

	alertDisconnected = () => {
		this._target().handleLinkLost();
	};

	alertConnected = async (server) => {
		// `this` is the driver instance. Registering the cube in My Cubes is the manager's job
		// (connection_manager.ts registerCube), not the driver's.
		await this._target().handleConnected(this, server);
	};

	alertBatteryLevel = (level) => {
		this._target().handleBattery(level);
	};

	alertTurnCube = (move) => {
		this._target().handleMove(move);
	};

	// `facelets` is the cube state after these moves. Drivers that track state pass
	// it so the state and the moves that produced it travel together; without it the
	// state update is a separate dispatch and can overtake the moves it belongs to.
	alertTurnCubeBatch = (moves, facelets = null) => {
		this._target().handleMoveBatch(moves, facelets);
	};

	alertCubeState = (state) => {
		this._target().handleFacelets(state);
	};

	alertGyroSupported = (supported) => {
		this._target().handleGyroSupported(supported);
	};

	// Gyro plumbing shared by the drivers that can stream orientation. A driver opts in by
	// defining `subscribeGyro = (cb) => this._addGyroListener(cb)`: the connection manager
	// reads the presence of `subscribeGyro` as "this cube may have a gyroscope", so it is not
	// defined here for everyone. Events carry `{quaternion, velocity?}` in GAN's frame
	// (+X red, +Y blue, +Z white), which is what the 3D view draws.
	_gyroListeners = [];

	_addGyroListener = (callback) => {
		this._gyroListeners.push(callback);
		this._onGyroSubscribersChanged?.(this._gyroListeners.length);
		return () => {
			this._gyroListeners = this._gyroListeners.filter((cb) => cb !== callback);
			this._onGyroSubscribersChanged?.(this._gyroListeners.length);
		};
	};

	_gyroSeen = false;

	_emitGyro = (event) => {
		if (!this._gyroSeen) {
			// A cube that streams orientation has a gyroscope, whatever it claimed at connect.
			this._gyroSeen = true;
			this.alertGyroSupported(true);
		}
		for (const listener of this._gyroListeners) listener(event);
	};

	// Dead paths kept for the drivers that still reference them: gan.js has its GYRO
	// dispatch commented out in favour of subscribeGyro, and nothing reads the two Redux
	// fields below. Left in place rather than removed because they are protocol surface.
	alertGyroData = (quaternion, velocity) => {
		setTimerParams({
			smartGyroQuaternion: quaternion,
			smartGyroVelocity: velocity || null,
		});
	};

	resetGyro = () => {
		setTimerParams({
			smartGyroQuaternion: null,
		});
	};
}
