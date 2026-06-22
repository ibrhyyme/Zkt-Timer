/**
 * OLLCP recognition mode — data + view types.
 * Data is pre-generated at build time (scripts/generate-ollcp-trainer-data.mjs) into
 * public/trainer/ollcp-recognition.json; see ollcp/data.ts.
 */

export type OllcpView = 'list' | 'detail' | 'train';

export interface OllcpCheck {
	/** Human-readable relational comparison, e.g. "Ön far" or "ön-sol köşe = kenar". */
	text: string;
	/** true → the comparison is a match (rendered green). */
	on: boolean;
}

export interface OllcpVariant {
	/** Display label, e.g. "#3". */
	n: string;
	algorithm: string;
	/** 21-char LL pattern (top 9 + F/R/B/L strips) for LLPatternView. */
	pattern: string;
	/** Move count of the OLLCP alg (ETM-ish). */
	moves: number;
	/** Priority tier vs the plain OLL alg: 1=Önce (cheap), 2=Orta, 3=Sonra (expensive). */
	prioTier: 1 | 2 | 3;
	prioLabel: string;
	/** Per-OLL discriminator answers for this variant. */
	checks: OllcpCheck[];
}

export interface OllcpScramble {
	/** Real WCA-style scramble (white bottom / yellow top). */
	s: string;
	/** Which variant (1..6) this scramble produces. */
	v: number;
}

export interface OllcpOll {
	/** 21-char LL pattern for the OLL orientation shape. */
	shape: string;
	/** What to look at to tell the 6 apart (generic labels). */
	checkList: string[];
	variants: OllcpVariant[];
	/** Pooled scrambles across all 6 variants (random → random variant). */
	scrambles: OllcpScramble[];
}

export type OllcpData = Record<string, OllcpOll>;
