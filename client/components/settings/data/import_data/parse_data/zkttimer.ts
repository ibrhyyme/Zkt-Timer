import { v4 as uuid } from 'uuid';
import { IImportDataContext, ImportableData } from '../ImportData';
import { Session } from '../../../../../@types/generated/graphql';
import { fetchSessions } from '../../../../../db/sessions/query';
import { parseZktTimerLegacyData } from './zkttimer_legacy';
import { Solve } from '../../../../../../server/schemas/Solve.schema';
import { normalizeBucketForImport } from './normalize-bucket';

interface ZktTimerExportSchema {
	solves: Solve[];
	sessions: Session[];
}

export function parseZktTimerData(txt: string, context: IImportDataContext): ImportableData {
	const currentSessions = fetchSessions();
	let importedData: ZktTimerExportSchema;

	try {
		importedData = JSON.parse(txt);

		// Checking for legacy version
		if (!importedData.sessions && (importedData as any).timer) {
			return parseZktTimerLegacyData(txt, context);
		}
	} catch (e) {
		throw new Error('Invalid import file. Please make sure this is a valid file exported from Zkt Timer');
	}

	const sessions = [];

	const oldNewSessionMap: Record<string, string> = {};
	for (const session of importedData.sessions) {
		const newSession: Session = {
			id: uuid(),
			name: session.name,
		};

		if (session.order !== undefined) {
			newSession.order = currentSessions.length + session.order;
		}

		oldNewSessionMap[session.id] = newSession.id;
		sessions.push(newSession);
	}

	const result = getUpdatedSolves(importedData.solves, oldNewSessionMap);

	return {
		sessions,
		solves: result.solves,
		skippedSolveCount: result.skippedCount || undefined,
		skippedCubeTypes: Object.keys(result.skippedTypes).length ? result.skippedTypes : undefined,
	};
}

function getUpdatedSolves(solves: Solve[], oldNewSessionMap: Record<string, string>) {
	const newSolves: Solve[] = [];
	let skippedCount = 0;
	const skippedTypes: Record<string, number> = {};

	for (const solve of solves) {
		const sessionId = solve.session_id;
		const trainerName = solve.trainer_name;

		if (!sessionId && !trainerName) {
			continue;
		}

		delete solve.bulk;
		delete solve.from_timer;
		delete solve.created_at;

		if (trainerName) {
			delete solve.session_id;
		} else {
			const newSessionId = oldNewSessionMap[sessionId];
			if (newSessionId) {
				solve.session_id = newSessionId;
			} else {
				throw new Error(
					'There is a solve in this data that is not associated with a session. Terminating import.'
				);
			}
		}

		// Modern Zkt-Timer export'larinda cube_type='wca' ve scramble_subset zaten dolu;
		// legacy/orphan kayitlari (cube_type='wca' subset=null veya eski variant ID) WCA bucket'ina normalize et.
		if (!solve.scramble_subset || solve.cube_type !== 'wca') {
			const normalized = normalizeBucketForImport(solve.cube_type);
			if (!normalized) {
				const key = solve.cube_type || 'unknown';
				skippedTypes[key] = (skippedTypes[key] || 0) + 1;
				skippedCount++;
				continue;
			}
			solve.cube_type = normalized.cube_type;
			solve.scramble_subset = normalized.scramble_subset;
		}

		newSolves.push(solve);
	}

	return { solves: newSolves, skippedCount, skippedTypes };
}
