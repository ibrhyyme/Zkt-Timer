import {Capacitor} from '@capacitor/core';
import {gqlMutateTyped} from '../components/api';
import {LogSmartDeviceEventDocument} from '../@types/generated/graphql';
import {SmartDeviceEventPayload, SmartDevicePlatform} from '../../shared/smart_cube/telemetry';

/**
 * Fire-and-forget smart cube / BLE timer connection telemetry.
 *
 * Sends connect/disconnect/error events to the server so we can see, in the admin panel,
 * who connects a smart device and WHY their connection drops. This must NEVER throw into
 * or block the BLE flow — every call is best-effort and silently swallows failures.
 *
 * `extra` is accepted as a plain object and serialized to a JSON string for the API.
 */

function detectPlatform(): SmartDevicePlatform {
	try {
		const p = Capacitor.getPlatform();
		if (p === 'ios') return 'ios';
		if (p === 'android') return 'android';
	} catch {
		/* SSR / no Capacitor — fall through to web */
	}
	return 'web';
}

/** Caller payload: platform is auto-detected; `extra` is a plain object (serialized here). */
export type SmartDeviceTelemetryInput = Omit<SmartDeviceEventPayload, 'platform' | 'extra'> & {
	platform?: SmartDevicePlatform;
	extra?: Record<string, unknown> | null;
};

export function logSmartDeviceEvent(payload: SmartDeviceTelemetryInput): void {
	try {
		const input = {
			device_type: payload.device_type,
			device_name: payload.device_name ?? null,
			hardware_name: payload.hardware_name ?? null,
			generation: payload.generation ?? null,
			platform: payload.platform ?? detectPlatform(),
			event: payload.event,
			reason: payload.reason ?? null,
			solve_count: payload.solve_count ?? null,
			last_serial: payload.last_serial ?? null,
			extra: payload.extra ? safeStringify(payload.extra) : null,
		};

		// Never await — telemetry runs alongside the connection flow, not in front of it.
		gqlMutateTyped(LogSmartDeviceEventDocument, {input}).catch(() => {
			/* swallow: a dropped telemetry packet must not surface to the user */
		});
	} catch {
		/* swallow: building/sending the event must never disrupt BLE logic */
	}
}

function safeStringify(value: Record<string, unknown>): string | null {
	try {
		return JSON.stringify(value);
	} catch {
		return null;
	}
}
