/**
 * OllTrainView — timed recognition practice for one OLL.
 * Pulls a RANDOM real scramble from the OLL's pool (→ random one of the 6 variants), times the
 * solve (spacebar/touch like the main TrainerTimer), then reveals which variant it was and records
 * the time against that variant's algId so the existing trainer stats (best/Ao5/Ao12/history) apply.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import block from '../../../../styles/bem';
import {useOllcp} from '../OllcpContext';
import {OLLCP_DATA} from '../data';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {addTime} from '../../hooks/useAlgorithmData';
import {useTrainerStats, formatTimeShort} from '../../hooks/useTrainerStats';
import TrainerBarChart from '../../panels/stats_panel/TrainerBarChart';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');
type Phase = 'idle' | 'ready' | 'running' | 'stopped';

export default function OllTrainView() {
	const {state} = useOllcp();
	const num = state.currentOll;
	const oll = num ? OLLCP_DATA[num] : undefined;

	const [phase, setPhase] = useState<Phase>('idle');
	const phaseRef = useRef<Phase>('idle');
	phaseRef.current = phase;
	const [display, setDisplay] = useState(0);
	const startRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const [cur, setCur] = useState<{s: string; v: number} | null>(null);
	const curRef = useRef(cur);
	curRef.current = cur;
	const [revealed, setRevealed] = useState(false);
	const [session, setSession] = useState<number[]>([]);
	const lastIdxRef = useRef(-1);

	const pool = oll?.scrambles ?? [];

	const pickNext = useCallback(() => {
		if (!pool.length) return;
		let i = Math.floor(Math.random() * pool.length);
		if (pool.length > 1 && i === lastIdxRef.current) i = (i + 1) % pool.length;
		lastIdxRef.current = i;
		setCur(pool[i]);
		setDisplay(0);
		setRevealed(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [num]);

	// First scramble on mount / OLL change.
	useEffect(() => {
		pickNext();
		setPhase('idle');
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [num]);

	const start = useCallback(() => {
		startRef.current = Date.now();
		setPhase('running');
		const tick = () => {
			setDisplay(Date.now() - startRef.current);
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
	}, []);

	const stop = useCallback(() => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		const t = Date.now() - startRef.current;
		setDisplay(t);
		setPhase('stopped');
		setRevealed(true);
		const c = curRef.current;
		if (c && oll) addTime(algToId(oll.variants[c.v - 1].algorithm), t);
		setSession((s) => [...s, t]);
	}, [oll]);

	// "Press while stopped" advances to the NEXT scramble and goes idle (does NOT auto-start) so you
	// can read/recognise the new case first; a separate hold→release starts the next solve.
	const advance = useCallback(() => {
		pickNext();
		setPhase('idle');
	}, [pickNext]);

	// Keyboard: hold Space → ready, release → run, press → stop, press again → next.
	useEffect(() => {
		const onDown = (e: KeyboardEvent) => {
			if (e.code !== 'Space' || e.repeat) return;
			e.preventDefault();
			const p = phaseRef.current;
			if (p === 'running') stop();
			else if (p === 'stopped') advance();
			else if (p === 'idle') setPhase('ready');
		};
		const onUp = (e: KeyboardEvent) => {
			if (e.code !== 'Space') return;
			e.preventDefault();
			if (phaseRef.current === 'ready') start();
		};
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
		};
	}, [start, stop, advance]);

	// Touch / pointer mirrors the keyboard machine.
	const onPointerDown = () => {
		const p = phaseRef.current;
		if (p === 'running') stop();
		else if (p === 'stopped') advance();
		else if (p === 'idle') setPhase('ready');
	};
	const onPointerUp = () => {
		if (phaseRef.current === 'ready') start();
	};

	const revealedVariant = revealed && cur && oll ? oll.variants[cur.v - 1] : null;
	const stats = useTrainerStats(revealedVariant ? revealedVariant.algorithm : null, revealedVariant?.moves);

	if (!num || !oll) return null;

	const liveTime = (display / 1000).toFixed(2);
	const sessionBest = session.length ? Math.min(...session) : null;
	const sessionAvg = session.length ? session.reduce((a, c) => a + c, 0) / session.length : null;

	return (
		<div className={b('train')}>
			<div className={b('train-top')}>
				<span className={b('train-oll')}>OLL {num}</span>
				<span className={b('train-session')}>
					{session.length} çözüm · oturum en iyi {formatTimeShort(sessionBest)} · ort {formatTimeShort(sessionAvg)}
				</span>
			</div>

			<div className={b('scramble')}>{cur ? cur.s : '…'}</div>

			<div
				className={b('timer', {[phase]: true})}
				onPointerDown={onPointerDown}
				onPointerUp={onPointerUp}
				role="button"
				tabIndex={0}
			>
				{liveTime}
			</div>

			<div className={b('train-hint')}>
				Boşluk (veya ekrana) <b>basılı tut → bırak → çöz → bas</b>. Çözünce hangi varyanttı görürsün.
			</div>

			{revealedVariant && (
				<div className={b('reveal')}>
					<div className={b('reveal-head')}>
						Bu <b>{revealedVariant.n}</b> idi — {revealedVariant.prioLabel} · {revealedVariant.moves}h
					</div>
					<div className={b('reveal-body')}>
						<OllcpCard variant={revealedVariant} active />
						<div className={b('reveal-stats')}>
							<div className={b('stat-row')}>
								<span>En iyi</span>
								<b>{formatTimeShort(stats.bestTime)}</b>
							</div>
							<div className={b('stat-row')}>
								<span>Ao5</span>
								<b>{formatTimeShort(stats.ao5)}</b>
							</div>
							<div className={b('stat-row')}>
								<span>Ao12</span>
								<b>{formatTimeShort(stats.ao12)}</b>
							</div>
							<div className={b('stat-row')}>
								<span>Toplam</span>
								<b>{stats.totalSolves}</b>
							</div>
							{stats.lastTimes.length > 0 && (
								<div className={b('stat-chart')}>
									<TrainerBarChart times={stats.lastTimes.map((r) => r.t)} bestTime={stats.bestTime} />
								</div>
							)}
						</div>
					</div>
					<button type="button" className={b('next-btn')} onClick={advance}>
						Sonraki ↻
					</button>
				</div>
			)}
		</div>
	);
}
