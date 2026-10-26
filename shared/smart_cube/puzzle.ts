// Which puzzle a smart cube is, read from the name it advertises over Bluetooth.
//
// Every smart cube the app knows is a 3x3 except two 2x2 models, and both carry their size
// in the name: the GAN 251 UI (cstimer gancube.js `is251`, smartcube-web-bluetooth
// `isGan251Device`) and the MoYu Weipo V5 AI (WCU_MY22, smartcube-web-bluetooth moyu32.ts).
//
// Shared by the drivers (key, frame and packet layout), the connection manager, Online Battle
// (which only takes a 3x3) and the server (the My Cubes row a connected cube gets). Keep it
// import free.

export type SmartCubePuzzle = '333' | '222';

/** GAN 251 UI. cstimer's pattern: the owner's cube advertises "GAN251Ui_..." and "GANic251...". */
export function isGan251Name(name: string | null | undefined): boolean {
	return /^gan(?:251ui|ic251)/i.test(name || '');
}

/** MoYu Weipo V5 AI. It shares the WCU_MY3x protocol but packs a 2x2 state. */
export function isMoyuMy22Name(name: string | null | undefined): boolean {
	return (name || '').trim().startsWith('WCU_MY22');
}

export function smartCubePuzzleFromName(name: string | null | undefined): SmartCubePuzzle {
	return isGan251Name(name) || isMoyuMy22Name(name) ? '222' : '333';
}
