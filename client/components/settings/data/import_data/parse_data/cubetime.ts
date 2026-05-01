import { IImportDataContext, ImportableData } from '../ImportData';
import { parseCsTimerData } from './cstimer';

// CubeTime'in JSON export'u csTimer formatiyla birebir ayni — parseCsTimerData'ya delege ediyoruz.
// CSV export'u session/cube_type/penalty bilgisi tasimadigi icin desteklemiyoruz; kullanici yanlislikla
// CSV yuklerse net bir yonlendirme mesaji veriyoruz (yoksa csTimer parser'i 'invalid file' der, kafa karistirici).
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
