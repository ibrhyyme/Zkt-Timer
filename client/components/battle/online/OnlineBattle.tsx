import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import block from '../../../styles/bem';
import FeatureGuard from '../../common/page_disabled/FeatureGuard';
import OfflineGuard from '../../common/offline_guard/OfflineGuard';
import AccountRequired from '../../common/account_required/AccountRequired';
import Button from '../../common/button/Button';
import BottomSheetNav from '../../layout/nav/bottom_sheet_nav/BottomSheetNav';
import TrainerModeHeader from '../../trainer/common/TrainerModeHeader';
import {useMe} from '../../../util/hooks/useMe';
import {useSettings} from '../../../util/hooks/useSettings';
import {useWakeLock} from '../../../util/hooks/useWakeLock';
import {isGreenBaseColor} from '../../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import {resourceUri} from '../../../util/storage';
import {toastError} from '../../../util/toast';
import {allowScreenSleep, hapticImpact, hapticNotification, keepScreenAwake} from '../../../util/native-plugins';
import {REMATCH_WINDOW_SEC} from '../../../../shared/battle/config';
import {BATTLE_ERROR_KEYS} from '../../../../shared/battle/events';
import {useBattleSocket} from './useBattleSocket';
import {BattleCubeRound, useBattleCube} from './useBattleCube';
import OnlineBattlePreview, {isPreviewState} from './OnlineBattlePreview';
import {outcomeFor, OnlineBattleState} from './battle_state';
import QueueScreen from './QueueScreen';
import MatchScreen from './MatchScreen';
import ResultScreen from './ResultScreen';
import './OnlineBattle.scss';

const b = block('online-battle');

/**
 * Leaving now cancels the match instead of losing it: the scramble of round 1 is not on
 * screen yet (design 4.6, "before the first round starts").
 */
export function isBeforeFirstScramble(state: OnlineBattleState, localNow: number, toLocal: (ms: number) => number): boolean {
	const match = state.match;
	if (state.stage !== 'match' || !match) return false;
	if (!match.current) return true;
	return match.current.round === 1 && localNow < toLocal(match.current.goAt);
}

interface PendingLeave {
	pathname: string;
	search: string;
	hash: string;
	action: string;
}

/**
 * /battle/online (design 5.1): queue, match and result in one state machine.
 *
 * The server owns every transition (useBattleSocket folds its events); the player's own
 * cube runs in useBattleCube. Client only: the socket and the cube live in the browser, so
 * the server render is null like the offline battle.
 */
export default function OnlineBattle() {
	if (typeof window === 'undefined') return null;

	if (process.env.NODE_ENV !== 'production') {
		const preview = new URLSearchParams(window.location.search).get('preview');
		if (isPreviewState(preview)) return <OnlineBattlePreview state={preview} />;
	}

	return (
		<FeatureGuard feature="online_battle_enabled" pageNameKey="online_battle.title">
			<OfflineGuard>
				<OnlineBattleGate />
			</OfflineGuard>
		</FeatureGuard>
	);
}

function OnlineBattleGate() {
	const {t} = useTranslation();
	const me = useMe();

	if (!me) {
		return (
			<div className={b('gate')}>
				<AccountRequired descriptionKey="online_battle.account_required" />
				<BottomSheetNav />
			</div>
		);
	}

	if (!me.email_verified) {
		return (
			<div className={b('gate')}>
				<div className={b('notice')}>
					<strong>{t('online_battle.email_title')}</strong>
					<span>{t('online_battle.email_body')}</span>
					<Button primary to="/account/personal-info" text={t('online_battle.email_cta')} />
				</div>
				<BottomSheetNav />
			</div>
		);
	}

	return <OnlineBattleInner />;
}

function OnlineBattleInner() {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const useBlueMatch = isGreenBaseColor(useSettings('text_color'));

	const {state, actions, toLocal} = useBattleSocket(true);
	const {stage, match, result} = state;

	// ── The round the cube plays ──
	const current = stage === 'match' && match ? match.current : null;
	const roundKey = current ? `${current.matchId}:${current.round}` : '';
	const cubeRound = useMemo<BattleCubeRound | null>(
		() =>
			current
				? {matchId: current.matchId, round: current.round, scramble: current.scramble, goAtLocal: toLocal(current.goAt)}
				: null,
		[roundKey]
	);

	// The scramble opens on both screens at goAt, not when round_start arrives.
	const [openKey, setOpenKey] = useState('');
	useEffect(() => {
		if (!current) return;
		const delay = toLocal(current.goAt) - Date.now();
		if (delay <= 0) {
			setOpenKey(roundKey);
			return;
		}
		const id = setTimeout(() => setOpenKey(roundKey), delay);
		return () => clearTimeout(id);
	}, [roundKey]);

	const roundOver = !!(match?.lastRoundResult && current && match.lastRoundResult.round === current.round);
	const live = !!current && !roundOver;
	const cube = useBattleCube(cubeRound, !!current && openKey === roundKey, live, actions);

	// ── Device: screen on, haptics, sound ──
	const active = stage === 'match' || stage === 'searching';
	useWakeLock(active);
	useEffect(() => {
		if (!active) return;
		void keepScreenAwake();
		return () => {
			void allowScreenSleep();
		};
	}, [active]);

	const foundSoundRef = useRef<HTMLAudioElement | null>(null);
	useEffect(() => {
		try {
			foundSoundRef.current = new Audio(resourceUri('audio/success.mp3'));
			foundSoundRef.current.load();
		} catch (e) {
			// No audio on this device; haptics still run.
		}
	}, []);

	const matchId = match?.matchId || null;
	useEffect(() => {
		if (!matchId || stage !== 'match') return;
		void hapticNotification('success');
		const audio = foundSoundRef.current;
		if (audio) {
			audio.currentTime = 0;
			audio.play().catch(() => undefined);
		}
	}, [matchId]);

	const lastRound = match?.lastRoundResult?.round || 0;
	useEffect(() => {
		if (lastRound) void hapticImpact('medium');
	}, [lastRound]);

	const side = match?.matched.side || 'A';
	useEffect(() => {
		if (!result) return;
		void hapticNotification(outcomeFor(result.winner, side) === 'lost' ? 'warning' : 'success');
	}, [result]);

	// ── Errors from the server ──
	useEffect(() => {
		if (!state.error) return;
		toastError(t(state.error.i18nKey, state.error.params || {}));
		// The server kept this player scrambling: the local round must go back there too.
		if (state.error.i18nKey === BATTLE_ERROR_KEYS.scrambleMismatch) cube.rejectScramble();
		actions.clearError();
	}, [state.error]);

	// ── Leaving ──
	const stateRef = useRef(state);
	stateRef.current = state;
	const [confirm, setConfirm] = useState<{leave: PendingLeave | null} | null>(null);
	const unblockRef = useRef<(() => void) | null>(null);
	const inMatch = stage === 'match';

	// Every way out of the page during a match goes through the confirm: a nav link, the
	// iOS swipe back and the Android back button (both end in history.back()).
	useEffect(() => {
		if (!inMatch) return;
		const unblock = history.block((location, action) => {
			setConfirm({leave: {pathname: location.pathname, search: location.search, hash: location.hash, action}});
			return false;
		});
		unblockRef.current = unblock;
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			unblock();
			unblockRef.current = null;
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	}, [inMatch, history]);

	useEffect(() => {
		if (!inMatch) setConfirm(null);
	}, [inMatch]);

	// A search left running is stopped when the page goes away.
	useEffect(() => () => actions.leaveQueueOnExit(), []);

	// The cube went away while searching: a match would start without it.
	useEffect(() => {
		if (stage === 'searching' && !cube.connected && !cube.reconnecting) actions.leaveQueue();
	}, [stage, cube.connected, cube.reconnecting]);

	const confirmLeave = () => {
		const s = stateRef.current;
		const pending = confirm?.leave || null;
		setConfirm(null);
		if (s.match) actions.giveUp(s.match.matchId);
		if (!pending) return;
		unblockRef.current?.();
		unblockRef.current = null;
		if (pending.action === 'POP') history.goBack();
		else if (pending.action === 'REPLACE') history.replace(pending);
		else history.push(pending);
	};

	// ── Result screen ──
	const resultAtRef = useRef(0);
	if (stage === 'result' && !resultAtRef.current) resultAtRef.current = Date.now();
	if (stage !== 'result') resultAtRef.current = 0;
	const rematchDeadlineLocal = state.rematch
		? toLocal(state.rematch.deadline)
		: resultAtRef.current + REMATCH_WINDOW_SEC * 1000;

	const [reported, setReported] = useState<Set<string>>(() => new Set());

	const startSearch = useCallback(() => {
		if (!cube.info?.hasClock) return;
		actions.joinQueue(cube.info);
	}, [cube.info, actions.joinQueue]);

	const newOpponent = () => {
		if (match) actions.rematch(match.matchId, false);
		actions.dismiss();
		startSearch();
	};

	const exit = () => {
		if (match) actions.rematch(match.matchId, false);
		actions.dismiss();
		history.push('/battle');
	};

	// ── Screens ──
	let body: React.ReactNode;
	if (stage === 'match' && match) {
		body = (
			<MatchScreen
				match={match}
				myName={me?.username || ''}
				myAvatar={me?.profile?.pfp_image?.storage_path || null}
				cube={cube}
				toLocal={toLocal}
				firstMatch={match.matched.you.games === 0}
				useBlueMatch={useBlueMatch}
				onGiveUp={() => setConfirm({leave: null})}
			/>
		);
	} else if (stage === 'result' && result && match) {
		body = (
			<ResultScreen
				result={result}
				side={match.matched.side}
				myName={me?.username || ''}
				myAvatar={me?.profile?.pfp_image?.storage_path || null}
				myRating={match.matched.you.rating}
				opponent={match.matched.opponent}
				rematch={state.rematch}
				rematchDeadlineLocal={rematchDeadlineLocal}
				reported={reported.has(match.matchId)}
				onRematch={() => actions.rematch(match.matchId, true)}
				onNewOpponent={newOpponent}
				onExit={exit}
				onReport={(reason) => {
					actions.report(match.matchId, reason);
					setReported((prev) => new Set(prev).add(match.matchId));
				}}
			/>
		);
	} else if (stage === 'cancelled') {
		body = (
			<div className={b('cancelled')}>
				<p className={b('cancelled-text')}>{t(`online_battle.cancelled.${state.cancelReason || 'not_found'}`)}</p>
				<Button large primary text={t('online_battle.ok')} onClick={actions.dismiss} />
			</div>
		);
	} else {
		body = (
			<QueueScreen
				searching={stage === 'searching'}
				queue={state.queue}
				cube={cube}
				onSearch={startSearch}
				onStop={actions.leaveQueue}
				onStillHere={actions.stillHere}
			/>
		);
	}

	const beforeStart = isBeforeFirstScramble(state, Date.now(), toLocal);

	return (
		<div className={b({match: inMatch})}>
			{/* The trainer's breadcrumb bar, so both hubs lead into their modes the same way. */}
			{!inMatch && (
				<TrainerModeHeader
					onBack={() => history.push('/battle')}
					trail={[{label: t('nav.battle'), onClick: () => history.push('/battle')}, {label: t('online_battle.title')}]}
				/>
			)}

			<div className={b('body')}>{body}</div>

			{confirm && (
				<div className={b('dialog-backdrop')}>
					<div className={b('dialog')} role="dialog">
						<p className={b('dialog-text')}>
							{beforeStart ? t('online_battle.leave_confirm_before_start') : t('online_battle.leave_confirm')}
						</p>
						<div className={b('dialog-actions')}>
							<Button gray text={t('online_battle.cancel')} onClick={() => setConfirm(null)} />
							<Button
								danger
								text={confirm.leave ? t('online_battle.leave') : t('online_battle.give_up')}
								onClick={confirmLeave}
							/>
						</div>
					</div>
				</div>
			)}

			{!inMatch && <BottomSheetNav />}
		</div>
	);
}
