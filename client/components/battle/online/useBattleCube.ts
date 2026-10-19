import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector, RootStateOrAny} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {getSmartCubeManager} from '../../../util/smart_cube/connection_manager';
import {SmartSolveEngine, SmartEngineEvent, SolveResult} from '../../../util/smart_cube';
import type {MatchStatus} from '../../../util/smart_cube/solve_engine';
import {recordEngineEvent} from '../../../util/smart_cube/telemetry';
import {SmartTurn} from '../../../util/smart_scramble';
import {useSettings} from '../../../util/hooks/useSettings';
import {setTimerParams} from '../../timer/helpers/params';
import {openModal, closeModal} from '../../../actions/general';
import BleScanningModal from '../../timer/smart_cube/ble_scanning_modal/BleScanningModal';
import BluetoothErrorMessage from '../../timer/common/BluetoothErrorMessage';
import type {SmartCubeViewHandle} from '../../timer/smart_cube/cube_view/SmartCubeView';
import {isNative} from '../../../util/platform';
import {toastError} from '../../../util/toast';
import {expectedProgress} from '../../../../shared/battle/verify';
import {addPenalties, inspectionPenalty, scramblePenalty as scrambleCall} from '../../../../shared/battle/rules';
import type {
	BattleProgressStep,
	ProgressPayload,
	ScrambleDonePayload,
	SolveDonePayload,
	SolveStartPayload,
} from '../../../../shared/battle/events';
import type {BattleMove, BattlePenalty, BattleSolveSource} from '../../../../shared/battle/types';
import {battleCubeInfo} from './cube_info';

/**
 * The player's own cube during an Online Battle round (design 4.5, 4.7, 4.11).
 *
 * Same engine and same app-wide connection as the timer page and friendly rooms
 * (FriendlyRoom.tsx, "Smart cube engine"). The room's Pro lock on smart cubes does not
 * come along: Online Battle is open to everyone (S-7).
 *
 * What it reports to the server, through `sink`:
 *   scramble_done  once the cube reaches the scramble; carries the cube's facelets (check 1)
 *                  and the cube clock of the last two scramble moves (check 6)
 *   solve_start    the first solve move, with the engine's inspection
 *   progress       each CFOP step as the move log completes it (check 7)
 *   solve_done     the engine's SolveResult: time, source, tail correction and the raw move
 *                  log (checks 2-8)
 *
 * The time sent is the engine's own, without the user's smart cube time offset: the server
 * recomputes the time from the moves and a shifted time would only trip `time_mismatch`.
 */

export interface BattleCubeRound {
	matchId: string;
	round: number;
	scramble: string;
	/** goAt on this device's clock: the scramble is timed from here. */
	goAtLocal: number;
}

export interface BattleCubeSink {
	scrambleDone(p: ScrambleDonePayload): void;
	solveStart(p: SolveStartPayload): void;
	progress(p: ProgressPayload): void;
	solveDone(p: SolveDonePayload): void;
}

export type BattleCubePhase = 'waiting' | 'scrambling' | 'inspecting' | 'solving' | 'done';

export interface BattleCubeSolve {
	timeMs: number;
	penalty: BattlePenalty | null;
}

/**
 * scramble_done waits this long after the engine sees the scramble complete. The cube can
 * hand over its final scramble move a moment after its facelets packet (the engine drops
 * such a move as LATE_SCRAMBLE_MOVE); its cube stamp is the one check 6 measures
 * inspection from. Short against the 1 s tolerance of check 5, and skipped as soon as the
 * solve starts.
 */
const SCRAMBLE_DONE_SETTLE_MS = 250;
/** Progress is recomputed from the move log at most this often while solving. */
const PROGRESS_THROTTLE_MS = 150;
/** Moves kept for the scramble stamps; only the last two before the solve matter. */
const MOVE_LOG_LIMIT = 64;

interface LoggedMove {
	turn: string;
	completedAt: number;
	cubeTimestamp: number | null;
}

function moveTime(turn: any): number {
	const raw = turn?.completedAt ?? turn?.time;
	if (!raw) return 0;
	return typeof raw === 'number' ? raw : new Date(raw).getTime();
}

/** Raw move log to the battle wire format. Gaps stay null: the server counts them (check 3). */
export function toBattleMoves(turns: SmartTurn[]): BattleMove[] {
	return turns.map((turn: any) => ({
		t: String(turn.turn || ''),
		c: typeof turn.cubeTimestamp === 'number' ? turn.cubeTimestamp : null,
		l: typeof turn.localTimestamp === 'number' ? turn.localTimestamp : null,
	}));
}

/**
 * Cube clock of the last two scramble moves: the moves before `solveStartedAt` when the
 * solve has started, otherwise the last two logged.
 */
export function lastScrambleStamps(log: LoggedMove[], solveStartedAt: number | null): [number | null, number | null] {
	const scrambleMoves = solveStartedAt == null ? log : log.filter((m) => m.completedAt < solveStartedAt);
	const last = scrambleMoves[scrambleMoves.length - 1];
	const beforeLast = scrambleMoves[scrambleMoves.length - 2];
	return [beforeLast?.cubeTimestamp ?? null, last?.cubeTimestamp ?? null];
}

/**
 * Steps to report now: those the move log has completed and that were not sent yet. A
 * step is final once sent; the bar only ever moves forward.
 */
export function newProgressSteps(
	scramble: string,
	moves: BattleMove[],
	sent: Set<BattleProgressStep>
): {step: BattleProgressStep; atMs: number}[] {
	const expected = expectedProgress(scramble, moves);
	if (!expected) return [];
	return expected
		.filter((p) => !sent.has(p.step as BattleProgressStep))
		.map((p) => ({step: p.step as BattleProgressStep, atMs: p.atMs}));
}

export function useBattleCube(round: BattleCubeRound | null, open: boolean, live: boolean, sink: BattleCubeSink) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const manager = getSmartCubeManager();

	const connected = useSelector((s: RootStateOrAny) => !!s.smartCube?.smartCubeConnected);
	const reconnecting = useSelector((s: RootStateOrAny) => !!s.smartCube?.smartReconnecting);
	const deviceName = useSelector((s: RootStateOrAny) => s.smartCube?.smartDeviceName || null) as string | null;
	const battery = useSelector((s: RootStateOrAny) => s.smartCube?.smartCubeBatteryLevel ?? null) as number | null;
	const gyroSupported = useSelector((s: RootStateOrAny) => !!s.smartCube?.smartGyroSupported);
	const solvedState = useSelector(
		(s: RootStateOrAny) => s.smartCube?.smartSolvedState || 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
	) as string;
	const turns = useSelector((s: RootStateOrAny) => s.timer?.smartTurns || []) as SmartTurn[];
	const currentFacelets = useSelector((s: RootStateOrAny) => s.smartCube?.smartCurrentState || null) as string | null;
	const stateSeq = useSelector((s: RootStateOrAny) => s.smartCube?.smartStateSeq || 0) as number;
	const scanError = useSelector((s: RootStateOrAny) => s.timer?.smartCubeScanError || null) as string | null;
	const moveOrderFix = useSettings('smart_cube_move_order_fix');

	const [phase, setPhase] = useState<BattleCubePhase>('waiting');
	const [matchStatus, setMatchStatus] = useState<MatchStatus[]>([]);
	const [undoMoves, setUndoMoves] = useState<string[] | null>(null);
	const [outOfSync, setOutOfSync] = useState(false);
	/** Local clock: scramble complete (inspection runs from here). */
	const [scrambleDoneAt, setScrambleDoneAt] = useState<number | null>(null);
	/** +2 when the scramble took over 20 s; the server makes the final call. */
	const [scramblePenalty, setScramblePenalty] = useState<BattlePenalty | null>(null);
	/** Move clock of the first solve move. */
	const [solveStartedAt, setSolveStartedAt] = useState<number | null>(null);
	const [solve, setSolve] = useState<BattleCubeSolve | null>(null);
	const [connecting, setConnecting] = useState(false);

	const roundRef = useRef(round);
	roundRef.current = round;
	const sinkRef = useRef(sink);
	sinkRef.current = sink;
	const turnsRef = useRef(turns);
	turnsRef.current = turns;
	const phaseRef = useRef(phase);
	phaseRef.current = phase;

	const moveLogRef = useRef<LoggedMove[]>([]);
	const inspectionMsRef = useRef(0);
	const scrambleMsRef = useRef<number | null>(null);
	const solveStartIndexRef = useRef(0);
	const solveStartedAtRef = useRef<number | null>(null);
	const sentStepsRef = useRef<Set<BattleProgressStep>>(new Set());
	const scrambleDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrambleDoneSentRef = useRef(false);
	const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scanModalOpenRef = useRef(false);

	/** The 3D mirror on the match screen, so engine re-anchors and "mark solved" reach it. */
	const viewRef = useRef<SmartCubeViewHandle>(null);

	// ── Engine ──
	const engineRef = useRef<SmartSolveEngine | null>(null);
	const engineEventRef = useRef<(event: SmartEngineEvent) => void>(() => {
		/* set below */
	});
	if (!engineRef.current) {
		engineRef.current = new SmartSolveEngine((event) => engineEventRef.current(event), {solvedState, moveOrderFix});
	}

	useEffect(() => {
		engineRef.current?.setMoveOrderFix(moveOrderFix);
	}, [moveOrderFix]);

	const sendScrambleDone = useCallback(() => {
		if (scrambleDoneTimerRef.current) {
			clearTimeout(scrambleDoneTimerRef.current);
			scrambleDoneTimerRef.current = null;
		}
		const r = roundRef.current;
		if (!r || scrambleDoneSentRef.current) return;
		scrambleDoneSentRef.current = true;
		sinkRef.current.scrambleDone({
			matchId: r.matchId,
			round: r.round,
			facelets: manager.getSnapshot().facelets,
			lastScrambleCubeTs: lastScrambleStamps(moveLogRef.current, solveStartedAtRef.current),
			scrambleMs: scrambleMsRef.current ?? undefined,
		});
	}, [manager]);

	const flushProgress = useCallback(() => {
		progressTimerRef.current = null;
		const r = roundRef.current;
		if (!r || phaseRef.current !== 'solving') return;
		const moves = toBattleMoves(turnsRef.current.slice(solveStartIndexRef.current));
		for (const p of newProgressSteps(r.scramble, moves, sentStepsRef.current)) {
			sentStepsRef.current.add(p.step);
			sinkRef.current.progress({matchId: r.matchId, round: r.round, step: p.step, atMs: p.atMs});
		}
	}, []);

	engineEventRef.current = (event: SmartEngineEvent) => {
		recordEngineEvent(event, 'room');
		const r = roundRef.current;

		switch (event.type) {
			case 'SCRAMBLE_COMPLETE':
				if (!r) return;
				setUndoMoves(null);
				setScrambleDoneAt(event.at);
				scrambleMsRef.current = Math.max(0, Math.round(event.at - r.goAtLocal));
				setScramblePenalty(scrambleCall(scrambleMsRef.current));
				setPhase('inspecting');
				phaseRef.current = 'inspecting';
				scrambleDoneSentRef.current = false;
				scrambleDoneTimerRef.current = setTimeout(sendScrambleDone, SCRAMBLE_DONE_SETTLE_MS);
				break;

			case 'UNDO_MOVES':
				setUndoMoves(event.moves);
				break;

			case 'SCRAMBLE_PROGRESS':
				setMatchStatus(event.matchStatus);
				break;

			case 'TIMER_START': {
				if (!r) return;
				solveStartedAtRef.current = event.startedAt;
				// scramble_done goes first, now with every scramble move in the log.
				sendScrambleDone();
				const list = turnsRef.current;
				let index = list.length - 1;
				for (let i = list.length - 1; i >= 0; i--) {
					if (moveTime(list[i]) === event.startedAt) {
						index = i;
						break;
					}
				}
				solveStartIndexRef.current = Math.max(0, index);
				sentStepsRef.current = new Set();
				inspectionMsRef.current = event.inspectionMs;
				setSolveStartedAt(event.startedAt);
				setPhase('solving');
				phaseRef.current = 'solving';
				sinkRef.current.solveStart({matchId: r.matchId, round: r.round, inspectionMs: Math.round(event.inspectionMs)});
				break;
			}

			case 'SOLVE_COMPLETE': {
				if (!r) return;
				const result: SolveResult = event.result;
				if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
				progressTimerRef.current = null;
				const moves = toBattleMoves(result.solutionTurns);
				// Steps the last moves completed, before the solve itself is reported.
				for (const p of newProgressSteps(r.scramble, moves, sentStepsRef.current)) {
					sentStepsRef.current.add(p.step);
					sinkRef.current.progress({matchId: r.matchId, round: r.round, step: p.step, atMs: p.atMs});
				}
				// The wire carries the inspection call only; the server adds its own scramble call.
				const penalty = inspectionPenalty(inspectionMsRef.current);
				const scrambleMs = scrambleMsRef.current;
				setSolve({timeMs: result.timeMs, penalty: addPenalties(scrambleMs == null ? null : scrambleCall(scrambleMs), penalty)});
				setPhase('done');
				phaseRef.current = 'done';
				sinkRef.current.solveDone({
					matchId: r.matchId,
					round: r.round,
					timeMs: Math.round(result.timeMs),
					penalty,
					source: result.source as BattleSolveSource,
					timeCorrectionMs: Math.round(result.timeCorrectionMs),
					moves,
				});
				break;
			}

			case 'LATE_SCRAMBLE_MOVE':
				setTimerParams({smartTurns: []});
				break;

			case 'OUT_OF_SYNC':
				setOutOfSync(event.out);
				break;

			case 'TRACKER_RESYNCED':
				// The mirror is driven by moves; after the engine re-anchors to what the cube
				// reports, replay the view to that state too (same as the offline battle).
				void viewRef.current?.syncToFacelets(event.facelets);
				break;
		}
	};

	// ── Round lifecycle ──
	const roundKey = round ? `${round.matchId}:${round.round}` : '';
	useEffect(() => {
		// A new round (or none): everything from the last one goes.
		if (scrambleDoneTimerRef.current) clearTimeout(scrambleDoneTimerRef.current);
		if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
		scrambleDoneTimerRef.current = null;
		progressTimerRef.current = null;
		scrambleDoneSentRef.current = false;
		solveStartedAtRef.current = null;
		sentStepsRef.current = new Set();
		// The ref too: the effect below reads it in this same commit.
		phaseRef.current = 'waiting';
		setPhase('waiting');
		setMatchStatus([]);
		setUndoMoves(null);
		setScrambleDoneAt(null);
		scrambleMsRef.current = null;
		setScramblePenalty(null);
		setSolveStartedAt(null);
		setSolve(null);
		engineRef.current?.suspend();
	}, [roundKey]);

	useEffect(() => {
		if (!round || !open || !live) return;
		if (phaseRef.current !== 'waiting') return;
		engineRef.current?.setScramble(round.scramble);
		setPhase('scrambling');
		phaseRef.current = 'scrambling';
	}, [roundKey, open, live]);

	// The server closed the round (time ran out, the match ended): stop where we are.
	useEffect(() => {
		if (live) return;
		const p = phaseRef.current;
		if (p === 'scrambling' || p === 'inspecting' || p === 'solving') {
			engineRef.current?.suspend();
			setPhase('done');
			phaseRef.current = 'done';
		}
	}, [live]);

	// The cube went away mid-solve and the manager has given up bringing it back (it is
	// neither connected nor retrying). Nothing can end this solve any more: no packet will
	// report it solved, and the player's hands are on the cube, not on a reconnect button.
	// Left alone, the round hung on the opponent until the server's solve window ran out,
	// over two minutes later. A solve without its cube cannot be timed, so it is a DNF now.
	// While the manager is still retrying, it waits: a cube that comes back finishes the
	// solve through the engine's facelets recovery.
	useEffect(() => {
		if (connected || reconnecting) return;
		const r = roundRef.current;
		if (!r || phaseRef.current !== 'solving') return;
		if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
		progressTimerRef.current = null;
		engineRef.current?.suspend();
		setSolve({timeMs: 0, penalty: 'DNF'});
		setPhase('done');
		phaseRef.current = 'done';
		sinkRef.current.solveDone({
			matchId: r.matchId,
			round: r.round,
			timeMs: 0,
			penalty: 'DNF',
			source: 'tracker',
			timeCorrectionMs: 0,
			moves: toBattleMoves(turnsRef.current.slice(solveStartIndexRef.current)),
		});
	}, [connected, reconnecting]);

	// ── Engine inputs ──
	useEffect(() => {
		engineRef.current?.setConnected(connected);
	}, [connected]);

	useEffect(() => {
		engineRef.current?.pushTurns(turns);
		if (phaseRef.current === 'solving' && !progressTimerRef.current) {
			progressTimerRef.current = setTimeout(flushProgress, PROGRESS_THROTTLE_MS);
		}
	}, [turns, flushProgress]);

	useEffect(() => {
		if (!currentFacelets) return;
		engineRef.current?.pushFacelets(currentFacelets);
	}, [stateSeq]);

	// Own move log for the scramble stamps: the Redux stream is cleared on a late scramble
	// move, which is exactly when the stamps are needed.
	useEffect(
		() =>
			manager.subscribeMoves((batch) => {
				const log = moveLogRef.current;
				for (const m of batch.moves as any[]) {
					log.push({
						turn: m.turn,
						completedAt: moveTime(m),
						cubeTimestamp: typeof m.cubeTimestamp === 'number' ? m.cubeTimestamp : null,
					});
				}
				if (log.length > MOVE_LOG_LIMIT) log.splice(0, log.length - MOVE_LOG_LIMIT);
			}),
		[manager]
	);

	// Attaching keeps the Redux turn mirror and the battery poll at full rate while the
	// battle is on screen. Detaching leaves the link up.
	useEffect(() => manager.attach({turnStream: true}), [manager]);

	useEffect(
		() => () => {
			if (scrambleDoneTimerRef.current) clearTimeout(scrambleDoneTimerRef.current);
			if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
			engineRef.current?.dispose();
		},
		[]
	);

	// ── Connecting (same flow as friendly rooms) ──
	const clearBleParams = () =>
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
			smartScanDevices: [],
		});

	const closeScanModal = () => {
		if (!scanModalOpenRef.current) return;
		scanModalOpenRef.current = false;
		dispatch(closeModal());
	};

	const cancelScan = () => {
		manager.cancelScan();
		closeScanModal();
		clearBleParams();
		setConnecting(false);
	};

	const connect = async () => {
		if (connecting || connected) return;
		setConnecting(true);
		if (!isNative()) {
			const bt = (navigator as any).bluetooth;
			const available = !!bt && (await bt.getAvailability());
			if (!available) {
				setConnecting(false);
				dispatch(openModal(React.createElement(BluetoothErrorMessage)));
				return;
			}
		}
		clearBleParams();
		scanModalOpenRef.current = true;
		// Native BLE has no OS picker: without this modal the scan hangs until its timeout.
		dispatch(
			openModal(
				React.createElement(BleScanningModal, {
					mode: 'smartcube',
					onCancel: cancelScan,
					onRetry: () => {
						clearBleParams();
						void manager.connect(false, 'room');
					},
					onShowAllDevices: () => {
						clearBleParams();
						void manager.connect(true, 'room');
					},
				}),
				{position: 'bottom', hideCloseButton: true, disableBackdropClick: true}
			)
		);
		const result = await manager.connect(false, 'room');
		if (!result.ok && result.reason === 'already_connected') {
			closeScanModal();
			toastError(t('smart_cube.already_connected', {name: result.deviceName || ''}));
		}
		setConnecting(false);
	};

	useEffect(() => {
		if (connected) scanModalOpenRef.current = false;
	}, [connected]);

	useEffect(() => {
		if (scanError === 'wrong_mac' && !isNative()) {
			toastError(t('smart_cube.wrong_mac_desc'));
			clearBleParams();
			setConnecting(false);
		}
	}, [scanError]);

	/** The user says the cube is physically solved (out of sync while scrambling). */
	const markSolved = async () => {
		await manager.resetCubeState();
		engineRef.current?.markSolved();
		setUndoMoves(null);
		setOutOfSync(false);
		void viewRef.current?.syncToFacelets(solvedState);
	};

	/** Point the 3D mirror's gyroscope back at the default view. */
	const resetGyro = () => viewRef.current?.resetGyro();

	/**
	 * The server refused scramble_done: the state the cube reports is not the scramble.
	 *
	 * The engine had matched the scramble from the move stream, so locally the round went on to
	 * inspection and even a solve, while the server kept this player scrambling and would DNF
	 * them at the scramble deadline. The time on screen was a time that would never count.
	 * Back to scrambling instead, with the mismatch shown: the engine re-anchors to what the
	 * cube reports, and "solve it, or mark it solved" is the way out either way.
	 */
	const rejectScramble = () => {
		const r = roundRef.current;
		const p = phaseRef.current;
		if (!r || (p !== 'inspecting' && p !== 'solving')) return;
		if (scrambleDoneTimerRef.current) clearTimeout(scrambleDoneTimerRef.current);
		if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
		scrambleDoneTimerRef.current = null;
		progressTimerRef.current = null;
		scrambleDoneSentRef.current = false;
		solveStartedAtRef.current = null;
		sentStepsRef.current = new Set();
		setScrambleDoneAt(null);
		scrambleMsRef.current = null;
		setScramblePenalty(null);
		setSolveStartedAt(null);
		setSolve(null);
		setMatchStatus([]);
		setUndoMoves(null);
		engineRef.current?.suspend();
		engineRef.current?.setScramble(r.scramble);
		phaseRef.current = 'scrambling';
		setPhase('scrambling');
		setOutOfSync(true);
	};

	return {
		connected,
		connecting,
		reconnecting,
		deviceName,
		battery,
		info: connected ? battleCubeInfo(deviceName) : null,
		connect,
		markSolved,
		resetGyro,
		rejectScramble,
		viewRef,
		gyroSupported,
		phase,
		matchStatus,
		undoMoves,
		outOfSync,
		scrambleDoneAt,
		scramblePenalty,
		solveStartedAt,
		solve,
	};
}
