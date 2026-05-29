import { IImportDataContext, ImportableData } from '../ImportData';
import { parseCsTimerData } from './cstimer';

// CubeTime's JSON export is identical to csTimer format — delegate to parseCsTimerData.
// CSV export doesn't carry session/cube_type/penalty info so we don't support it; if user
// accidentally uploads CSV, show clear redirect message (otherwise csTimer parser says 'invalid file', confusing).
export function parseCubeTimeData(txt: string, context: IImportDataContext): ImportableData {
	const firstLine = txt.split(/\r?\n/, 1)[0]?.trim().toLowerCase() ?? '';

	const looksLikeCsv =
		firstLine.startsWith('time,') ||
		firstLine === 'time,comment,scramble,date' ||
		firstLine.includes('time,comment,scramble');

	if (looksLikeCsv) {
		throw new Error('CUBETIME_CSV_NOT_SUPPORTED');
	}

	return parseCsTimerData(txt, context);
}
