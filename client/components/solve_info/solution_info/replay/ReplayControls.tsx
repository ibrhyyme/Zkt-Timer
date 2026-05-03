import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward } from 'phosphor-react';
import block from '../../../../styles/bem';

const b = block('replay-controls');

interface Props {
	isPlaying: boolean;
	currentMoveIdx: number;
	totalMoves: number;
	elapsedMs: number;
	totalMs: number;
	currentStepName: string;
	speed: number;
	onPlayPause: () => void;
	onSeek: (idx: number) => void;
	onPrevStep: () => void;
	onNextStep: () => void;
	onSpeedChange: (s: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2];

function formatSeconds(ms: number): string {
	return (ms / 1000).toFixed(2) + 's';
}

export default function ReplayControls(props: Props) {
	const { t } = useTranslation();
	const {
		isPlaying,
		currentMoveIdx,
		totalMoves,
		elapsedMs,
		totalMs,
		currentStepName,
		speed,
		onPlayPause,
		onSeek,
		onPrevStep,
		onNextStep,
		onSpeedChange,
	} = props;

	const progress = totalMoves > 0 ? (currentMoveIdx / totalMoves) * 100 : 0;

	function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
		const pct = Number(e.target.value) / 100;
		// Clamp: 100% slider'da Math.round(1.0 * totalMoves) bazi tarayicilarda
		// floating drift ile totalMoves+1 ureteibilir. Defansif min.
		onSeek(Math.min(Math.max(0, Math.round(pct * totalMoves)), totalMoves));
	}

	return (
		<div className={b()}>
			<div className={b('seek-row')}>
				<input
					type="range"
					min={0}
					max={100}
					value={progress}
					onChange={handleSliderChange}
					className={b('seek')}
					aria-label={t('solve_info.replay.seek')}
				/>
			</div>

			<div className={b('info-row')}>
				<div className={b('phase')}>{currentStepName}</div>
				<div className={b('time')}>
					{formatSeconds(elapsedMs)} / {formatSeconds(totalMs)}
				</div>
				<div className={b('move-count')}>
					{currentMoveIdx} / {totalMoves}
				</div>
			</div>

			<div className={b('buttons-row')}>
				<button
					className={b('btn')}
					onClick={onPrevStep}
					aria-label={t('solve_info.replay.prev_step')}
					title={t('solve_info.replay.prev_step')}
				>
					<Rewind size={20} weight="fill" />
				</button>
				<button
					className={b('btn')}
					onClick={() => onSeek(Math.max(0, currentMoveIdx - 1))}
					aria-label={t('solve_info.replay.prev_move')}
					title={t('solve_info.replay.prev_move')}
				>
					<SkipBack size={18} weight="fill" />
				</button>
				<button
					className={b('btn', { primary: true })}
					onClick={onPlayPause}
					aria-label={isPlaying ? t('solve_info.replay.pause') : t('solve_info.replay.play')}
				>
					{isPlaying ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
				</button>
				<button
					className={b('btn')}
					onClick={() => onSeek(Math.min(totalMoves, currentMoveIdx + 1))}
					aria-label={t('solve_info.replay.next_move')}
					title={t('solve_info.replay.next_move')}
				>
					<SkipForward size={18} weight="fill" />
				</button>
				<button
					className={b('btn')}
					onClick={onNextStep}
					aria-label={t('solve_info.replay.next_step')}
					title={t('solve_info.replay.next_step')}
				>
					<FastForward size={20} weight="fill" />
				</button>
			</div>

			<div className={b('speed-row')}>
				<span className={b('speed-label')}>{t('solve_info.replay.speed')}</span>
				{SPEED_OPTIONS.map((s) => (
					<button
						key={s}
						className={b('speed-btn', { active: s === speed })}
						onClick={() => onSpeedChange(s)}
					>
						{s}x
					</button>
				))}
			</div>
		</div>
	);
}
