/**
 * Cube brands the app can talk to, each with the name prefixes it advertises over BLE.
 *
 * Two consumers read this: `_deviceOptions.nameFilters` in `connect.js` is derived from
 * it, so the scanner cannot drift, and the help page renders the brand names as its list
 * of supported cubes. That list used to be typed out by hand in five translation files
 * and had already fallen five brands behind the routing table.
 *
 * It lives in its own module, with no imports, so the help page can name the cubes
 * without pulling the whole BLE stack (protocol classes, crypto, native adapters) into a
 * server-rendered page.
 *
 * The routing table in `createCubeForDevice` matches the same prefixes but is still
 * written out by hand, because each branch picks a different protocol class: add a brand
 * here and a branch there in the same change.
 */
export const SUPPORTED_SMART_CUBE_BRANDS: {brand: string; prefixes: string[]}[] = [
	{brand: 'GAN', prefixes: ['GAN', 'Gan', 'gan']},
	{brand: 'Monster Go', prefixes: ['MG']},
	{brand: 'AiCube', prefixes: ['AiCube']},
	{brand: 'Giiker', prefixes: ['Gi', 'Hi-']},
	{brand: 'Xiaomi', prefixes: ['Mi Smart Magic Cube']},
	{brand: 'GoCube', prefixes: ['GoCube']},
	{brand: "Rubik's Connected", prefixes: ['Rubiks']},
	{brand: 'MoYu', prefixes: ['MHC', 'WCU_MY3']},
	{brand: 'QiYi', prefixes: ['QY-QYSC', 'XMD-TornadoV4-i']},
];

/** Flat prefix list for the BLE scanners. Both adapters treat it as an unordered set. */
export const SMART_CUBE_NAME_PREFIXES = SUPPORTED_SMART_CUBE_BRANDS.flatMap((entry) => entry.prefixes);
