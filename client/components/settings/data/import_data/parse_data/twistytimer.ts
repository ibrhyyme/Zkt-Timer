import { v4 as uuid } from 'uuid';
import { IImportDataContext, ImportableData } from '../ImportData';
import { SolveInput } from '../../../../../@types/generated/graphql';
import { normalizeBucketForImport } from './normalize-bucket';
import { detectCubeTypeFromScramble } from './detect-cube-type';

const TWISTY_TIMER_CUBETYPE_MAP: Record<string, string> = {
	'222': '222',
	'333': '333',
	'444': '444',
	'555': '555',
	'666': '666',
	'777': '777',
	mega: 'minx',
	pyra: 'pyraminx',
	skewb: 'skewb',
	clock: 'clock',
	sq1: 'sq1',
};

// Filename pattern: Solves_{puzzleType}_{puzzleName}_{date}_{time}.txt
const FILENAME_REGEX = /^Solves_(\w+)_(.+?)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.txt$/;

/**
 * Parse Twisty Timer time string to seconds.
 * Formats: "9.45" → 9.45, "1:23.45" → 83.45
 */
function parseTimeString(timeStr: string): number {
	if (timeStr.includes(':')) {
		const [minutes, seconds] = timeStr.split(':');
		return parseFloat(minutes) * 60 + parseFloat(seconds);
	}

	return parseFloat(timeStr);
}

/**
 * Parse a single CSV line with semicolon delimiter and quote wrapping.
 * Returns array of unquoted field values.
 */
function parseLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ';' && !inQuotes) {
			fields.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	fields.push(current);
	return fields;
}

function getCubeTypeFromFilename(filename: string): { cubeType: string; puzzleName: string } | null {
	const match = filename.match(FILENAME_REGEX);
	if (!match) return null;

	const ttCode = match[1].toLowerCase();
	const puzzleName = match[2];
	const cubeType = TWISTY_TIMER_CUBETYPE_MAP[ttCode];

	if (!cubeType) return null;

	return { cubeType, puzzleName };
}

export function parseTwistyTimerData(txt: string, context: IImportDataContext): ImportableData {
	const lines = txt.split('\n').filter((line) => line.trim().length > 0);

	if (lines.length === 0) {
		throw new Error('Empty file. No solves found.');
	}

	// 1) Once tum satirlari parse et — scramble detect icin ilk gecerli scramble'a ihtiyacimiz var
	type ParsedRow = { rawTime: number; scramble: string; isDnf: boolean; startedAt: number; endedAt: number };
	const rows: ParsedRow[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fields = parseLine(line);

		if (fields.length < 3) {
			console.warn(`[TwistyTimer] Skipping invalid line ${i + 1}: expected at least 3 fields, got ${fields.length}`);
			continue;
		}

		const timeStr = fields[0];
		const scramble = fields[1].replace(/\s+/g, ' ').trim();
		const dateStr = fields[2];
		const penalty = fields[3]?.trim();

		const isDnf = penalty === 'DNF';
		const rawTime = parseTimeString(timeStr);

		if (isNaN(rawTime)) {
			console.warn(`[TwistyTimer] Skipping line ${i + 1}: invalid time "${timeStr}"`);
			continue;
		}

		const startedAt = new Date(dateStr).getTime();
		const endedAt = startedAt + rawTime * 1000;

		rows.push({ rawTime, scramble, isDnf, startedAt, endedAt });
	}

	if (rows.length === 0) {
		throw new Error('No valid solves found in Twisty Timer file.');
	}

	// 2) Cube type tespit oncelik sirasi:
	//    a) Kullanici context'te belirtmis -> mutlak oncelik
	//    b) Filename pattern (Solves_222_2x2_..._.txt) -> guvenilir
	//    c) Ilk solve'un scramble'indan auto-detect
	//    d) Hepsi basarisiz -> '333' default (kullanici CubePicker ile override edebilir)
	let cubeType: string | null = null;
	let puzzleName = '3x3';

	if (context.cubeType) {
		cubeType = context.cubeType;
	} else if (context.file?.name) {
		const fileInfo = getCubeTypeFromFilename(context.file.name);
		if (fileInfo) {
			cubeType = fileInfo.cubeType;
			puzzleName = fileInfo.puzzleName;
		}
	}

	if (!cubeType) {
		// Ilk birkac satira bakip detect — tek satir hatali olabilir
		for (let i = 0; i < Math.min(rows.length, 5); i++) {
			const detected = detectCubeTypeFromScramble(rows[i].scramble);
			if (detected) {
				cubeType = detected;
				break;
			}
		}
	}

	const finalCubeType = cubeType || '333';

	// WCA bucket'ina normalize et
	const normalized = normalizeBucketForImport(finalCubeType);
	if (!normalized) {
		const skippedCount = rows.length;
		return {
			solves: [],
			sessions: [],
			skippedSolveCount: skippedCount,
			skippedCubeTypes: { [finalCubeType]: skippedCount },
		};
	}

	const sessionId = uuid();
	const sessionName = `Twisty Timer - ${puzzleName}`;

	const solves: SolveInput[] = rows.map(r => ({
		time: r.isDnf ? -1 : r.rawTime,
		raw_time: r.rawTime,
		plus_two: false,
		dnf: r.isDnf,
		scramble: r.scramble,
		cube_type: normalized.cube_type,
		scramble_subset: normalized.scramble_subset,
		session_id: sessionId,
		started_at: r.startedAt,
		ended_at: r.endedAt,
	}));

	console.log(`[TwistyTimer] Parsed ${solves.length} solves (bucket: ${normalized.cube_type}/${normalized.scramble_subset}, source: ${cubeType ? 'detected' : 'default'})`);

	// sessionIdCubeTypeMap set et -> ReviewImport CubePicker render eder, kullanici override edebilir.
	// Picker WCA event ID'sini gosterir (333/222/444/...), updateSessionCubeType normalize eder.
	const sessionIdCubeTypeMap: Record<string, string> = {
		[sessionId]: normalized.scramble_subset ?? finalCubeType,
	};

	return {
		solves,
		sessions: [
			{
				id: sessionId,
				name: sessionName,
				order: 0,
			},
		],
		sessionIdCubeTypeMap,
	};
}
