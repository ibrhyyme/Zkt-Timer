import {IImportDataContext, ImportableData} from '../ImportData';
import {v4 as uuid, v5 as uuidv5} from 'uuid';
import {SessionInput, SolveInput} from '../../../../../@types/generated/graphql';
import {normalizeBucketForImport} from './normalize-bucket';

// Namespace UUID for csTimer sessions (randomly generated, constant for this app)
const CSTIMER_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// csTimer scrType -> Zkt-Timer flat WCA event ID.
// Tum WCA varyantlari (oh/bld/fm/mirror/cll/eg/method-trainer'lar) parent event'e duser.
// normalizeBucketForImport bu degeri WCA bucket'ina (cube_type='wca' + subset) cevirir.
// Burada OLMAYAN scrType -> session skip + raporlanir.
const CSTIMER_ZKTTIMER_CUBETYPE_MAP: Record<string, string> = {
	// 3x3 ve tum 3x3 method/varyantlari -> 333
	'333': '333',
	'333wca': '333',
	'333o': '333',
	'333oh': '333',
	'333ft': '333',
	'333fm': '333',
	'333bf': '333',
	'333bld': '333',
	'333ni': '333',
	'333mbld': '333',
	'333noob': '333',
	'333mirror': '333',
	lsemu: '333',
	lsll: '333',
	cll: '333',
	ll: '333',
	pll: '333',
	oll: '333',
	eo: '333',
	roux: '333',
	f2l: '333',
	cmll: '333',
	cmll2: '333',

	// 2x2 ve tum varyantlari -> 222
	'222': '222',
	'222o': '222',
	'222so': '222',
	'222nb': '222',
	'222oh': '222',
	'222eg': '222',
	'222eg0': '222',
	'222eg1': '222',
	'222eg2': '222',
	'222tcll': '222',
	'222cll': '222',
	'222lbl': '222',
	'2223': '222',

	// 4x4 -> 444
	'444': '444',
	'444wca': '444',
	'444m': '444',
	'444yj': '444',
	'444bld': '444',
	'444bl': '444',
	'4edge': '444',

	// 5x5 -> 555
	'555': '555',
	'555wca': '555',
	'555bld': '555',
	'555bl': '555',
	'5edge': '555',

	// 6x6 -> 666
	'666': '666',
	'666wca': '666',
	'666p': '666',
	'666s': '666',
	'666si': '666',
	'6edge': '666',

	// 7x7 -> 777
	'777': '777',
	'777wca': '777',
	'777p': '777',
	'777s': '777',
	'777si': '777',
	'7edge': '777',

	// Megaminx ailesi -> minx
	mgmp: 'minx',
	mgmo: 'minx',
	mgmc: 'minx',
	mgms2l: 'minx',
	klmso: 'minx',
	klmp: 'minx',
	mlsll: 'minx',
	minx2g: 'minx',

	// Pyraminx ailesi -> pyraminx
	pyrso: 'pyraminx',
	pyro: 'pyraminx',
	pyrm: 'pyraminx',
	pyrl4e: 'pyraminx',
	pyr4c: 'pyraminx',
	pyrnb: 'pyraminx',
	mpyr: 'pyraminx',
	mpyrso: 'pyraminx',

	// Skewb ailesi -> skewb
	skbso: 'skewb',
	skbo: 'skewb',
	skb: 'skewb',
	skbnb: 'skewb',

	// Square-1 ailesi -> sq1
	sqrs: 'sq1',
	sq1t: 'sq1',
	sq1h: 'sq1',
	sqrcsp: 'sq1',
	sq1pll: 'sq1',
	sq2: 'sq1',
	ssq1t: 'sq1',
	bsq: 'sq1',

	// Clock ailesi -> clock
	clkwca: 'clock',
	clkwcab: 'clock',
	clknf: 'clock',
	clk: 'clock',
	clko: 'clock',
	clkc: 'clock',
	clke: 'clock',
};

// Penalty (-1 = DNF, 2000 = +2), Solve Time
type CsTimerSolveTime = [number, number];

// Solve Time, Scramble, Notes, Started At
type CsTimerSolve = [CsTimerSolveTime, string, string, number];

interface CsTimerSession {
	id: string;
	key: string;
	name: string;
	rank: number;
	cubeType: string;
	// Tanimadigimiz cube_type ile gelen sezonlar — solve'lari import'a dahil edilmez.
	skip?: boolean;
	scrambleSubset?: string | null;
	originalCubeType?: string;
}

interface CsTimerProperties {
	sessionData: CsTimerSession[];
	useIns: string;
	input: string;
	color: string;
	scrFlt: string;
	session: string | number;
	srcType: string;
}

export function parseCsTimerData(txt: string, context: IImportDataContext): ImportableData {
	const csTimerData = parseAndValidateInput(txt);
	const properties = getCsTimerProperties(csTimerData);

	// Tanimlanmamis cube_type'li sezonlari ayikla — solve'lari import'a girmez.
	const skippedCubeTypes: Record<string, number> = {};
	let skippedSolveCount = 0;
	const validSessions: CsTimerSession[] = [];
	for (const ses of properties.sessionData) {
		if (ses.skip) {
			const csSolves = csTimerData[`session${ses.key}`] || [];
			skippedSolveCount += csSolves.length;
			const key = ses.originalCubeType || 'unknown';
			skippedCubeTypes[key] = (skippedCubeTypes[key] || 0) + csSolves.length;
			continue;
		}
		validSessions.push(ses);
	}

	const solves = getAllSolves(csTimerData, validSessions);
	const sessions = getSessionInputFromCsTimerSessionData(validSessions);

	console.log('[csTimer Parse] Parsed data summary:', {
		sessionCount: sessions.length,
		solveCount: solves.length,
		skippedSolveCount,
		skippedCubeTypes,
	});

	// CubePicker'da kullanici-yuzlu WCA event ID'sini goster (333/222/444...).
	// updateSessionCubeType bunu normalize edip cube_type='wca' + subset yapar.
	const sessionIdCubeTypeMap = {};
	for (const session of validSessions) {
		sessionIdCubeTypeMap[session.id] = session.scrambleSubset ?? session.cubeType;
	}

	const sessionIds = new Set(sessions.map(s => s.id));
	const orphanSolves = solves.filter(solve => !sessionIds.has(solve.session_id));
	if (orphanSolves.length > 0) {
		console.error('[csTimer Parse] Found orphan solves without valid session_id:', orphanSolves.length);
	}

	return {
		solves,
		sessions,
		sessionIdCubeTypeMap,
		skippedSolveCount: skippedSolveCount || undefined,
		skippedCubeTypes: Object.keys(skippedCubeTypes).length ? skippedCubeTypes : undefined,
	};
}

function getSessionInputFromCsTimerSessionData(sessionData: CsTimerSession[]): SessionInput[] {
	return sessionData.map((ses) => ({
		id: ses.id,
		name: ses.name,
		order: ses.rank,
	}));
}

function parseAndValidateInput(txt: string) {
	let data: Record<string, any>;

	if (typeof txt === 'string') {
		try {
			data = JSON.parse(txt);
		} catch (e) {
			throw new Error('Invalid input. Could not parse csTimer data.');
		}
	} else if (typeof txt === 'object') {
		data = txt;
	} else {
		throw new Error('Invalid input. Could not parse csTimer data.');
	}

	if (!data.properties) {
		throw new Error('Invalid input. csTimer data is missing required properties.');
	}

	return data;
}

function getCsTimerProperties(data: Record<string, any>): CsTimerProperties {
	const props = data.properties;
	const sessionData = getSessionData(props.sessionData);

	return {
		...props,
		sessionData,
	};
}

function getSessionData(sesData: string | object) {
	let sessionData = sesData;
	if (typeof sesData === 'string') {
		sessionData = JSON.parse(sesData);
	}

	const sessionInput: CsTimerSession[] = [];
	const sessionKeys = Object.keys(sessionData);
	for (const sessionId of sessionKeys) {
		const ses = sessionData[sessionId];

		const srcType = ses?.opt?.scrType;
		const deterministicId = uuidv5(`cstimer-session-${sessionId}`, CSTIMER_NAMESPACE);

		// srcType var ama haritada yok -> WCA disi puzzle (gear/fto/relay/15p vs). Skip.
		if (srcType && !CSTIMER_ZKTTIMER_CUBETYPE_MAP[srcType]) {
			sessionInput.push({
				id: deterministicId,
				key: String(sessionId),
				name: String(ses.name),
				rank: ses.rank,
				cubeType: srcType,
				originalCubeType: srcType,
				skip: true,
			});
			continue;
		}

		// srcType undefined (opt:{}) -> '333' default; kullanici ReviewImport'ta override edebilir.
		const mappedFlat = srcType ? CSTIMER_ZKTTIMER_CUBETYPE_MAP[srcType] : '333';
		const normalized = normalizeBucketForImport(mappedFlat);

		if (!normalized) {
			// Bu noktaya gelmemeli (haritadaki tum degerler WCA event); savunma amacli skip.
			sessionInput.push({
				id: deterministicId,
				key: String(sessionId),
				name: String(ses.name),
				rank: ses.rank,
				cubeType: mappedFlat,
				originalCubeType: srcType || mappedFlat,
				skip: true,
			});
			continue;
		}

		sessionInput.push({
			id: deterministicId,
			key: String(sessionId),
			name: String(ses.name),
			rank: ses.rank,
			cubeType: normalized.cube_type,
			scrambleSubset: normalized.scramble_subset,
		});
	}

	return sessionInput;
}

function getAllSolves(data: Record<string, CsTimerSolve[]>, sessionData: CsTimerProperties['sessionData']) {
	const solves: SolveInput[] = [];
	for (const session of sessionData) {
		const sessionKey = `session${session.key}`;
		const csSolves: CsTimerSolve[] = data[sessionKey] || [];

		for (const solve of csSolves) {
			const input = getSolveInputFromCsTimerSolve(solve, session);
			solves.push(input);
		}
	}

	return solves;
}

function getSolveInputFromCsTimerSolve(csSolve: CsTimerSolve, session: CsTimerSession): SolveInput {
	// Handle solve time
	const solveTime = csSolve[0];
	const penalty = solveTime[0];
	let rawTime = solveTime[1];
	const plusTwo = penalty === 2000;
	const dnf = penalty === -1;
	let time = rawTime;

	// Handle scramble
	let scramble = csSolve[1];
	scramble = scramble.replace(/\s+/g, ' ');
	scramble = scramble.trim();

	// Handle notes
	const notes = csSolve[2] || '';

	// Handle start time
	const startTime = Number(csSolve[3]) * 1000;
	const endTime = startTime + rawTime;

	rawTime /= 1000;
	time /= 1000;

	if (plusTwo) {
		time += 2;
	} else if (dnf) {
		time = -1;
	}

	return {
		time,
		raw_time: rawTime,
		plus_two: plusTwo,
		dnf,
		scramble,
		cube_type: session.cubeType,
		scramble_subset: session.scrambleSubset ?? null,
		session_id: session.id,
		notes,
		started_at: startTime,
		ended_at: endTime,
	};
}
