import {IImportDataContext, ImportableData} from '../ImportData';
import {v4 as uuid, v5 as uuidv5} from 'uuid';
import {SessionInput, SolveInput} from '../../../../../@types/generated/graphql';
import {normalizeBucketForImport} from './normalize-bucket';

// Namespace UUID for csTimer sessions (randomly generated, constant for this app)
const CSTIMER_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const CSTIMER_ZKTTIMER_CUBETYPE_MAP = {
	'333': '333',
	'333wca': '333',
	'222': '222',
	'222so': '222',
	'444': '444',
	'444wca': '444',
	'555': '555',
	'555wca': '555',
	'666': '666',
	'666wca': '666',
	'777': '777',
	'777wca': '777',
	'333ni': '333',
	'333fm': '333',
	'333bf': '333',
	'333oh': '333',
	'333ft': '333',
	clkwca: 'clock',
	mgmp: 'minx',
	pyrso: 'pyraminx',
	ksbso: 'skewb',
	mgmc: 'minx',
	mgmo: 'minx',
	pyro: 'pyraminx',
	pyrm: 'pyraminx',
	pyrl4e: 'pyraminx',
	pyr4c: 'pyraminx',
	pyrnb: 'pyraminx',
	'444yj': '444',
	'444m': '444',
	'222o': '222',
	'2223': '222',
	'222eg': '222',
	'222eg0': '222',
	'222eg1': '222',
	'5edge': '555',
	'222eg2': '222',
	'666si': '666',
	'666p': '666',
	'666s': '666',
	'6edge': '666',
	'777si': '777',
	'777p': '777',
	'777s': '777',
	'7edge': '777',
	skbso: 'skewb',
	skbo: 'skewb',
	skb: 'skewb',
	skbnb: 'skewb',
	sq1t: 'sq1',
	sq1h: 'sq1',
	sqrcsp: 'sq1',
	sqrs: 'sq1',
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

	const sessionIdCubeTypeMap = {};
	for (const session of validSessions) {
		sessionIdCubeTypeMap[session.id] = session.cubeType;
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
		const mappedFlat = srcType && CSTIMER_ZKTTIMER_CUBETYPE_MAP[srcType] ? CSTIMER_ZKTTIMER_CUBETYPE_MAP[srcType] : '333';

		const normalized = normalizeBucketForImport(mappedFlat);

		const deterministicId = uuidv5(`cstimer-session-${sessionId}`, CSTIMER_NAMESPACE);

		if (!normalized) {
			// Tanimlanmamis cube_type — sezonu skip isaretle, solve'lari import'a girmez.
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
