import {SmartCubeStore, TimerStore} from '../components/timer/@types/interfaces';

export function turnSmartCube(turn, completedAt, cubeTimestamp?: number | null, localTimestamp?: number | null) {
	return {
		type: 'TURN_SMART_CUBE',
		payload: {
			turn,
			completedAt,
			cubeTimestamp: cubeTimestamp ?? null,
			localTimestamp: localTimestamp ?? null,
		},
	};
}

export function turnSmartCubeBatch(
	moves: Array<{ turn: string; completedAt: number; cubeTimestamp?: number | null; localTimestamp?: number | null; recovered?: boolean }>,
	// Cube state after these moves. Carried in the SAME action on purpose: shipping
	// moves and facelets as two dispatches lets a state update land before the moves
	// that produced it, which made the timer treat the last scramble move as the
	// first solve move. The reference implementations keep both in one callback.
	facelets?: string | null
) {
	return {
		type: 'TURN_SMART_CUBE_BATCH',
		payload: {
			moves,
			facelets: facelets ?? null,
		},
	};
}

export function setTimerParamsAction(params: Partial<TimerStore>) {
	return {
		type: 'SET_TIMER_PARAM',
		payload: {
			params,
		},
	};
}

/**
 * Cube state reported without any moves attached (periodic FACELETS packet, a resync, a
 * manual "mark as solved"). The sequence number is bumped by the reducer, so it is the one
 * authority on it whichever path the state arrived by.
 */
export function smartCubeFaceletsAction(facelets: string) {
	return {
		type: 'SMART_CUBE_FACELETS',
		payload: {
			facelets,
		},
	};
}

export function setSmartCubeParamsAction(params: Partial<SmartCubeStore>) {
	return {
		type: 'SET_SMART_CUBE_PARAM',
		payload: {
			params,
		},
	};
}

export function setTimerDisabled(disabled) {
	return {
		type: 'SET_TIMER_DISABLED',
		payload: {
			disabled,
		},
	};
}

export function setStartEnabled(val) {
	return {
		type: 'SET_START_ENABLED',
		payload: val,
	};
}
