/**
 * Readable names for the phone models stored with a magnet calibration (My Cubes, cube profile;
 * design .feedback/designs/magnet-cubes.md 5.3).
 *
 * The stored key is `<manufacturer> <model>` from the Capacitor Device plugin (the same helper as
 * the magnet telemetry). On iOS the model is the machine identifier ("Apple iPhone16,1"), which
 * nobody recognises, so the common iPhones are mapped here. Anything else is shown as stored:
 * Android model codes ("samsung SM-F956B") and unknown identifiers stay exactly what the admin
 * page shows, so the two can be matched.
 *
 * When the Device plugin is missing from an iOS build the key falls back to the screen
 * ("Apple screen-393x852@3", design 9.1); that one reads as "iPhone (393 x 852)".
 */

const IPHONE_NAMES: Record<string, string> = {
	'iPhone10,1': 'iPhone 8',
	'iPhone10,4': 'iPhone 8',
	'iPhone10,2': 'iPhone 8 Plus',
	'iPhone10,5': 'iPhone 8 Plus',
	'iPhone10,3': 'iPhone X',
	'iPhone10,6': 'iPhone X',
	'iPhone11,2': 'iPhone XS',
	'iPhone11,4': 'iPhone XS Max',
	'iPhone11,6': 'iPhone XS Max',
	'iPhone11,8': 'iPhone XR',
	'iPhone12,1': 'iPhone 11',
	'iPhone12,3': 'iPhone 11 Pro',
	'iPhone12,5': 'iPhone 11 Pro Max',
	'iPhone12,8': 'iPhone SE (2nd gen)',
	'iPhone13,1': 'iPhone 12 mini',
	'iPhone13,2': 'iPhone 12',
	'iPhone13,3': 'iPhone 12 Pro',
	'iPhone13,4': 'iPhone 12 Pro Max',
	'iPhone14,4': 'iPhone 13 mini',
	'iPhone14,5': 'iPhone 13',
	'iPhone14,2': 'iPhone 13 Pro',
	'iPhone14,3': 'iPhone 13 Pro Max',
	'iPhone14,6': 'iPhone SE (3rd gen)',
	'iPhone14,7': 'iPhone 14',
	'iPhone14,8': 'iPhone 14 Plus',
	'iPhone15,2': 'iPhone 14 Pro',
	'iPhone15,3': 'iPhone 14 Pro Max',
	'iPhone15,4': 'iPhone 15',
	'iPhone15,5': 'iPhone 15 Plus',
	'iPhone16,1': 'iPhone 15 Pro',
	'iPhone16,2': 'iPhone 15 Pro Max',
	'iPhone17,1': 'iPhone 16 Pro',
	'iPhone17,2': 'iPhone 16 Pro Max',
	'iPhone17,3': 'iPhone 16',
	'iPhone17,4': 'iPhone 16 Plus',
	'iPhone17,5': 'iPhone 16e',
	'iPhone18,1': 'iPhone 17 Pro',
	'iPhone18,2': 'iPhone 17 Pro Max',
	'iPhone18,3': 'iPhone 17',
	'iPhone18,4': 'iPhone Air',
};

const SCREEN_KEY = /^screen-(\d+)x(\d+)(?:@[\d.]+)?$/;

/** A stored calibration model key in words. Never throws; an empty key comes back empty. */
export function deviceModelDisplayName(deviceModel: string | null | undefined): string {
	const raw = (deviceModel || '').trim();
	if (!raw) return '';

	// "Apple iPhone16,1" -> "iPhone16,1"; the manufacturer adds nothing once the name says iPhone.
	const model = raw.replace(/^apple\s+/i, '');
	const known = IPHONE_NAMES[model];
	if (known) return known;

	const screen = SCREEN_KEY.exec(model);
	if (screen) return `iPhone (${screen[1]} x ${screen[2]})`;

	return raw;
}
