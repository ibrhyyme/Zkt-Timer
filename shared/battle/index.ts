/**
 * Online Battle shared core (design ranking-battle.md, task B1).
 *
 * config   constants (4.9), the only file a retune touches
 * types    shared string unions and records (4.10)
 * events   Socket.IO event names and payloads (4.11)
 * glicko2  rating update, idle RD growth, preview deltas, leaderboard key (4.4)
 * rules    round and match outcome, penalties, pair limit, queue window (4.2, 4.5, 4.6)
 * verify   solve verification, checks 1-8 (4.7)
 *
 * `verify` pulls in cubejs and the phase engine. A client bundle that only needs the
 * event names or the rules should import those modules directly instead of this index.
 */

export * from './config';
export * from './types';
export * from './events';
export * from './glicko2';
export * from './rules';
export * from './verify';
