import {gql} from '@apollo/client';
import {gqlQuery, gqlMutate} from '../../api';

// Untyped inline operations (daily-goal style). The RecordWatch types are not in
// the committed schema.graphql yet (regenerated on server restart), so we avoid
// putting these ops in client/graphql/*.graphql to keep graphql-codegen green.

export interface RecordWatchEntry {
	id: string;
	events: string[];
	scope: string; // 'WR' | 'CR' | 'NR'
	region: string;
	enabled: boolean;
	created_at: string;
}

export interface SaveRecordWatchInput {
	events: string[];
	scope: string;
	region?: string;
}

const WATCH_FIELDS = `
	id
	events
	scope
	region
	enabled
	created_at
`;

export async function fetchRecordWatches(): Promise<RecordWatchEntry[]> {
	const res = await gqlQuery<{myRecordWatches: RecordWatchEntry[]}>(
		gql`
			query MyRecordWatches {
				myRecordWatches {
					${WATCH_FIELDS}
				}
			}
		`
	);
	return res.data?.myRecordWatches || [];
}

export async function saveRecordWatch(input: SaveRecordWatchInput): Promise<RecordWatchEntry> {
	const res = await gqlMutate<{saveRecordWatch: RecordWatchEntry}>(
		gql`
			mutation SaveRecordWatch($input: SaveRecordWatchInput!) {
				saveRecordWatch(input: $input) {
					${WATCH_FIELDS}
				}
			}
		`,
		{input}
	);
	return res.data?.saveRecordWatch;
}

export async function setRecordWatchEnabled(id: string, enabled: boolean): Promise<void> {
	await gqlMutate(
		gql`
			mutation SetRecordWatchEnabled($id: String!, $enabled: Boolean!) {
				setRecordWatchEnabled(id: $id, enabled: $enabled) {
					id
					enabled
				}
			}
		`,
		{id, enabled}
	);
}

export interface RecentRecordEntry {
	id: string;
	tag: string;
	type: string; // 'single' | 'average'
	eventId: string;
	eventName: string;
	attemptResult: number;
	personName: string;
	personCountryIso2?: string;
	competitionId?: string;
	competitionName: string;
	roundNumber?: number;
}

export async function fetchRecentRecords(): Promise<RecentRecordEntry[]> {
	const res = await gqlQuery<{wcaRecentRecords: RecentRecordEntry[]}>(
		gql`
			query WcaRecentRecords {
				wcaRecentRecords {
					id
					tag
					type
					eventId
					eventName
					attemptResult
					personName
					personCountryIso2
					competitionId
					competitionName
					roundNumber
				}
			}
		`
	);
	return res.data?.wcaRecentRecords || [];
}

export async function deleteRecordWatch(id: string): Promise<void> {
	await gqlMutate(
		gql`
			mutation DeleteRecordWatch($id: String!) {
				deleteRecordWatch(id: $id)
			}
		`,
		{id}
	);
}

// Admin-only: send yourself a sample record notification to preview how it looks.
export async function sendTestRecordNotification(locale: string): Promise<void> {
	await gqlMutate(
		gql`
			mutation SendTestRecordNotification($locale: String) {
				sendTestRecordNotification(locale: $locale)
			}
		`,
		{locale}
	);
}
