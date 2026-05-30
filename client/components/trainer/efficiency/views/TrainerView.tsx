/**
 * TrainerView — efficiency core flow. Single-screen 2-column (no scroll):
 *  top: compact control bar (type + rotation/slot/length dropdown)
 *  algorithm (scramble) full-width bar
 *  left: single 3D cube (SolutionPlayer) + Back/Next · right: Show / solution panel
 */
import React, {Suspense, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import RotationPicker from '../components/RotationPicker';
import TargetLengthPicker from '../components/TargetLengthPicker';
import XCrossSlotPicker from '../components/XCrossSlotPicker';
import SolutionList from '../components/SolutionList';
import {useEfficiencyContext} from '../EfficiencyContext';
import {useEfficiencyScramble} from '../hooks/useEfficiencyScramble';
import {selectSolution, sortSolutions} from '../../../../util/trainer/efficiency/solution_select';
import {EO_AXES} from '../../../../util/trainer/efficiency/constants';

const SolutionPlayer = React.lazy(() => import('../components/SolutionPlayer'));

const b = block('trainer-efficiency');

export default function TrainerView() {
	const {t} = useTranslation();
	const {state, setEoAxis, setTargetLength, setXCrossSlot, setRotation, goBack, reveal} = useEfficiencyContext();
	const {next} = useEfficiencyScramble();
	const {session, settings} = state;

	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);

	useEffect(() => {
		next();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session.type, session.targetLength, session.xcrossSlot, session.rotation]);

	const selected = useMemo(
		() => selectSolution(session.results, session.type, session.eoAxis),
		[session.results, session.type, session.eoAxis]
	);
	const alternatives = useMemo(
		() => (settings.showAllSolutions ? sortSolutions(session.results) : []),
		[settings.showAllSolutions, session.results]
	);
	// Alternatif (secili-disi) cozumler — alt-panel'i kosullu render icin (mobilde kup ALTINDA).
	const others = useMemo(
		() => (selected && selected.solution.length > 0 ? alternatives.filter((r) => r.face !== selected.face) : []),
		[alternatives, selected]
	);
	// Rotation included in setup (cube starts at correct angle), player ONLY plays solution moves
	// → seek/counter (X/total) matches SolutionList moveCount.
	const setupAlg = [session.scramble, selected?.rotation].filter(Boolean).join(' ');
	const solutionAlg = selected ? selected.solution.join(' ') : '';

	if (!hydrated) {
		return <div className={b('skeleton')} />;
	}

	return (
		<div className={b('trainer')}>
			{/* Compact control bar (type picker header'a tasindi) */}
			<div className={b('controls')}>
				<RotationPicker value={session.rotation} onChange={setRotation} />
				{session.type === 'eocross' && (
					<div className={b('segment')} role="tablist" aria-label={t('trainer.efficiency.eo_axis_label', {defaultValue: 'EO axis'})}>
						{EO_AXES.map((axis) => (
							<button
								key={axis}
								type="button"
								role="tab"
								aria-selected={session.eoAxis === axis}
								className={b('segment-btn', {active: session.eoAxis === axis})}
								onClick={() => setEoAxis(axis)}
							>
								{t(axis === 'LR' ? 'trainer.efficiency.eo_axis_lr' : 'trainer.efficiency.eo_axis_fb', {defaultValue: axis})}
							</button>
						))}
					</div>
				)}
				{session.type === 'xcross' && (
					<XCrossSlotPicker value={session.xcrossSlot} onChange={setXCrossSlot} />
				)}
				<TargetLengthPicker type={session.type} value={session.targetLength} onChange={setTargetLength} />
			</div>

			{/* Algorithm (scramble) — large in center, Back/Next on sides */}
			{session.scramble && (
				<div className={b('scramble-bar')}>
					<Button
						primary
						noMargin
						textColor="#fff"
						className={b('scramble-nav')}
						text={t('trainer.efficiency.back', {defaultValue: 'Back'})}
						onClick={goBack}
					/>
					<span className={b('scramble-text')}>{session.scramble}</span>
					<Button
						primary
						noMargin
						textColor="#fff"
						className={b('scramble-nav')}
						text={t('trainer.efficiency.next', {defaultValue: 'Next'})}
						onClick={next}
					/>
				</div>
			)}

			{!session.scramble && session.loading && <div className={b('skeleton')} />}

			{session.scramble && (
				<div className={b('stage', {loading: session.loading})}>
					{/* PRIMARY — Show button OR optimal solution (mobil: küpün ÜSTÜnde) */}
					<div className={b('panel', {revealed: session.revealed})}>
						<div className={b('panel-body')}>
							{!session.revealed ? (
								<Button
									primary
									large
									fullWidth
									textColor="#fff"
									className={b('reveal-btn')}
									text={t('trainer.efficiency.reveal', {defaultValue: 'Show solution'})}
									onClick={reveal}
								/>
							) : (
								<SolutionList selected={selected} alternatives={alternatives} section="primary" />
							)}
						</div>
					</div>

					{/* CUBE — mobilde optimal ile alternatifler ARASINDA */}
					<div className={b('cube-col')}>
						<Suspense fallback={<div className={b('skeleton')} />}>
							<SolutionPlayer
								scramble={setupAlg}
								alg={session.revealed ? solutionAlg : ''}
								className={b('player')}
								maskType={session.type}
								maskSlot={session.xcrossSlot}
								maskRotation={session.rotation}
							/>
						</Suspense>
					</div>

					{/* ALTERNATIVES — mobilde küpün ALTINDA, masaüstünde sağ-alt */}
					{session.revealed && others.length > 0 && (
						<div className={b('alt-panel')}>
							<SolutionList selected={selected} alternatives={alternatives} section="alternatives" />
						</div>
					)}
				</div>
			)}
		</div>
	);
}
