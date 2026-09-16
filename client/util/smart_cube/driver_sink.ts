/**
 * Where the cube protocol drivers send what they hear.
 *
 * The drivers' base class (bluetooth/smart_cube.js) needs to reach the connection manager,
 * and the manager builds the drivers through bluetooth/connect.js. Importing the manager
 * from the base class directly would close that loop into a module cycle, and in a cycle
 * whichever file happens to load first decides whether `class GAN extends SmartCube` sees
 * a class or `undefined`. This file has no imports, so it can sit in the middle of that
 * loop safely: the manager registers itself here when it is created, the base class looks
 * it up here when a driver speaks.
 *
 * Only the manager creates Connect, so by the time any driver calls in, the sink is set.
 */

export interface SmartCubeDriverSink {
	handleScanning(): void;
	handleConnecting(): void;
	handleScanError(message: string): void;
	handleConnected(cube: any, server: any): Promise<void>;
	handleLinkLost(): void;
	handleBattery(level: number): void;
	handleGyroSupported(supported: boolean): void;
	handleMove(move: string): void;
	handleMoveBatch(moves: any[], facelets?: string | null): void;
	handleFacelets(facelets: string): void;
}

let sink: SmartCubeDriverSink | null = null;

export function setSmartCubeDriverSink(next: SmartCubeDriverSink | null): void {
	sink = next;
}

export function getSmartCubeDriverSink(): SmartCubeDriverSink | null {
	return sink;
}
