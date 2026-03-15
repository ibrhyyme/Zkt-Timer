import React, { useContext, useRef, useState, useEffect, useMemo } from 'react';
import { Check } from 'phosphor-react';
import Button from '../../../common/button/Button';
import './Manual.scss';
import { convertTimeStringToSeconds, getTimeString } from '../../../../util/time';
import { TimerContext } from '../../Timer';
import block from '../../../../styles/bem';
import { resetScramble } from '../../helpers/scramble';
import { saveSolve } from '../../helpers/save';
import StartInstructions from '../start_instructions/StartInstructions';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useElementListener } from '../../../../util/hooks/useListener';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../../db/settings/update';
import SolveDiff from '../SolveDiff';
import Scramble from '../../../modules/scramble/ScrambleVisual';
import { getStatsBlockValueFromFilter } from '../../../modules/quick_stats/util';
import { useSolveDb } from '../../../../util/hooks/useSolveDb';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';

const b = block('manual-time-entry');

export default function Manual() {
	const manualInput = useRef<HTMLInputElement>(null);

	const [manualTime, setManualTime] = useState('');
	const [error, setError] = useState(false);

	const context = useContext(TimerContext);
	const { scramble, originalScramble, disabled, hideTime, cubeType, solvesFilter } = context;

	const mobileMode = useGeneral('mobile_mode');
	let timerTimeSize = useSettings('timer_time_size');
	if (mobileMode) {
		timerTimeSize *= MOBILE_FONT_SIZE_MULTIPLIER;
	}
	const timerFontFamily = useSettings('timer_font_family');
	const requirePeriodInManualTimeEntry = useSettings('require_period_in_manual_time_entry');
	const sessionId = useSettings('session_id');

	useSolveDb();

	const compactStats = useMemo(() => {
		if (!mobileMode) return null;

		const statBlocks: { label: string; block: StatsModuleBlock }[] = [
			{ label: 'AO5', block: { statType: 'average', sortBy: 'current', averageCount: 5, session: true, colorName: 'primary' } },
			{ label: 'AO12', block: { statType: 'average', sortBy: 'current', averageCount: 12, session: true, colorName: 'primary' } },
			{ label: 'AO100', block: { statType: 'average', sortBy: 'current', averageCount: 100, session: true, colorName: 'primary' } },
			{ label: 'Mean', block: { statType: 'average', sortBy: 'current', averageCount: null, session: true, colorName: 'primary' } },
		];

		return statBlocks.map(({ label, block }) => {
			const stat = getStatsBlockValueFromFilter(block, solvesFilter, sessionId);
			return { label, time: getTimeString(stat?.time) };
		});
	}, [mobileMode, solvesFilter, sessionId]);

	useEffect(() => {
		if (!disabled && manualInput.current) {
			manualInput.current.focus();
		}
	}, [disabled]);

	useElementListener(manualInput.current, 'keydown', addManualTime, [manualInput?.current, manualTime]);

	function submitTime() {
		if (error) return;

		try {
			const seconds = convertTimeStringToSeconds(manualTime, requirePeriodInManualTimeEntry);
			const endedAt = new Date().getTime();
			const startedAt = endedAt - seconds.timeMilli;

			saveSolve(context, seconds.timeMilli, scramble, startedAt, endedAt, seconds.dnf, seconds.plusTwo);
			resetScramble(context);

			setManualTime('');
			setError(false);

			// Odağı koru - React state güncellemelerinin tamamlanmasını bekle
			requestAnimationFrame(() => {
				manualInput.current?.focus();
			});
		} catch (err) {
			// Do nothing
		}
	}

	function addManualTime(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitTime();
		}
	}

	function handleManualEntryChange(e) {
		const val = e.target.value;

		let manualEntryErr = false;
		let time;
		try {
			time = convertTimeStringToSeconds(val, requirePeriodInManualTimeEntry);

			if (time.time <= 0 && !time.dnf) {
				manualEntryErr = true;
			}
		} catch (err) {
			manualEntryErr = true;
		}

		setManualTime(val);
		setError(manualEntryErr);
	}

	let input = (
		<input
			ref={manualInput}
			autoFocus
			onBlur={(e) => {
				const target = e.target;
				if (!disabled) {
					const refocus = () => {
						if (document.activeElement === document.body || !document.activeElement) {
							target.focus();
						}
					};
					requestAnimationFrame(refocus);
					setTimeout(refocus, 50);
				}
			}}
			disabled={disabled}
			style={{
				fontSize: timerTimeSize + 'px',
				fontFamily: timerFontFamily,
			}}
			onChange={handleManualEntryChange}
			value={manualTime}
			inputMode="decimal"
			className={b({
				error: error && !!manualTime,
			})}
		/>
	);

	if (hideTime) {
		input = null;
	}

	return (
		<div className={b('wrapper')}>
			<div className={b('input-container')}>
				{input}
				{!hideTime && (
					<Button
						onClick={submitTime}
						icon={<Check weight="bold" />}
						className={b('submit-btn')}
						title="Onayla"
					/>
				)}
			</div>

			{!hideTime && (
				<StartInstructions>Zamanı manuel olarak girin.</StartInstructions>
			)}
			<SolveDiff />

			{/* Mobilde: Scramble visual + kompakt AO stats */}
			{mobileMode && !hideTime && (
				<div className={b('context-row')}>
					<div className={b('scramble-compact')}>
						<Scramble cubeType={cubeType} scramble={originalScramble || scramble} width="100px" />
					</div>
					<div className={b('stats-compact')}>
						{compactStats?.map(({ label, time }) => (
							<div key={label} className={b('stat-item')}>
								<span className={b('stat-label')}>{label}</span>
								<span className={b('stat-value')}>{time}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
