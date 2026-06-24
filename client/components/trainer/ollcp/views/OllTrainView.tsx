/**
 * OllTrainView — recognition practice for one OLL or a mixed set of OLLs (multi-select).
 * Pulls a RANDOM real scramble from the trained OLLs' pools (→ random one of their variants, never
 * the same (OLL,variant) twice in a row, every pair shown once per cycle), times the solve
 * (spacebar/touch), reveals which OLL+variant it was, and lets the user mark ✓/✗. Accuracy is
 * tracked per variant (server-backed) so the user can see which cases they know well vs poorly.
 * Solve time is recorded against the variant's algId (reuses the existing trainer stats).
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
type Pick = {oll: string; s: string; v: number};

function shuffle<T>(a: T[]): T[] {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export default function OllTrainView() {
	const {state} = useOllcp();
	const olls = state.trainOlls;
	const multi = olls.length > 1;

	const [phase, setPhase] = useState<Phase>('idle');
	const phaseRef = useRef<Phase>('idle');
	phaseRef.current = phase;
	const [display, setDisplay] = useState(0);
	const startRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const [cur, setCur] = useState<Pick | null>(null);
	const curRef = useRef(cur);
	curRef.current = cur;
	const [revealed, setRevealed] = useState(false);
	const [session, setSession] = useState<number[]>([]);
	const [sessRight, setSessRight] = useState(0);
	const [sessTotal, setSessTotal] = useState(0);
	const accVersion = useOllcpStatsVersion(); // bumps when server accuracy changes → recompute strip
	const lastKeyRef = useRef(''); // last shown (oll,variant) key (avoid repeat at deck boundary)
	const bagRef = useRef<string[]>([]); // shuffled deck of (oll,variant) keys → even coverage

	// All scrambles of every trained OLL, tagged with their OLL. A "deck" of (OLL,variant) pairs is
	// dealt out (reshuffled when empty) so every case appears once per cycle (even coverage); each
	// time a RANDOM scramble of that pair is chosen (variety — 12 distinct scrambles per pair).
	const byPair = useMemo(() => {
		const m: Record<string, Pick[]> = {};
		for (const o of olls) {
			const data = OLLCP_DATA[o];
			if (!data) continue;
			for (const sc of data.scrambles) (m[`${o}:${sc.v}`] ||= []).push({oll: o, s: sc.s, v: sc.v});
		}
		return m;
	}, [olls]);

	const pickNext = useCallback(() => {
		const keys = Object.keys(byPair);
		if (!keys.length) return;
		if (bagRef.current.length === 0) {
			const bag = shuffle([...keys]);
			if (bag.length > 1 && bag[0] === lastKeyRef.current) [bag[0], bag[1]] = [bag[1], bag[0]];
			bagRef.current = bag;
		}
		const key = bagRef.current.shift() as string;
		lastKeyRef.current = key;
		const scrs = byPair[key];
		const sc = scrs[Math.floor(Math.random() * scrs.length)];
		setCur(sc);
		setDisplay(0);
		setRevealed(false);
	}, [byPair]);

	// First scramble on mount / trained-set change (fresh deck).
	useEffect(() => {
		bagRef.current = [];
		lastKeyRef.current = '';
		pickNext();
		setPhase('idle');
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [olls]);

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
		if (c) addTime(algToId(OLLCP_DATA[c.oll].variants[c.v - 1].algorithm), t);
		setSession((s) => [...s, t]);
	}, []);

	// Advance to the next scramble (idle → read/recognise, then hold to start).
	const advance = useCallback(() => {
		pickNext();
		setPhase('idle');
	}, [pickNext]);

	// Mark the solved attempt right/wrong → record accuracy + advance.
	const assess = useCallback(
		(correct: boolean) => {
			const c = curRef.current;
			if (c) recordAccuracy(algToId(OLLCP_DATA[c.oll].variants[c.v - 1].algorithm), correct);
			setSessTotal((n) => n + 1);
			if (correct) setSessRight((n) => n + 1);
			advance();
		},
		[advance],
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

	const revealedVariant = revealed && cur ? OLLCP_DATA[cur.oll].variants[cur.v - 1] : null;
	const revealOll = revealedVariant && cur ? cur.oll : null;
	const stats = useTrainerStats(revealedVariant ? revealedVariant.algorithm : null, revealedVariant?.moves);

	// Per-variant accuracy strip — only for a single OLL (the 6 cells are that OLL's variants).
	// Memoised so it doesn't re-read on every timer frame.
	const singleOll = !multi && olls.length ? OLLCP_DATA[olls[0]] : undefined;
	const accStrip = useMemo(() => {
		if (!singleOll) return [];
		return singleOll.variants.map((v) => {
			const a = getAccuracy(algToId(v.algorithm));
			return {n: v.n, pct: accuracyPct(a), t: a.t};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [singleOll, accVersion]);

	const revealAcc = useMemo(() => {
		if (!revealedVariant) return null;
		return getAccuracy(algToId(revealedVariant.algorithm));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [revealedVariant, accVersion]);

	if (!olls.length) return null;

	const liveTime = (display / 1000).toFixed(2);
	const sessionBest = session.length ? Math.min(...session) : null;
	const pctColor = (pct: number | null) =>
		pct === null ? undefined : pct >= 80 ? '#46cf72' : pct >= 50 ? '#e0a93a' : '#e2685d';

	return (
		<div className={b('train')}>
			<div className={b('train-top')}>
				<span className={b('train-oll')}>{multi ? `Karışık · ${olls.join(', ')}` : `OLL ${olls[0]}`}</span>
				<span className={b('train-session')}>
					{sessTotal > 0 ? `${sessRight}/${sessTotal} doğru` : `${session.length} çözüm`}
					{sessionBest !== null && ` · en iyi ${formatTimeShort(sessionBest)}`}
				</span>
				<button type="button" className={b('reset')} onClick={resetSession}>
					Sıfırla
				</button>
			</div>

			{!multi && (
				<div className={b('acc-strip')}>
					{accStrip.map((a) => (
						<span key={a.n} className={b('acc-cell')} style={{color: pctColor(a.pct)}}>
							{a.n} {a.pct === null ? '—' : `%${a.pct}`}
						</span>
					))}
				</div>
			)}

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
						Bu <b>{multi ? `OLL ${revealOll} ${revealedVariant.n}` : revealedVariant.n}</b> idi —{' '}
						{revealedVariant.prioLabel} · {revealedVariant.moves}h
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
					<OllcpCard
						variant={revealedVariant}
						active
						similar={cur ? OLLCP_SIMILAR[cur.oll][cur.v - 1] : undefined}
					/>
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
