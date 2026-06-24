/**
 * OllTrainView — recognition practice for one OLL.
 * Pulls a RANDOM real scramble from the OLL's pool (→ random one of the 6 variants, never the same
 * variant twice in a row), times the solve (spacebar/touch), reveals which variant it was, and lets
 * the user mark ✓/✗ (recognised/solved correctly?). Accuracy is tracked per variant so the user can
 * see which cases they know well vs poorly. Solve time is recorded against the variant's algId
 * (reuses the existing trainer stats), accuracy in a separate store (ollcp/stats).
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import block from '../../../../styles/bem';
import {useOllcp} from '../OllcpContext';
import {OLLCP_DATA, OLLCP_SIMILAR} from '../data';
import {getAccuracy, recordAccuracy, accuracyPct, useOllcpStatsVersion} from '../stats';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {addTime} from '../../hooks/useAlgorithmData';
import {useTrainerStats, formatTimeShort} from '../../hooks/useTrainerStats';
import TrainerBarChart from '../../panels/stats_panel/TrainerBarChart';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');
type Phase = 'idle' | 'ready' | 'running' | 'stopped';

function shuffle<T>(a: T[]): T[] {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

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
	const [sessRight, setSessRight] = useState(0);
	const [sessTotal, setSessTotal] = useState(0);
	const accVersion = useOllcpStatsVersion(); // bumps when server accuracy changes → recompute strip
	const lastVRef = useRef(-1); // last shown variant (avoid repeat at deck boundary)
	const bagRef = useRef<number[]>([]); // shuffled deck of the 6 variants → even coverage

	const pool = oll?.scrambles ?? [];

	// Scrambles grouped by variant. A "deck" of the 6 variants is dealt out (reshuffled when empty)
	// so every variant is shown once per cycle of 6 (even coverage); each time a RANDOM scramble of
	// that variant is chosen (variety — 12 distinct scrambles per variant).
	const byVariant = useMemo(() => {
		const m: Record<number, {s: string; v: number}[]> = {};
		for (const sc of pool) (m[sc.v] ||= []).push(sc);
		return m;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [oll]);

	const pickNext = useCallback(() => {
		const vars = Object.keys(byVariant).map(Number);
		if (!vars.length) return;
		if (bagRef.current.length === 0) {
			const bag = shuffle([...vars]);
			if (bag.length > 1 && bag[0] === lastVRef.current) [bag[0], bag[1]] = [bag[1], bag[0]];
			bagRef.current = bag;
		}
		const v = bagRef.current.shift() as number;
		lastVRef.current = v;
		const scrs = byVariant[v];
		const sc = scrs[Math.floor(Math.random() * scrs.length)];
		setCur(sc);
		setDisplay(0);
		setRevealed(false);
	}, [byVariant]);

	// First scramble on mount / OLL change (fresh deck).
	useEffect(() => {
		bagRef.current = [];
		lastVRef.current = -1;
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

	// Advance to the next scramble (idle → read/recognise, then hold to start).
	const advance = useCallback(() => {
		pickNext();
		setPhase('idle');
	}, [pickNext]);

	// Mark the solved attempt right/wrong → record accuracy + advance.
	const assess = useCallback(
		(correct: boolean) => {
			const c = curRef.current;
			if (c && oll) recordAccuracy(algToId(oll.variants[c.v - 1].algorithm), correct);
			setSessTotal((n) => n + 1);
			if (correct) setSessRight((n) => n + 1);
			advance();
		},
		[oll, advance],
	);

	const resetSession = () => {
		setSession([]);
		setSessRight(0);
		setSessTotal(0);
	};

	// Keyboard: hold Space → ready, release → run, press → stop, press again → next (no mark).
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
	const onPointerDown = (e: React.PointerEvent) => {
		// Capture the pointer so the release (up/cancel) is delivered here even if the finger drifts
		// off the timer before lifting — otherwise pointerup lands elsewhere and start() never runs.
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			/* unsupported → touch-action:none still keeps the gesture on this element */
		}
		const p = phaseRef.current;
		if (p === 'running') stop();
		else if (p === 'stopped') advance();
		else if (p === 'idle') {
			setPhase('ready');
			phaseRef.current = 'ready'; // authoritative now so an immediate release still starts
		}
	};
	const onPointerUp = () => {
		if (phaseRef.current === 'ready') start();
	};
	// If the OS/browser still steals the gesture mid-hold, fall back to idle instead of staying stuck
	// on "ready" (the old bug: hold → green frozen, release → nothing).
	const onPointerCancel = () => {
		if (phaseRef.current === 'ready') {
			setPhase('idle');
			phaseRef.current = 'idle';
		}
	};

	const revealedVariant = revealed && cur && oll ? oll.variants[cur.v - 1] : null;
	const stats = useTrainerStats(revealedVariant ? revealedVariant.algorithm : null, revealedVariant?.moves);

	// Per-variant accuracy strip (which variants the user knows well vs poorly). Memoised so it
	// doesn't re-read localStorage on every timer frame.
	const accStrip = useMemo(() => {
		if (!oll) return [];
		return oll.variants.map((v) => {
			const a = getAccuracy(algToId(v.algorithm));
			return {n: v.n, pct: accuracyPct(a), t: a.t};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [oll, accVersion]);

	const revealAcc = useMemo(() => {
		if (!revealedVariant) return null;
		return getAccuracy(algToId(revealedVariant.algorithm));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [revealedVariant, accVersion]);

	if (!num || !oll) return null;

	const liveTime = (display / 1000).toFixed(2);
	const sessionBest = session.length ? Math.min(...session) : null;
	const pctColor = (pct: number | null) =>
		pct === null ? undefined : pct >= 80 ? '#46cf72' : pct >= 50 ? '#e0a93a' : '#e2685d';

	return (
		<div className={b('train')}>
			<div className={b('train-top')}>
				<span className={b('train-oll')}>OLL {num}</span>
				<span className={b('train-session')}>
					{sessTotal > 0 ? `${sessRight}/${sessTotal} doğru` : `${session.length} çözüm`}
					{sessionBest !== null && ` · en iyi ${formatTimeShort(sessionBest)}`}
				</span>
				<button type="button" className={b('reset')} onClick={resetSession}>
					Sıfırla
				</button>
			</div>

			<div className={b('acc-strip')}>
				{accStrip.map((a) => (
					<span key={a.n} className={b('acc-cell')} style={{color: pctColor(a.pct)}}>
						{a.n} {a.pct === null ? '—' : `%${a.pct}`}
					</span>
				))}
			</div>

			<div className={b('scramble')}>{cur ? cur.s : '…'}</div>

			<div
				className={b('timer', {[phase]: true})}
				onPointerDown={onPointerDown}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				role="button"
				tabIndex={0}
			>
				{liveTime}
			</div>

			{revealedVariant ? (
				<div className={b('reveal-top')}>
					<div className={b('reveal-head')}>
						Bu <b>{revealedVariant.n}</b> idi — {revealedVariant.prioLabel} · {revealedVariant.moves}h
						{revealAcc && revealAcc.t > 0 && (
							<span className={b('reveal-acc')}>
								{' '}· doğruluk {revealAcc.c}/{revealAcc.t} (%{accuracyPct(revealAcc)})
							</span>
						)}
					</div>
					<div className={b('assess')}>
						<button type="button" className={b('assess-yes')} onClick={() => assess(true)}>
							✓ Doğru
						</button>
						<button type="button" className={b('assess-no')} onClick={() => assess(false)}>
							✗ Yanlış
						</button>
						<button type="button" className={b('assess-skip')} onClick={advance}>
							Atla →
						</button>
					</div>
				</div>
			) : (
				<div className={b('train-hint')}>
					Boşluk (veya ekrana) <b>basılı tut → bırak → çöz → bas</b>. Çözünce doğru mu yaptın işaretle.
				</div>
			)}

			{revealedVariant && (
				<div className={b('reveal-body')}>
					<OllcpCard variant={revealedVariant} active similar={cur ? OLLCP_SIMILAR[num][cur.v - 1] : undefined} />
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
						{stats.lastTimes.length > 0 && (
							<div className={b('stat-chart')}>
								<TrainerBarChart times={stats.lastTimes.map((r) => r.t)} bestTime={stats.bestTime} />
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
