/**
 * Algorithm set requests (trainer-sets 4.2), through the generated typed documents of
 * client/graphql/alg_sets.graphql. Every response is normalized here (types.ts), so callers get
 * plain non null fields.
 *
 * Request count matters (reference_graphql_request_cost): nothing here runs on app start. My Sets
 * asks once when its tab opens, a set page once, Community once per page.
 */
import {gqlMutateTyped, gqlQueryTyped} from '../../components/api';
import {
	AddAlgSetItemsDocument,
	AlgSetDocument,
	CommunityAlgSetsDocument,
	CreateAlgSetDocument,
	DeleteAlgSetDocument,
	MyAlgSetsDocument,
	RemoveAlgSetItemsDocument,
	ReorderAlgSetItemsDocument,
	ReportAlgSetDocument,
	ResetAlgSetCodeDocument,
	SaveAlgSetDocument,
	UnsaveAlgSetDocument,
	UpdateAlgSetDocument,
	UpdateAlgSetItemDocument,
} from '../../@types/generated/graphql';
import {isAlgSetVisibility, DEFAULT_ALG_SET_VISIBILITY} from '../../../shared/trainer/alg_sets';
import type {AlgSetVisibility, AlgSetCommunitySort, AlgSetReportReason} from '../../../shared/trainer/alg_sets';
import type {
	AlgSetData,
	AlgSetItemData,
	AlgSetOwnerData,
	AlgSetSummaryData,
	CommunityAlgSetPageData,
	MyAlgSetsData,
	SavedAlgSetData,
} from './types';

// ── Normalizers ──────────────────────────────────────────────────────────

type Maybe<T> = T | null | undefined;

function str(value: Maybe<string>): string {
	return typeof value === 'string' ? value : '';
}

function num(value: Maybe<number>): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function strList(values: Maybe<Array<Maybe<string>>>): string[] {
	return (values || []).filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function toItem(raw: any, index = 0): AlgSetItemData {
	return {
		id: str(raw?.id),
		category: str(raw?.category),
		case_name: str(raw?.case_name),
		subset: str(raw?.subset),
		puzzle: str(raw?.puzzle),
		algorithm: str(raw?.algorithm),
		position: typeof raw?.position === 'number' ? raw.position : index,
	};
}

function toItems(raw: Maybe<any[]>): AlgSetItemData[] {
	return (raw || [])
		.filter(Boolean)
		.map((item, i) => toItem(item, i))
		.filter((item) => item.category && item.case_name && item.algorithm)
		.sort((a, b) => a.position - b.position);
}

function toOwner(raw: any): AlgSetOwnerData {
	return {
		id: str(raw?.id),
		username: str(raw?.username),
		verified: !!raw?.verified,
		avatar_path: raw?.avatar_path || null,
	};
}

function toVisibility(value: Maybe<string>): AlgSetVisibility {
	return isAlgSetVisibility(value) ? value : DEFAULT_ALG_SET_VISIBILITY;
}

function toDate(value: unknown): string | null {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

export function toSummary(raw: any): AlgSetSummaryData {
	return {
		id: str(raw?.id),
		code: str(raw?.code),
		name: str(raw?.name),
		description: raw?.description || null,
		visibility: toVisibility(raw?.visibility),
		item_count: num(raw?.item_count),
		save_count: num(raw?.save_count),
		categories: strList(raw?.categories),
		puzzles: strList(raw?.puzzles),
		preview: toItems(raw?.preview),
		owner: toOwner(raw?.owner),
		published_at: toDate(raw?.published_at),
		updated_at: toDate(raw?.updated_at) || '',
		created_at: toDate(raw?.created_at) || '',
		hidden: !!raw?.hidden,
	};
}

export function toSet(raw: any, items?: AlgSetItemData[]): AlgSetData {
	return {
		...toSummary(raw),
		items: items || toItems(raw?.items),
		is_owner: !!raw?.is_owner,
		is_saved: !!raw?.is_saved,
	};
}

function toSaved(raw: any): SavedAlgSetData {
	const unavailable = !!raw?.unavailable || !raw?.set;
	return {
		set_id: str(raw?.set_id),
		saved_at: toDate(raw?.saved_at),
		unavailable,
		set: unavailable ? null : toSummary(raw.set),
	};
}

// ── Errors ───────────────────────────────────────────────────────────────

function firstExtensions(err: any): Record<string, any> | null {
	return err?.graphQLErrors?.[0]?.extensions || err?.extensions || null;
}

/** The set is gone, private, hidden, or the code is wrong: the server says the same for all. */
export function isAlgSetNotFound(err: any): boolean {
	const ext = firstExtensions(err);
	return ext?.code === 'NOT_FOUND' && (!ext?.i18nKey || ext.i18nKey === 'alg_set_errors.not_found');
}

/** `category::case_name` of every case addAlgSetItems refused (extensions.rejected). */
export function rejectedCases(err: any): string[] {
	const rejected = firstExtensions(err)?.rejected;
	return Array.isArray(rejected) ? rejected.filter((r) => typeof r === 'string') : [];
}

export function errorI18nKey(err: any): string | null {
	const key = firstExtensions(err)?.i18nKey;
	return typeof key === 'string' && key ? key : null;
}

// ── Queries ──────────────────────────────────────────────────────────────

export async function fetchMyAlgSets(): Promise<MyAlgSetsData> {
	const res = await gqlQueryTyped(MyAlgSetsDocument, {}, {fetchPolicy: 'no-cache'});
	const data = res?.data?.myAlgSets;
	return {
		own: (data?.own || []).filter(Boolean).map(toSummary),
		saved: (data?.saved || []).filter(Boolean).map(toSaved),
	};
}

export async function fetchAlgSet(code: string): Promise<AlgSetData> {
	const res = await gqlQueryTyped(AlgSetDocument, {code}, {fetchPolicy: 'no-cache'});
	const set = res?.data?.algSet;
	if (!set) throw Object.assign(new Error('NOT_FOUND'), {extensions: {code: 'NOT_FOUND'}});
	return toSet(set);
}

export interface CommunityQuery {
	q?: string | null;
	sort?: AlgSetCommunitySort;
	puzzle?: string | null;
	category?: string | null;
	page?: number;
	page_size?: number;
}

export async function fetchCommunityAlgSets(query: CommunityQuery): Promise<CommunityAlgSetPageData> {
	const res = await gqlQueryTyped(
		CommunityAlgSetsDocument,
		{
			q: query.q || null,
			sort: query.sort || 'new',
			puzzle: query.puzzle || null,
			category: query.category || null,
			page: query.page || 0,
			page_size: query.page_size || null,
		},
		{fetchPolicy: 'no-cache'}
	);
	const page = res?.data?.communityAlgSets;
	return {
		items: (page?.items || []).filter(Boolean).map(toSummary),
		total: num(page?.total),
		has_more: !!page?.has_more,
	};
}

// ── Mutations ────────────────────────────────────────────────────────────

export interface AlgSetTextInput {
	name?: string;
	description?: string | null;
	visibility?: AlgSetVisibility;
}

export async function createAlgSet(input: AlgSetTextInput & {name: string}): Promise<AlgSetData> {
	const res = await gqlMutateTyped(CreateAlgSetDocument, {
		input: {name: input.name, description: input.description ?? null, visibility: input.visibility || null},
	});
	return toSet(res?.data?.createAlgSet);
}

/** Returns the set head (no rows); the caller keeps its own rows. */
export async function updateAlgSet(id: string, input: AlgSetTextInput, rows: AlgSetItemData[] = []): Promise<AlgSetData> {
	const res = await gqlMutateTyped(UpdateAlgSetDocument, {
		id,
		input: {
			...(input.name !== undefined ? {name: input.name} : {}),
			...(input.description !== undefined ? {description: input.description} : {}),
			...(input.visibility !== undefined ? {visibility: input.visibility} : {}),
		},
	});
	return toSet(res?.data?.updateAlgSet, rows);
}

export async function deleteAlgSet(id: string): Promise<boolean> {
	const res = await gqlMutateTyped(DeleteAlgSetDocument, {id});
	return !!res?.data?.deleteAlgSet;
}

export async function resetAlgSetCode(id: string, rows: AlgSetItemData[] = []): Promise<AlgSetData> {
	const res = await gqlMutateTyped(ResetAlgSetCodeDocument, {id});
	return toSet(res?.data?.resetAlgSetCode, rows);
}

export interface AlgSetItemInputData {
	category: string;
	case_name: string;
	algorithm: string;
}

export async function addAlgSetItems(setId: string, items: AlgSetItemInputData[]): Promise<AlgSetData> {
	const res = await gqlMutateTyped(AddAlgSetItemsDocument, {set_id: setId, items});
	return toSet(res?.data?.addAlgSetItems);
}

export async function updateAlgSetItem(itemId: string, algorithm: string): Promise<AlgSetItemData> {
	const res = await gqlMutateTyped(UpdateAlgSetItemDocument, {item_id: itemId, algorithm});
	return toItem(res?.data?.updateAlgSetItem);
}

export async function removeAlgSetItems(setId: string, itemIds: string[]): Promise<AlgSetData> {
	const res = await gqlMutateTyped(RemoveAlgSetItemsDocument, {set_id: setId, item_ids: itemIds});
	return toSet(res?.data?.removeAlgSetItems);
}

export async function reorderAlgSetItems(setId: string, itemIds: string[]): Promise<AlgSetData> {
	const res = await gqlMutateTyped(ReorderAlgSetItemsDocument, {set_id: setId, item_ids: itemIds});
	return toSet(res?.data?.reorderAlgSetItems);
}

export async function saveAlgSet(setId: string): Promise<boolean> {
	const res = await gqlMutateTyped(SaveAlgSetDocument, {set_id: setId});
	return !!res?.data?.saveAlgSet;
}

export async function unsaveAlgSet(setId: string): Promise<boolean> {
	const res = await gqlMutateTyped(UnsaveAlgSetDocument, {set_id: setId});
	return !!res?.data?.unsaveAlgSet;
}

export async function reportAlgSet(setId: string, reason: AlgSetReportReason, note?: string | null): Promise<boolean> {
	const res = await gqlMutateTyped(ReportAlgSetDocument, {set_id: setId, reason, note: note || null});
	return !!res?.data?.reportAlgSet;
}
