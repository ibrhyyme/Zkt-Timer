import { gql } from '@apollo/client';
import { SessionInput, SolveInput } from '../../../../../@types/generated/graphql';
import { gqlMutate } from '../../../../api';

export interface ImportProgress {
	type: 'sessions' | 'solves';
	currentChunk: number;
	totalChunks: number;
	itemsProcessed: number;
	totalItems: number;
	percentComplete: number;
}

export interface ChunkedImportResult {
	successCount: number;
	failureCount: number;
	errors: Array<{
		chunkIndex: number;
		itemRange: string;
		error: string;
	}>;
}

type ProgressCallback = (progress: ImportProgress) => void;

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
	const CHUNK_SIZE = 100;
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
	const CHUNK_SIZE = 100; // User preference: conservative approach
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
				chunkIndex: i,
				itemRange: `${startIdx + 1}-${endIdx}`,
				error: error.message || String(error),
			});
		}
	}

	return result;
}
