import {COUNTRY_TO_CONTINENT} from '../../shared/wca_geo';

export interface RecordCandidate {
	eventId: string;
	tag: string; // 'WR' | 'CR' | 'NR'
	personCountryIso2?: string;
}

export interface WatchRule {
	events: string[];
	scope: string; // 'WR' | 'CR' | 'NR'
	region: string; // NR -> country iso2, CR -> continent id, WR -> ''
}

// WCA tags each record with the single highest applicable scope (WR > CR > NR).
// So a Turkish world record carries tag 'WR', yet it is also that person's NR and
// their continent's CR. Sub-scopes therefore match all higher tags.
const TAG_RANK: Record<string, number> = {WR: 3, CR: 2, NR: 1};

/**
 * Does a record watch rule fire for a given competition record?
 *
 * - WR watch: only a world record (tag === 'WR'), any country.
 * - CR watch: a WR or CR set by a person whose continent equals the watched continent.
 * - NR watch: a WR, CR, or NR set by a person of the watched country.
 */
export function watchMatchesRecord(watch: WatchRule, rec: RecordCandidate): boolean {
	if (!watch.events.includes(rec.eventId)) return false;

	const recRank = TAG_RANK[rec.tag] || 0;
	if (recRank === 0) return false;

	if (watch.scope === 'WR') {
		return rec.tag === 'WR';
	}

	if (watch.scope === 'CR') {
		if (recRank < TAG_RANK.CR) return false; // only WR/CR qualify as a CR
		const continent = rec.personCountryIso2 ? COUNTRY_TO_CONTINENT[rec.personCountryIso2] : undefined;
		return !!continent && continent === watch.region;
	}

	if (watch.scope === 'NR') {
		// WR/CR/NR all qualify as an NR (recRank >= 1 always true here)
		return !!rec.personCountryIso2 && rec.personCountryIso2 === watch.region;
	}

	return false;
}
