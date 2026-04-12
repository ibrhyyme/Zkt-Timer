import {WcaApiService} from './WcaApiService';

/**
 * WcaRecord shape from Prisma (subset of fields we need)
 */
interface WcaRecordRow {
	wca_event: string;
	single_record: number | null; // centiseconds
	average_record: number | null; // centiseconds
	single_world_rank: number | null;
	average_world_rank: number | null;
}

export interface EventKinchScore {
	eventId: string;
	score: number;
}

export interface KinchResult {
	overall: number;
	events: EventKinchScore[];
}

export interface SoRResult {
	single: number;
	average: number;
}

/**
 * Pure calculation functions for Kinch Ranks and Sum of Ranks.
 * Ported from cubingapp reference: Referans/cubingapp-main/server/src/php/kinch.php
 */
export class RankingService {
	/**
	 * MBLD encoded value → score.
	 * Format: (99 - points) * 1e7 + seconds * 1e2 + missed
	 */
	static mbldScore(value: number): number {
		if (!value) return 0;

		const seconds = Math.floor(value / 100) % 1e5;
		const points = 99 - (Math.floor(value / 1e7) % 100);
		const centiseconds = seconds === 99999 ? null : seconds * 100;

		if (centiseconds === null) return Math.max(points, 0);

		const proportionOfHourLeft = 1 - centiseconds / 360000;
		return Math.max(points + proportionOfHourLeft, 0);
	}

	/**
	 * Calculate Kinch score for a user.
	 * Port of calcKinch() from cubingapp kinch.php
	 */
	static calculateKinchScore(
		wcaRecords: WcaRecordRow[],
		worldRecords: Record<string, {single: number; average: number}>
	): KinchResult {
		const rankingEvents = WcaApiService.getRankingEvents();
		const bestOfEvents = WcaApiService.getBestOfEvents();
		const recordMap = new Map(wcaRecords.map((r) => [r.wca_event, r]));
		const events: EventKinchScore[] = [];

		for (const eventId of rankingEvents) {
			const record = recordMap.get(eventId);
			const wr = worldRecords[eventId];

			if (!wr) {
				events.push({eventId, score: 0});
				continue;
			}

			const userSingle = record?.single_record || 0;
			const userAverage = record?.average_record || 0;
			const wrSingle = wr.single || 0;
			const wrAverage = wr.average || 0;

			// MBLD: special encoding
			if (eventId === '333mbf') {
				const personalScore = this.mbldScore(userSingle);
				const recordScore = this.mbldScore(wrSingle);

				if (!recordScore) {
					events.push({eventId, score: 100});
					continue;
				}

				events.push({
					eventId,
					score: personalScore ? Math.round(((personalScore / recordScore) * 100) * 100) / 100 : 0,
				});
				continue;
			}

			// BLD + FMC: use better of single/average
			if (bestOfEvents.includes(eventId)) {
				if (!userSingle) {
					events.push({eventId, score: 0});
					continue;
				}

				if (!wrSingle || !wrAverage) {
					events.push({eventId, score: 100});
					continue;
				}

				if (!userAverage) {
					// Only single available
					const score = (wrSingle / userSingle) * 100;
					events.push({eventId, score: Math.round(score * 100) / 100});
					continue;
				}

				// Both available → use better
				const singleScore = (wrSingle / userSingle) * 100;
				const averageScore = (wrAverage / userAverage) * 100;
				events.push({
					eventId,
					score: Math.round(Math.max(singleScore, averageScore) * 100) / 100,
				});
				continue;
			}

			// Regular events: use average only
			if (!userAverage) {
				events.push({eventId, score: 0});
				continue;
			}

			if (!wrAverage) {
				events.push({eventId, score: 100});
				continue;
			}

			const score = (wrAverage / userAverage) * 100;
			events.push({eventId, score: Math.round(score * 100) / 100});
		}

		// Overall = average of all event scores
		const sum = events.reduce((acc, e) => acc + e.score, 0);
		const overall = events.length > 0 ? Math.round((sum / events.length) * 100) / 100 : 0;

		return {overall, events};
	}

	/**
	 * Calculate Sum of Ranks for a user.
	 * For missing events, penalty = maxRank (total competitors in that event).
	 */
	static calculateSumOfRanks(
		wcaRecords: WcaRecordRow[],
		maxRanks: Record<string, {single: number; average: number}>
	): SoRResult {
		const rankingEvents = WcaApiService.getRankingEvents();
		const recordMap = new Map(wcaRecords.map((r) => [r.wca_event, r]));

		let singleSum = 0;
		let averageSum = 0;

		for (const eventId of rankingEvents) {
			const record = recordMap.get(eventId);
			const max = maxRanks[eventId] || {single: 0, average: 0};

			// Single rank
			const singleRank = record?.single_world_rank || (max.single + 1);
			singleSum += singleRank;

			// Average rank (MBLD has no average)
			if (eventId !== '333mbf') {
				const averageRank = record?.average_world_rank || (max.average + 1);
				averageSum += averageRank;
			}
		}

		return {single: singleSum, average: averageSum};
	}
}
