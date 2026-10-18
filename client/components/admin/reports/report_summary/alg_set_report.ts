import {
	ALG_SET_MODERATION,
	AlgSetReportReason,
	isAlgSetReportReason,
} from '../../../../../shared/trainer/alg_sets';

export interface ParsedAlgSetReport {
	/** Known reason key, or null when the stored reason is not one of ALG_SET_REPORT_REASONS. */
	reason: AlgSetReportReason | null;
	/** The reason key exactly as stored, shown raw when it is unknown. */
	rawReason: string;
	/** Free text note the reporter wrote, '' when there is none. */
	note: string;
}

/**
 * Report.reason for a trainer set report is written by reportAlgSet as
 * `alg_set:<reason>` or `alg_set:<reason>: <note>` (trainer-sets 4.2). Returns null for any
 * other report so profile reports keep rendering their reason text unchanged.
 */
export function parseAlgSetReportReason(reason: string | null | undefined): ParsedAlgSetReport | null {
	if (typeof reason !== 'string') return null;
	const prefix = ALG_SET_MODERATION.REPORT_REASON_PREFIX;
	if (!reason.startsWith(prefix)) return null;

	const rest = reason.slice(prefix.length);
	const sep = rest.indexOf(':');
	const rawReason = (sep === -1 ? rest : rest.slice(0, sep)).trim();
	const note = sep === -1 ? '' : rest.slice(sep + 1).trim();

	return {
		reason: isAlgSetReportReason(rawReason) ? rawReason : null,
		rawReason,
		note,
	};
}

export type AlgSetHiddenSource = 'auto' | 'admin' | 'other';

/** Where a hide came from: the 3 report auto hide, an admin without a reason, or a written reason. */
export function algSetHiddenSource(hiddenReason: string | null | undefined): AlgSetHiddenSource {
	if (hiddenReason === ALG_SET_MODERATION.AUTO_HIDE_REASON) return 'auto';
	if (!hiddenReason || hiddenReason === 'admin') return 'admin';
	return 'other';
}
