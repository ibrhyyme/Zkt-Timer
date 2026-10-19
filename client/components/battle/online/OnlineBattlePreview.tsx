import React, {useRef, useState} from 'react';
import block from '../../../styles/bem';
import type {SmartCubeViewHandle} from '../../timer/smart_cube/cube_view/SmartCubeView';
import type {MatchResultPayload, OpponentStatePayload, RoundResultPayload} from '../../../../shared/battle/events';
import type {BattlePenalty} from '../../../../shared/battle/types';
import {CHALLENGE_TTL_SEC, SCRAMBLE_SEC} from '../../../../shared/battle/config';
import QueueScreen, {QueueCubeView, QueuePreviewProfile} from './QueueScreen';
import MatchScreen, {MatchCubeView} from './MatchScreen';
import ResultScreen from './ResultScreen';
import DuelWaitScreen from './DuelWaitScreen';
import DuelInviteScreen, {DuelInvite} from './DuelInviteScreen';
import type {OnlineMatchView} from './battle_state';
import type {BattleCubePhase} from './useBattleCube';

const b = block('online-battle');

/**
 * Development only: every Online Battle screen with made-up data, at
 * /battle/online?preview=<state>. A real match needs two accounts and two smart cubes, so
 * the screens could not be looked at, let alone compared in both themes and on a phone.
 * OnlineBattle renders this before any guard and only outside production builds.
 */

const SCRAMBLE = "R2 D' B2 U2 L2 F2 D' L2 U' F2 U2 R' B' L D2 F' U L' F R2";
const NAME = 'ibrhyme';
const OPPONENT = {id: 'opp', username: 'cuber_ankara', avatar: null, rating: 1612, provisional: false};

export const PREVIEW_STATES = [
	'queue',
	'queue-new',
	'queue-nocube',
	'searching',
	'found',
	'countdown',
	'scramble',
	'scramble-late',
	'inspect',
	'inspect-late',
	'solving',
	'waiting',
	'round-won',
	'round-lost',
	'disconnected',
	'result-won',
	'result-lost',
	'result-draw',
	// Duels (owner decision 2026-10-20)
	'duel-queue',
	'duel-target',
	'duel-creating',
	'duel-wait',
	'duel-wait-target',
	'duel-expired',
	'duel-invite',
	'duel-invite-nocube',
	'duel-invite-signedout',
	'duel-invite-used',
	'duel-found',
	'duel-result-won',
	'duel-result-lost',
] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

export function isPreviewState(value: string | null): value is PreviewState {
	return !!value && (PREVIEW_STATES as readonly string[]).includes(value);
}

const PROFILE: QueuePreviewProfile = {
	name: NAME,
	avatar: null,
	rating: {rating: 1648, provisional: false, games: 23, wins: 14, losses: 8, draws: 1, peak: 1702, rank: 12},
	recent: [
		{id: '1', result: 'WIN', scoreFor: 3, scoreAgainst: 1, delta: 11, opponentName: 'cuber_ankara', opponentAvatar: null},
		{id: '2', result: 'LOSS', scoreFor: 2, scoreAgainst: 3, delta: -9, opponentName: 'speedy.tr', opponentAvatar: null},
		{id: '3', result: 'WIN', scoreFor: 3, scoreAgainst: 0, delta: 8, opponentName: 'mert_k', opponentAvatar: null},
		{id: '4', result: 'WIN', scoreFor: 3, scoreAgainst: 2, delta: 12, opponentName: 'zeynepcubes', opponentAvatar: null},
		{id: '5', result: 'DRAW', scoreFor: 2, scoreAgainst: 2, delta: 0, opponentName: 'oll_skip', opponentAvatar: null},
		{id: '6', result: 'LOSS', scoreFor: 1, scoreAgainst: 3, delta: -10, opponentName: 'f2l_fan', opponentAvatar: null},
		{id: '7', result: 'WIN', scoreFor: 3, scoreAgainst: 1, delta: 9, opponentName: 'kup_ustasi', opponentAvatar: null},
	],
};

/** The queue's recent list with two duels in it (labelled, out of the form strip). */
const DUEL_PROFILE: QueuePreviewProfile = {
	...PROFILE,
	recent: [
		{id: 'd1', result: 'WIN', scoreFor: 3, scoreAgainst: 2, delta: null, opponentName: 'mert_k', opponentAvatar: null, challenge: true},
		...PROFILE.recent.slice(0, 2),
		{id: 'd2', result: 'LOSS', scoreFor: 1, scoreAgainst: 3, delta: null, opponentName: 'mert_k', opponentAvatar: null, challenge: true},
		...PROFILE.recent.slice(2),
	],
};

const CUBE: QueueCubeView = {
	connected: true,
	connecting: false,
	reconnecting: false,
	deviceName: 'GAN12 ui Maglev',
	battery: 78,
	info: {brand: 'gan', hasClock: true},
	connect: () => undefined,
};

const NO_CUBE: QueueCubeView = {...CUBE, connected: false, deviceName: null, battery: null, info: null};

function invite(state: PreviewState, t0: number): DuelInvite {
	return {
		code: 'k7m2xq9pza',
		status: state === 'duel-invite-used' ? 'ACCEPTED' : 'PENDING',
		expiresAt: t0 + 11 * 60 * 1000 + 42 * 1000,
		from: {id: 'opp', username: OPPONENT.username, avatar: null},
		restricted: false,
		own: false,
		forYou: false,
	};
}

function solve(timeMs: number | null, penalty: BattlePenalty | null = null) {
	return {timeMs, penalty, dnfReason: penalty === 'DNF' ? ('inspection' as const) : null};
}

function roundResult(round: number, me: number | null, them: number | null, score: {a: number; b: number}, mePen: BattlePenalty | null = null): RoundResultPayload {
	const a = solve(me, mePen);
	const bb = solve(them);
	const ta = me == null || mePen === 'DNF' ? Infinity : me + (mePen === 'PLUS_TWO' ? 2000 : mePen === 'PLUS_FOUR' ? 4000 : 0);
	const tb = them == null ? Infinity : them;
	return {matchId: 'm', round, a, b: bb, winner: ta < tb ? 'A' : tb < ta ? 'B' : 'DRAW', score};
}

const ROUNDS: RoundResultPayload[] = [
	roundResult(1, 11420, 12980, {a: 1, b: 0}),
	roundResult(2, 13050, 10870, {a: 1, b: 1}),
	roundResult(3, 9980, 11300, {a: 2, b: 1}),
	roundResult(4, 11240, 14010, {a: 3, b: 1}, 'PLUS_TWO'),
];

function matchView(state: PreviewState, t0: number): OnlineMatchView {
	const duel = state === 'duel-found';
	const before = state === 'found' || duel;
	const score = before ? {a: 0, b: 0} : state === 'round-won' ? {a: 2, b: 1} : state === 'round-lost' ? {a: 1, b: 2} : {a: 1, b: 1};
	const goAt = state === 'countdown' ? t0 + 2400 : state === 'scramble-late' ? t0 - (SCRAMBLE_SEC + 3) * 1000 : t0 - 6000;
	let opponent: OpponentStatePayload | null = {matchId: 'm', round: 3, phase: 'scrambling'};
	if (state === 'inspect' || state === 'inspect-late') opponent = {matchId: 'm', round: 3, phase: 'inspecting'};
	if (state === 'solving' || state === 'waiting' || state === 'disconnected')
		opponent = {matchId: 'm', round: 3, phase: 'solving', step: 'f2l_2', solvingSince: t0 - 7300};
	const last =
		state === 'round-won'
			? roundResult(3, 9980, 11300, score)
			: state === 'round-lost'
				? roundResult(3, 13420, 10110, score)
				: null;
	return {
		matchId: 'm',
		matched: {
			matchId: 'm',
			rated: !duel,
			isRematch: false,
			challenge: duel,
			side: 'A',
			you: {rating: 1648, provisional: false, games: 23},
			opponent: OPPONENT,
			preview: duel ? null : {win: 11, draw: -1, loss: -9},
			startsAt: t0 + 2600,
		},
		round: before ? 0 : 3,
		current: before ? null : {matchId: 'm', round: 3, scramble: SCRAMBLE, goAt, scrambleDeadline: goAt + 40000},
		score,
		rounds: [],
		opponent: last ? {matchId: 'm', round: 3, phase: 'finished', timeMs: last.b.timeMs, penalty: null} : opponent,
		opponentConnected: state !== 'disconnected',
		opponentGraceUntil: state === 'disconnected' ? t0 + 14000 : null,
		lastRoundResult: last,
	};
}

function cubeView(state: PreviewState, t0: number, viewRef: React.RefObject<SmartCubeViewHandle>): MatchCubeView {
	const phase: BattleCubePhase =
		state === 'inspect' || state === 'inspect-late'
			? 'inspecting'
			: state === 'solving' || state === 'disconnected'
				? 'solving'
				: state === 'waiting' || state === 'round-won' || state === 'round-lost'
					? 'done'
					: state === 'scramble' || state === 'scramble-late'
						? 'scrambling'
						: 'waiting';
	const moves = SCRAMBLE.split(' ').length;
	const doneMoves = state === 'scramble-late' ? 17 : 8;
	return {
		connected: true,
		connecting: false,
		reconnecting: false,
		battery: 78,
		gyroSupported: true,
		viewRef,
		phase,
		matchStatus: phase === 'scrambling' ? Array.from({length: moves}, (_, i) => (i < doneMoves ? 'perfect' : 'pending')) : [],
		undoMoves: null,
		outOfSync: false,
		scrambleDoneAt: state === 'inspect-late' ? t0 - 15600 : t0 - 4200,
		scramblePenalty: state === 'inspect-late' ? 'PLUS_TWO' : null,
		solveStartedAt: t0 - 9100,
		solve: state === 'waiting' ? {timeMs: 10840, penalty: null} : null,
		markSolved: () => undefined,
		resetGyro: () => undefined,
		connect: () => undefined,
	};
}

function result(state: PreviewState): MatchResultPayload {
	const duel = state.startsWith('duel-result');
	const won = state === 'result-won' || state === 'duel-result-won';
	const draw = state === 'result-draw';
	return {
		matchId: 'm',
		winner: draw ? 'DRAW' : won ? 'A' : 'B',
		endReason: 'NORMAL',
		rated: !duel,
		ratingBefore: duel ? null : 1648,
		ratingAfter: duel ? null : draw ? 1647 : won ? 1659 : 1639,
		delta: duel ? null : draw ? -1 : won ? 11 : -9,
		provisional: false,
		games: 24,
		challenge: duel,
		headToHead: duel ? (won ? {wins: 7, losses: 4, draws: 1} : {wins: 6, losses: 5, draws: 1}) : null,
		rounds: won
			? ROUNDS
			: ROUNDS.map((r) => ({...r, a: r.b, b: r.a, winner: r.winner === 'A' ? 'B' : r.winner === 'B' ? 'A' : 'DRAW', score: {a: r.score.b, b: r.score.a}})),
	};
}

export default function OnlineBattlePreview({state}: {state: PreviewState}) {
	const [t0] = useState(() => Date.now());
	const viewRef = useRef<SmartCubeViewHandle>(null);
	const noop = () => undefined;

	let body: React.ReactNode;
	if (state === 'duel-queue' || state === 'duel-target') {
		body = (
			<QueueScreen
				searching={false}
				queue={null}
				cube={CUBE}
				onSearch={noop}
				onStop={noop}
				onStillHere={noop}
				duelTarget={state === 'duel-target' ? OPPONENT.username : null}
				onChallenge={noop}
				onClearTarget={noop}
				preview={DUEL_PROFILE}
			/>
		);
	} else if (state === 'duel-creating' || state === 'duel-wait' || state === 'duel-wait-target' || state === 'duel-expired') {
		body = (
			<DuelWaitScreen
				challenge={
					state === 'duel-creating'
						? null
						: {
								code: 'k7m2xq9pza',
								status: state === 'duel-expired' ? 'EXPIRED' : 'PENDING',
								expiresAt: t0 + CHALLENGE_TTL_SEC * 1000 - 23 * 1000,
								to: state === 'duel-wait-target' ? {id: 'opp', username: OPPONENT.username} : null,
						  }
				}
				myName={NAME}
				cube={CUBE}
				toLocal={(ms) => ms}
				onCancel={noop}
				onNewInvite={noop}
				onBack={noop}
			/>
		);
	} else if (state.startsWith('duel-invite')) {
		body = (
			<DuelInviteScreen
				invite={invite(state, t0)}
				loading={false}
				headToHead={state === 'duel-invite-signedout' ? null : {wins: 6, losses: 4, draws: 1}}
				signedIn={state !== 'duel-invite-signedout'}
				emailVerified
				accepting={false}
				cube={state === 'duel-invite-nocube' ? NO_CUBE : CUBE}
				onAccept={noop}
				onGoBattle={noop}
				onSignIn={noop}
				onSignUp={noop}
				onVerifyEmail={noop}
			/>
		);
	} else if (state === 'queue' || state === 'queue-new' || state === 'queue-nocube' || state === 'searching') {
		body = (
			<QueueScreen
				searching={state === 'searching'}
				queue={state === 'searching' ? {searching: true, waitedSec: 14, searchingCount: 3, askStillHere: false} : null}
				cube={{
					connected: state !== 'queue-nocube',
					connecting: false,
					reconnecting: false,
					deviceName: 'GAN12 ui Maglev',
					battery: 78,
					info: state === 'queue-nocube' ? null : {brand: 'gan', hasClock: true},
					connect: noop,
				}}
				onSearch={noop}
				onStop={noop}
				onStillHere={noop}
				preview={state === 'queue-new' ? {name: NAME, avatar: null, rating: null, recent: []} : PROFILE}
			/>
		);
	} else if (state.startsWith('result') || state.startsWith('duel-result')) {
		body = (
			<ResultScreen
				result={result(state)}
				challenge={state.startsWith('duel-result')}
				side="A"
				myName={NAME}
				myAvatar={null}
				myRating={1648}
				opponent={OPPONENT}
				rematch={null}
				rematchDeadlineLocal={t0 + 15000}
				reported={false}
				onRematch={noop}
				onNewOpponent={noop}
				onExit={noop}
				onReport={noop}
			/>
		);
	} else {
		body = (
			<MatchScreen
				match={matchView(state, t0)}
				myName={NAME}
				myAvatar={null}
				cube={cubeView(state, t0, viewRef)}
				toLocal={(ms) => ms}
				firstMatch={false}
				useBlueMatch={false}
				onGiveUp={noop}
			/>
		);
	}

	const inMatch = state === 'duel-found' || (!state.startsWith('queue') && state !== 'searching' && !state.startsWith('result') && !state.startsWith('duel'));
	return (
		<div className={b({match: inMatch})}>
			<div className={b('body')}>{body}</div>
		</div>
	);
}
