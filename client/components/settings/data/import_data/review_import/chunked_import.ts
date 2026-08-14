import { gql } from '@apollo/client';
import { SessionInput, SolveInput } from '../../../../../@types/generated/graphql';
import { gqlMutate, gqlQuery } from '../../../../api';

/**
 * Content fingerprints of everything already stored server-side, so the importer
 * can drop rows the account already has.
 *
 * Returns null when the check could not run. That distinction matters: an empty
 * set means "you have nothing stored, import everything", while a failed request
 * means "we do not know", and silently treating the latter as the former is what
 * would let a duplicate import through unnoticed.
 */
export async function fetchServerSolveFingerprints(): Promise<Set<string> | null> {
	const query = gql`
		query Query {
			mySolveFingerprints
		}
	`;

	try {
		const res = await gqlQuery<{ mySolveFingerprints: string[] }>(query);
		const list = res.data?.mySolveFingerprints;
		if (!list) return null;
		return new Set(list);
	} catch (e) {
		console.error('[Import] Could not fetch server fingerprints:', e);
		return null;
	}
}

export interface ImportProgress {
	type: 'sessions' | 'solves';
	currentChunk: number;
	totalChunks: number;
	itemsProcessed: number;
	totalItems: number;
	percentComplete: number;
}

export interface ChunkError {
	type: 'sessions' | 'solves';
	chunkIndex: number;
	itemRange: string;
	error: string;
}

export interface ChunkedImportResult {
	successCount: number;
	failureCount: number;
	errors: ChunkError[];
}

type ProgressCallback = (progress: ImportProgress) => void;

export const CHUNK_SIZE = 100;

// Helper: Split array into chunks
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

// Import sessions in chunks
export async function importSessionsInChunks(
	sessions: SessionInput[],
	onProgress: ProgressCallback
): Promise<ChunkedImportResult> {
	const chunks = chunkArray(sessions, CHUNK_SIZE);
	const totalChunks = chunks.length;

	const result: ChunkedImportResult = {
		successCount: 0,
		failureCount: 0,
		errors: [],
	};

	const query = gql`
		mutation Mutate($sessions: [SessionInput]) {
			bulkCreateSessions(sessions: $sessions)
		}
	`;

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const startIdx = i * CHUNK_SIZE;
		const endIdx = startIdx + chunk.length;

		console.log(`[Sessions] Processing chunk ${i + 1}/${totalChunks} (items ${startIdx + 1}-${endIdx})`, chunk);

		try {
			const response = await gqlMutate(query, { sessions: chunk });
			console.log(`[Sessions] Chunk ${i + 1} response:`, response);
			result.successCount++;

			// Report progress
			onProgress({
				type: 'sessions',
				currentChunk: i + 1,
				totalChunks,
				itemsProcessed: endIdx,
				totalItems: sessions.length,
				percentComplete: Math.round((endIdx / sessions.length) * 100),
			});
		} catch (error) {
			console.error(`[Sessions] Chunk ${i + 1} failed:`, error);
			result.failureCount++;
			result.errors.push({
				type: 'sessions',
				chunkIndex: i,
				itemRange: `${startIdx + 1}-${endIdx}`,
				error: error.message || String(error),
			});
		}
	}

	return result;
}

// Import solves in chunks
export async function importSolvesInChunks(
	solves: SolveInput[],
	onProgress: ProgressCallback
): Promise<ChunkedImportResult> {
	const chunks = chunkArray(solves, CHUNK_SIZE);
	const totalChunks = chunks.length;

	const result: ChunkedImportResult = {
		successCount: 0,
		failureCount: 0,
		errors: [],
	};

	const query = gql`
		mutation Mutate($solves: [SolveInput]) {
			bulkCreateSolves(solves: $solves)
		}
	`;

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const startIdx = i * CHUNK_SIZE;
		const endIdx = startIdx + chunk.length;

		console.log(`[Solves] Processing chunk ${i + 1}/${totalChunks} (items ${startIdx + 1}-${endIdx})`);

		try {
			const response = await gqlMutate(query, { solves: chunk });
			console.log(`[Solves] Chunk ${i + 1} response:`, response);
			result.successCount++;

			// Report progress
			onProgress({
				type: 'solves',
				currentChunk: i + 1,
				totalChunks,
				itemsProcessed: endIdx,
				totalItems: solves.length,
				percentComplete: Math.round((endIdx / solves.length) * 100),
			});
		} catch (error) {
			console.error(`[Solves] Chunk ${i + 1} failed:`, error);
			result.failureCount++;
			result.errors.push({
				type: 'solves',
				chunkIndex: i,
				itemRange: `${startIdx + 1}-${endIdx}`,
				error: error.message || String(error),
			});
		}
	}

	return result;
}
