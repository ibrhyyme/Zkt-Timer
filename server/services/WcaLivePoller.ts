import {fetchLiveRoundResults} from './WcaLiveService';
import {createRedisKey, RedisNamespace, setKeyInRedis} from './redis';
import {logger} from './logger';
import {ZktFederationService} from './ZktFederationService';
import {isZktCompetitionId, zktSlugOf, zktRoundToWcaLiveResults} from './ZktWcaAdapter';

const POLL_INTERVAL_MS = 7000;

interface RoundSubscription {
	competitionId: string;
	sockets: Set<string>;
	intervalId: ReturnType<typeof setInterval>;
	lastHash: string;
}

const subscriptions = new Map<string, RoundSubscription>();

let _getIO: (() => any) | null = null;

export function setPollerIOGetter(fn: () => any) {
	_getIO = fn;
}

/**
 * Read one round in the shape the client expects. A ZKT competition's rounds
 * live on the federation, not on WCA Live — polling WCA Live with a federation
 * round id just returns nothing, which is why ZKT rounds never pushed and fell
 * back to the client's 60s poll. Both branches come back as WcaLiveRoundResults
 * so the emit path below stays identical.
 */
async function fetchRoundData(liveRoundId: string, competitionId: string): Promise<any | null> {
	if (isZktCompetitionId(competitionId)) {
		const raw = await ZktFederationService.fetchRoundResultsFresh(
			zktSlugOf(competitionId),
			liveRoundId
		);
		return raw ? zktRoundToWcaLiveResults(raw) : null;
	}
	return fetchLiveRoundResults(liveRoundId);
}

async function pollRound(liveRoundId: string, competitionId: string) {
	try {
		const data = await fetchRoundData(liveRoundId, competitionId);
		const sub = subscriptions.get(liveRoundId);
		if (!sub) return;

		const newHash = data ? JSON.stringify(data.results) : '';
		if (newHash !== sub.lastHash) {
			sub.lastHash = newHash;
			// The ZKT branch already wrote the fresh payload to its own federation
			// cache key (the one its resolver reads), so only the WCA branch needs
			// this write.
			if (!isZktCompetitionId(competitionId)) {
				const cacheKey = createRedisKey(
					RedisNamespace.WCA_WCIF,
					`liveround:${competitionId}:${liveRoundId}`
				);
				try {
					await setKeyInRedis(cacheKey, JSON.stringify(data), 60);
				} catch {}
			}
			if (_getIO) {
				_getIO().to(`wca-live-round:${liveRoundId}`).emit('wca-live:round-update', data);
			}
		}

		if (data?.finished) {
			stopPolling(liveRoundId);
		}
	} catch (err: any) {
		logger.warn('[WcaLivePoller] poll failed', {liveRoundId, competitionId, error: err?.message});
	}
}

function startPolling(liveRoundId: string, competitionId: string) {
	if (subscriptions.has(liveRoundId)) return;
	const intervalId = setInterval(() => pollRound(liveRoundId, competitionId), POLL_INTERVAL_MS);
	subscriptions.set(liveRoundId, {
		competitionId,
		sockets: new Set(),
		intervalId,
		lastHash: '',
	});
}

function stopPolling(liveRoundId: string) {
	const sub = subscriptions.get(liveRoundId);
	if (!sub) return;
	clearInterval(sub.intervalId);
	subscriptions.delete(liveRoundId);
}

export function subscribeRound(socketId: string, competitionId: string, liveRoundId: string) {
	if (!subscriptions.has(liveRoundId)) {
		startPolling(liveRoundId, competitionId);
	}
	subscriptions.get(liveRoundId)!.sockets.add(socketId);
}

export function unsubscribeRound(socketId: string, liveRoundId: string) {
	const sub = subscriptions.get(liveRoundId);
	if (!sub) return;
	sub.sockets.delete(socketId);
	if (sub.sockets.size === 0) {
		stopPolling(liveRoundId);
	}
}

export function unsubscribeAllRounds(socketId: string) {
	for (const [roundId] of subscriptions.entries()) {
		unsubscribeRound(socketId, roundId);
	}
}
