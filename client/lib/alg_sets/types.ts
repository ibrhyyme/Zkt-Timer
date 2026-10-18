/**
 * Algorithm set types of the client (trainer-sets 4.1, 9.3).
 *
 * The generated GraphQL types make every field optional; api.ts turns a response into these
 * normalized shapes once, so the screens, the device cache and the study engine never deal with
 * `null | undefined` per field.
 *
 * OWNERSHIP: opened by T4 with the study engine part (StudySet, loadSetForStudy), owned by T5
 * since (client/lib/alg_sets/).
 */
import type {AlgSetVisibility} from '../../../shared/trainer/alg_sets';

/** One set row as the study engine needs it (a subset of AlgSetItemData). */
export interface StudySetItem {
	category: string;
	case_name: string;
	subset: string;
	/** The owner's algorithm for the case, stored exactly as written. */
	algorithm: string;
	position: number;
}

/** A set ready to study: its identity, who shares it, and every row. */
export interface StudySet {
	id: string;
	code: string;
	name: string;
	owner_name: string;
	is_owner: boolean;
	items: StudySetItem[];
}

export interface AlgSetItemData extends StudySetItem {
	id: string;
	puzzle: string;
}

export interface AlgSetOwnerData {
	id: string;
	username: string;
	verified: boolean;
	/** Storage path of the profile picture; getStorageURL() makes the URL. */
	avatar_path: string | null;
}

/** A set without its rows (lists, cards). */
export interface AlgSetSummaryData {
	id: string;
	code: string;
	name: string;
	description: string | null;
	visibility: AlgSetVisibility;
	item_count: number;
	save_count: number;
	categories: string[];
	puzzles: string[];
	/** First rows by position, for the card thumbnails. */
	preview: AlgSetItemData[];
	owner: AlgSetOwnerData;
	published_at: string | null;
	updated_at: string;
	created_at: string;
	/** Hidden by moderation; only ever true for the owner (and staff). */
	hidden: boolean;
}

/** A set with every row and the caller's relation to it. */
export interface AlgSetData extends AlgSetSummaryData {
	items: AlgSetItemData[];
	is_owner: boolean;
	is_saved: boolean;
}

/** One entry of "Saved": the set, or a note that it is no longer shared. */
export interface SavedAlgSetData {
	set_id: string;
	saved_at: string | null;
	/** The owner made it private or it was hidden; `set` is null then (no name leaks). */
	unavailable: boolean;
	set: AlgSetSummaryData | null;
}

export interface MyAlgSetsData {
	own: AlgSetSummaryData[];
	saved: SavedAlgSetData[];
}

export interface CommunityAlgSetPageData {
	items: AlgSetSummaryData[];
	total: number;
	has_more: boolean;
}

export {loadSetForStudy} from './loader';
