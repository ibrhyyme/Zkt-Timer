import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SolutionInfo.scss';
import CopyText from '../../common/copy_text/CopyText';
import { getSolveStepsWithoutParents } from '../util/solution';
import { getCrossRotation, transformMoves } from '../util/cross_rotation';
import { getStepDisplayName } from '../util/consts';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';
import ReplayPlayer from './replay/ReplayPlayer';
import { useFlattenedMoves } from './replay/useFlattenedMoves';
import { buildSmartSolveCopyText, buildSmartSolveDetailedCopyText } from './solution_copy_text';

const b = block('solve-info-solution-info');

interface Props {
	solve: Solve;
}

export default function SolutionInfo(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();
	const steps = getSolveStepsWithoutParents(solve);

	// [SOLUTION_INFO] window.__SMART_DEBUG__ ile aktif. steps array sirasi (render_idx) vs step_index degerleri.
	// Eger render_idx=0'da step_index=5 cikiyorsa client'ta siralama atlanmis demek; tutarli ise sorun backend'den gelmis.
	React.useEffect(() => {
		if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
		const summary = steps.map((s, i) => ({
			render_idx: i,
			step_index: (s as any).step_index,
			step_name: s.step_name,
			parent_name: s.parent_name,
			turns_head: (s.turns || '').slice(0, 30)
		}));
		console.log('%c[SOLUTION_INFO]', 'color:#00BCD4;font-weight:bold',
			`solve=${solve.id} | steps=${steps.length}`, summary);
	}, [solve.id, steps.length]);

	const crossStep = steps.find((s) => s.step_name === 'cross');
	const rotation = useMemo(
		() => (crossStep ? getCrossRotation(solve.scramble, crossStep.turns) : ''),
		[solve.scramble, crossStep?.turns]
	);

	// Replay state — SolutionInfo tutuyor, ReplayPlayer'a controlled prop olarak geciyor.
	// Boylece tablo da aktif hamleyi highlight edebilir + step row'a tiklanca seek edebilir.
	// currentMoveIdx FLAT QUARTER index'i (U3 → 3 ayri quarter). Token highlight icin
	// tokenStartIndices/tokenQuarterCounts kullaniyoruz.
	const [currentMoveIdx, setCurrentMoveIdx] = useState(0);
	const { stepStartIndices, tokenStartIndices, tokenQuarterCounts } = useFlattenedMoves(steps);

	// Both clipboard texts come from the steps and rotation the table below renders, so what
	// is copied is what is on screen (see solution_copy_text.ts).
	const copyText = buildSmartSolveCopyText(t, solve);
	const detailedCopyText = buildSmartSolveDetailedCopyText(t, solve, steps, rotation);

	return (
		<div className={b()}>
			<div className={b('column', { table: true })}>
				<table className={b('table')}>
					<thead>
						<tr>
							<th>{t('solve_info.step')}</th>
							<th>
								{t('solve_info.turns')}
								<CopyText
									text={copyText}
									buttonProps={{ text: '' }}
								/>
								<CopyText
									text={detailedCopyText}
									buttonProps={{ text: t('solve_info.copy_detailed') }}
									toastifyMessageOnCopy={t('solve_info.copied_detailed')}
								/>
							</th>
						</tr>
					</thead>
					<tbody>
						{steps.map((step, sIdx) => {
							const isCross = step.step_name === 'cross';
							const stepStartGlobal = stepStartIndices[sIdx] ?? 0;
							// Step toplam quarter sayisi = sIdx step'inin tum tokenlarinin quarter toplam'i
							const stepQuarterCount = (tokenQuarterCounts[sIdx] || []).reduce((s, n) => s + n, 0);
							// Step row aktif mi? currentMoveIdx = "siradaki uygulanacak quarter" pozisyonu.
							const isActiveStep = currentMoveIdx >= stepStartGlobal &&
								currentMoveIdx < stepStartGlobal + stepQuarterCount;

							return (
								<tr
									key={step.step_name}
									className={b('row', { active: isActiveStep, clickable: true })}
									onClick={() => setCurrentMoveIdx(stepStartGlobal)}
								>
									<td className={b('step-name')}>{getStepDisplayName(step)}</td>
									<td className={b('step-turns')}>
										{isCross && rotation && (
											<span className={b('rotation')}>{rotation}</span>
										)}
										{((step.turns || '').split(' ').filter(Boolean) as string[]).map((rawMove: string, mIdx: number) => {
											// Bu token hangi flat-quarter aralikta? U3 → 3 quarter'i kapsar.
											const tokenStart = (tokenStartIndices[sIdx] || [])[mIdx] ?? (stepStartGlobal + mIdx);
											const tokenQuarters = (tokenQuarterCounts[sIdx] || [])[mIdx] ?? 1;
											// currentMoveIdx-1 = son uygulanan quarter index'i. Token'in range'inde mi?
											const lastApplied = currentMoveIdx - 1;
											const isCurrent = lastApplied >= tokenStart && lastApplied < tokenStart + tokenQuarters;
											// BLE CORE hamlesini kullanicinin pozisyonel perspectifine cevir.
											// Ornek: z2 cross → BLE "R" → kullanici icin "L" (cube'in fiziksel sol yuzu).
											const displayMove = rotation
												? transformMoves(rawMove, rotation)
												: rawMove;
											return (
												<span
													key={`${sIdx}-${mIdx}`}
													className={b('move', { current: isCurrent })}
													onClick={(e) => {
														e.stopPropagation();
														setCurrentMoveIdx(tokenStart + tokenQuarters);
													}}
												>
													{displayMove}
												</span>
											);
										})}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<div className={b('column', { replay: true })}>
				<ReplayPlayer
					solve={solve}
					steps={steps}
					rotation={rotation}
					currentMoveIdx={currentMoveIdx}
					onMoveIdxChange={setCurrentMoveIdx}
				/>
			</div>
		</div>
	);
}
