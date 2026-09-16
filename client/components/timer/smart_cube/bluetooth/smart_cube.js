import { setTimerParams } from '../../helpers/params';
import { gql } from '@apollo/client';
import { gqlMutate } from '../../../api';
import { getSmartCubeDriverSink } from '../../../../util/smart_cube/driver_sink';

/**
 * Base class for every cube protocol driver (and for Connect itself).
 *
 * The alert* methods are the drivers' only way out. They used to write Redux directly,
 * which is why each page had to build its own Connect and re-point them at itself. They
 * now hand everything to the app-level connection manager, so a driver behaves the same
 * whichever page happens to be on screen, or when none is.
 *
 * The manager is reached through util/smart_cube/driver_sink, not imported: the manager
 * imports connect.js, which extends this class, and a direct import back would make a module
 * cycle in which a driver can load before this class exists.
 */
/** The connection manager, registered when it was created. Only it creates Connect. */
function sink() {
	const target = getSmartCubeDriverSink();
	if (!target) {
		throw new Error('[smart-cube] driver callback with no connection manager registered');
	}
	return target;
}

export default class SmartCube {
	alertScanning = () => {
		sink().handleScanning();
	};

	alertScanError = (errorMessage) => {
		sink().handleScanError(errorMessage);
	};

	alertConnecting = () => {
		sink().handleConnecting();
	};

	alertDisconnected = () => {
		sink().handleLinkLost();
	};

	smartCubeInDb = async (server) => {
		const query = gql`
			query Query {
				smartDevices {
					id
					device_id
				}
			}
		`;

		const res = await gqlMutate(query);

		for (const dev of res.data.smartDevices) {
			if (dev.device_id === server.device.id) {
				return dev;
			}
		}

		return false;
	};

	addSmartCubeToDb = async (originalName, deviceId) => {
		const query = gql`
			mutation Mutate($originalName: String, $deviceId: String) {
				addNewSmartDevice(originalName: $originalName, deviceId: $deviceId) {
					id
					name
					internal_name
					device_id
					created_at
				}
			}
		`;

		const res = await gqlMutate(query, {
			originalName,
			deviceId,
		});

		return res.data.addNewSmartDevice;
	};

	alertConnected = async (server) => {
		// `this` is the driver instance, which owns the DB helpers above.
		await sink().handleConnected(this, server);
	};

	alertBatteryLevel = (level) => {
		sink().handleBattery(level);
	};

	alertTurnCube = (move) => {
		sink().handleMove(move);
	};

	// `facelets` is the cube state after these moves. Drivers that track state pass
	// it so the state and the moves that produced it travel together; without it the
	// state update is a separate dispatch and can overtake the moves it belongs to.
	alertTurnCubeBatch = (moves, facelets = null) => {
		sink().handleMoveBatch(moves, facelets);
	};

	alertCubeState = (state) => {
		sink().handleFacelets(state);
	};

	alertGyroSupported = (supported) => {
		sink().handleGyroSupported(supported);
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
