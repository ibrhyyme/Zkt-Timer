/**
 * SolutionPlayer — sets up scramble and plays solution step-by-step with custom
 * control bar (ReplayPlayer-inspired):
 *   - cubing controlPanel: 'none' (no gray box) — controls are ours
 *   - forward: experimentalAddMove (smooth animation) · backward: reset + replay
 *   - own UI: seek slider + play/pause + speed + move counter
 * if alg empty (before reveal) shows only scramble, controls hidden.
 * SSR safety: loaded with React.lazy (cubing/twisty extends HTMLElement).
 */
import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Play, Pause, ArrowCounterClockwise} from 'phosphor-react';
import {TwistyPlayer} from 'cubing/twisty';
import block from '../../../../styles/bem';
import {getEfficiencyMask} from '../../../../util/trainer/efficiency/sticker_mask';
import type {EfficiencyType} from '../types';

const b = block('eff-player');

interface Props {
	scramble: string;
	alg: string;
	className?: string;
	maskType?: EfficiencyType;
	maskSlot?: number;
	maskRotation?: string;
}

const SPEEDS = [1, 2, 4];

const SolutionPlayer: React.FC<Props> = ({scramble, alg, className, maskType, maskSlot, maskRotation}) => {
	const {t} = useTranslation();
	const containerRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<TwistyPlayer | null>(null);
	const appliedRef = useRef(0);
	const maskRef = useRef<any>(null); // last calculated mask — reapplied after setupAlg reset

	const [ready, setReady] = useState(false);
	const [moveIdx, setMoveIdx] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);

	const moves = useMemo(() => (alg.trim() ? alg.trim().split(/\s+/) : []), [alg]);
	const total = moves.length;

	// Player set up once (puzzle always 3x3x3)
	useEffect(() => {
		if (typeof window === 'undefined' || !containerRef.current) return;
		const player = new TwistyPlayer({
			puzzle: '3x3x3',
			visualization: '3D',
			alg: '',
			experimentalSetupAlg: scramble,
			background: 'none',
			controlPanel: 'none',
			hintFacelets: 'none',
			backView: 'none',
			experimentalDragInput: 'auto',
			tempoScale: 4,
		} as ConstructorParameters<typeof TwistyPlayer>[0]);
		containerRef.current.innerHTML = '';
		containerRef.current.appendChild(player);
		player.style.width = '100%';
		player.style.height = '100%';
		playerRef.current = player;
		appliedRef.current = 0;
		setReady(true);
		return () => {
			if (containerRef.current) containerRef.current.innerHTML = '';
			playerRef.current = null;
			setReady(false);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sticker mask — only parts relevant to algorithm in color, rest gray.
	// Recalculated when type/slot/rotation change (rotation-aware, cached).
	useEffect(() => {
		if (!ready || !playerRef.current || !maskType) return;
		let cancelled = false;
		getEfficiencyMask(maskType, maskSlot, maskRotation || '')
			.then((mask) => {
				maskRef.current = mask;
				const p = playerRef.current;
				if (cancelled || !p) return;
				try {
					if (mask) (p as any).experimentalStickeringMaskOrbits = mask;
					else (p as any).experimentalStickering = 'full';
				} catch {
					// stickering not supported — stays full color
				}
			})
			.catch(() => {
				// mask calculation rejected — stays full color
			});
		return () => {
			cancelled = true;
		};
	}, [maskType, maskSlot, maskRotation, ready]);

	// When scramble or alg changes: return to setup, reset move
	useEffect(() => {
		const p = playerRef.current;
		setMoveIdx(0);
		setIsPlaying(false);
		appliedRef.current = 0;
		if (!p) return;
		try {
			p.alg = '';
			(p as TwistyPlayer & {experimentalSetupAlg: string}).experimentalSetupAlg = scramble;
			// setupAlg change may reset stickering → reapply mask (don't lose on next())
			if (maskRef.current) (p as any).experimentalStickeringMaskOrbits = maskRef.current;
		} catch {
			// cubing notation parse failed
		}
	}, [scramble, alg]);

	// Sync TwistyPlayer when moveIdx changes
	useEffect(() => {
		if (!ready || !playerRef.current) return;
		const p = playerRef.current;
		const applied = appliedRef.current;
		if (moveIdx === applied) return;
		const target = Math.max(0, Math.min(moveIdx, total));
		try {
			if (target > applied) {
				// Forward — smooth animation
				for (let i = applied; i < target; i++) {
					(p as any).experimentalAddMove(moves[i], {cancel: false});
				}
			} else {
				// Backward — reset + apply 0..target (instant)
				p.alg = '';
				(p as TwistyPlayer & {experimentalSetupAlg: string}).experimentalSetupAlg = scramble;
				for (let i = 0; i < target; i++) {
					(p as any).experimentalAddMove(moves[i], {cancel: false});
				}
			}
			appliedRef.current = target;
		} catch {
			// notation error — silently skip
		}
	}, [moveIdx, moves, ready, scramble, total]);

	// Playback — advances currentMoveIdx
	useEffect(() => {
		if (!isPlaying || !ready) return;
		if (moveIdx >= total) {
			setIsPlaying(false);
			return;
		}
		const tid = setTimeout(() => setMoveIdx((i) => i + 1), 520 / speed);
		return () => clearTimeout(tid);
	}, [isPlaying, moveIdx, total, speed, ready]);

	const onPlayPause = useCallback(() => {
		if (moveIdx >= total) setMoveIdx(0);
		setIsPlaying((p) => !p);
	}, [moveIdx, total]);

	const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setIsPlaying(false);
		setMoveIdx(Number(e.target.value));
	}, []);

	const onReset = useCallback(() => {
		setIsPlaying(false);
		setMoveIdx(0);
	}, []);

	const shown = Math.min(moveIdx, total);

	return (
		<div className={[b(), className].filter(Boolean).join(' ')}>
			<div className={b('cube')} ref={containerRef} />
			{total > 0 && (
				<div className={b('controls')}>
					<input
						type="range"
						min={0}
						max={total}
						value={shown}
						onChange={onSeek}
						className={b('seek')}
						aria-label={t('trainer.efficiency.player_seek', {defaultValue: 'Seek'})}
						style={{['--pct' as any]: `${total > 0 ? (shown / total) * 100 : 0}%`}}
					/>
					<div className={b('row')}>
						<button
							type="button"
							className={b('btn', {primary: true})}
							onClick={onPlayPause}
							aria-label={isPlaying ? t('trainer.efficiency.player_pause', {defaultValue: 'Pause'}) : t('trainer.efficiency.player_play', {defaultValue: 'Play'})}
						>
							{isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
						</button>
						<button
							type="button"
							className={b('btn')}
							onClick={onReset}
							aria-label={t('trainer.efficiency.player_reset', {defaultValue: 'Restart'})}
						>
							<ArrowCounterClockwise size={18} weight="bold" />
						</button>
						<div className={b('count')}>
							{shown}<span className={b('count-sep')}>/</span>{total}
						</div>
						<div className={b('speeds')}>
							{SPEEDS.map((s) => (
								<button
									key={s}
									type="button"
									className={b('speed', {active: s === speed})}
									onClick={() => setSpeed(s)}
								>
									{s}x
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SolutionPlayer;
