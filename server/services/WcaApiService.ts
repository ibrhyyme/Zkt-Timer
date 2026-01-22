import axios from 'axios';
import { Integration } from '../schemas/Integration.schema';

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

export interface WcaPerson {
	wca_id: string;
	name: string;
	country_iso2: string;
	personal_records: Record<string, WcaPersonalRecord>;
}

export class WcaApiService {
	private static readonly BASE_URL = 'https://www.worldcubeassociation.org/api/v0';

	/**
	 * Fetch person data from WCA API using WCA ID
	 */
	static async fetchPersonData(wcaId: string): Promise<WcaPerson | null> {
		try {
			const response = await axios.get(`${this.BASE_URL}/persons/${wcaId}`);
			return response.data;
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
}
