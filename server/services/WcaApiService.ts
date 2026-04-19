import axios from 'axios';
import { Integration } from '../schemas/Integration.schema';
import { RedisNamespace, createRedisKey, fetchDataFromCache } from './redis';

export interface WcaPersonalRecord {
	single?: {
		best: number;
		world_rank: number;
		continent_rank: number;
		country_rank: number;
	};
	average?: {
		best: number;
		world_rank: number;
		continent_rank: number;
		country_rank: number;
	};
}

export interface WcaMedals {
	gold: number;
	silver: number;
	bronze: number;
	total: number;
}

export interface WcaRecordCounts {
	national: number;
	continental: number;
	world: number;
	total: number;
}

export interface WcaPerson {
	wca_id: string;
	name: string;
	country_iso2: string;
	personal_records: Record<string, WcaPersonalRecord>;
	competition_count: number;
	medals: WcaMedals;
	records: WcaRecordCounts;
}

export class WcaApiService {
	private static readonly BASE_URL = 'https://www.worldcubeassociation.org/api/v0';

	/**
	 * Fetch person data from WCA API using WCA ID
	 */
	static async fetchPersonData(wcaId: string): Promise<WcaPerson | null> {
		try {
			const response = await axios.get(`${this.BASE_URL}/persons/${wcaId}`);
			const data = response.data;
			// WCA API response: {person: {name, country_iso2, ...}, personal_records: {...}, ...}
			// Flatten person fields into top level for our interface
			return {
				...data,
				wca_id: data.person?.wca_id || wcaId,
				name: data.person?.name || '',
				country_iso2: data.person?.country_iso2 || data.person?.country?.iso2 || '',
			};
		} catch (error) {
			console.error(`Failed to fetch WCA person data for ${wcaId}:`, error.message);
			return null;
		}
	}

	/**
	 * Fetch WCA records for a user using their integration
	 */
	static async fetchWcaRecordsForUser(integration: Integration): Promise<WcaPerson | null> {
		if (!integration.wca_id) {
			throw new Error('User does not have a WCA ID');
		}

		return this.fetchPersonData(integration.wca_id);
	}

	/**
	 * Format WCA time from centiseconds to readable format
	 * @param centiseconds Time in centiseconds (e.g., 1234 = 12.34 seconds)
	 */
	static formatTime(centiseconds: number): string {
		if (!centiseconds) return '—';

		const minutes = Math.floor(centiseconds / 6000);
		const seconds = Math.floor((centiseconds % 6000) / 100);
		const cs = centiseconds % 100;

		if (minutes > 0) {
			return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
		} else {
			return `${seconds}.${cs.toString().padStart(2, '0')}`;
		}
	}

	/**
	 * Get supported WCA events (cube types that we want to show)
	 */
	static getSupportedEvents(): string[] {
		return [
			'333',    // 3x3x3 Cube
			'222',    // 2x2x2 Cube
			'444',    // 4x4x4 Cube
			'555',    // 5x5x5 Cube
			'666',    // 6x6x6 Cube
			'777',    // 7x7x7 Cube
			'333bf',  // 3x3x3 Blindfolded
			'333fm',  // 3x3x3 Fewest Moves
			'333oh',  // 3x3x3 One-Handed
			'333ft',  // 3x3x3 With Feet
			'minx',   // Megaminx
			'pyram',  // Pyraminx
			'clock',  // Clock
			'skewb',  // Skewb
			'sq1',    // Square-1
			'444bf',  // 4x4x4 Blindfolded
			'555bf',  // 5x5x5 Blindfolded
			'333mbf'  // 3x3x3 Multi-Blind
		];
	}

	/**
	 * Events used for Kinch/SoR ranking calculations.
	 * Excludes deprecated: 333ft, 333mbo, magic, mmagic
	 */
	static getRankingEvents(): string[] {
		return [
			'333', '222', '444', '555', '666', '777',
			'333bf', '333fm', '333oh',
			'minx', 'pyram', 'clock', 'skewb', 'sq1',
			'444bf', '555bf', '333mbf',
		];
	}

	/**
	 * Events where Kinch uses best-of single/average (BLD + FMC)
	 */
	static getBestOfEvents(): string[] {
		return ['333bf', '444bf', '555bf', '333fm'];
	}


	/**
	 * Hardcoded fallback WRs (centiseconds, FMC=moves, MBLD=encoded).
	 * Kullanim: DB'deki world_record tablosu bos/eksik oldugunda (ilk deploy, sync hatasi).
	 * Prod'da asil kaynak: WorldRecordSyncService haftalik sync ile DB'yi doldurur.
	 */
	static getWorldRecords(): Record<string, { single: number; average: number }> {
		return {
			'333': { single: 276, average: 384 },
			'222': { single: 39, average: 86 },
			'444': { single: 1518, average: 1856 },
			'555': { single: 3045, average: 3431 },
			'666': { single: 5769, average: 6504 },
			'777': { single: 9348, average: 9686 },
			'333bf': { single: 1167, average: 1405 },
			'333fm': { single: 16, average: 1933 },
			'333oh': { single: 566, average: 772 },
			'minx': { single: 2199, average: 2438 },
			'pyram': { single: 73, average: 114 },
			'clock': { single: 153, average: 224 },
			'skewb': { single: 73, average: 137 },
			'sq1': { single: 340, average: 463 },
			'444bf': { single: 5196, average: 5939 },
			'555bf': { single: 11859, average: 14763 },
			'333mbf': { single: 930058230065, average: 0 },
		};
	}

	/**
	 * Approximate max competitor counts per event (for SoR missing-event penalty).
	 */
	static getMaxRanks(): Record<string, { single: number; average: number }> {
		return {
			'333': { single: 250000, average: 200000 },
			'222': { single: 120000, average: 100000 },
			'444': { single: 80000, average: 65000 },
			'555': { single: 50000, average: 40000 },
			'666': { single: 20000, average: 18000 },
			'777': { single: 18000, average: 15000 },
			'333bf': { single: 15000, average: 5000 },
			'333fm': { single: 12000, average: 5000 },
			'333oh': { single: 70000, average: 55000 },
			'minx': { single: 40000, average: 30000 },
			'pyram': { single: 80000, average: 65000 },
			'clock': { single: 30000, average: 25000 },
			'skewb': { single: 50000, average: 40000 },
			'sq1': { single: 30000, average: 25000 },
			'444bf': { single: 3000, average: 500 },
			'555bf': { single: 1500, average: 300 },
			'333mbf': { single: 5000, average: 0 },
		};
	}

	/**
	 * Get WR + max rank data for ranking calculations.
	 * WRs DB'den (WorldRecordSyncService tarafindan haftalik guncellenir); eksikse hardcode fallback.
	 */
	static async fetchRankingData(): Promise<{
		worldRecords: Record<string, { single: number; average: number }>;
		maxRanks: Record<string, { single: number; average: number }>;
	}> {
		const { getWorldRecordsFromDb } = require('./WorldRecordSyncService');
		const hardcoded = this.getWorldRecords();
		let dbRecords: Record<string, { single: number; average: number }> = {};
		try {
			dbRecords = await getWorldRecordsFromDb();
		} catch (err) {
			console.error('[WcaApiService] Failed to read world_record from DB, using hardcoded fallback:', err);
		}

		// Event basinda DB degeri gecerliyse onu kullan, yoksa hardcode'a dus
		const merged: Record<string, { single: number; average: number }> = {};
		const allEvents = new Set([...Object.keys(hardcoded), ...Object.keys(dbRecords)]);
		for (const event of allEvents) {
			const db = dbRecords[event];
			const hc = hardcoded[event];
			merged[event] = {
				single: db?.single || hc?.single || 0,
				average: db?.average || hc?.average || 0,
			};
		}

		return {
			worldRecords: merged,
			maxRanks: this.getMaxRanks(),
		};
	}

	/**
	 * Fetch upcoming WCA competitions (parallel pages)
	 */
	static async fetchUpcomingCompetitions(countryIso2?: string): Promise<any[]> {
		try {
			// Bu ayin basindan itibaren cek (bitmis ama bu aydaki yarismalar da gorunsun)
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const startFrom = monthStart.toISOString().split('T')[0];

			const PER_PAGE = 100;
			const MAX_PAGES = 5;

			const baseParams: Record<string, any> = {
				start: startFrom,
				sort: 'start_date',
				per_page: PER_PAGE,
			};

			if (countryIso2) {
				baseParams.country_iso2 = countryIso2;
			}

			// Sayfa 1'i cek, toplam sayfa sayisini hesapla
			const firstRes = await axios.get(`${this.BASE_URL}/competitions`, {
				params: { ...baseParams, page: 1 },
				timeout: 15000,
			});

			const firstPage: any[] = firstRes.data || [];
			const totalHeader = firstRes.headers['total'];
			const total = totalHeader ? parseInt(totalHeader, 10) : firstPage.length;
			const totalPages = Math.min(Math.ceil(total / PER_PAGE), MAX_PAGES);

			if (totalPages <= 1) {
				return firstPage.filter((c: any) => !c.cancelled_at);
			}

			// Kalan sayfalari paralel cek
			const pagePromises = [];
			for (let p = 2; p <= totalPages; p++) {
				pagePromises.push(
					axios.get(`${this.BASE_URL}/competitions`, {
						params: { ...baseParams, page: p },
						timeout: 15000,
					}).then((r) => r.data || [])
				);
			}

			const restPages = await Promise.all(pagePromises);
			const allCompetitions = [firstPage, ...restPages].flat();

			return allCompetitions.filter((c: any) => !c.cancelled_at);
		} catch (error) {
			// Hatayı yutup [] dondurmek tehlikeli — client bunu "gercekten bos" sanip
			// "bulunamadi" gosteriyor. Throw ederek client'in gercek hata UI'i acmasini saglayalim.
			console.error('[WCA API] fetchUpcomingCompetitions error:', error.message);
			throw new Error(`WCA API fetch failed: ${error.message}`);
		}
	}

	/**
	 * Map WCA event codes to readable names (Turkish)
	 */
	static getEventName(eventCode: string): string {
		const eventNames: Record<string, string> = {
			'333': '3x3x3',
			'222': '2x2x2',
			'444': '4x4x4',
			'555': '5x5x5',
			'666': '6x6x6',
			'777': '7x7x7',
			'333bf': '3x3x3 Gözü Kapalı',
			'333fm': '3x3x3 En Az Hamle',
			'333oh': '3x3x3 Tek El',
			'333ft': '3x3x3 Ayakla',
			'minx': 'Megaminx',
			'pyram': 'Pyraminx',
			'clock': 'Clock',
			'skewb': 'Skewb',
			'sq1': 'Square-1',
			'444bf': '4x4x4 Gözü Kapalı',
			'555bf': '5x5x5 Gözü Kapalı',
			'333mbf': '3x3x3 Çoklu Gözü Kapalı'
		};

		return eventNames[eventCode] || eventCode;
	}

	/**
	 * Bildirim ve kisa goruntuleme icin kisaltilmis event isimleri.
	 * "3x3x3 Cube" yerine "3x3", "3x3x3 One-Handed" yerine "3x3 OH" vs.
	 */
	static getShortEventName(eventCode: string): string {
		const shortNames: Record<string, string> = {
			'333': '3x3',
			'222': '2x2',
			'444': '4x4',
			'555': '5x5',
			'666': '6x6',
			'777': '7x7',
			'333bf': '3x3 BLD',
			'333fm': 'FMC',
			'333oh': '3x3 OH',
			'333ft': '3x3 Ayak',
			'minx': 'Megaminx',
			'pyram': 'Pyraminx',
			'clock': 'Clock',
			'skewb': 'Skewb',
			'sq1': 'Square-1',
			'444bf': '4x4 BLD',
			'555bf': '5x5 BLD',
			'333mbf': 'MBLD',
		};

		return shortNames[eventCode] || eventCode;
	}

	/**
	 * Fetch public WCIF data for a competition
	 */
	static async fetchCompetitionWcif(competitionId: string): Promise<any | null> {
		try {
			const response = await axios.get(`${this.BASE_URL}/competitions/${competitionId}/wcif/public`, {
				timeout: 15000,
			});
			return response.data;
		} catch (error) {
			console.error(`Failed to fetch WCIF for competition ${competitionId}:`, error.message);
			return null;
		}
	}

	/**
	 * Fetch user's registered competitions using OAuth token
	 * Uses /api/v0/competitions/mine endpoint
	 */
	static async fetchMyCompetitions(authToken: string): Promise<any[]> {
		try {
			const response = await axios.get(`${this.BASE_URL}/competitions/mine`, {
				headers: { Authorization: `Bearer ${authToken}` },
				timeout: 15000,
			});
			const data = response.data;
			const comps = [
				...(data?.future_competitions || []),
				...(data?.ongoing_competitions || []),
			];
			return comps.filter((c: any) => !c['cancelled?']);
		} catch (error) {
			console.error('Failed to fetch my competitions:', error.message);
			return [];
		}
	}

	/**
	 * Search WCA competitions by name (includes past competitions)
	 */
	static async searchCompetitions(query: string): Promise<any[]> {
		try {
			const response = await axios.get(`${this.BASE_URL}/competitions`, {
				params: { q: query, sort: '-start_date', per_page: 25 },
				timeout: 15000,
			});
			return (response.data || []).filter((c: any) => !c.cancelled_at);
		} catch (error) {
			console.error(`Failed to search WCA competitions:`, error.message);
			return [];
		}
	}

	/**
	 * Fetch all competition results for a person
	 */
	static async fetchPersonResults(wcaId: string): Promise<any[]> {
		try {
			const response = await axios.get(`${this.BASE_URL}/persons/${wcaId}/results`);
			return response.data || [];
		} catch (error) {
			console.error(`Failed to fetch WCA results for ${wcaId}:`, error.message);
			return [];
		}
	}

	/**
	 * Fetch all competitions a person attended
	 */
	static async fetchPersonCompetitions(wcaId: string): Promise<any[]> {
		try {
			const response = await axios.get(`${this.BASE_URL}/persons/${wcaId}/competitions`);
			return response.data || [];
		} catch (error) {
			console.error(`Failed to fetch WCA competitions for ${wcaId}:`, error.message);
			return [];
		}
	}

	/**
	 * Map round type IDs to readable names
	 */
	static getRoundName(roundTypeId: string): string {
		const roundNames: Record<string, string> = {
			'1': 'First Round',
			'2': 'Second Round',
			'3': 'Third Round',
			'f': 'Final',
			'c': 'Combined Final',
			'd': 'Combined First',
			'e': 'Combined Second',
		};
		return roundNames[roundTypeId] || roundTypeId;
	}
}
