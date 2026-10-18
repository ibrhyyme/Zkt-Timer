import {getPrisma} from '../database';
import {v4 as uuid} from 'uuid';

export function getSmartDeviceById(id) {
	return getPrisma().smartDevice.findUnique({
		where: {
			id,
		},
	});
}

export function getSmartDevices(user) {
	return getPrisma().smartDevice.findMany({
		where: {
			user_id: user.id,
		},
		// Old clients read only solves.length (and ask for `solves { id }`); loading every
		// column of every solve just to count them was the slowest part of this query.
		include: {
			solves: {select: {id: true}},
		},
	});
}

export function deleteSmartDevice(id) {
	return getPrisma().smartDevice.delete({
		where: {
			id,
		},
	});
}

export function updateSmartDevice(id, params) {
	return getPrisma().smartDevice.update({
		where: {
			id,
		},
		data: params,
	});
}

export function createSmartDevice(user, name, internalName, deviceId) {
	const id = uuid();

	return getPrisma().smartDevice.create({
		data: {
			id,
			name,
			user_id: user.id,
			internal_name: internalName,
			device_id: deviceId,
		},
	});
}
