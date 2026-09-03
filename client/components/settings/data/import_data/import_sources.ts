/**
 * The apps Zkt Timer can import a backup from.
 *
 * Its own module, with no imports, so the help page can list the supported sources
 * without pulling the parsers and the import UI into a server-rendered page. `ImportData`
 * re-exports both names, so nothing else had to change.
 *
 * Add a source here and the help page picks it up on its own; the hand-written list it
 * replaced had been three sources long since CubeTime shipped.
 */
export enum ImportDataType {
	CS_TIMER,
	ZKT_TIMER,
	TWISTY_TIMER,
	CUBE_TIME,
}

// DataSettings.tsx openModal title'inda kullaniyor — kaynak app ismi.
export const IMPORT_TYPE_NAMES: Record<ImportDataType, string> = {
	[ImportDataType.CS_TIMER]: 'csTimer',
	[ImportDataType.ZKT_TIMER]: 'Zkt Timer',
	[ImportDataType.TWISTY_TIMER]: 'Twisty Timer',
	[ImportDataType.CUBE_TIME]: 'CubeTime',
};
