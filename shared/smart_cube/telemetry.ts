/**
 * Smart cube / BLE timer connection telemetry — shared client+server contract.
 *
 * Records connect / disconnect / error events so we can see, server-side, who connects
 * a smart device and WHY their connection drops. Disconnect events carry a reason code
 * (the whole point: distinguishing a clean manual disconnect from a buffer overflow,
 * a wrong-MAC handshake timeout, or a GATT-level drop).
 *
 * Kept dependency-free (no Node/DOM imports) per the shared-workspace rule.
 */

/** High-level lifecycle event. */
export type SmartDeviceEvent = 'connect' | 'disconnect' | 'error';

/**
 * Why a connection ended (or an error fired). Stable string codes — they are written to
 * the DB and filtered in the admin panel, so do not rename without a data migration.
 */
export type SmartDisconnectReason =
	| 'manual' // user pressed disconnect
	| 'timer_type_change' // switched away from smart-cube timer type
	| 'wrong_mac' // handshake watchdog: packets never decrypted (bad MAC)
	| 'handshake_timeout' // handshake watchdog fired without the proof packet (HARDWARE)
	| 'buffer_overflow' // Gen4 move buffer grew past the safety limit -> forced teardown
	| 'buffer_overflow_recovered' // same condition, but recovered via FACELETS resync (no teardown)
	| 'gatt_self' // device/firmware/OS dropped the GATT link on its own
	| 'notify_fail' // could not subscribe to BLE notifications
	| 'unknown';

/** Which client surface produced the event. */
export type SmartDevicePlatform = 'web' | 'ios' | 'android';

/**
 * Payload sent from the client logger to the `logSmartDeviceEvent` mutation.
 * Mirrors the SmartDeviceLog Prisma model (minus server-derived fields: id, user_email, created_at).
 */
export interface SmartDeviceEventPayload {
	/** Protocol family: 'gan' | 'qiyi_timer' | 'qiyi' | 'moyu' | 'moyu32' | 'giiker' | 'particula' | ... */
	device_type: string;
	/** Advertised BLE name (e.g. "GAN12uiM"). */
	device_name?: string | null;
	/** Name reported in the HARDWARE handshake, when available. */
	hardware_name?: string | null;
	/** GAN generation: 'gen2' | 'gen3' | 'gen4'. Null for non-GAN devices. */
	generation?: string | null;
	platform: SmartDevicePlatform;
	event: SmartDeviceEvent;
	/** Required for disconnect/error events; omit for connect. */
	reason?: SmartDisconnectReason | null;
	/** Solves completed in this connection session (helps spot "drops after N solves"). */
	solve_count?: number | null;
	/** Last Gen4 move serial seen — useful for the 255->0 wrap bug. */
	last_serial?: number | null;
	/** Free-form debug context: buffer_len, hw_version, sw_version, error message, etc. */
	extra?: Record<string, unknown> | null;
}
